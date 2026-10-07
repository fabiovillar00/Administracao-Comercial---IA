"""Read-only executive customer/group dashboard, using the existing portfolio group resolver."""
from collections import defaultdict
from datetime import date, datetime, timedelta
from calendar import monthrange
from queries import DETAILS, OPEN_ORDERS, OPEN_PROPOSALS
from portfolio import PEOPLE, group_clients, normalize
from portfolio_analysis import category_filter


def shift(day, months):
    n = day.year * 12 + day.month - 1 + months
    year, month = n // 12, n % 12 + 1
    return date(year, month, min(day.day, monthrange(year, month)[1]))


def options(params, today=None):
    today = today or date.today()
    end = date.fromisoformat(params.get('end', [today.isoformat()])[0])
    months = int(params.get('months', ['12'])[0])
    if months not in (3, 6, 12, 24, 36, 60):
        raise ValueError('Período inválido.')
    start = date.fromisoformat(params.get('start', [(shift(end, -months)+timedelta(days=1)).isoformat()])[0])
    recent = int(params.get('recentMonths', ['3'])[0])
    category = params.get('category', ['all'])[0]
    if category not in ('all', 'pecas', 'implementos'):
        raise ValueError('Categoria inválida.')
    if start > end or end > today or start.year < 1900 or (end-start).days > 366*20 or not 1 <= recent <= 24:
        raise ValueError('Confira o período (até 20 anos), sem datas futuras, e a janela de produtos (1 a 24 meses).')
    person = int(params.get('personId', ['0'])[0])
    unit = int(params.get('unitId', ['0'])[0])
    seller = params.get('sellerId', [''])[0]
    seller = int(seller) if seller != '' else None
    if person <= 0 or unit < 0 or (seller is not None and seller < 0):
        raise ValueError('Selecione um grupo/cliente válido.')
    return dict(start=start, end=end, category=category, recentMonths=recent, personId=person, unitId=unit, sellerId=seller)


def group_label(members, selected):
    aliases = sorted({str(p['groupName']).strip() for p in members if str(p.get('groupName') or '').strip()})
    return aliases[0] if aliases else min(members, key=lambda p: int(p['id']))['nome']


