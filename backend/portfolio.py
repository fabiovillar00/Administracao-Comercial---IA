"""Read-only portfolio analysis. Rules are deterministic and independently testable."""
from collections import defaultdict
from datetime import date, datetime, timedelta
from statistics import median
import re
import threading
import time
import unicodedata

from queries import DETAILS, OPEN_ORDERS, OPEN_PROPOSALS


def month_shift(day, amount):
    index = day.year * 12 + day.month - 1 + amount
    return date(index // 12, index % 12 + 1, 1)


def normalize(value):
    text = unicodedata.normalize('NFD', str(value or '').strip().casefold())
    return ''.join(c for c in text if unicodedata.category(c) != 'Mn')


def group_clients(clients):
    """Transitive union: full CNPJ root, business group, or nonempty group alias.

    CPF, blank CNPJ and placeholder business-group values never link strangers.
    """
    parents = {int(p['id']): int(p['id']) for p in clients}

    def root(key):
        while parents[key] != key:
            parents[key] = parents[parents[key]]
            key = parents[key]
        return key

    def union(a, b):
        a, b = root(a), root(b)
        parents[max(a, b)] = min(a, b)

    links = {}
    for p in clients:
        pid = int(p['id'])
        document = re.sub(r'\D', '', str(p.get('documento') or ''))
        keys = []
        if len(document) == 14 and len(set(document)) > 1:
            keys.append(('cnpj', document[:8]))
        alias = normalize(p.get('groupName'))
        if alias:
            keys.append(('alias', alias))
        business = int(p.get('businessGroup') or 0)
        if business > 0:
            keys.append(('business', business))
            if business in parents:
                union(pid, business)
        for key in keys:
            if key in links:
                union(pid, links[key])
            links[key] = pid
    groups = defaultdict(list)
    for p in clients:
        groups[root(int(p['id']))].append(p)
    return dict(groups)


# Reuse the report's fiscal scope rather than introduce different sales rules.
sales_from = DETAILS[DETAILS.index('FROM FN_DOCUMENTOS'):].split('ORDER BY')[0]
SALES = """SELECT A.PESSOA AS person, CAST(A.DATAEMISSAO AS date) AS day,
    CASE WHEN FAM.FAMILIA LIKE '1.%' THEN 'implementos'
         WHEN FAM.FAMILIA LIKE '[2-8].%' THEN 'pecas'
         WHEN FAM.FAMILIA LIKE '0.%' THEN 'servicos' ELSE 'outros' END AS category,
    SUM(ITEM.VALORLIQUIDO + ITEM.SEGURO + ITEM.FRETE + ITEM.OUTROS) AS value
""" + sales_from.format(ids='SELECT HANDLE FROM GN_PESSOAS', category_filter='1=1') + """
GROUP BY A.PESSOA, CAST(A.DATAEMISSAO AS date),
    CASE WHEN FAM.FAMILIA LIKE '1.%' THEN 'implementos'
         WHEN FAM.FAMILIA LIKE '[2-8].%' THEN 'pecas'
         WHEN FAM.FAMILIA LIKE '0.%' THEN 'servicos' ELSE 'outros' END
"""
PEOPLE = """SELECT P.HANDLE AS id, CAST(P.CODIGO AS varchar(50)) AS codigo,
    P.NOME AS nome, P.CGCCPF AS documento, P.K_NOMEGRUPO AS groupName,
    P.GRUPOEMPRESARIAL AS businessGroup, UF.SIGLA AS uf, M.NOME AS municipio
FROM GN_PESSOAS P
LEFT JOIN ESTADOS UF ON UF.HANDLE = P.ESTADO
LEFT JOIN MUNICIPIOS M ON M.HANDLE = P.MUNICIPIO"""
PROPOSALS = """SELECT A.PESSOA AS person, SUM(A.K_VALORTOTACIPI) AS value,
    COUNT(*) AS count, MIN(A.DATAINCLUSAO) AS oldest,
    SUM(CASE WHEN A.DATAINCLUSAO >= ? THEN 1 ELSE 0 END) AS recentCount
""" + OPEN_PROPOSALS[OPEN_PROPOSALS.index('FROM CM_CONTRATOS'):].format(ids='SELECT HANDLE FROM GN_PESSOAS') + '\nGROUP BY A.PESSOA'
ORDERS = """SELECT OV.PESSOA AS person,
    SUM(CASE WHEN OV.STATUS NOT IN (6, 5, 4) THEN OV.VALORLIQUIDO ELSE 0 END) AS value,
    SUM(CASE WHEN OV.STATUS NOT IN (6, 5, 4) THEN 1 ELSE 0 END) AS count,
    MAX(OV.DATAINCLUSAO) AS lastOrder
""" + OPEN_ORDERS[OPEN_ORDERS.index('FROM CM_ORDENSVENDA'):].format(ids='SELECT HANDLE FROM GN_PESSOAS').replace('OV.STATUS NOT IN (6, 5, 4)', 'OV.STATUS <> 5') + '\nGROUP BY OV.PESSOA'


def as_date(value):
    return date.fromisoformat(str(value)[:10]) if value else None


def money(value):
    return 'R$ ' + f'{value:,.0f}'.replace(',', '.')


def analyze(clients, sales, orders, proposals, today=None):
    today = today or date.today()
    end = today.replace(day=1)
    start = month_shift(end, -24)
    recent_start, prior_start = month_shift(end, -3), month_shift(end, -6)
    annual_start = month_shift(end, -12)
    yoy_start, yoy_end = month_shift(end, -15), month_shift(end, -12)
    cutoff = today - timedelta(days=90)
    groups = group_clients(clients)
    membership = {int(p['id']): gid for gid, members in groups.items() for p in members}
    activity = defaultdict(lambda: {'sales': [], 'orders': [], 'proposals': []})
    for kind, rows in (('sales', sales), ('orders', orders), ('proposals', proposals)):
        for row in rows:
            gid = membership.get(int(row['person']))
            if gid is not None:
                activity[gid][kind].append(row)
    result = []
    labels = {'pecas': 'peças', 'implementos': 'implementos', 'servicos': 'serviços', 'outros': 'outros produtos'}
    for gid, rows in activity.items():
        members = sorted(groups[gid], key=lambda p: int(p['id']))
        days = [(as_date(r['day']), r['category'], float(r['value'] or 0)) for r in rows['sales']]
        days = [(d, c, v) for d, c, v in days if start <= d <= today]
        positive_days = sorted({d for d, _, v in days if v > 0})
        last_sale = max(positive_days, default=None)
        last_order = max((as_date(r['lastOrder']) for r in rows['orders'] if r.get('lastOrder')), default=None)
        order_value = sum(float(r['value'] or 0) for r in rows['orders'])
        order_count = sum(int(r['count']) for r in rows['orders'])
        proposal_value = sum(float(r['value'] or 0) for r in rows['proposals'])
        proposal_count = sum(int(r['count']) for r in rows['proposals'])
        recent_proposals = sum(int(r.get('recentCount', 0)) for r in rows['proposals'])
        oldest_proposal = min((as_date(r['oldest']) for r in rows['proposals'] if r.get('oldest')), default=None)
        monthly = defaultdict(float)
        for d, _, value in days:
            monthly[d.replace(day=1)] += value
        def total(a, b):
            return sum(v for d, _, v in days if a <= d < b)
        recent, prior, seasonal = total(recent_start, end), total(prior_start, recent_start), total(yoy_start, yoy_end)
        annual = total(annual_start, end)
        historical_revenue = total(start, today + timedelta(days=1))
        alerts = []
        def add(kind, title, evidence, action, score, impact):
            alerts.append(dict(kind=kind, title=title, evidence=evidence, action=action,
                               score=score, impact=round(max(impact, 0), 2)))
        if recent_proposals and not order_count and (not last_sale or last_sale < cutoff) and (not last_order or last_order < cutoff):
            add('proposals', 'Propostas sem compra recente',
                f'{proposal_count} proposta(s) em aberto, somando {money(proposal_value)}; {recent_proposals} criada(s) nos últimos 365 dias. Nenhum pedido novo ou faturamento nos últimos 90 dias; nenhum pedido em aberto. O valor inclui propostas antigas: valide quais ainda estão vigentes.',
                'Retomar as propostas, confirmar a necessidade e registrar o impedimento para fechar.', 65, proposal_value)
        # At least five separate buying days; learn cadence from the last 12 months.
        purchase_days = [d for d in positive_days if d >= today - timedelta(days=365)]
        intervals = [(b-a).days for a, b in zip(purchase_days, purchase_days[1:])]
        cadence = None
        if len(intervals) >= 4:
            cadence = median(intervals)
            deviation = median([abs(v-cadence) for v in intervals])
            limit = max(14, round(cadence * 1.5), round(cadence + deviation * 3))
            elapsed = (today-last_sale).days
            if deviation <= cadence and elapsed > limit and not order_count and (not last_order or (today-last_order).days > limit):
                add('cadence', 'Recompra além do habitual',
                    f'{elapsed} dias sem faturar. Intervalo mediano: {cadence:g} dias, em {len(purchase_days)} dias de compra. Limite de atenção: {limit} dias; sem pedido recente ou em aberto.',
                    'Confirmar a próxima necessidade e investigar se a compra migrou para outro fornecedor.',
                    min(85, 50 + round(elapsed / limit * 10)), annual / 12)
        # Adaptive threshold: stable portfolios get 30%; volatile ones up to 60%.
        history = [monthly[month_shift(end, -i)] for i in range(4, 13)]
        base = median(history)
        variation = median([abs(v-base) for v in history]) / base if base > 0 else 1
        threshold = min(.60, max(.30, variation))
        drop = (prior-recent)/prior if prior > 0 else 0
        seasonal_drop = (seasonal-recent)/seasonal if seasonal > 0 else None
        recurring = sum(v > 0 for v in history) >= 3
        if recurring and prior >= 1000 and prior-recent >= 1000 and drop >= threshold and (seasonal_drop is None or seasonal_drop >= .20):
            seasonal_text = f' Também caiu {seasonal_drop:.0%} contra o mesmo trimestre do ano anterior.' if seasonal_drop is not None else ' Sem base sazonal positiva: sinal exige validação do vendedor.'
            add('decline', 'Queda de faturamento',
                f'Últimos 3 meses completos: {money(recent)}, contra {money(prior)} nos 3 anteriores ({drop:.0%} de queda). Limite deste grupo: {threshold:.0%}.' + seasonal_text,
                'Investigar demanda, concorrência e composição das compras; verificar a cobertura dos pedidos em aberto.',
                75 if seasonal_drop is not None else 55, prior-recent)
        lost = []
        lost_value = 0
        for category in labels:
            category_history = [(d, v) for d, c, v in days if c == category and annual_start <= d < cutoff and v > 0]
            value = sum(v for _, v in category_history)
            if len({d.replace(day=1) for d, _ in category_history}) >= 3 and value >= 1000 and not any(d >= cutoff and c == category and v > 0 for d, c, v in days):
                lost.append(labels[category])
                lost_value += value
        if lost and any(d >= cutoff and v > 0 for d, _, v in days):
            add('categories', 'Categorias deixaram de aparecer',
                f'Sem faturamento de {", ".join(lost)} há pelo menos 90 dias, apesar de compras em outras categorias. Cada categoria apareceu em pelo menos 3 meses do histórico anterior.',
                'Validar a sazonalidade e os produtos em carteira antes de propor a recuperação dessas categorias.',
                55, lost_value / 3)
        if (last_sale and (today-last_sale).days >= 180 and historical_revenue >= 1000
                and not order_count and (not last_order or last_order < cutoff)):
            add('inactive', 'Cliente que comprava ficou inativo',
                f'{(today-last_sale).days} dias sem faturar no grupo, com {money(historical_revenue)} faturados no histórico disponível desde {start.strftime("%d/%m/%Y")}. Sem pedido nos últimos 90 dias ou pedido em aberto. A compra anterior pode ter sido pontual ou sazonal: confirme a necessidade atual.',
                'Retomar o contato, entender por que as compras pararam e validar a próxima necessidade antes de oferecer uma nova venda.',
                75, historical_revenue / 24)
        # Inactivity and cadence describe the same gap; do not count it twice.
        signal_families = {'purchase_gap' if a['kind'] in ('inactive', 'cadence') else a['kind'] for a in alerts}
        financial_bonus = (15 if historical_revenue >= 500000 else 10 if historical_revenue >= 100000 else 0) if alerts else 0
        score = min(100, max((a['score'] for a in alerts), default=0) + max(0, len(signal_families)-1)*5 + financial_bonus)
        main_alert = max(alerts, key=lambda a: a['score'], default=None)
        priority_reason = main_alert['title'] + '.' if main_alert else 'Nenhum sinal ativo nesta análise.'
        if financial_bonus:
            priority_reason += f' A relevância comercial aumenta a prioridade: {money(historical_revenue)} já faturados no histórico disponível.'
        elif len(signal_families) > 1:
            priority_reason += ' Outros sinais reforçam a necessidade de contato.'
        aliases = sorted({str(p['groupName']).strip() for p in members if p.get('groupName') and str(p['groupName']).strip()})
        name = aliases[0] if aliases else members[0]['nome']
        result.append(dict(
            id=str(gid), name=name, members=[{k: p.get(k) for k in ('id', 'codigo', 'nome', 'documento')} for p in members],
            alerts=alerts, score=score, priority='Alta' if score >= 75 else 'Média' if score else 'Sem sinais',
            priorityReason=priority_reason, nextAction=main_alert['action'] if main_alert else 'Confirmar o resultado do último contato.',
            historicalRevenue=round(historical_revenue, 2), financialBonus=financial_bonus,
            impact=max((a['impact'] for a in alerts), default=0),
            annualRevenue=round(annual, 2), recentRevenue=round(recent, 2), priorRevenue=round(prior, 2),
            lastSale=last_sale.isoformat() if last_sale else None,
            lastOrder=last_order.isoformat() if last_order else None,
            openOrders=round(order_value, 2), openOrdersCount=order_count,
            openProposals=round(proposal_value, 2), openProposalsCount=proposal_count,
            recentProposalsCount=recent_proposals, oldestProposal=oldest_proposal.isoformat() if oldest_proposal else None,
            cadence=cadence,
            monthly=[dict(month=month_shift(end, -i).isoformat(), value=round(monthly[month_shift(end, -i)], 2)) for i in range(12, 0, -1)],
        ))
    result.sort(key=lambda g: (-g['score'], -g['impact'], g['name']))
    return dict(asOf=today.isoformat(), generatedAt=datetime.now().astimezone().isoformat(),
                period=dict(start=recent_start.isoformat(), end=(end-timedelta(days=1)).isoformat()),
                historyStart=start.isoformat(), analyzedGroups=len(result), groups=result)


class PortfolioService:
    """One read per refresh, shared across tabs. Keep monitoring while API runs."""
    def __init__(self, connect, read_rows):
        self.connect, self.read_rows = connect, read_rows
        self.lock = threading.Lock()
        self.snapshot = None
        self.error = None
        self.started = False
        self.refreshing = False

    def start(self):
        with self.lock:
            if self.started:
                return
            self.started = True
        threading.Thread(target=self._loop, daemon=True, name='portfolio-monitor').start()

    def _loop(self):
        while True:
            self.refresh()
            time.sleep(900)

    def refresh(self):
        with self.lock:
            if self.refreshing:
                return
            self.refreshing = True
        try:
            today = date.today()
            with self.connect() as conn:
                conn.timeout = 90
                cur = conn.cursor()
                clients = self.read_rows(cur.execute(PEOPLE))
                sales = self.read_rows(cur.execute(SALES, month_shift(today, -24), today+timedelta(days=1)))
                orders = self.read_rows(cur.execute(ORDERS))
                proposals = self.read_rows(cur.execute(PROPOSALS, today-timedelta(days=365)))
            snapshot = analyze(clients, sales, orders, proposals, today)
            with self.lock:
                self.snapshot, self.error = snapshot, None
        except Exception as exc:
            print(f'[portfolio] Refresh failed: {exc}')
            with self.lock:
                self.error = 'Não foi possível atualizar a carteira. Tente novamente em alguns instantes.'
        finally:
            with self.lock:
                self.refreshing = False

    def get(self):
        self.start()
        with self.lock:
            return self.snapshot, self.error, self.refreshing
