import argparse
import json
import os
import re
import unicodedata
from datetime import date, datetime, timedelta
from decimal import Decimal
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import pyodbc

from queries import (
    BRANCH_SUMMARY,
    DETAILS,
    FIND_BUSINESS_GROUP,
    FIND_CLIENTS,
    FIND_CONNECTED_CLIENTS,
    FIND_GROUP_ALIAS,
    SUMMARY,
)


def connection():
    server = os.getenv('PULSO_SQL_SERVER', '192.168.0.241')
    database = os.getenv('PULSO_SQL_DATABASE', 'ERP_PROD')
    value = (
        'DRIVER={ODBC Driver 17 for SQL Server};'
        f'SERVER={server};DATABASE={database};Trusted_Connection=yes;'
        'Encrypt=no;TrustServerCertificate=yes;APP=PulsoComercial;ApplicationIntent=ReadOnly'
    )
    return pyodbc.connect(value, timeout=10)


def serialize(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def previous_year(value):
    try:
        return value.replace(year=value.year - 1)
    except ValueError:
        return value.replace(year=value.year - 1, day=28)


def rows_as_dict(cursor):
    columns = [item[0] for item in cursor.description]
    return [{key: serialize(value) for key, value in zip(columns, row)} for row in cursor.fetchall()]


def find_clients(term):
    like = f'%{term}%'
    with connection() as conn:
        return rows_as_dict(conn.cursor().execute(FIND_CLIENTS, like, like, like, like, term))


def find_business_group(matrix_code):
    with connection() as conn:
        return rows_as_dict(conn.cursor().execute(FIND_BUSINESS_GROUP, matrix_code))


def find_group_alias(term):
    with connection() as conn:
        return rows_as_dict(conn.cursor().execute(FIND_GROUP_ALIAS, term))


def find_connected_clients(client_ids):
    """Expand all links transitively: CNPJ root, Grupo Empresarial and K_NOMEGRUPO."""
    connected_ids = set(client_ids)
    connected = []
    for _ in range(10):
        placeholders = ','.join('?' for _ in connected_ids)
        sql = FIND_CONNECTED_CLIENTS.format(ids=placeholders)
        with connection() as conn:
            connected = rows_as_dict(conn.cursor().execute(sql, *sorted(connected_ids)))
        expanded_ids = {int(item['id']) for item in connected}
        if expanded_ids <= connected_ids:
            break
        connected_ids.update(expanded_ids)
    return connected


CLIENT_SPEECH_ALIASES = {
    'de carvalho': 'Dcarvalho',
    'd carvalho': 'Dcarvalho',
    'oi imagem': 'Oimasa',
    'oi imagens': 'Oimasa',
    'o imagem': 'Oimasa',
    'oi maza': 'Oimasa',
    'oi masa': 'Oimasa',
    'raizen': 'RAIZEN',
    'corpercana': 'Copercana',
}


def plain_text(value):
    normalized = unicodedata.normalize('NFD', value.lower())
    return ' '.join(''.join(char for char in normalized if unicodedata.category(char) != 'Mn').split())


def client_groups(clients):
    groups = {}
    for item in clients:
        document = str(item.get('documento') or '')
        if document:
            groups.setdefault(document[:10], []).append(item)
    return groups


def resolve_spoken_client(term):
    """Prefer a phonetic alias only when it resolves to one documented company group."""
    clients = find_clients(term)
    original_groups = client_groups(clients)
    if len(original_groups) == 1:
        return clients, None

    normalized = plain_text(term)
    leading_name_clients = [
        item for item in clients
        if plain_text(str(item.get('nome') or '')).startswith(normalized)
    ]
    if len(client_groups(leading_name_clients)) == 1:
        return leading_name_clients, None

    # Short commercial acronyms must match a complete token. This prevents
    # "BP" from also selecting BPL, RIB.PRETO and unrelated embedded letters.
    if re.fullmatch(r'[a-z0-9]{2,4}', normalized):
        token = re.compile(rf'(?<![a-z0-9]){re.escape(normalized)}(?![a-z0-9])', re.I)
        exact_token_clients = [item for item in clients if token.search(plain_text(str(item.get('nome') or '')))]
        if len(client_groups(exact_token_clients)) == 1:
            return exact_token_clients, None

    alternatives = []
    configured = CLIENT_SPEECH_ALIASES.get(normalized)
    if configured:
        alternatives.append(configured)
    match = re.fullmatch(r'de\s+(.+)', normalized)
    if match:
        alternatives.append(f'D{match.group(1).replace(" ", "")}')

    for alternative in dict.fromkeys(alternatives):
        alias_clients = find_clients(alternative)
        if len(client_groups(alias_clients)) == 1:
            return alias_clients, alternative
    return clients, None


def category_clause(category):
    return {
        'pecas': "FAM.FAMILIA LIKE '[2-8].%'",
        'implementos': "FAM.FAMILIA LIKE '1.%'",
        'servicos': "FAM.FAMILIA LIKE '0.%'",
    }.get(category, '1=1')


def summary_rows(cursor, sql, client_ids, start, end):
    return rows_as_dict(cursor.execute(
        sql,
        *client_ids, start, end,
        *client_ids, start, end,
        *client_ids, start, end,
    ))


def report(client_ids, start, end, category=None, comparison_start=None, comparison_end=None):
    if isinstance(client_ids, int):
        client_ids = [client_ids]
    placeholders = ','.join('?' for _ in client_ids)
    selected_filter = category_clause(category)
    summary_sql = SUMMARY.format(ids=placeholders, category_filter=selected_filter)
    branch_sql = BRANCH_SUMMARY.format(ids=placeholders, category_filter=selected_filter)
    comparison_start = comparison_start or start
    comparison_end = comparison_end or end
    with connection() as conn:
        cur = conn.cursor()
        monthly = summary_rows(cur, summary_sql, client_ids, start, end)
        comparison_monthly = summary_rows(cur, summary_sql, client_ids, comparison_start, comparison_end)
        branches = rows_as_dict(cur.execute(
            branch_sql,
            *client_ids, start, end,
            *client_ids, start, end,
            *client_ids, start, end,
            *client_ids,
        ))
        category_totals = {}
        category_monthly = {}
        comparison_category_totals = {}
        comparison_category_monthly = {}
        for key in ('pecas', 'implementos', 'servicos'):
            category_sql = SUMMARY.format(ids=placeholders, category_filter=category_clause(key))
            rows = summary_rows(cur, category_sql, client_ids, start, end)
            category_monthly[key] = rows
            category_totals[key] = sum(float(row['liquido'] or 0) for row in rows)
            previous_rows = summary_rows(cur, category_sql, client_ids, comparison_start, comparison_end)
            comparison_category_monthly[key] = previous_rows
            comparison_category_totals[key] = sum(float(row['liquido'] or 0) for row in previous_rows)
    totals = {
        key: sum(float(row[key] or 0) for row in monthly)
        for key in ('faturamento', 'devolucoes', 'liquido', 'impostos', 'quantidade', 'documentos')
    }
    comparison_totals = {
        key: sum(float(row[key] or 0) for row in comparison_monthly)
        for key in ('faturamento', 'devolucoes', 'liquido', 'impostos', 'quantidade', 'documentos')
    }
    for branch in branches:
        branch['share'] = (float(branch['liquido']) / totals['liquido']) if totals['liquido'] else 0
    return {
        'totals': totals, 'monthly': monthly, 'details': [], 'branches': branches,
        'categoryTotals': category_totals, 'categoryMonthly': category_monthly,
        'comparison': {
            'totals': comparison_totals,
            'monthly': comparison_monthly,
            'categoryTotals': comparison_category_totals,
            'categoryMonthly': comparison_category_monthly,
            'start': comparison_start.isoformat() if isinstance(comparison_start, (date, datetime)) else comparison_start,
            'end': comparison_end.isoformat() if isinstance(comparison_end, (date, datetime)) else comparison_end,
        },
    }


MONTHS = {
    'janeiro': 1, 'fevereiro': 2, 'marco': 3, 'abril': 4,
    'maio': 5, 'junho': 6, 'julho': 7, 'agosto': 8,
    'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12,
}


def period_from_question(question, year):
    normalized = plain_text(question)
    month_names = '|'.join(MONTHS)
    match = re.search(
        rf'\b(?:de\s+)?({month_names})\s+(?:a|ate)\s+({month_names})\s+(?:de\s+)?20\d{{2}}\b',
        normalized,
    )
    if match:
        first_month, last_month = MONTHS[match.group(1)], MONTHS[match.group(2)]
        if last_month < first_month:
            return date(year, 1, 1), date(year + 1, 1, 1)
        start = date(year, first_month, 1)
        end = date(year + (last_month == 12), 1 if last_month == 12 else last_month + 1, 1)
        return start, end

    named_month = re.search(
        rf'\b({month_names})\s+(?:(?:de\s+)?20\d{{2}}|(?:deste|desse|neste|nesse)\s+ano|do\s+ano\s+(?:atual|passado))\b',
        normalized,
    )
    numeric_month = re.search(r'\b(0?[1-9]|1[0-2])\s*(?:/|de)\s*20\d{2}\b', normalized)
    if named_month:
        selected_month = MONTHS[named_month.group(1)]
    elif numeric_month:
        selected_month = int(numeric_month.group(1))
    elif re.search(r'\b(?:(?:este|esse|neste|nesse)\s+mes|(?:no\s+)?mes\s+atual)\b', normalized):
        selected_month = date.today().month
    else:
        return date(year, 1, 1), date(year + 1, 1, 1)
    start = date(year, selected_month, 1)
    end = date(year + (selected_month == 12), 1 if selected_month == 12 else selected_month + 1, 1)
    return start, end


def interpret(question):
    year_match = re.search(r'\b(20\d{2})\b', question)
    if year_match:
        year = int(year_match.group(1))
    elif re.search(r'\bano\s+passado\b', question, re.I):
        year = date.today().year - 1
    else:
        year = date.today().year
    month_names = r'janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro'
    relative_year = r'(?:este|neste|esse|nesse)\s+ano|(?:no\s+)?ano\s+atual|(?:no\s+)?ano\s+passado'
    relative_month = r'(?:este|esse|neste|nesse)\s+m[eê]s|(?:no\s+)?m[eê]s\s+atual'
    single_month = rf'(?:{month_names})\s+(?:(?:de\s+)?20\d{{2}}|(?:deste|desse|neste|nesse)\s+ano|do\s+ano\s+(?:atual|passado))'
    numeric_month = r'(?:0?[1-9]|1[0-2])\s*(?:/|de)\s*20\d{2}'
    period_boundary = rf'(?=\s+(?:(?:{relative_year})|(?:{relative_month})|(?:{single_month})|(?:{numeric_month})|(?:de\s+)?(?:{month_names})\s+(?:a|at[eé])\s+(?:{month_names})\s+(?:de\s+)?20\d{{2}}|(?:(?:no\s+)?per[ií]odo\s+de\s+|no\s+|em\s+|entre\s+)?20\d{{2}})\b|$)'
    client = None
    for pattern in (
        rf'\bcliente\s+(.+?){period_boundary}',
        rf'\bgrupo\s+(.+?){period_boundary}',
        rf'\bempresa\s+(.+?){period_boundary}',
        rf'\b(?:acumulado(?:\s+geral)?|vendas?|faturamento)\s+(?:do|da|de)\s+(.+?){period_boundary}',
        rf'\b(?:acumulado(?:\s+geral)?|vendas?|faturamento)\s+(.+?){period_boundary}',
    ):
        client_match = re.search(pattern, question, re.I)
        if client_match:
            client = client_match.group(1).strip(' ,.?')
            break
    if not client:
        client = question.strip()
    normalized = question.lower()
    category = None
    if re.search(r'\bpe[cç]as?\b', normalized): category = 'pecas'
    elif re.search(r'\bimplementos?\b', normalized): category = 'implementos'
    elif re.search(r'\bservi[cç]os?\b', normalized): category = 'servicos'
    start, end = period_from_question(question, year)
    return client, year, category, start, end


class Handler(BaseHTTPRequestHandler):
    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', 'http://localhost:3000')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', 'http://localhost:3000')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        try:
            if parsed.path == '/api/health':
                with connection() as conn:
                    db = conn.cursor().execute('SELECT DB_NAME()').fetchval()
                return self.send_json(200, {'ok': True, 'database': db})
            if parsed.path == '/api/clients':
                return self.send_json(200, {'clients': find_clients(params.get('q', [''])[0])})
            if parsed.path == '/api/faturamento':
                ids = [int(value) for value in params['clientId'][0].split(',')]
                data = report(ids, date.fromisoformat(params['start'][0]), date.fromisoformat(params['end'][0]))
                return self.send_json(200, data)
            return self.send_json(404, {'error': 'Rota não encontrada'})
        except Exception as exc:
            return self.send_json(500, {'error': str(exc)})

    def do_POST(self):
        if urlparse(self.path).path != '/api/ask':
            return self.send_json(404, {'error': 'Rota não encontrada'})
        try:
            size = int(self.headers.get('Content-Length', '0'))
            payload = json.loads(self.rfile.read(size) or b'{}')
            question = str(payload.get('question', ''))[:500]
            client_term, year, category, start_date, end_date = interpret(question)
            direct_client = str(payload.get('clientTerm', '')).strip()[:150]
            group_name = str(payload.get('groupName', '')).strip()[:60]
            if direct_client or group_name:
                client_term = group_name or direct_client
            if payload.get('start') and payload.get('end'):
                start_date = date.fromisoformat(str(payload['start']))
                end_inclusive = date.fromisoformat(str(payload['end']))
                if end_inclusive < start_date:
                    return self.send_json(400, {'error': 'A data final deve ser igual ou posterior à data inicial.'})
                end_date = end_inclusive + timedelta(days=1)
                year = start_date.year
            code_match = re.fullmatch(r'(?:c[oó]digo\s+)?(\d+)', client_term.strip(), re.I)
            alias_clients = find_group_alias(client_term) if group_name else ([] if code_match else find_group_alias(client_term))
            grouping = 'cnpj'
            matrix_code = None
            if code_match:
                matrix_code = int(code_match.group(1))
                clients = find_business_group(matrix_code)
                understood_as = None
                grouping = 'grupoempresarial'
            elif alias_clients:
                clients = alias_clients
                understood_as = None
                grouping = 'connected_group'
            else:
                clients, understood_as = resolve_spoken_client(client_term)
            if not clients:
                return self.send_json(404, {'error': f'Cliente “{client_term}” não encontrado.'})
            if grouping == 'cnpj':
                documented_groups = client_groups(clients)
                if len(documented_groups) == 1:
                    clients = next(iter(documented_groups.values()))
                elif len(documented_groups) > 1:
                    choices = [
                        {'root': root, 'count': len(items), 'name': items[0]['nome'], 'clients': items}
                        for root, items in documented_groups.items()
                    ]
                    return self.send_json(409, {
                        'error': 'Foram encontrados mais de um grupo empresarial. Selecione o CNPJ-base desejado.',
                        'needsSelection': True, 'groups': choices, 'year': year,
                    })
                elif len(clients) > 1:
                    return self.send_json(409, {
                        'error': 'Foram encontrados vários cadastros sem CNPJ. Informe o código do cliente.',
                        'needsSelection': True, 'clients': clients, 'year': year,
                    })
            primary_client = clients[0]
            connected_clients = find_connected_clients([item['id'] for item in clients])
            if connected_clients:
                clients = connected_clients
                grouping = 'connected_group'
            client = primary_client
            if not client.get('groupName'):
                client['groupName'] = next(
                    (item.get('groupName') for item in clients if item.get('groupName')),
                    None,
                )
            client['branchCount'] = len(clients)
            client['ids'] = [item['id'] for item in clients]
            if year == date.today().year:
                end_date = min(end_date, date.today() + timedelta(days=1))
            comparison_start = previous_year(start_date)
            comparison_end = previous_year(end_date)
            data = report(
                client['ids'], start_date, end_date, category,
                comparison_start, comparison_end,
            )
            return self.send_json(200, {
                'client': client, 'year': year, 'category': category,
                'period': {'start': start_date.isoformat(), 'end': end_date.isoformat()},
                'understoodAs': understood_as, 'grouping': grouping,
                'groupLinks': ['cnpj', 'grupoempresarial', 'k_nomegrupo'],
                'matrixCode': matrix_code, **data,
            })
        except Exception as exc:
            return self.send_json(500, {'error': str(exc)})

    def log_message(self, format, *args):
        print(f'[api] {self.address_string()} {format % args}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--probe', metavar='CLIENT')
    args = parser.parse_args()
    if args.probe:
        print(json.dumps(find_clients(args.probe), ensure_ascii=False, indent=2))
    else:
        print(f'Pulso Comercial API em http://localhost:{args.port}')
        ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
