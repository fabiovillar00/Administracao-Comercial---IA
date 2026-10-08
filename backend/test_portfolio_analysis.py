from datetime import date
import unittest
from unittest.mock import MagicMock
from portfolio_analysis import options, consolidate, PortfolioAnalysis


def person(pid, alias='', business=None):
    return dict(id=pid, codigo=str(pid), nome=f'Cliente {pid}', documento='', groupName=alias, businessGroup=business)


class ReactivationTests(unittest.TestCase):
    def test_period_boundaries_and_past_year(self):
        current = options({'years': ['10'], 'baseYear': ['2026']}, date(2026, 10, 6))
        self.assertEqual((current['start'], current['cutoff'], current['end']), (date(2016, 1, 1), date(2026, 1, 1), date(2026, 10, 7)))
        past = options({'years': ['5'], 'baseYear': ['2024'], 'mode': ['both']}, date(2026, 10, 6))
        self.assertEqual((past['start'], past['cutoff'], past['end']), (date(2019, 1, 1), date(2023, 1, 1), date(2025, 1, 1)))

    def test_invalid_ranges_and_filters(self):
        for params in ({'years': ['0']}, {'years': ['51']}, {'baseYear': ['2027']}, {'category': ['sql']}, {'mode': ['bad']}, {'mode': ['both'], 'years': ['1']}):
            with self.subTest(params=params), self.assertRaises(ValueError):
                options(params, date(2026, 10, 6))

    def test_purchase_in_linked_branch_excludes_whole_group(self):
        clients = [person(1, 'Grupo'), person(2, 'Grupo'), person(3, business=2), person(4)]
        sales = [dict(person=1, historicalCount=2, historicalRevenue=100), dict(person=3, inactiveCount=1), dict(person=4, historicalCount=1, historicalRevenue=50)]
        groups = consolidate(clients, sales, [], [])
        self.assertEqual([g['id'] for g in groups], ['4'])

    def test_group_sums_include_branch_without_historical_purchase(self):
        clients = [person(1, 'Grupo'), person(2, 'Grupo'), person(3)]
        sales = [dict(person=1, historicalCount=1, historicalRevenue=100, lastSale='2023-01-01')]
        proposals = [dict(person=1, proposalCount=2, proposalValue=10), dict(person=2, proposalCount=3, proposalValue=20), dict(person=3, proposalCount=9, proposalValue=100)]
        groups = consolidate(clients, sales, proposals, [dict(person=2, lastOrder='2025-05-31')])
        self.assertEqual(len(groups), 1)
        self.assertEqual((groups[0]['proposalCount'], groups[0]['proposalValue'], groups[0]['lastOrder']), (5, 30, '2025-05-31'))
        self.assertEqual(sum(b['proposalValue'] for b in groups[0]['members']), groups[0]['proposalValue'])

    def test_attention_flag_uses_any_order_in_base_year_across_units(self):
        clients = [person(1, 'Grupo'), person(2, 'Grupo'), person(3)]
        sales = [dict(person=1, historicalCount=1), dict(person=3, historicalCount=1)]
        orders = [dict(person=2, lastOrder='2027-01-01', hasBaseYearOrder=1), dict(person=3, lastOrder='2025-01-01', hasBaseYearOrder=0)]
        groups = consolidate(clients, sales, [], orders)
        by_id = {g['id']: g for g in groups}
        self.assertTrue(by_id['1']['hasBaseYearOrder'])
        self.assertFalse(by_id['3']['hasBaseYearOrder'])
        self.assertTrue(next(b for b in by_id['1']['members'] if b['id']==2)['hasBaseYearOrder'])

    def test_detail_uses_same_status_category_and_bound_ids(self):
        connect, rows = MagicMock(), MagicMock(return_value=[])
        cursor = connect.return_value.__enter__.return_value.cursor.return_value
        service = PortfolioAnalysis(connect, rows)
        result = service.get({'action': ['products'], 'category': ['implementos'], 'proposalId': ['55'], 'personId': ['77']})
        sql, *params = cursor.execute.call_args.args
        self.assertIn('A.STATUSPROPOSTA = 1', sql)
        self.assertIn("FAM.FAMILIA LIKE '1.%'", sql)
        self.assertIn('NOT EXISTS', sql)
        self.assertEqual(params, [55, 77])
        self.assertEqual(result, {'items': []})

    def test_last_order_includes_closed_orders_and_matches_category(self):
        connect, rows = MagicMock(), MagicMock(return_value=[])
        service = PortfolioAnalysis(connect, rows)
        self.assertEqual(service.get({'action': ['lastOrder'], 'personId': ['77'], 'category': ['pecas']}), {'orders': []})
        sql, *params = connect.return_value.__enter__.return_value.cursor.return_value.execute.call_args.args
        self.assertIn('TOP (1)', sql)
        self.assertIn('OV.STATUS <> 5', sql)
        self.assertIn("FAM.FAMILIA LIKE '[2-8].%'", sql)
        self.assertIn('ORDER BY OV.DATAINCLUSAO DESC, OV.HANDLE DESC', sql)
        self.assertEqual(params, [77])

    def test_order_products_are_bound_to_order_and_unit(self):
        connect, rows = MagicMock(), MagicMock(return_value=[])
        service = PortfolioAnalysis(connect, rows)
        self.assertEqual(service.get({'action': ['orderProducts'], 'orderId': ['55'], 'personId': ['77'], 'category': ['implementos']}), {'items': []})
        sql, *params = connect.return_value.__enter__.return_value.cursor.return_value.execute.call_args.args
        self.assertIn('OV.HANDLE = ? AND OV.PESSOA = ?', sql)
        self.assertIn('OV.STATUS <> 5', sql)
        self.assertIn("FAM.FAMILIA LIKE '1.%'", sql)
        self.assertEqual(params, [55, 77])
        for invalid in ({'personId': ['0']}, {'personId': ['77'], 'orderId': ['0']}):
            with self.assertRaises(ValueError):
                service.get({'action': ['orderProducts'], **invalid})

    def test_summary_preserves_invoice_boundaries_and_category(self):
        connect, rows = MagicMock(), MagicMock(side_effect=[[], [], [], []])
        service = PortfolioAnalysis(connect, rows)
        service.get({'baseYear': ['2024'], 'years': ['5'], 'category': ['pecas']})
        calls = connect.return_value.__enter__.return_value.cursor.return_value.execute.call_args_list
        sql, *params = calls[1].args
        self.assertIn("FAM.FAMILIA LIKE '[2-8].%'", sql)
        self.assertEqual(params, [date(2024,1,1)] * 3 + [date(2019,1,1), date(2025,1,1)])
        self.assertIn('COUNT(DISTINCT A.HANDLE)', calls[2].args[0])
        self.assertIn('OV.STATUS <> 5', calls[3].args[0])
        self.assertIn('hasBaseYearOrder', calls[3].args[0])
        self.assertEqual(calls[3].args[1:], (date(2024,1,1), date(2025,1,1)))


if __name__ == '__main__':
    unittest.main()
