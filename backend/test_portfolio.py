import os
from datetime import date, timedelta
import tempfile
import unittest
from unittest.mock import patch

from portfolio import analyze, group_clients, month_shift
from portfolio_actions import save_action, with_actions

TODAY = date(2026, 9, 28)


def client(pid, document='', alias='', business=None):
    return dict(id=pid, codigo=str(pid), nome=f'Empresa {pid}', documento=document, groupName=alias, businessGroup=business)


def sale(pid, day, value=1000, category='pecas'):
    return dict(person=pid, day=day.isoformat(), value=value, category=category)


def signals(snapshot):
    return {a['kind'] for g in snapshot['groups'] for a in g['alerts']}


class PortfolioTests(unittest.TestCase):
    def test_transitive_group_and_cpf_isolation(self):
        clients = [client(1, '12.345.678/0001-00'), client(2, '12.345.678/0002-00', 'Árvore'),
                   client(3, alias='ARVORE', business=4), client(4),
                   client(5, '12345678901'), client(6, '12345678902'), client(7, business=0), client(8, business=0)]
        groups = group_clients(clients)
        self.assertEqual([p['id'] for p in groups[1]], [1, 2, 3, 4])
        self.assertEqual(len(groups), 5)

    def test_another_branch_sale_or_order_prevents_proposal_alert(self):
        clients = [client(1, alias='Grupo'), client(2, alias='Grupo')]
        proposals = [dict(person=1, value=10000, count=2, recentCount=1)]
        self.assertIn('proposals', signals(analyze(clients, [], [], proposals, TODAY)))
        self.assertNotIn('proposals', signals(analyze(clients, [sale(2, TODAY)], [], proposals, TODAY)))
        orders = [dict(person=2, value=0, count=0, lastOrder=TODAY.isoformat())]
        self.assertNotIn('proposals', signals(analyze(clients, [], orders, proposals, TODAY)))
        orders[0].update(value=1000, count=1, lastOrder='2025-01-01')
        self.assertNotIn('proposals', signals(analyze(clients, [], orders, proposals, TODAY)))

    def test_decline_excludes_incomplete_month_and_respects_seasonality(self):
        sales = [sale(1, month_shift(TODAY, -i), 10000) for i in range(4, 13)]
        sales += [sale(1, month_shift(TODAY, -i), 2000) for i in (1, 2, 3)]
        sales += [sale(1, TODAY, 2000000)]
        result = analyze([client(1)], sales, [], [], TODAY)
        self.assertIn('decline', signals(result))
        self.assertEqual(result['groups'][0]['recentRevenue'], 6000)
        # Same seasonal dip last year: suppress the decline claim.
        sales += [sale(1, month_shift(TODAY, -i), 2000) for i in (13, 14, 15)]
        self.assertNotIn('decline', signals(analyze([client(1)], sales, [], [], TODAY)))

    def test_branch_migration_does_not_look_like_decline(self):
        clients = [client(1, alias='Grupo'), client(2, alias='Grupo')]
        sales = [sale(1 if i > 3 else 2, month_shift(TODAY, -i), 10000) for i in range(1, 13)]
        result = analyze(clients, sales, [], [], TODAY)
        self.assertNotIn('decline', signals(result))
        self.assertEqual(len(result['groups']), 1)

    def test_old_proposals_alone_do_not_fill_active_queue(self):
        proposals = [dict(person=1, value=10000, count=2, recentCount=0)]
        self.assertNotIn('proposals', signals(analyze([client(1)], [], [], proposals, TODAY)))

    def test_cadence_requires_history_and_honors_recent_orders(self):
        sales = [sale(1, TODAY-timedelta(days=i)) for i in (50, 60, 70, 80, 90)]
        self.assertIn('cadence', signals(analyze([client(1)], sales, [], [], TODAY)))
        self.assertNotIn('cadence', signals(analyze([client(1)], sales[:4], [], [], TODAY)))
        order = [dict(person=1, value=0, count=0, lastOrder=TODAY.isoformat())]
        self.assertNotIn('cadence', signals(analyze([client(1)], sales, order, [], TODAY)))

    def test_category_loss_requires_other_active_category(self):
        sales = [sale(1, month_shift(TODAY, -i), category='implementos') for i in (4, 5, 6)]
        self.assertNotIn('categories', signals(analyze([client(1)], sales, [], [], TODAY)))
        sales.append(sale(1, TODAY, category='pecas'))
        self.assertIn('categories', signals(analyze([client(1)], sales, [], [], TODAY)))

    def test_actions_persist_suppress_and_reopen_on_due_or_new_signal(self):
        with tempfile.TemporaryDirectory() as temp, patch.dict(os.environ, {'PULSO_PORTFOLIO_DB': os.path.join(temp, 'actions.db')}):
            snapshot = analyze([client(1)], [], [], [dict(person=1, value=1000, count=1, recentCount=1)], TODAY)
            group = snapshot['groups'][0]
            payload = dict(owner='Vendedor', due='2026-10-01', note='Retomar proposta', reason='Contato pendente')
            save_action(payload, group, TODAY)
            self.assertEqual(with_actions(snapshot, TODAY)['groups'][0]['status'], 'scheduled')
            self.assertEqual(with_actions(snapshot, date(2026, 10, 1))['groups'][0]['status'], 'attention')
            group['alerts'].append(dict(kind='decline'))
            self.assertTrue(with_actions(snapshot, TODAY)['groups'][0]['escalated'])
            group['alerts'] = []
            self.assertEqual(with_actions(snapshot, TODAY)['groups'][0]['status'], 'clear')
            self.assertEqual(with_actions(snapshot, date(2026, 10, 1))['groups'][0]['status'], 'review')
            with self.assertRaises(ValueError):
                save_action({**payload, 'due': '2026-01-01'}, group, TODAY)

    def test_inactivity_survives_zero_quarters_and_rolling_year(self):
        sales = [sale(1, date(2025, 5, 1), 197095)]
        group = analyze([client(1)], sales, [], [], TODAY)['groups'][0]
        self.assertEqual(group['recentRevenue'], 0)
        self.assertEqual(group['priorRevenue'], 0)
        self.assertEqual(group['annualRevenue'], 0)
        self.assertEqual(group['priority'], 'Alta')
        self.assertEqual(group['financialBonus'], 10)
        self.assertEqual([a['kind'] for a in group['alerts']], ['inactive'])

    def test_inactivity_respects_other_branches_and_order_coverage(self):
        clients = [client(1, alias='Grupo'), client(2, alias='Grupo')]
        sales = [sale(1, TODAY-timedelta(days=200), 150000)]
        for orders in ([dict(person=2, value=0, count=0, lastOrder=TODAY.isoformat())],
                       [dict(person=2, value=100, count=1, lastOrder='2025-01-01')]):
            self.assertNotIn('inactive', signals(analyze(clients, sales, orders, [], TODAY)))
        self.assertNotIn('inactive', signals(analyze(clients, sales+[sale(2, TODAY)], [], [], TODAY)))

    def test_money_does_not_create_alert_for_active_customer_or_use_proposals(self):
        group = analyze([client(1)], [sale(1, TODAY, 600000)], [], [], TODAY)['groups'][0]
        self.assertEqual(group['score'], 0)
        group = analyze([client(1)], [], [], [dict(person=1, count=1, value=9000000, recentCount=1)], TODAY)['groups'][0]
        self.assertEqual(group['priority'], 'Média')
        self.assertEqual(group['financialBonus'], 0)

    def test_inactivity_and_cadence_do_not_double_count_same_gap(self):
        sales = [sale(1, TODAY-timedelta(days=i), 1000) for i in (190, 200, 210, 220, 230)]
        group = analyze([client(1)], sales, [], [], TODAY)['groups'][0]
        self.assertEqual({a['kind'] for a in group['alerts']}, {'inactive', 'cadence'})
        self.assertEqual(group['score'], max(a['score'] for a in group['alerts']))


if __name__ == '__main__':
    unittest.main()
