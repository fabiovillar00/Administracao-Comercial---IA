import unittest
from email.message import Message
from server import request_identity


class IdentityTests(unittest.TestCase):
    def headers(self, *users):
        headers = Message()
        for user in users:
            headers['X-Pulso-User'] = user
        return headers

    def test_trust_is_explicit_and_loopback_only(self):
        headers = self.headers('DMB\\maria.silva')
        self.assertFalse(request_identity(headers, '127.0.0.1')['authenticated'])
        self.assertFalse(request_identity(headers, '192.168.0.10', True)['authenticated'])

    def test_missing_or_duplicate_identity_is_neutral(self):
        for headers in (self.headers(), self.headers(''), self.headers('a', 'b')):
            self.assertFalse(request_identity(headers, '127.0.0.1', True)['authenticated'])

    def test_distinct_users_do_not_share_identity(self):
        for login, name, initials in (
            ('DMB\\maria.silva', 'maria.silva', 'MS'),
            ('DMB\\joao.souza', 'joao.souza', 'JS'),
            ('ti02@dmb.local', 'ti02', 'TI'),
        ):
            user = request_identity(self.headers(login), '127.0.0.1', True)
            self.assertEqual(user, dict(authenticated=True, login=login, name=name, initials=initials))


if __name__ == '__main__':
    unittest.main()
