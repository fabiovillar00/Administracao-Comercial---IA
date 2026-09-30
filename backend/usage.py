"""Minimal usage telemetry, separate from ERP. All identities come from IIS."""
from contextlib import contextmanager
from datetime import date, datetime, time as daytime, timedelta, timezone
import os
from pathlib import Path
import sqlite3
import time
import uuid
import base64
import hashlib
import hmac
from http.cookies import SimpleCookie, CookieError

MANAGER = 'dmb\\fabio.andrade'
VIEWS = {'overview': 'Faturamento', 'products': 'Produtos faturados', 'orders': 'Pedidos',
         'proposals': 'Propostas', 'order-products': 'Produtos dos pedidos',
         'proposal-products': 'Produtos das propostas', 'usage': 'Uso da plataforma'}
RETENTION_DAYS = 90
BRAZIL = timezone(timedelta(hours=-3))


def signed_identity(cookie, peer):
    unknown = {'authenticated': False, 'login': None, 'name': None, 'initials': None}
    if peer not in ('127.0.0.1', '::1'):
        return unknown
    try:
        jar = SimpleCookie()
        jar.load(cookie or '')
        token = jar['PulsoUsageIdentity'].value
        version, encoded_login, expires, signature = token.split('.')
        now = time.time()
        if version != 'v1' or not now < int(expires) <= now+330:
            return unknown
        key_path = Path(os.getenv('PULSO_USAGE_KEY', str(Path(__file__).resolve().parents[2]/'Config/Usage/identity.key')))
        key = key_path.read_bytes()
        if len(key) != 32:
            return unknown
        message = f'{version}.{encoded_login}.{expires}'.encode('ascii')
        expected = base64.urlsafe_b64encode(hmac.new(key, message, hashlib.sha256).digest()).decode().rstrip('=')
        if not hmac.compare_digest(signature, expected):
            return unknown
        login = base64.urlsafe_b64decode(encoded_login+'='*(-len(encoded_login)%4)).decode('utf-8')
        if not login or len(login)>256 or any(ord(c)<32 for c in login):
            return unknown
        return {'authenticated': True, 'login': login}
    except (ValueError, KeyError, OSError, UnicodeError, TypeError, CookieError):
        return unknown


def can_manage(identity):
    return bool(identity.get('authenticated') and str(identity.get('login', '')).casefold() == MANAGER)


@contextmanager
def database():
    path = Path(os.getenv('PULSO_USAGE_DB', str(Path(__file__).resolve().parents[1] / 'outputs/usage/usage.sqlite3')))
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=5)
    conn.row_factory = sqlite3.Row
    try:
        with conn:
            conn.execute('''CREATE TABLE IF NOT EXISTS sessions (
                login TEXT NOT NULL, session TEXT NOT NULL, started REAL NOT NULL,
                seen REAL NOT NULL, active REAL, view TEXT NOT NULL,
                PRIMARY KEY (login, session))''')
            conn.execute('''CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY, at REAL NOT NULL, login TEXT NOT NULL,
                kind TEXT NOT NULL, view TEXT NOT NULL, status INTEGER)''')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_usage_events_at ON events(at)')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_usage_events_login_at ON events(login, at)')
            conn.execute('CREATE TABLE IF NOT EXISTS maintenance (id INTEGER PRIMARY KEY, at REAL NOT NULL)')
            now = time.time()
            last = conn.execute('SELECT at FROM maintenance WHERE id=1').fetchone()
            if not last or now-last['at'] > 86400:
                conn.execute('DELETE FROM events WHERE at < ?', (now-RETENTION_DAYS*86400,))
                conn.execute('DELETE FROM sessions WHERE seen < ?', (now-RETENTION_DAYS*86400,))
                conn.execute('INSERT OR REPLACE INTO maintenance VALUES (1, ?)', (now,))
            yield conn
    finally:
        conn.close()


