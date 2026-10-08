"""Customer reactivation by complete business group; ERP reads only."""
from datetime import date, datetime, timedelta
from portfolio import group_clients, PEOPLE, sales_from
from queries import OPEN_PROPOSALS, OPEN_ORDERS


def category_filter(category, alias='FAM'):
    return {'all': '1=1', 'pecas': f"{alias}.FAMILIA LIKE '[2-8].%'",
            'implementos': f"{alias}.FAMILIA LIKE '1.%'"}[category]


def options(params, today=None):
    today = today or date.today()
    years = int(params.get('years', ['10'])[0])
    year = int(params.get('baseYear', [str(today.year)])[0])
    mode = params.get('mode', ['base'])[0]
    category = params.get('category', ['all'])[0]
    if not 1 <= years <= 50 or not 1901 <= year <= today.year or year - years < 1900:
        raise ValueError('Informe de 1 a 50 anos de histórico e um ano-base entre 1901 e o ano atual.')
    if mode not in ('base', 'both') or category not in ('all', 'pecas', 'implementos'):
        raise ValueError('Período sem compras ou categoria inválidos.')
    start = date(year-years, 1, 1)
    cutoff = date(year - (mode == 'both'), 1, 1)
    if cutoff <= start:
        raise ValueError('Para comparar dois anos sem compras, informe pelo menos 2 anos de histórico.')
    end = min(date(year+1, 1, 1), today+timedelta(days=1))
    return dict(years=years, baseYear=year, mode=mode, category=category,
                start=start, cutoff=cutoff, end=end)


def consolidate(clients, sales, proposals, orders):
    sales = {int(r['person']): r for r in sales}
    proposals = {int(r['person']): r for r in proposals}
    orders = {int(r['person']): r for r in orders}
    result = []
    for gid, members in group_clients(clients).items():
        if not any(int(sales.get(int(p['id']), {}).get('historicalCount') or 0) for p in members):
            continue
        # Any invoice in any linked branch prevents a false inactive group.
        if any(int(sales.get(int(p['id']), {}).get('inactiveCount') or 0) for p in members):
            continue
        branches = []
        for p in members:
            pid = int(p['id'])
            sale, proposal, order = sales.get(pid, {}), proposals.get(pid, {}), orders.get(pid, {})
            branches.append(dict(id=pid, codigo=p.get('codigo'), nome=p.get('nome'), documento=p.get('documento'),
                historicalRevenue=float(sale.get('historicalRevenue') or 0), lastSale=sale.get('lastSale'),
                proposalCount=int(proposal.get('proposalCount') or 0), proposalValue=float(proposal.get('proposalValue') or 0),
                lastOrder=order.get('lastOrder'), hasBaseYearOrder=bool(order.get('hasBaseYearOrder'))))
        branches.sort(key=lambda b: (-b['proposalValue'], b['nome'] or '', b['id']))
        aliases = sorted({str(p['groupName']).strip() for p in members if str(p.get('groupName') or '').strip()})
        name = aliases[0] if aliases else min(members, key=lambda p: int(p['id']))['nome']
        result.append(dict(id=str(gid), name=name, members=branches,
            historicalRevenue=round(sum(b['historicalRevenue'] for b in branches), 2),
            lastSale=max((b['lastSale'] for b in branches if b['lastSale']), default=None),
            proposalCount=sum(b['proposalCount'] for b in branches),
            proposalValue=round(sum(b['proposalValue'] for b in branches), 2),
            lastOrder=max((b['lastOrder'] for b in branches if b['lastOrder']), default=None),
            hasBaseYearOrder=any(b['hasBaseYearOrder'] for b in branches)))
    return sorted(result, key=lambda g: (-g['proposalValue'], g['name']))


