import unittest
from datetime import date, timedelta
from unittest.mock import patch
from server import interpret


class InterpretTests(unittest.TestCase):
    def test_relative_periods_with_and_without_client(self):
        for today in (date(2026, 9, 23), date(2026, 1, 1), date(2024, 3, 1)):
            month_start = today.replace(day=1)
            previous_month = (month_start - timedelta(days=1)).replace(day=1)
            next_month = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
            periods = {
                'hoje': (today, today + timedelta(days=1)),
                'ontem': (today - timedelta(days=1), today),
                'este mÊs': (month_start, next_month),
                'mês passado': (previous_month, month_start),
                'mês anterior': (previous_month, month_start),
                'mes anterior': (previous_month, month_start),
                'no mês passado': (previous_month, month_start),
                'ano passado': (date(today.year - 1, 1, 1), date(today.year, 1, 1)),
                'ano anterior': (date(today.year - 1, 1, 1), date(today.year, 1, 1)),
                'este ano': (date(today.year, 1, 1), date(today.year + 1, 1, 1)),
            }
            with patch('server.date', wraps=date) as clock:
                clock.today.return_value = today
                for period, expected in periods.items():
                    for prefix, client in (('', ''), ('faturamento ', ''), ('venda ', ''),
                                           ('acumulado ', ''), ('BP ', 'BP'),
                                           ('faturamento Santa Isabel ', 'Santa Isabel')):
                        with self.subTest(today=today, question=prefix + period):
                            result = interpret(prefix + period)
                            self.assertEqual(result[0], client)
                            self.assertEqual(result[1], expected[0].year)
                            self.assertEqual(result[3:], expected)

    def test_yesterday(self):
        for today in (date(2026, 9, 23), date(2026, 1, 1), date(2024, 3, 1)):
            with patch('server.date', wraps=date) as clock:
                clock.today.return_value = today
                for question, client in (('ontem', ''), ('ONTEM?', ''),
                                         ('faturamento ontem', ''), ('vendas ontem', ''),
                                         ('acumulado ontem', ''), ('BP ontem', 'BP'),
                                         ('Santa Isabel de ontem', 'Santa Isabel')):
                    with self.subTest(today=today, question=question):
                        result = interpret(question)
                        yesterday = today - timedelta(days=1)
                        self.assertEqual(result[0], client)
                        self.assertEqual(result[1], yesterday.year)
                        self.assertEqual(result[3:], (yesterday, today))

    def test_period_without_client_or_metric(self):
        for period in ('hoje', 'hj', 'HOJE', 'hoje?', 'este mês', 'este ano',
                       'ano passado', 'março 2026', '03/2026', '2018 a 2026'):
            with self.subTest(period=period):
                short = interpret(period)
                self.assertEqual(short[0], '')
                self.assertEqual(short[3:], interpret('faturamento ' + period)[3:])
        for metric in ('faturamento', 'venda', 'vendas', 'acumulado'):
            self.assertEqual(interpret(metric + ' hoje'), interpret('hoje'))
        self.assertEqual(interpret('BP hoje')[0], 'BP')
        self.assertEqual(interpret('3190')[0], '3190')
        self.assertEqual(interpret('hoje EmpresaXYZ')[0], 'hoje EmpresaXYZ')

    def test_general_revenue(self):
        for question in ('faturamento hoje', 'faturamento hj', 'faturamento este mês',
                         'faturamento 2018 a 2026', 'faturamento geral hoje', 'vendas hoje'):
            with self.subTest(question=question):
                self.assertEqual(interpret(question)[0], '')
        self.assertEqual(interpret('faturamento hj')[3:], (date.today(), date.today() + timedelta(days=1)))
        self.assertEqual(interpret('faturamento EmpresaXYZ hoje')[0], 'EmpresaXYZ')
        self.assertEqual(interpret('BP hj')[0], 'BP')

    def test_today(self):
        today = date.today()
        for question in ('santa isabel hoje', 'Santa Isabel de hoje',
                         'faturamento Santa Isabel hoje', 'cliente Santa Isabel no dia de hoje'):
            with self.subTest(question=question):
                client, year, category, start, end = interpret(question)
                self.assertEqual(client.lower(), 'santa isabel')
                self.assertEqual((start, end), (today, today + timedelta(days=1)))

    def test_year_range(self):
        for question in ('BP de 2018 a 2026', 'faturamento BP de 2018 até 2026', 'BP 2018 a 2026'):
            with self.subTest(question=question):
                client, year, category, start, end = interpret(question)
                self.assertEqual(client, 'BP')
                self.assertEqual((start, end), (date(2018, 1, 1), date(2027, 1, 1)))
        with self.assertRaises(ValueError):
            interpret('BP de 2026 a 2018')

    def test_bare_name_matches_explicit_revenue(self):
        for name in ('BP', 'Vale Verde', 'Usina Alto Alegre', '3190'):
            for period in ('', ' 2026', ' em 2025', ' ano passado', ' março 2026', ' 03/2026', ' de janeiro a março de 2026'):
                with self.subTest(name=name, period=period):
                    short = interpret(name + period)
                    self.assertEqual(short, interpret('faturamento ' + name + period))
                    self.assertEqual(short[0], name)

    def test_default_year_and_complete_name(self):
        result = interpret('Usina Alto Alegre')
        self.assertEqual(result[0], 'Usina Alto Alegre')
        self.assertEqual(result[1], date.today().year)


if __name__ == '__main__':
    unittest.main()