def heartbeat(login, payload, now=None):
    now = time.time() if now is None else now
    if not isinstance(payload, dict) or payload.get('view') not in VIEWS or type(payload.get('active')) is not bool:
        raise ValueError('Presença inválida.')
    session = str(uuid.UUID(str(payload.get('session', ''))))
    login = login.casefold()
    with database() as conn:
        previous = conn.execute('SELECT * FROM sessions WHERE login=? AND session=?', (login, session)).fetchone()
        kind = 'access' if previous is None or now-previous['seen'] > 120 else 'navigation' if previous['view'] != payload['view'] else None
        active = now if payload['active'] else previous['active'] if previous else None
        conn.execute('''INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(login,session) DO UPDATE SET seen=excluded.seen,active=excluded.active,view=excluded.view''',
            (login, session, now, now, active, payload['view']))
        if kind:
            conn.execute('INSERT INTO events(at,login,kind,view) VALUES (?,?,?,?)', (now, login, kind, payload['view']))


def record_query(login, path, status, kind=None):
    views = {'/api/ask': 'overview', '/api/faturamento': 'overview', '/api/products': 'products', '/api/open-items': 'orders', '/api/clients': 'overview'}
    if path not in views:
        return
    if path == '/api/open-items' and kind == 'proposals':
        views[path] = 'proposals'
    # Autocomplete is not a consultation; successful suggestion requests are omitted.
    if path == '/api/clients' and status < 400:
        return
    with database() as conn:
        conn.execute('INSERT INTO events(at,login,kind,view,status) VALUES (?,?,?,?,?)',
                     (time.time(), login.casefold(), 'error' if status >= 400 else 'query', views[path], status))


def report(params, now=None):
    now = time.time() if now is None else now
    today = datetime.fromtimestamp(now, BRAZIL).date()
    start = date.fromisoformat(params.get('start', [(today-timedelta(days=6)).isoformat()])[0])
    end = date.fromisoformat(params.get('end', [today.isoformat()])[0])
    offset = int(params.get('offset', ['0'])[0])
    login = params.get('login', [''])[0].strip().casefold()
    if start > end or (end-start).days > 90 or end > today or offset < 0 or len(login) > 256:
        raise ValueError('Período ou filtro inválido; use até 90 dias, sem datas futuras.')
    low = datetime.combine(start, daytime.min, BRAZIL).timestamp()
    high = datetime.combine(end+timedelta(days=1), daytime.min, BRAZIL).timestamp()
    where = 'at>=? AND at<?' + (' AND login=?' if login else '')
    args = [low, high] + ([login] if login else [])
    with database() as conn:
        rows = conn.execute('SELECT * FROM sessions ORDER BY seen DESC').fetchall()
        people = {}
        for row in rows:
            if login and row['login'] != login:
                continue
            person = people.setdefault(row['login'], dict(login=row['login'], lastSeen=row['seen'], lastActive=None, view=VIEWS.get(row['view'], row['view']), sessions=0))
            if now-row['seen'] <= 120:
                person['sessions'] += 1
                person['lastActive'] = max(person['lastActive'] or 0, row['active'] or 0) or None
        for person in people.values():
            person['state'] = 'Desconectado' if not person['sessions'] else 'Ativo' if person['lastActive'] and now-person['lastActive'] <= 90 else 'Sem interação recente'
        events = [dict(r) for r in conn.execute(f'SELECT * FROM events WHERE {where} ORDER BY at DESC,id DESC LIMIT 100 OFFSET ?', [*args, offset])]
        total = conn.execute(f'SELECT COUNT(*) FROM events WHERE {where}', args).fetchone()[0]
        summary = [dict(r) for r in conn.execute(f'''SELECT login,
            SUM(CASE WHEN kind='access' THEN 1 ELSE 0 END) accesses,
            SUM(CASE WHEN kind='query' THEN 1 ELSE 0 END) queries,
            SUM(CASE WHEN kind='error' THEN 1 ELSE 0 END) errors,
            MAX(at) lastUse FROM events WHERE {where} GROUP BY login ORDER BY lastUse DESC''', args)]
        users = [r[0] for r in conn.execute('SELECT DISTINCT login FROM events ORDER BY login')]
    for event in events:
        event['view'] = VIEWS.get(event['view'], event['view'])
    return dict(people=list(people.values()), events=events, summary=summary, users=users,
                total=total, offset=offset, limit=100, retentionDays=RETENTION_DAYS,
                generatedAt=now, start=start.isoformat(), end=end.isoformat())