def analyze(sales, orders, proposals, open_proposals, receipts, start, end, recent_months, today=None, discounts=None):
    today = today or date.today()
    doc_map, product_map = {}, {}
    monthly = defaultdict(float)
    month = start.replace(day=1)
    while month <= end:
        monthly[month.strftime('%Y-%m')] = 0
        month = shift(month, 1)
    all_days = set()
    cutoff = shift(end, -recent_months) + timedelta(days=1)
    for r in sales:
        d = date.fromisoformat(str(r['day'])[:10])
        if d > today:
            continue
        value, qty = float(r.get('value') or 0), float(r.get('quantity') or 0)
        if value > 0:
            all_days.add(d)
        doc = doc_map.setdefault(r['documentId'], dict(id=r['documentId'], number=r['number'], day=d, value=0))
        doc['value'] += value
        p = product_map.setdefault(r['productId'], dict(id=r['productId'], codigo=r['codigo'], nome=r['nome'], quantity=0, revenue=0,
            net=0, orders=set(), invoices=set(), first=None, last=None, lastPrice=None, lastKey=None, regularMonths=set(), recent=False))
        if value > 0 and d <= end:
            p['first'] = min(p['first'], d) if p['first'] else d
            p['last'] = max(p['last'], d) if p['last'] else d
            if shift(cutoff, -12) <= d < cutoff:
                p['regularMonths'].add(d.strftime('%Y-%m'))
            if cutoff <= d:
                p['recent'] = True
        if start <= d <= end:
            p['quantity'] += qty
            p['revenue'] += value
            p['net'] += float(r.get('net') or 0)
            if r.get('orderId'):
                p['orders'].add(r['orderId'])
            p['invoices'].add(r['documentId'])
            key = (d, int(r['documentId']))
            if qty > 0 and (p['lastKey'] is None or key > p['lastKey']):
                p['lastKey'], p['lastPrice'] = key, float(r.get('net') or 0) / qty
            monthly[d.strftime('%Y-%m')] += value
    period_docs = [d for d in doc_map.values() if start <= d['day'] <= end]
    revenue = sum(d['value'] for d in period_docs)
    last_sale = max((d for d in doc_map.values() if d['value'] > 0), key=lambda d: (d['day'], d['id']), default=None)
    def event(rows):
        r = max(rows, key=lambda r: (str(r['day']), r['id']), default=None)
        return dict(id=r['id'], number=r['number'], day=str(r['day'])[:10], value=float(r['value'] or 0)) if r else None
    def elapsed(e):
        return (today-date.fromisoformat(e['day'])).days if e else None
    sale_event = dict(id=last_sale['id'], number=last_sale['number'], day=last_sale['day'].isoformat(), value=round(last_sale['value'],2)) if last_sale else None
    order_event, proposal_event = event(orders), event(proposals)
    dates = sorted(all_days)
    gaps = [(b-a).days for a,b in zip(dates, dates[1:])]
    selected_orders = [r for r in orders if start <= date.fromisoformat(str(r['day'])[:10]) <= end]
    biggest = max(orders, key=lambda r: float(r['value'] or 0), default=None)
    new, abandoned, products = [], [], []
    for p in product_map.values():
        base = dict(id=p['id'], codigo=p['codigo'], nome=p['nome'], lastPurchase=p['last'].isoformat() if p['last'] else None)
        if p['first'] and p['first'] >= cutoff:
            new.append({**base, 'firstPurchase': p['first'].isoformat()})
        if len(p['regularMonths']) >= 3 and not p['recent']:
            abandoned.append({**base, 'daysWithoutPurchase': (end-p['last']).days, 'activeMonths': len(p['regularMonths'])})
        if p['invoices']:
            products.append({**base, 'quantity': p['quantity'], 'revenue': round(p['revenue'],2), 'orders': len(p['orders']), 'invoices': len(p['invoices']),
                'averagePrice': p['net']/p['quantity'] if p['quantity'] > 0 else None, 'lastPrice': p['lastPrice'], 'averageDiscount': None, 'maxDiscount': None})
    products.sort(key=lambda p: (-p['revenue'], p['codigo'] or ''))
    abandoned.sort(key=lambda p: -p['daysWithoutPurchase'])
    new.sort(key=lambda p: p['firstPurchase'], reverse=True)
    def leader(key):
        valid = [p for p in products if p[key] > 0]
        return max(valid, key=lambda p: p[key], default=None)
    discounts = [r for r in (discounts or []) if r.get('discount') is not None and 0 <= float(r['discount']) <= 100 and float(r.get('quantity') or 0) > 0]
    period_discounts = [r for r in discounts if start <= date.fromisoformat(str(r['day'])[:10]) <= end]
    by_product = defaultdict(list)
    for r in period_discounts: by_product[r['productId']].append(r)
    for p in products:
        ds = by_product.get(p['id'], [])
        if ds:
            p['averageDiscount'] = sum(float(r['discount'])*float(r['quantity']) for r in ds)/sum(float(r['quantity']) for r in ds)
            p['maxDiscount'] = max(float(r['discount']) for r in ds)
    discount_leaders = [dict(id=pid,codigo=ds[0]['codigo'],nome=ds[0]['nome'],averageDiscount=sum(float(r['discount'])*float(r['quantity']) for r in ds)/sum(float(r['quantity']) for r in ds)) for pid,ds in by_product.items()]
    greatest_discount = max(discounts, key=lambda r: float(r['discount']), default=None)
    open_orders = [r for r in orders if r['status'] not in (4,5,6)]
    payment = receipts[0] if receipts else {}
    return dict(cards=dict(revenue=round(revenue,2), invoiceCount=len(period_docs), averageTicket=revenue/len(period_docs) if period_docs else None,
        openOrders=round(sum(float(r['value'] or 0) for r in open_orders),2), openOrderCount=len(open_orders),
        openProposals=round(sum(float(r['value'] or 0) for r in open_proposals),2), openProposalCount=len(open_proposals),
        averageReceiptDays=payment.get('averageDays'), settledInstallments=int(payment.get('count') or 0), maxDiscount=max((float(r['discount']) for r in period_discounts),default=None)),
        activity=dict(lastInvoice=sale_event, lastOrder=order_event, lastProposal=proposal_event, daysWithoutInvoice=elapsed(sale_event),
            daysWithoutOrder=elapsed(order_event), daysWithoutProposal=elapsed(proposal_event)),
        behavior=dict(averageGap=sum(gaps)/len(gaps) if gaps else None, maxGap=max(gaps) if gaps else None, purchaseDays=len(dates),
            historyStart=dates[0].isoformat() if dates else None, largestOrder=event([biggest]) if biggest else None,
            averageProductsPerOrder=sum(int(r['productCount'] or 0) for r in selected_orders)/len(selected_orders) if selected_orders else None,
            orderCount=len(selected_orders), unlinkedInvoices=len({r['documentId'] for r in sales if not r.get('orderId') and start <= date.fromisoformat(str(r['day'])[:10]) <= end}), distinctProducts=len(products), greatestDiscount=greatest_discount, peakMonth=max((dict(month=m,value=v) for m,v in monthly.items() if v > 0),key=lambda r:r['value'],default=None)),
        monthly=[dict(month=m, value=round(v,2)) for m,v in sorted(monthly.items())], products=products,
        leaders=dict(quantity=leader('quantity'), revenue=leader('revenue'), recurrence=leader('orders'), discount=max(discount_leaders,key=lambda p:p['averageDiscount'],default=None)),
        abandoned=abandoned, newProducts=new, recentStart=cutoff.isoformat(), discountNote='Descontos: K_NEGOCIACAO dos itens de pedidos não cancelados. Média por produto ponderada pela quantidade, nos pedidos incluídos no período. Maior desconto histórico considera todo o histórico disponível.')