class PortfolioAnalysis:
    def __init__(self, connect, read_rows):
        self.connect, self.read_rows = connect, read_rows

    def get(self, params):
        opt = options(params)
        action = params.get('action', ['summary'])[0]
        if action not in ('summary', 'proposals', 'products', 'lastOrder', 'orderProducts'):
            raise ValueError('Detalhamento inválido.')
        filt = category_filter(opt['category'])
        # Same proposal eligibility as the revenue dashboard, with parameterized IDs.
        eligible = OPEN_PROPOSALS[OPEN_PROPOSALS.index('FROM CM_CONTRATOS'):].format(ids='SELECT HANDLE FROM GN_PESSOAS')
        proposal_from = """FROM CM_CONTRATOS A
JOIN CM_CONTRATOITENS I ON I.CONTRATO = A.HANDLE
JOIN PD_PRODUTOS P ON P.HANDLE = I.PRODUTO
LEFT JOIN PD_FAMILIASPRODUTOS FAM ON FAM.HANDLE = P.FAMILIA
WHERE A.HANDLE IN (SELECT A.HANDLE """ + eligible + ') AND ' + filt
        with self.connect() as conn:
            conn.timeout = 120
            cur = conn.cursor()
            if action in ('lastOrder', 'orderProducts'):
                person_id = int(params.get('personId', ['0'])[0])
                if person_id <= 0:
                    raise ValueError('Informe a unidade.')
                order_scope = OPEN_ORDERS[OPEN_ORDERS.index('FROM CM_ORDENSVENDA'):].format(ids='SELECT HANDLE FROM GN_PESSOAS').replace('OV.STATUS NOT IN (6, 5, 4)', 'OV.STATUS <> 5')
                order_items = '''FROM CM_ORDENSVENDA OV
JOIN CM_ORDEMVENDAITENS I ON I.ORDEMVENDA = OV.HANDLE
JOIN PD_PRODUTOS P ON P.HANDLE = I.PRODUTO
LEFT JOIN PD_FAMILIASPRODUTOS FAM ON FAM.HANDLE = P.FAMILIA
WHERE OV.HANDLE IN (SELECT OV.HANDLE ''' + order_scope + ') AND ' + filt
                if action == 'orderProducts':
                    order_id = int(params.get('orderId', ['0'])[0])
                    if order_id <= 0:
                        raise ValueError('Informe o pedido.')
                    sql = '''SELECT I.HANDLE AS id, P.CODIGOREFERENCIA AS codigo,
P.NOME AS nome, FAM.NOME AS familia, I.QUANTIDADE AS quantidade,
COALESCE(I.VALORLIQUIDO, 0) AS valor ''' + order_items + ' AND OV.HANDLE = ? AND OV.PESSOA = ? ORDER BY I.HANDLE'
                    return dict(items=self.read_rows(cur.execute(sql, order_id, person_id)))
                sql = '''SELECT TOP (1) OV.HANDLE AS id, OV.NUMEROOV AS numero, OV.DATAINCLUSAO AS data,
COUNT(*) AS itemCount, SUM(COALESCE(I.VALORLIQUIDO, 0)) AS valor ''' + order_items + '''
AND OV.PESSOA = ? GROUP BY OV.HANDLE, OV.NUMEROOV, OV.DATAINCLUSAO
ORDER BY OV.DATAINCLUSAO DESC, OV.HANDLE DESC'''
                return dict(orders=self.read_rows(cur.execute(sql, person_id)))
            if action == 'products':
                proposal_id = int(params.get('proposalId', ['0'])[0])
                person_id = int(params.get('personId', ['0'])[0])
                if proposal_id <= 0 or person_id <= 0:
                    raise ValueError('Informe a proposta e a unidade.')
                sql = """SELECT I.HANDLE AS id, P.CODIGOREFERENCIA AS codigo,
P.NOME AS nome, FAM.NOME AS familia, I.QUANTIDADE AS quantidade,
COALESCE(I.VALORLIQUIDO, 0) AS valor """ + proposal_from + ' AND A.HANDLE = ? AND A.PESSOA = ? ORDER BY I.HANDLE'
                return dict(items=self.read_rows(cur.execute(sql, proposal_id, person_id)))
            if action == 'proposals':
                person_id = int(params.get('personId', ['0'])[0])
                if person_id <= 0:
                    raise ValueError('Informe a unidade.')
                sql = """SELECT A.HANDLE AS id, A.NUMERO AS numero, A.DATAINCLUSAO AS data,
COUNT(*) AS itemCount, SUM(COALESCE(I.VALORLIQUIDO, 0)) AS valor """ + proposal_from + """
AND A.PESSOA = ? GROUP BY A.HANDLE, A.NUMERO, A.DATAINCLUSAO ORDER BY A.DATAINCLUSAO DESC, A.HANDLE DESC"""
                return dict(proposals=self.read_rows(cur.execute(sql, person_id)))
            clients = self.read_rows(cur.execute(PEOPLE))
            sql = """SELECT A.PESSOA AS person,
SUM(CASE WHEN A.DATAEMISSAO < ? THEN 1 ELSE 0 END) AS historicalCount,
SUM(CASE WHEN A.DATAEMISSAO >= ? THEN 1 ELSE 0 END) AS inactiveCount,
SUM(CASE WHEN A.DATAEMISSAO < ? THEN ITEM.VALORLIQUIDO + ITEM.SEGURO + ITEM.FRETE + ITEM.OUTROS ELSE 0 END) AS historicalRevenue,
MAX(CAST(A.DATAEMISSAO AS date)) AS lastSale
""" + sales_from.format(ids='SELECT HANDLE FROM GN_PESSOAS', category_filter=filt) + ' GROUP BY A.PESSOA'
            sales = self.read_rows(cur.execute(sql, opt['cutoff'], opt['cutoff'], opt['cutoff'], opt['start'], opt['end']))
            proposals = self.read_rows(cur.execute('SELECT A.PESSOA AS person, COUNT(DISTINCT A.HANDLE) AS proposalCount, SUM(COALESCE(I.VALORLIQUIDO, 0)) AS proposalValue ' + proposal_from + ' GROUP BY A.PESSOA'))
            order_from = OPEN_ORDERS[OPEN_ORDERS.index('FROM CM_ORDENSVENDA'):].format(ids='SELECT HANDLE FROM GN_PESSOAS').replace('OV.STATUS NOT IN (6, 5, 4)', 'OV.STATUS <> 5')
            sql = 'SELECT OV.PESSOA AS person, MAX(OV.DATAINCLUSAO) AS lastOrder, MAX(CASE WHEN OV.DATAINCLUSAO >= ? AND OV.DATAINCLUSAO < ? THEN 1 ELSE 0 END) AS hasBaseYearOrder ' + order_from + '''
AND EXISTS (SELECT 1 FROM CM_ORDEMVENDAITENS I
JOIN PD_PRODUTOS P ON P.HANDLE = I.PRODUTO
LEFT JOIN PD_FAMILIASPRODUTOS FAM ON FAM.HANDLE = P.FAMILIA
WHERE I.ORDEMVENDA = OV.HANDLE AND ''' + filt + ') GROUP BY OV.PESSOA'
            orders = self.read_rows(cur.execute(sql, date(opt['baseYear'],1,1), date(opt['baseYear']+1,1,1)))
        groups = consolidate(clients, sales, proposals, orders)
        return dict(groups=groups, generatedAt=datetime.now().astimezone().isoformat(),
                    filters={k: v for k, v in opt.items() if k not in ('start', 'cutoff', 'end')},
                    period=dict(historyStart=opt['start'].isoformat(), historyEnd=(opt['cutoff']-timedelta(days=1)).isoformat(),
                                inactiveStart=opt['cutoff'].isoformat(), inactiveEnd=(opt['end']-timedelta(days=1)).isoformat()))
