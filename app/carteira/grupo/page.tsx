'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BarChart3, RefreshCw, Search, Users, Printer } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { groupPrintHtml } from '@/lib/group-print';
import { printProposalDocument } from '@/lib/proposal-print';
import { PortfolioNav } from '@/components/portfolio-nav';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

type Candidate = { personId: number; groupId: number | null; name: string; matchedName: string; codigo: string };
type Member = { id: number; codigo: string; nome: string; documento: string };
type Context = { scope: { name: string; groupId: number | null; members: Member[] }; sellers: { id: number; nome: string }[] };
type Event = { id: number; number: string; day: string; value: number };
type Product = { id: number; codigo: string; nome: string; quantity: number; revenue: number; orders: number; invoices: number; lastPurchase: string | null; averagePrice: number | null; lastPrice: number | null; averageDiscount: number | null; maxDiscount: number | null };
export type Report = {
  scope: Context['scope']; generatedAt: string;
  filters: { category: string; start: string; end: string; recentMonths: number; personId: number; unitId: number; sellerId: number | null };
  cards: { revenue: number; invoiceCount: number; averageTicket: number | null; openOrders: number; openOrderCount: number; openProposals: number; openProposalCount: number; averageReceiptDays: number | null; settledInstallments: number; maxDiscount: number | null };
  activity: { lastInvoice: Event | null; lastOrder: Event | null; lastProposal: Event | null; daysWithoutInvoice: number | null; daysWithoutOrder: number | null; daysWithoutProposal: number | null };
  behavior: { averageGap: number | null; maxGap: number | null; purchaseDays: number; historyStart: string | null; largestOrder: Event | null; averageProductsPerOrder: number | null; orderCount: number; unlinkedInvoices: number; distinctProducts: number; peakMonth: { month: string; value: number } | null; greatestDiscount: { number: number; day: string; codigo: string; nome: string; discount: number } | null };
  leaders: { quantity: Product | null; revenue: Product | null; recurrence: Product | null; discount: { codigo: string; nome: string; averageDiscount: number } | null };
  monthly: { month: string; value: number }[]; products: Product[];
  abandoned: { id: number; codigo: string; nome: string; lastPurchase: string; daysWithoutPurchase: number; activeMonths: number }[];
  newProducts: { id: number; codigo: string; nome: string; firstPurchase: string; lastPurchase: string }[];
  recentStart: string; discountNote: string;
};
const num = (n: number | null | undefined, digits = 1) => n == null ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: digits });
const brl = (n: number | null | undefined) => n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const day = (s?: string | null) => s ? s.slice(0, 10).split('-').reverse().join('/') : 'Sem registro';
const pct = (n: number | null) => n == null ? '—' : `${num(n, 2)}%`;
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const input = 'mt-1 w-full rounded-lg border border-[#d9dbea] bg-white px-3 py-2 text-sm';
const panel = 'rounded-2xl border border-[#ddddeb] bg-white p-5';
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
async function get<T>(params: URLSearchParams, signal: AbortSignal): Promise<T> {
  const r = await fetch(`/api/group-dashboard?${params}`, { signal });
  const value = await r.json() as T & { error?: string };
  if (!r.ok) throw new Error(value.error || 'Não foi possível carregar o painel.');
  return value;
}
function Metric({ title, value, note }: { title: string; value: string; note: string }) {
  return <article className={panel}><p className="text-xs text-[#71728a]">{title}</p><p className="mt-3 break-words text-2xl font-semibold text-[#312d5e]">{value}</p><p className="mt-2 text-xs leading-relaxed text-[#71728a]">{note}</p></article>;
}
function EventCard({ title, event, days, note }: { title: string; event: Event | null; days: number | null; note: string }) {
  return <article className={panel}><h3 className="font-semibold">{title}</h3>{event ? <><p className="mt-3 text-sm text-[#008ad0]">{day(event.day)} · {event.number}</p><p className="mt-2 text-xl font-semibold">{brl(event.value)}</p><p className="mt-3 text-sm">{num(days, 0)} dias desde este registro</p></> : <p className="py-4 text-sm text-[#71728a]">Sem registro no escopo selecionado.</p>}<p className="mt-3 text-xs text-[#71728a]">{note}</p></article>;
}