class GroupDashboard:
    def __init__(self, connect, read_rows):
        self.connect, self.rows = connect, read_rows

    def members(self, cur, person_id):
        clients = self.rows(cur.execute(PEOPLE))
        selected = next((p for p in clients if int(p['id']) == person_id), None)
        if not selected:
            raise ValueError('Cliente não encontrado.')
        members = next(m for m in group_clients(clients).values() if any(int(p['id']) == person_id for p in m))
        return selected, members

    def get(self, params):
        action = params.get('action', ['report'])[0]
        if action not in ('search','context','report'):
            raise ValueError('Consulta inválida.')
        with self.connect() as conn:
            conn.timeout = 120
            cur = conn.cursor()
            if action == 'search':
                q = params.get('q', [''])[0].strip()[:150]
                if len(q) < 2:
                    return dict(results=[])
                clients = self.rows(cur.execute(PEOPLE))
                term = normalize(q)
                results = []
                for gid, members in group_clients(clients).items():
                    matches = [p for p in members if any(term in normalize(p.get(k)) for k in ('nome','groupName','codigo','documento'))]
                    if not matches:
                        continue
                    p = matches[0]
                    results.append(dict(personId=p['id'], groupId=gid if len(members)>1 else None,
                        name=group_label(members,p), matchedName=p['nome'], codigo=p['codigo']))
                results.sort(key=lambda p: (normalize(p['name']) != term, normalize(p['name'])))
                results = results[:100]
                return dict(results=results)
            opt = options(params)
            selected, members = self.members(cur, opt['personId'])
            if opt['unitId'] and opt['unitId'] not in {p['id'] for p in members}:
                raise ValueError('A unidade não pertence ao grupo selecionado.')
            ids = [p['id'] for p in members]
            marks = ','.join('?' for _ in ids)
            scope = dict(name=group_label(members, selected), groupId=min(int(p['id']) for p in members) if len(members)>1 else None,
                         members=[{k:p[k] for k in ('id','codigo','nome','documento')} for p in members])
            if action == 'context':
                seller_sql = f'''SELECT DISTINCT S.HANDLE AS id, S.NOME AS nome FROM GN_PESSOAS S WHERE S.HANDLE IN (
SELECT AGENTEVENDAS FROM FN_DOCUMENTOS WHERE PESSOA IN ({marks})
UNION SELECT AGENTEVENDAS FROM CM_ORDENSVENDA WHERE PESSOA IN ({marks})
UNION SELECT AGENTEVENDAS FROM CM_CONTRATOS WHERE PESSOA IN ({marks})) ORDER BY S.NOME'''
                return dict(scope=scope, sellers=self.rows(cur.execute(seller_sql, *ids,*ids,*ids)))
            ids = [opt['unitId']] if opt['unitId'] else ids
            marks = ','.join('?' for _ in ids)
            seller, seller_params = (' AND COALESCE(A.AGENTEVENDAS,0)=?', [opt['sellerId']]) if opt['sellerId'] is not None else ('', [])
            sales_from = DETAILS[DETAILS.index('FROM FN_DOCUMENTOS'):].split('ORDER BY')[0].format(ids=marks, category_filter=category_filter(opt['category'])) + seller
            today = date.today()
            sales_sql = '''SELECT A.HANDLE AS documentId,A.DOCUMENTODIGITADO AS number,CAST(A.DATAEMISSAO AS date) AS day,A.ORDEMVENDA AS orderId,
PROD.HANDLE AS productId,PROD.CODIGOREFERENCIA AS codigo,PROD.NOME AS nome,SUM(ITEM.QUANTIDADE) AS quantity,
SUM(ITEM.VALORLIQUIDO + ITEM.SEGURO + ITEM.FRETE + ITEM.OUTROS) AS value,SUM(ITEM.VALORLIQUIDO) AS net
''' + sales_from + ' GROUP BY A.HANDLE,A.DOCUMENTODIGITADO,CAST(A.DATAEMISSAO AS date),A.ORDEMVENDA,PROD.HANDLE,PROD.CODIGOREFERENCIA,PROD.NOME'
            sales = self.rows(cur.execute(sales_sql, *ids,date(1900,1,1),today+timedelta(days=1),*seller_params))
            orders_from = OPEN_ORDERS[OPEN_ORDERS.index('FROM CM_ORDENSVENDA'):].format(ids=marks).replace('OV.STATUS NOT IN (6, 5, 4)','OV.STATUS <> 5')
            item_filter = category_filter(opt['category'])
            order_items = f'''SELECT SUM(COALESCE(I.VALORLIQUIDO,0)) AS value,COUNT(DISTINCT I.PRODUTO) AS productCount
FROM CM_ORDEMVENDAITENS I LEFT JOIN PD_PRODUTOS P ON P.HANDLE=I.PRODUTO
LEFT JOIN PD_FAMILIASPRODUTOS FAM ON FAM.HANDLE=P.FAMILIA
WHERE I.ORDEMVENDA=OV.HANDLE AND {item_filter}'''
            order_value = 'OV.VALORLIQUIDO' if opt['category']=='all' else 'IT.value'
            order_scope = orders_from.replace('WHERE OV.PESSOA', 'CROSS APPLY ('+order_items+') IT WHERE OV.PESSOA',1)
            if opt['category']!='all': order_scope += ' AND IT.productCount>0'
            order_sql = f'''SELECT OV.HANDLE AS id,CAST(OV.NUMEROOV AS varchar(50)) AS number,CAST(OV.DATAINCLUSAO AS date) AS day,
{order_value} AS value,OV.STATUS AS status,IT.productCount
''' + order_scope + seller.replace('A.','OV.') + ' AND OV.DATAINCLUSAO < ?'
            orders = self.rows(cur.execute(order_sql,*ids,*seller_params,today+timedelta(days=1)))
            discount_from = orders_from.replace('WHERE OV.PESSOA', 'JOIN CM_ORDEMVENDAITENS I ON I.ORDEMVENDA=OV.HANDLE JOIN PD_PRODUTOS P ON P.HANDLE=I.PRODUTO LEFT JOIN PD_FAMILIASPRODUTOS FAM ON FAM.HANDLE=P.FAMILIA WHERE OV.PESSOA',1)
            discounts = self.rows(cur.execute('SELECT I.HANDLE AS id,OV.NUMEROOV AS number,CAST(OV.DATAINCLUSAO AS date) AS day,I.PRODUTO AS productId,P.CODIGOREFERENCIA AS codigo,P.NOME AS nome,I.QUANTIDADE AS quantity,I.K_NEGOCIACAO AS discount ' + discount_from + ' AND '+item_filter + seller.replace('A.','OV.') + ' AND OV.DATAINCLUSAO < ?',*ids,*seller_params,today+timedelta(days=1)))
            proposal_items = f"""SELECT SUM(COALESCE(I.VALORLIQUIDO,0)) AS value,COUNT(*) AS itemCount
FROM CM_CONTRATOITENS I LEFT JOIN PD_PRODUTOS P ON P.HANDLE=I.PRODUTO
LEFT JOIN PD_FAMILIASPRODUTOS FAM ON FAM.HANDLE=P.FAMILIA
WHERE I.CONTRATO=A.HANDLE AND {item_filter}"""
            proposal_join = ' CROSS APPLY ('+proposal_items+') IT '
            proposal_value = 'A.K_VALORTOTACIPI' if opt['category']=='all' else 'IT.value'
            proposal_condition = '' if opt['category']=='all' else ' AND IT.itemCount>0'
            proposal_from = OPEN_PROPOSALS[OPEN_PROPOSALS.index('FROM CM_CONTRATOS'):].format(ids=marks).replace('WHERE A.PESSOA',proposal_join+'WHERE A.PESSOA',1) + seller + proposal_condition
            open_proposals = self.rows(cur.execute(f'SELECT A.HANDLE AS id,A.NUMERO AS number,A.DATAINCLUSAO AS day,{proposal_value} AS value ' + proposal_from, *ids,*seller_params))
            proposals = self.rows(cur.execute(f'SELECT TOP (1) A.HANDLE AS id,A.NUMERO AS number,A.DATAINCLUSAO AS day,{proposal_value} AS value FROM CM_CONTRATOS A '+proposal_join+f' WHERE A.PESSOA IN ({marks}) AND A.ORIGINAL IS NULL' + seller + proposal_condition + ' AND A.DATAINCLUSAO < ? ORDER BY A.DATAINCLUSAO DESC,A.HANDLE DESC',*ids,*seller_params,today+timedelta(days=1)))
            # Receipt indicator was removed from this view; do not query financial installments.
            receipts = []

        return dict(scope=scope,filters={k:v.isoformat() if isinstance(v,date) else v for k,v in opt.items()},generatedAt=datetime.now().astimezone().isoformat(),
                    **analyze(sales,orders,proposals,open_proposals,receipts,opt['start'],opt['end'],opt['recentMonths'],today,discounts))
