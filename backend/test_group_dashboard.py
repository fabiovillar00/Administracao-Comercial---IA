from datetime import date
import unittest
from unittest.mock import MagicMock
from group_dashboard import analyze, options, GroupDashboard

TODAY = date(2026,10,6)
def sale(doc, product, day, value=100, quantity=2, order=1):
    return dict(documentId=doc,productId=product,day=day,value=value,net=value,quantity=quantity,orderId=order,number=str(doc),codigo=str(product),nome='Produto')
def run(sales=(),orders=(),discounts=()):
    return analyze(sales,orders,[],[],[],date(2026,1,1),TODAY,3,TODAY,discounts)

class GroupDashboardTests(unittest.TestCase):
    def test_period_and_validation(self):
        p=options({'personId':['1']},TODAY)
        self.assertEqual(p['start'],date(2025,10,7))
        for extra in ({'unitId':['-1']},{'sellerId':['-1']},{'months':['13']},{'category':['invalid']},{'end':['2027-01-01']},{'recentMonths':['0']}):
            with self.subTest(extra=extra),self.assertRaises(ValueError): options({'personId':['1'],**extra},TODAY)

    def test_invoice_aggregation_and_months_without_sales(self):
        r=run([sale(1,10,'2026-01-01'),sale(1,20,'2026-01-01',200),sale(2,10,'2026-03-01',50),sale(3,10,'2025-12-31',999)])
        self.assertEqual(r['cards']['revenue'],350)
        self.assertEqual(r['cards']['invoiceCount'],2)
        self.assertEqual(r['cards']['averageTicket'],175)
        self.assertEqual(r['monthly'][1],{'month':'2026-02','value':0})
        self.assertEqual(r['products'][0]['revenue'],200)
        self.assertEqual(r['behavior']['maxGap'],59)

    def test_new_and_abandoned_require_history_and_no_recent_purchase(self):
        history=[sale(i,10,d) for i,d in enumerate(['2026-01-01','2026-03-01','2026-06-01'],1)]
        r=run(history+[sale(4,20,'2026-08-01')])
        self.assertEqual([p['id'] for p in r['abandoned']],[10])
        self.assertEqual([p['id'] for p in r['newProducts']],[20])
        self.assertFalse(run(history+[sale(5,10,'2026-07-07')])['abandoned'])
        self.assertFalse(run(history[:2])['abandoned'])

    def test_discounts_weighted_and_history_distinct_from_period(self):
        ds=[dict(id=i,productId=10,day=d,discount=p,quantity=q,codigo='10',nome='X',number=i) for i,(d,p,q) in enumerate([('2026-01-01',10,1),('2026-02-01',30,3),('2025-01-01',50,1)])]
        r=run([sale(1,10,'2026-01-01')],discounts=ds)
        self.assertEqual(r['products'][0]['averageDiscount'],25)
        self.assertEqual(r['cards']['maxDiscount'],30)
        self.assertEqual(r['behavior']['greatestDiscount']['discount'],50)
        self.assertIsNone(run()['cards']['maxDiscount'])

    def test_members_reuse_existing_portfolio_grouping(self):
        clients=[dict(id=7,nome='A',groupName='Grupo',businessGroup=None,documento=''),
                 dict(id=8,nome='B',groupName='Grupo',businessGroup=None,documento='12345678000190'),
                 dict(id=9,nome='C',groupName='',businessGroup=None,documento='12345678000271'),
                 dict(id=10,nome='Individual',groupName='',businessGroup=None,documento='')]
        cur=MagicMock();s=GroupDashboard(None,MagicMock(return_value=clients))
        self.assertEqual({p['id'] for p in s.members(cur,7)[1]},{7,8,9})
        self.assertEqual([p['id'] for p in s.members(cur,10)[1]],[10])

    def test_unit_outside_group_rejected(self):
        connect=MagicMock();s=GroupDashboard(connect,MagicMock())
        s.members=MagicMock(return_value=({},[dict(id=7)]))
        with self.assertRaises(ValueError): s.get({'personId':['7'],'unitId':['8']})

    def test_queries_bind_scope_without_unused_financial_access(self):
        connect=MagicMock(); rows=MagicMock(return_value=[])
        s=GroupDashboard(connect,rows)
        member=dict(id=7,codigo='7',nome='Cliente',documento='',groupId=None,validGroup=None)
        s.members=MagicMock(return_value=(member,[member]))
        s.get({'personId':['7'],'sellerId':['99'],'category':['implementos']})
        calls=connect.return_value.__enter__.return_value.cursor.return_value.execute.call_args_list
        for call in calls[:5]:
            self.assertIn("FAM.FAMILIA LIKE '1.%'",call.args[0])
        self.assertIn('IT.value AS value',calls[1].args[0])
        self.assertIn('IT.productCount>0',calls[1].args[0])
        self.assertIn('IT.itemCount>0',calls[3].args[0])
        self.assertEqual(len(calls),5)
        self.assertTrue(all('FN_PARCELAS' not in c.args[0] for c in calls))
        self.assertEqual(calls[-1].args[1],7)
        self.assertEqual(calls[-1].args[-2],99)
        self.assertIn('A.STATUSPROPOSTA = 1',calls[3].args[0])

if __name__=='__main__': unittest.main()