export default function GroupDashboardPage() {
  const [term, setTerm] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [chosen, setChosen] = useState<Candidate | null>(null);
  const [context, setContext] = useState<Context | null>(null);
  const [searching, setSearching] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [category, setCategory] = useState('all');
  const [months, setMonths] = useState('12');
  const [start, setStart] = useState(`${new Date().getFullYear()}-01-01`);
  const [end, setEnd] = useState(today());
  const [unit, setUnit] = useState('0');
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState('');
  const [searchError, setSearchError] = useState('');
  const [productTerm, setProductTerm] = useState('');
  const [page, setPage] = useState(0);
  const [signalTab, setSignalTab] = useState<'abandoned' | 'new'>('abandoned');
  const [signalPage, setSignalPage] = useState(0);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (term.trim().length < 2) { setCandidates([]); setSearching(false); return; }
    const c = new AbortController(); setSearchError(''); setSearching(true);
    const timer = setTimeout(() => { void get<{ results: Candidate[] }>(new URLSearchParams({ action: 'search', q: term.trim() }), c.signal).then(r => { if (!c.signal.aborted) setCandidates(r.results); }).catch(e => { if (!c.signal.aborted) setSearchError(e.message); }).finally(() => { if (!c.signal.aborted) setSearching(false); }); }, 350);
    return () => { clearTimeout(timer); c.abort(); };
  }, [term]);
  useEffect(() => {
    request.current?.abort(); setLoading(false); setData(null); setContext(null); setUnit('0'); setError('');
    if (!chosen) return;
    const c = new AbortController(); setContextLoading(true);
    void get<Context>(new URLSearchParams({ action: 'context', personId: String(chosen.personId) }), c.signal).then(r => { if (!c.signal.aborted) setContext(r); }).catch(e => { if (!c.signal.aborted) setError(e.message); }).finally(() => { if (!c.signal.aborted) setContextLoading(false); });
    return () => c.abort();
  }, [chosen]);
  async function analyze(e: React.FormEvent) {
    e.preventDefault(); if (!chosen || !context) return;
    request.current?.abort(); const c = new AbortController(); request.current = c;
    setLoading(true); setError(''); setData(null); setPage(0); setSignalPage(0); setProductTerm('');
    const params = new URLSearchParams({ personId: String(chosen.personId), unitId: unit, category, months: months === 'custom' ? '12' : months });
    if (months === 'custom') { params.set('start', start); params.set('end', end); }
    try { const r = await get<Report>(params, c.signal); if (!c.signal.aborted) setData(r); }
    catch (e) { if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'Falha ao analisar.'); }
    finally { if (!c.signal.aborted) setLoading(false); }
  }
  async function printReport() {
    if (!data || printing) return;
    const report = data;
    setPrinting(true); setError('');
    try {
      const user = await fetch('/api/me').then(r => r.ok ? r.json() as Promise<{ login?: string }> : null).catch(() => null);
      await printProposalDocument(groupPrintHtml(report, { login: user?.login || 'Não identificado (sem autenticação Windows)', printedAt: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }), logo: new URL('/logo-dmb.jpg', window.location.origin).href }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível preparar a impressão.'); }
    finally { setPrinting(false); }
  }
  const products = (data?.products ?? []).filter(p => norm(`${p.codigo} ${p.nome}`).includes(norm(productTerm)));
  return <main className="min-h-screen bg-[#f5f6fb] text-[#24233d]">
    <header className="border-b bg-white px-6 py-4"><div className="mx-auto flex max-w-[1500px] items-center gap-4"><a href="/" className="flex items-center gap-2 text-sm text-[#62637b]"><ArrowLeft className="size-4" />Voltar ao faturamento</a><div className="border-l pl-4"><p className="text-xs uppercase tracking-widest text-[#71728a]">Carteira inteligente</p><h1 className="text-lg font-semibold">Visão do grupo</h1></div></div></header>
    <PortfolioNav />
    <div className="mx-auto max-w-[1500px] space-y-5 px-5 py-6">
      <div><h2 className="text-2xl font-semibold">Relacionamento e comportamento de compra</h2><p className="mt-2 text-sm text-[#71728a]">Faturamento, atividade comercial e produtos do grupo em um só painel.</p></div>
      <section className={panel}><label className="text-sm font-semibold">Grupo / cliente<div className="mt-2 flex items-center gap-2 rounded-lg border px-3"><Search className="size-4 text-[#71728a]" /><input aria-label="Buscar grupo ou cliente" placeholder="Digite nome, grupo, código ou CNPJ" value={term} onChange={e => setTerm(e.target.value)} className="w-full py-3 text-sm outline-none" /></div></label>
        {searching && <p role="status" className="mt-2 text-xs">Buscando…</p>}{searchError && <p role="alert" className="mt-2 text-sm text-red-800">{searchError}</p>}
        {!searching && term.trim().length >= 2 && !candidates.length && !searchError && <p className="mt-2 text-sm">Nenhum cadastro encontrado.</p>}
        {!!candidates.length && <div className="mt-3 max-h-56 overflow-auto rounded-lg border">{candidates.map(c => <button key={`${c.groupId ?? 'person'}-${c.personId}`} onClick={() => { setChosen(c); setTerm(''); setCandidates([]); }} className="block w-full border-b px-4 py-3 text-left text-sm hover:bg-[#eff7fc]"><strong>{c.name}</strong><span className="ml-2 text-xs text-[#71728a]">{c.groupId ? 'Grupo empresarial' : 'Cliente individual'}</span><span className="mt-1 block text-xs">Encontrado em: {c.codigo} · {c.matchedName}</span></button>)}</div>}
        {chosen && <p className="mt-3 flex items-center gap-2 text-sm text-[#312d5e]"><Users className="size-4" /><strong>{context?.scope.name ?? chosen.name}</strong> · {contextLoading ? 'Carregando unidades…' : `${context?.scope.members.length ?? 0} unidade(s)`}</p>}
      </section>
      <form onSubmit={analyze} className={`${panel} grid items-end gap-4 md:grid-cols-2 xl:grid-cols-4`}>
        <label className="text-sm">Tipo de produto<select value={category} onChange={e => setCategory(e.target.value)} className={input}><option value="all">Geral</option><option value="pecas">Peças</option><option value="implementos">Implementos</option></select></label>
        <label className="text-sm">Período de análise<select value={months} onChange={e => setMonths(e.target.value)} className={input}>{[3,6,12,24,36,60].map(m => <option key={m} value={m}>Últimos {m} meses</option>)}<option value="custom">Período personalizado</option></select></label>
        <label className="text-sm">Unidade / filial do cliente<select value={unit} onChange={e => setUnit(e.target.value)} className={input} disabled={!context}><option value="0">Todas as unidades</option>{context?.scope.members.map(m => <option key={m.id} value={m.id}>{m.codigo} · {m.nome}</option>)}</select></label>
        <Button type="submit" disabled={!context || loading || contextLoading} className="bg-[#312d5e] text-white"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />{loading ? 'Analisando…' : 'Analisar grupo'}</Button>
        {months === 'custom' && <><label className="text-sm">Data inicial<input type="date" required value={start} max={end} onChange={e => setStart(e.target.value)} className={input} /></label><label className="text-sm">Data final<input type="date" required value={end} min={start} max={today()} onChange={e => setEnd(e.target.value)} className={input} /></label></>}
      </form>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
      {loading && <div role="status" className={`${panel} py-12 text-center`}><RefreshCw className="mx-auto mb-3 size-7 animate-spin text-[#008ad0]" />Consolidando faturamento, pedidos, propostas e produtos…</div>}
      {!data && !loading && !error && <div className={`${panel} py-10 text-center text-[#71728a]`}><BarChart3 className="mx-auto mb-3 size-8 text-[#008ad0]" />Selecione um grupo ou cliente e clique em Analisar grupo.</div>}
      {data && <>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[#71728a]">Imprime a análise completa e todos os produtos, incluindo outras páginas e ambas as listas de acompanhamento.</p><Button variant="outline" disabled={printing || loading} onClick={printReport}><Printer className="size-4" />{printing ? 'Preparando impressão…' : 'Imprimir / Salvar PDF'}</Button></div>
        <div className="rounded-xl bg-[#e9f5fc] p-4 text-sm"><strong>{data.scope.name}</strong> · {day(data.filters.start)} a {day(data.filters.end)}<p className="mt-1 text-xs text-[#62637b]">Unidade: {data.filters.unitId ? data.scope.members.find(m => m.id === data.filters.unitId)?.nome : 'Todas'} · Categoria: {data.filters.category === 'pecas' ? 'Peças' : data.filters.category === 'implementos' ? 'Implementos' : 'Geral'} · Atualizado em {new Date(data.generatedAt).toLocaleString('pt-BR')}</p></div>
        <section aria-label="Indicadores executivos" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Faturamento do período" value={brl(data.cards.revenue)} note={`${num(data.cards.invoiceCount,0)} documentos · antes das devoluções`} />
          <Metric title="Pedidos em aberto" value={brl(data.cards.openOrders)} note={`${num(data.cards.openOrderCount,0)} pedidos · posição atual, todas as datas`} />
          <Metric title="Propostas em elaboração" value={brl(data.cards.openProposals)} note={`${num(data.cards.openProposalCount,0)} propostas sem pedido vinculado · posição atual`} />
          <Metric title="Último faturamento" value={day(data.activity.lastInvoice?.day)} note="Última nota no histórico disponível" />
          <Metric title="Dias sem faturar" value={num(data.activity.daysWithoutInvoice,0)} note="Dias desde a última nota até hoje" />
        </section>
        <section><h2 className="mb-3 text-lg font-semibold">Relacionamento / atividade comercial</h2><div className="grid gap-3 lg:grid-cols-3"><EventCard title="Última proposta cadastrada" event={data.activity.lastProposal} days={data.activity.daysWithoutProposal} note="Qualquer situação; não se limita às propostas em elaboração." /><EventCard title="Último pedido" event={data.activity.lastOrder} days={data.activity.daysWithoutOrder} note="Pedido não cancelado, no escopo comercial." /><EventCard title="Último faturamento" event={data.activity.lastInvoice} days={data.activity.daysWithoutInvoice} note="Faturamento antes das devoluções, no escopo fiscal." /></div></section>
        <section className={panel}><h2 className="text-lg font-semibold">Comportamento de compra</h2><p className="mt-1 text-xs text-[#71728a]">Histórico disponível desde {day(data.behavior.historyStart)} · {num(data.behavior.purchaseDays,0)} dias de compra</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric title="Mês de maior compra" value={data.behavior.peakMonth ? data.behavior.peakMonth.month.split('-').reverse().join('/') : '—'} note={brl(data.behavior.peakMonth?.value)} /><Metric title="Maior pedido histórico" value={brl(data.behavior.largestOrder?.value)} note={data.behavior.largestOrder ? `OV ${data.behavior.largestOrder.number} · ${day(data.behavior.largestOrder.day)}` : 'Sem registro'} /><Metric title="Produtos por pedido" value={num(data.behavior.averageProductsPerOrder)} note={`Média de SKUs distintos em ${num(data.behavior.orderCount,0)} pedidos do período`} /><Metric title="Produtos distintos comprados" value={num(data.behavior.distinctProducts,0)} note="Produtos faturados no período selecionado" /><Metric title="Produtos sem recompra" value={num(data.abandoned.length,0)} note={`Sem compras nos últimos ${data.filters.recentMonths} meses da análise; histórico recorrente anterior`} /><Metric title="Produtos novos" value={num(data.newProducts.length,0)} note={`Primeira compra no histórico disponível nos últimos ${data.filters.recentMonths} meses da análise`} /></div>
        </section>
        <section className={panel}><h2 className="font-semibold">Faturamento mensal no período</h2>{data.monthly.length ? <ChartContainer config={{ value: { label: 'Faturamento', color: '#008ad0' } }} className="mt-4 h-[260px] w-full"><BarChart data={data.monthly}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="month" tickFormatter={v => String(v).split('-').reverse().join('/')} tick={{fontSize:11}} /><YAxis tickFormatter={v => `${num(Number(v)/1000,0)}k`} tick={{fontSize:11}} /><ChartTooltip content={<ChartTooltipContent formatter={v => brl(Number(v))} />} /><Bar dataKey="value" fill="#008ad0" radius={[5,5,0,0]} /></BarChart></ChartContainer> : <p className="py-8 text-center text-sm text-[#71728a]">Sem faturamento no período.</p>}</section>
        <section><h2 className="mb-3 text-lg font-semibold">Produtos em destaque</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
          ['Mais comprado em quantidade', data.leaders.quantity, data.leaders.quantity ? `${num(data.leaders.quantity.quantity,4)} unidades` : '—'],
          ['Maior faturamento', data.leaders.revenue, brl(data.leaders.revenue?.revenue)],
          ['Mais recorrente', data.leaders.recurrence, data.leaders.recurrence ? `${num(data.leaders.recurrence.orders,0)} pedidos faturados` : 'Sem vínculo de pedido'],
          ['Maior desconto médio', data.leaders.discount, pct(data.leaders.discount?.averageDiscount ?? null)],
        ].map(([label,p,value]) => { const product = p as {codigo:string;nome:string} | null; return <article key={String(label)} className={panel}><p className="text-xs text-[#71728a]">{String(label)}</p><p className="mt-3 text-xl font-semibold text-[#312d5e]">{String(value)}</p><p className="mt-2 text-xs text-[#008ad0]">{product?.codigo}</p><p className="mt-1 text-sm">{product?.nome ?? 'Sem dados suficientes'}</p></article>; })}</div>
        </section>
        <section className="overflow-hidden rounded-2xl border border-[#ddddeb] bg-white"><div className="flex flex-wrap justify-between gap-3 p-5"><div><h2 className="font-semibold">Produtos comprados no período</h2><p className="mt-1 text-xs text-[#71728a]">{num(products.length,0)} produtos · preços líquidos por unidade · descontos nos pedidos do período</p></div><input aria-label="Filtrar produtos do grupo" value={productTerm} onChange={e => { setProductTerm(e.target.value); setPage(0); }} placeholder="Código ou produto" className="rounded-lg border px-3 py-2 text-sm" /></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-[#f7f9fc]"><tr>{['Produto','Qtd.','Faturamento','Nº pedidos','Última compra','Preço médio','Último preço','Desc. médio','Maior desc.'].map(t => <th className="whitespace-nowrap px-3 py-3 text-left text-xs" key={t}>{t}</th>)}</tr></thead><tbody>{products.slice(page*25,(page+1)*25).map(p => <tr key={p.id} className="border-t"><td className="min-w-[230px] px-3 py-3"><span className="block text-xs text-[#008ad0]">{p.codigo}</span>{p.nome}</td>{[num(p.quantity,4),brl(p.revenue),num(p.orders,0),day(p.lastPurchase),brl(p.averagePrice),brl(p.lastPrice),pct(p.averageDiscount),pct(p.maxDiscount)].map((v,i) => <td key={i} className="whitespace-nowrap px-3 py-3 tabular-nums">{v}</td>)}</tr>)}{!products.length && <tr><td colSpan={9} className="p-8 text-center text-[#71728a]">Nenhum produto nesta seleção.</td></tr>}</tbody></table></div><Pagination page={page} count={products.length} onChange={setPage} />{data.behavior.unlinkedInvoices > 0 && <p className="border-t p-4 text-xs text-[#71728a]">{data.behavior.unlinkedInvoices} notas sem vínculo direto de ordem de venda. Entram no faturamento; não são contadas como pedidos na recorrência.</p>}</section>
        <section className={panel}><div className="flex flex-wrap gap-2"><Button variant={signalTab === 'abandoned' ? 'default' : 'outline'} onClick={() => {setSignalTab('abandoned');setSignalPage(0);}}>Produtos sem recompra ({data.abandoned.length})</Button><Button variant={signalTab === 'new' ? 'default' : 'outline'} onClick={() => {setSignalTab('new');setSignalPage(0);}}>Produtos novos ({data.newProducts.length})</Button></div><p className="my-3 text-xs leading-relaxed text-[#71728a]">Janela: {day(data.recentStart)} a {day(data.filters.end)}. Sem recompra: comprado em pelo menos 3 meses distintos nos 12 meses anteriores à janela e sem faturamento nela. Novo: primeira compra registrada no histórico disponível dentro da janela.</p>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="py-3 text-left">Produto</th><th className="py-3 text-left">{signalTab === 'new' ? 'Primeira compra' : 'Última compra'}</th><th className="py-3 text-right">{signalTab === 'new' ? 'Última compra' : 'Dias sem comprar'}</th></tr></thead><tbody>{signalTab === 'abandoned' ? data.abandoned.slice(signalPage*25,(signalPage+1)*25).map(p => <tr className="border-t" key={p.id}><td className="py-3 pr-4"><span className="block text-xs text-[#008ad0]">{p.codigo}</span>{p.nome}<small className="block text-[#71728a]">Comprado em {p.activeMonths} meses do histórico anterior</small></td><td>{day(p.lastPurchase)}</td><td className="text-right">{num(p.daysWithoutPurchase,0)}</td></tr>) : data.newProducts.slice(signalPage*25,(signalPage+1)*25).map(p => <tr className="border-t" key={p.id}><td className="py-3 pr-4"><span className="block text-xs text-[#008ad0]">{p.codigo}</span>{p.nome}</td><td>{day(p.firstPurchase)}</td><td className="text-right">{day(p.lastPurchase)}</td></tr>)}</tbody></table></div>{!(signalTab === 'new' ? data.newProducts.length : data.abandoned.length) && <p className="py-6 text-center text-sm text-[#71728a]">Nenhum produto atende a estes critérios.</p>}<Pagination page={signalPage} count={signalTab === 'new' ? data.newProducts.length : data.abandoned.length} onChange={setSignalPage} />
        </section>
        <details className={panel}><summary className="cursor-pointer font-semibold">Fontes e critérios dos indicadores</summary><div className="mt-4 space-y-3 text-sm leading-relaxed text-[#62637b]"><p>O grupo segue a mesma identificação da Carteira inteligente: vínculos de grupo empresarial, nome de grupo cadastrado e raiz de CNPJ, incluindo unidades ligadas por esses vínculos. Sem vínculo, considera somente a pessoa selecionada.</p><p>Filial refere-se à unidade do cliente. Os indicadores consideram todos os vendedores.</p><p>Faturamento segue o escopo fiscal da análise existente (incluindo filial fiscal 1), antes de devoluções. Na categoria Geral, pedidos/propostas usam o valor do cabeçalho. Em Peças ou Implementos, usam apenas o valor líquido dos itens da categoria selecionada. Preço médio é o líquido dos itens dividido pela quantidade; último preço é a média líquida da última nota com o produto no período.</p><p>Atividade e maior pedido usam todo o histórico disponível até hoje. Produtos novos/sem recompra são avaliados em relação ao fim do período selecionado.</p><p>Descontos dos produtos: percentual comercial de negociação dos itens de pedidos não cancelados, com média ponderada pela quantidade no período.</p></div></details>
      </>}
    </div>
  </main>;
}

function Pagination({ page, count, onChange }: { page: number; count: number; onChange: (p:number)=>void }) {
  if (count <= 25) return null;
  return <div className="flex items-center justify-between gap-3 border-t p-4 text-xs"><Button variant="outline" disabled={!page} onClick={()=>onChange(page-1)}>Anterior</Button><span>{page+1} / {Math.ceil(count/25)}</span><Button variant="outline" disabled={(page+1)*25>=count} onClick={()=>onChange(page+1)}>Próxima</Button></div>;
}
