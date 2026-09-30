import importlib.util
from pathlib import Path
import unittest
from unittest.mock import Mock

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('release_source', ROOT / 'scripts/release-source.py')
release_source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release_source)


class ReleaseExclusionsTests(unittest.TestCase):
    def test_release_api_has_no_portfolio_routes_or_worker(self):
        original = (ROOT / 'backend/server.py').read_text(encoding='utf-8')
        sanitized = release_source.release_server(original)
        namespace = {'__name__': 'release_test'}
        exec(compile(sanitized, 'release_server.py', 'exec'), namespace)
        self.assertNotIn('portfolio_service', namespace)
        for method, path in [('do_GET', '/api/portfolio'), ('do_POST', '/api/portfolio/actions')]:
            handler = namespace['Handler'].__new__(namespace['Handler'])
            handler.path = path
            handler.send_json = Mock()
            getattr(handler, method)()
            self.assertEqual(handler.send_json.call_args.args[0], 404)
        self.assertIn("'/api/ask'", sanitized)
        self.assertIn("'/api/faturamento'", sanitized)
        self.assertIn('portfolio_service.start()', original)

    def test_unknown_portfolio_integration_blocks_release(self):
        original = (ROOT / 'backend/server.py').read_text(encoding='utf-8')
        with self.assertRaises(ValueError):
            release_source.release_server(original + '\n# new portfolio integration\n')


if __name__ == '__main__':
    unittest.main()
