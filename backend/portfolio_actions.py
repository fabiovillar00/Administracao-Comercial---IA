"""Local follow-up log. Never writes to the ERP database."""
from datetime import date, datetime
from contextlib import contextmanager
import json
import os
from pathlib import Path
import sqlite3


@contextmanager
def connect():
    path = Path(os.getenv('PULSO_PORTFOLIO_DB', str(Path(__file__).resolve().parent.parent / 'outputs' / 'portfolio-actions.sqlite3')))
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute('''CREATE TABLE IF NOT EXISTS actions (
        id INTEGER PRIMARY KEY, group_id TEXT NOT NULL, owner TEXT NOT NULL,
        due TEXT NOT NULL, note TEXT NOT NULL, reason TEXT NOT NULL,
        score INTEGER NOT NULL, signals TEXT NOT NULL, created_at TEXT NOT NULL)''')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_actions_group ON actions(group_id, id)')
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def save_action(payload, group, today=None):
    today = today or date.today()
    if not isinstance(payload, dict):
        raise ValueError('Informe os dados da ação.')
    owner, note = str(payload.get('owner', '')).strip(), str(payload.get('note', '')).strip()
    reason = str(payload.get('reason', '')).strip()
    if not owner or len(owner) > 120 or not note or len(note) > 2000:
        raise ValueError('Informe o responsável (até 120 caracteres) e a próxima ação (até 2.000 caracteres).')
    if reason not in ('Contato pendente', 'Negociação em andamento', 'Sazonalidade', 'Concorrência', 'Entrega / operação', 'Outro'):
        raise ValueError('Selecione um motivo válido.')
    try:
        due = date.fromisoformat(str(payload.get('due', '')))
    except ValueError:
        raise ValueError('Informe uma data válida para o próximo acompanhamento.') from None
    if due < today or (due-today).days > 365:
        raise ValueError('O acompanhamento deve ser entre hoje e os próximos 365 dias.')
    signals = json.dumps(sorted(a['kind'] for a in group['alerts']))
    with connect() as conn:
        conn.execute('''INSERT INTO actions
            (group_id, owner, due, note, reason, score, signals, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
            (group['id'], owner, due.isoformat(), note, reason, group['score'], signals, datetime.now().astimezone().isoformat()))
    return latest_actions().get(group['id'])


def latest_actions():
    with connect() as conn:
        records = conn.execute('SELECT * FROM actions WHERE id IN (SELECT MAX(id) FROM actions GROUP BY group_id)').fetchall()
    return {row['group_id']: dict(row) for row in records}


def with_actions(snapshot, today=None):
    today = today or date.today()
    latest = latest_actions()
    groups = []
    for group in snapshot['groups']:
        action = latest.get(group['id'])
        if not group['alerts'] and not action:
            continue
        escalated = bool(action and group['alerts'] and (
            group['score'] >= action['score'] + 15 or
            set(a['kind'] for a in group['alerts']) - set(json.loads(action['signals']))))
        due = action and date.fromisoformat(action['due']) <= today
        status = ('review' if action and due else 'clear') if not group['alerts'] else (
            'attention' if not action or due or escalated else 'scheduled')
        groups.append({**group, 'followUp': action, 'escalated': escalated,
                       'status': status, 'overdue': bool(action and date.fromisoformat(action['due']) < today)})
    return {**snapshot, 'groups': groups}
