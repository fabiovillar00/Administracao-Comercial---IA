import io
import json
import unittest
from unittest.mock import Mock, patch

from server import Handler


class GeneralScopeTests(unittest.TestCase):
    def ask(self, payload):
        body = json.dumps(payload).encode()
        handler = Handler.__new__(Handler)
        handler.path = '/api/ask'
        handler.headers = {'Content-Length': str(len(body))}
        handler.rfile = io.BytesIO(body)
        handler.send_json = Mock()
        handler.do_POST()
        return handler.send_json.call_args.args

    @patch('server.report', return_value={'branches': []})
    @patch('server.find_group_alias')
    def test_general_skips_client_resolution(self, aliases, report):
        status, result = self.ask({'question': 'faturamento hoje'})
        self.assertEqual(status, 200)
        self.assertEqual(result['grouping'], 'all')
        self.assertIsNone(report.call_args.args[0])
        aliases.assert_not_called()

    @patch('server.report', return_value={'branches': []})
    def test_clearing_filters_removes_previous_client(self, report):
        status, result = self.ask({'question': 'BP hoje', 'clientTerm': '', 'groupName': ''})
        self.assertEqual(status, 200)
        self.assertEqual(result['grouping'], 'all')
        self.assertIsNone(report.call_args.args[0])

    @patch('server.report')
    @patch('server.resolve_spoken_client', return_value=([], None))
    @patch('server.find_group_alias', return_value=[])
    def test_unknown_client_never_falls_back_to_general(self, aliases, resolve, report):
        status, result = self.ask({'question': 'EmpresaXYZ hoje'})
        self.assertEqual(status, 404)
        report.assert_not_called()

    @patch('server.report')
    def test_empty_request_is_not_general(self, report):
        self.assertEqual(self.ask({'question': ''})[0], 400)
        report.assert_not_called()


if __name__ == '__main__':
    unittest.main()
