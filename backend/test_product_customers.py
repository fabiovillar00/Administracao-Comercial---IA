import unittest
from unittest.mock import MagicMock, patch

from server import product_report


class ProductCustomersTests(unittest.TestCase):
    @patch('server.rows_as_dict')
    @patch('server.connection')
    def test_groups_customers_and_preserves_scope(self, connection, rows):
        cursor = MagicMock()
        connection.return_value.__enter__.return_value.cursor.return_value = cursor
        rows.side_effect = [
            [dict(codigoProduto='A', produto='Produto A', familia='F', quantidade=3),
             dict(codigoProduto='B', produto='Produto B', familia='F', quantidade=4)],
            [dict(codigoProduto=code, produto=f'Produto {code}', familia='F',
                  id=customer, codigo=str(customer), nome=f'Cliente {customer}',
                  documento='123', quantidade=quantity)
             for code, customer, quantity in [('A', 1, 1), ('A', 2, 2), ('B', 2, 4)]],
        ]
        products = product_report([1, 2], '2026-01-01', '2026-02-01', 'implementos')
        self.assertEqual([len(p['clientesDetalhes']) for p in products], [2, 1])
        for product in products:
            self.assertEqual(sum(c['quantidade'] for c in product['clientesDetalhes']), product['quantidade'])
        summary, details = cursor.execute.call_args_list
        self.assertEqual(details.args[1:], (*summary.args[1:], 'A', 'B'))
        self.assertIn("FAM.FAMILIA LIKE '1.%'", details.args[0])
        self.assertIn('PROD.CODIGOREFERENCIA IN (?,?)', details.args[0])

    @patch('server.rows_as_dict', return_value=[])
    @patch('server.connection')
    def test_empty_report_does_not_query_customers(self, connection, rows):
        self.assertEqual(product_report(None, '2026-01-01', '2026-02-01'), [])
        rows.assert_called_once()


if __name__ == '__main__':
    unittest.main()
