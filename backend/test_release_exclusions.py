import importlib.util
from pathlib import Path
import unittest
from unittest.mock import Mock

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('release_source', ROOT / 'scripts/release-source.py')
release_source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release_source)


class ReleaseContentsTests(unittest.TestCase):
    def test_release_includes_approved_portfolio_without_legacy_worker(self):
        original = (ROOT / 'backend/server.py').read_text(encoding='utf-8')
        source = release_source.release_server(original)
        namespace = {'__name__': 'release_test'}
        exec(compile(source, 'release_server.py', 'exec'), namespace)
        service = namespace['portfolio_service']
        service.get = Mock(return_value={'groups': []})
        handler = namespace['Handler'].__new__(namespace['Handler'])
        handler.path = '/api/portfolio?years=5&baseYear=2026'
        handler.send_json = Mock()
        handler.do_GET()
        self.assertEqual(handler.send_json.call_args.args, (200, {'groups': []}))
        service.get.assert_called_once_with({'years': ['5'], 'baseYear': ['2026']})
        self.assertIn('portfolio_analysis.py', release_source.BACKEND_FILES)
        self.assertIn('portfolio.py', release_source.BACKEND_FILES)
        self.assertNotIn('portfolio_actions.py', release_source.BACKEND_FILES)
        self.assertNotIn('portfolio_service.start()', source)

    def test_legacy_worker_blocks_release(self):
        original = (ROOT / 'backend/server.py').read_text(encoding='utf-8')
        with self.assertRaises(ValueError):
            release_source.release_server(original + '\nportfolio_service.start()\n')


if __name__ == '__main__':
    unittest.main()
