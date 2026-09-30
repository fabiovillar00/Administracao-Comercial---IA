from email.message import Message
import io
import json
import os
from pathlib import Path
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch
import uuid
import base64
import hashlib
import hmac

import usage
from server import Handler


class UsageAuthorizationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.key = os.urandom(32)
        path = Path(self.temp.name)/'key'
        path.write_bytes(self.key)
        self.env = patch.dict(os.environ, {'PULSO_USAGE_KEY':str(path)})
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.temp.cleanup()

    def cookie(self, login, expires=None):
        encode = lambda value: base64.urlsafe_b64encode(value).decode().rstrip('=')
        body = f'v1.{encode(login.encode())}.{expires or int(time.time()+300)}'
        signature = encode(hmac.new(self.key, body.encode(), hashlib.sha256).digest())
        return 'PulsoUsageIdentity='+body+'.'+signature

    def handler(self, login=None, trust=True, path='/api/admin/usage'):
        h = Handler.__new__(Handler)
        h.path = path
        h.headers = Message()
        if login:
            h.headers['X-Pulso-User'] = login
            if trust:
                h.headers['Cookie'] = self.cookie(login)
        h.server = SimpleNamespace(trust_iis_identity=trust)
        h.client_address = ('127.0.0.1', 1234)
        h.send_json = Mock()
        return h

    @patch('usage.report', return_value={'people': []})
    def test_manager_only_and_no_local_identity_override(self, report):
        for login, trust in [(None, True), ('DMB\\outro.usuario', True), ('DMB\\fabio.andrade', False), ('OTHER\\fabio.andrade', True)]:
            h = self.handler(login, trust)
            h.do_GET()
            self.assertEqual(h.send_json.call_args.args[0], 403)
        report.assert_not_called()
        for login in ('DMB\\fabio.andrade', 'dmb\\FABIO.ANDRADE'):
            h = self.handler(login)
            h.do_GET()
            self.assertEqual(h.send_json.call_args.args[0], 200)

    @patch('usage.report')
    def test_tampered_or_remote_cookie_cannot_authorize(self, report):
        h = self.handler('DMB\\fabio.andrade')
        h.headers.replace_header('Cookie', h.headers['Cookie']+'tampered')
        h.do_GET()
        self.assertEqual(h.send_json.call_args.args[0], 403)
        h = self.handler('DMB\\fabio.andrade')
        h.client_address = ('192.168.0.10', 1234)
        h.do_GET()
        self.assertEqual(h.send_json.call_args.args[0], 403)
        report.assert_not_called()

    def test_expired_future_or_unsigned_identity_is_rejected(self):
        for expires in (int(time.time()-1), int(time.time()+1000)):
            self.assertFalse(usage.signed_identity(self.cookie('DMB\\fabio.andrade',expires), '127.0.0.1')['authenticated'])
        self.assertFalse(usage.signed_identity('PulsoUsageIdentity=DMB\\fabio.andrade', '127.0.0.1')['authenticated'])

    @patch('usage.heartbeat')
    def test_heartbeat_identity_is_taken_from_server_not_body(self, heartbeat):
        h = self.handler('DMB\\maria', path='/api/usage/heartbeat')
        body = json.dumps(dict(login='DMB\\fabio.andrade', session=str(uuid.uuid4()), view='overview', active=True)).encode()
        h.headers['Content-Length'] = str(len(body))
        h.headers['Content-Type'] = 'application/json'
        h.rfile = io.BytesIO(body)
        h.do_POST()
        self.assertEqual(heartbeat.call_args.args[0], 'DMB\\maria')
        self.assertEqual(h.send_json.call_args.args[0], 200)
        h = self.handler(path='/api/usage/heartbeat')
        h.do_POST()
        self.assertEqual(h.send_json.call_args.args[0], 401)


class UsageStorageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {'PULSO_USAGE_DB': str(Path(self.temp.name)/'usage.db')})
        self.env.start()
        self.now = time.time()

    def tearDown(self):
        self.env.stop()
        self.temp.cleanup()

    def test_presence_multiple_tabs_idle_and_expiration(self):
        payload = dict(session=str(uuid.uuid4()), view='overview', active=True)
        usage.heartbeat('DMB\\maria', payload, self.now)
        usage.heartbeat('dmb\\maria', {**payload, 'session':str(uuid.uuid4()), 'active':False}, self.now+30)
        result = usage.report({}, self.now+60)
        self.assertEqual(len(result['people']), 1)
        self.assertEqual(result['people'][0]['sessions'], 2)
        self.assertEqual(result['people'][0]['state'], 'Ativo')
        self.assertEqual(usage.report({}, self.now+100)['people'][0]['state'], 'Sem interação recente')
        self.assertEqual(usage.report({}, self.now+151)['people'][0]['state'], 'Desconectado')

    def test_history_navigation_queries_and_filter(self):
        payload = dict(session=str(uuid.uuid4()), view='overview', active=False)
        usage.heartbeat('DMB\\maria', payload)
        usage.heartbeat('DMB\\maria', payload)
        usage.heartbeat('DMB\\maria', {**payload, 'view':'proposals'})
        usage.record_query('DMB\\maria', '/api/open-items', 200, 'proposals')
        usage.record_query('DMB\\maria', '/api/ask', 500)
        usage.record_query('DMB\\joao', '/api/ask', 200)
        result = usage.report({'login':['DMB\\maria']})
        self.assertEqual(result['total'], 4)
        self.assertEqual(result['summary'][0]['accesses'], 1)
        self.assertEqual(result['summary'][0]['queries'], 1)
        self.assertEqual(result['summary'][0]['errors'], 1)
        self.assertEqual(next(e for e in result['events'] if e['kind']=='query')['view'], 'Propostas')
        self.assertEqual(usage.report({'login':['DMB\\maria'], 'offset':['100']})['events'], [])
        with self.assertRaises(ValueError):
            usage.report({'start':['2026-02-02'], 'end':['2026-01-01']})

    def test_retention_removes_old_events_but_keeps_recent(self):
        with usage.database() as conn:
            conn.execute('INSERT INTO events(at,login,kind,view) VALUES (?,?,?,?)', (self.now-91*86400,'old','access','overview'))
            conn.execute('DELETE FROM maintenance')
        usage.record_query('new', '/api/ask', 200)
        with usage.database() as conn:
            self.assertEqual([r[0] for r in conn.execute('SELECT login FROM events')], ['new'])


if __name__ == '__main__':
    unittest.main()
