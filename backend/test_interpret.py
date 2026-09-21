import unittest
from datetime import date
from server import interpret


class InterpretTests(unittest.TestCase):
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
