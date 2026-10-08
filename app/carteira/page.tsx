'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, RefreshCw, Search, Users, Printer, Lightbulb, FileSpreadsheet } from 'lucide-react';
import { portfolioPrintHtml, proposalPrintHtml, printProposalDocument, type PrintableProposal } from '@/lib/proposal-print';
import { PortfolioNav } from '@/components/portfolio-nav';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from '@/components/ui/sheet';

type Filters = { years: number; baseYear: number; category: string; mode: string };
type Unit = { id: number; codigo: string; nome: string; documento: string; historicalRevenue: number; lastSale: string | null; proposalCount: number; proposalValue: number; lastOrder: string | null; hasBaseYearOrder?: boolean };
type Group = Omit<Unit, 'id' | 'codigo' | 'nome' | 'documento'> & { id: string; name: string; members: Unit[] };
type Report = { generatedAt: string; filters: Filters; groups: Group[]; period: { historyStart: string; historyEnd: string; inactiveStart: string; inactiveEnd: string } };
type Proposal = { id: number; numero: string; data: string; itemCount: number; valor: number };
type PanelTarget = { group: Group; unit?: Unit; order?: boolean };
type DetailCache = Map<string, Promise<unknown>>;
type SortColumn = 'name' | 'proposalCount' | 'proposalValue' | 'lastOrder' | 'lastSale' | 'hasBaseYearOrder';
type ListedProposal = Proposal & { unit: Unit };
type Product = { id: number; codigo: string; nome: string; familia: string; quantidade: number; valor: number };
const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const number = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
const day = (s: string | null) => s ? s.slice(0, 10).split('-').reverse().join('/') : '—';
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const inputClass = 'mt-1 w-full rounded-lg border border-[#d9dbea] bg-white px-3 py-2 text-sm text-[#24233d]';
const th = 'px-4 py-3 text-left text-xs font-semibold text-[#62637b]';
const td = 'px-4 py-3 text-sm';
const yearNow = () => Number(new Intl.DateTimeFormat('en', { timeZone: 'America/Sao_Paulo', year: 'numeric' }).format(new Date()));
const query = (filters: Filters, extra: Record<string, string> = {}) => new URLSearchParams({ years: String(filters.years), baseYear: String(filters.baseYear), category: filters.category, mode: filters.mode, ...extra });

async function read<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error || 'Não foi possível carregar os dados. Tente novamente.');
  return body as T;
}

function Pages({ page, count, size, onChange }: { page: number; count: number; size: number; onChange: (page: number) => void }) {
  if (!count) return null;
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-xs text-[#62637b]">
    <span>{number(page * size + 1)}–{number(Math.min((page + 1) * size, count))} de {number(count)}</span>
    <div className="flex items-center gap-2"><Button variant="outline" disabled={!page} onClick={() => onChange(page - 1)}>Anterior</Button><span>Página {number(page + 1)} de {number(Math.ceil(count / size))}</span><Button variant="outline" disabled={(page + 1) * size >= count} onClick={() => onChange(page + 1)}>Próxima</Button></div>
  </div>;
}

export default function PortfolioPage() {
  const [filters, setFilters] = useState<Filters>({ years: 10, baseYear: yearNow(), category: 'all', mode: 'base' });
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [printingReport, setPrintingReport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [reportPrintError, setReportPrintError] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn>('proposalValue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<PanelTarget | null>(null);
  const detailCache = useRef<DetailCache>(new Map());
  const opener = useRef<HTMLElement | null>(null);
  function openPanel(group: Group, unit?: Unit, order = false) { opener.current = document.activeElement as HTMLElement; setPanel({ group, unit, order }); }
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function load(event: React.FormEvent) {
    event.preventDefault();
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setPanel(null); detailCache.current = new Map();
    setLoading(true); setError(''); setData(null); setExpanded(new Set()); setPage(0);
    try { const result = await read<Report>(`/api/portfolio?${query(filters)}`, controller.signal); if (!controller.signal.aborted) setData(result); }
    catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Falha ao analisar.'); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }
  const term = normalize(search.trim());
  const groups = (data?.groups ?? []).filter(g => !term || normalize([g.name, ...g.members.flatMap(m => [m.codigo, m.nome, m.documento])].join(' ')).includes(term)).sort((a, b) => {
    const left = sortColumn === 'hasBaseYearOrder' ? Number(!!a.hasBaseYearOrder) : a[sortColumn];
    const right = sortColumn === 'hasBaseYearOrder' ? Number(!!b.hasBaseYearOrder) : b[sortColumn];
    // Missing dates stay at the end in either direction.
    if (left == null || right == null) {
      if (left != null) return -1;
      if (right != null) return 1;
    }
    const compared = typeof left === 'number' && typeof right === 'number' ? left - right : String(left ?? '').localeCompare(String(right ?? ''), 'pt-BR', { sensitivity: 'base', numeric: true });
    return compared * (sortDirection === 'asc' ? 1 : -1) || a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id);
  });
  async function printReport() {
    if (!data) return;
    setPrintingReport(true); setReportPrintError('');
    try {
      const user = await read<{ login?: string }>('/api/me').catch(() => null);
      await printProposalDocument(portfolioPrintHtml({ groups, expanded, category: ({ all: 'Geral', pecas: 'Peças', implementos: 'Implementos' } as Record<string,string>)[data.filters.category], years: data.filters.years, baseYear: data.filters.baseYear, period: data.period, search: search.trim(), login: user?.login || 'Não identificado (sem autenticação Windows)', printedAt: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }), generatedAt: new Date(data.generatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }), logo: new URL('/logo-dmb.jpg', window.location.origin).href }));
    } catch (e) { setReportPrintError(e instanceof Error ? e.message : 'Não foi possível preparar a impressão.'); }
    finally { setPrintingReport(false); }
  }
  async function exportExcel() {
    if (!data) return;
    setExporting(true); setExportError('');
    try {
      const { exportPortfolioExcel } = await import('@/lib/portfolio-excel');
      await exportPortfolioExcel({ ...data, groups, search: search.trim() });
    } catch (e) { setExportError(e instanceof Error ? e.message : 'Não foi possível exportar o Excel. Tente novamente.'); }
    finally { setExporting(false); }
  }
  const toggle = (id: string) => setExpanded(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  return <main className="min-h-screen bg-[#f5f6fb] text-[#24233d]">
    <header className="border-b border-[#ddddeb] bg-white px-6 py-4"><div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-4"><a href="/" className="flex items-center gap-2 text-sm text-[#62637b]"><ArrowLeft className="size-4" />Voltar ao faturamento</a><div className="border-l pl-4"><p className="text-xs uppercase tracking-widest text-[#71728a]">Carteira inteligente</p><h1 className="text-lg font-semibold">Clientes que deixaram de comprar</h1></div></div></header>
    <PortfolioNav />
    <div className="mx-auto max-w-[1500px] space-y-5 px-5 py-7">
      <div><h2 className="text-2xl font-semibold">Análise de clientes por grupo</h2><p className="mt-2 text-sm text-[#62637b]">Encontre grupos com faturamento no histórico e sem compras no período de comparação. Expanda os grupos para ver as unidades e clique na quantidade de propostas para conferir os produtos no painel lateral.</p></div>
      <form onSubmit={load} className="rounded-2xl border border-[#ddddeb] bg-white p-5">
        <div className="grid items-end gap-4 md:grid-cols-2 xl:grid-cols-[.8fr_.8fr_1fr_1.6fr_auto]">
          <label className="text-sm font-medium">Período de análise (anos)<input type="number" min={1} max={50} required value={filters.years} onChange={e => setFilters({ ...filters, years: Number(e.target.value) })} className={inputClass} /></label>
          <label className="text-sm font-medium">Ano-base<input type="number" min={1901} max={yearNow()} required value={filters.baseYear} onChange={e => setFilters({ ...filters, baseYear: Number(e.target.value) })} className={inputClass} /></label>
          <label className="text-sm font-medium">Tipo de produto<select value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value })} className={inputClass}><option value="all">Geral</option><option value="pecas">Peças</option><option value="implementos">Implementos</option></select></label>
          <label className="text-sm font-medium">Sem faturamento<select value={filters.mode} onChange={e => setFilters({ ...filters, mode: e.target.value })} className={inputClass}><option value="base">No ano-base</option><option value="both">No ano-base e no ano anterior</option></select></label>
          <Button type="submit" disabled={loading} className="bg-[#312d5e] text-white hover:bg-[#454073]"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />{loading ? 'Analisando…' : 'Analisar clientes'}</Button>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-[#71728a]">O histórico começa em janeiro do ano-base menos o período informado. Uma compra de qualquer unidade impede que o grupo seja considerado sem compras. No ano vigente, a comparação vai até hoje.</p>
      </form>
      <details className="rounded-xl border border-[#ddddeb] bg-white px-5 py-3 text-sm text-[#62637b]"><summary className="cursor-pointer font-medium">Critérios da análise</summary><div className="mt-3 space-y-2 leading-relaxed"><p>Grupos consolidados pelo cadastro atual: raiz de CNPJ, grupo empresarial e nome de grupo, inclusive vínculos entre filiais. CPF não é agrupado por raiz.</p><p>Faturamento conforme as regras fiscais da Análise de Faturamento, antes das devoluções. A ausência é verificada pela existência de faturamento, sem compensar compras com devoluções.</p><p>Propostas: posição atual em elaboração (status 1), sem pedido vinculado e com os demais critérios comerciais da consulta de propostas. Valores correspondem aos itens líquidos da categoria selecionada, para conferir com o detalhamento.</p><p>Último pedido: data de inclusão mais recente de pedido não cancelado dentro do escopo comercial, na categoria selecionada. Propostas e último pedido mostram a posição atual, mesmo quando o ano-base é anterior.</p><p>Peças ou implementos filtram tanto a atividade de compra quanto as propostas e o último pedido. No modo de dois anos sem compras, o ano anterior deixa de compor o período de compras históricas.</p></div></details>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}
      {loading && <div role="status" className="rounded-2xl border bg-white p-10 text-center"><RefreshCw className="mx-auto mb-3 size-7 animate-spin text-[#008ad0]" />Consolidando o histórico de faturamento dos grupos…<p className="mt-2 text-sm text-[#71728a]">A consulta de vários anos pode levar alguns instantes.</p></div>}
      {!data && !loading && !error && <div className="rounded-2xl border border-dashed border-[#cfd3e4] p-10 text-center text-[#62637b]"><Users className="mx-auto mb-3 size-8 text-[#008ad0]" />Defina o período e clique em Analisar clientes.</div>}
      {data && <>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[#71728a]">Excel: todos os grupos da busca e suas filiais. Impressão: grupos e filiais expandidas. Inclui todas as páginas.</p><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={exporting || loading || !groups.length} onClick={() => void exportExcel()} title="Exportar todos os grupos da busca e suas filiais para Excel"><FileSpreadsheet className="size-4" />{exporting ? 'Exportando…' : 'Exportar Excel'}</Button><Button variant="outline" disabled={printingReport || loading} onClick={() => void printReport()} title="Escolha uma impressora ou Salvar como PDF"><Printer className="size-4" />{printingReport ? 'Preparando impressão…' : 'Imprimir / Salvar PDF'}</Button></div></div>
        {exportError && <p role="alert" className="text-sm text-red-800">{exportError}</p>}
        {reportPrintError && <p role="alert" className="text-sm text-red-800">{reportPrintError}</p>}
        <div className="rounded-xl bg-[#e9f5fc] px-5 py-4 text-sm text-[#24607e]"><strong>{({ all: 'Geral', pecas: 'Peças', implementos: 'Implementos' } as Record<string, string>)[data.filters.category]}</strong> · Comprou de {day(data.period.historyStart)} a {day(data.period.historyEnd)} · Sem faturamento de {day(data.period.inactiveStart)} a {day(data.period.inactiveEnd)}<p className="mt-1 text-xs">Consulta concluída em {new Date(data.generatedAt).toLocaleString('pt-BR')}</p></div>
        <div className="grid gap-3 md:grid-cols-3">{[['Grupos sem compras', number(data.groups.length)], ['Propostas em elaboração', number(data.groups.reduce((s, g) => s + g.proposalCount, 0))], ['Valor líquido das propostas', money(data.groups.reduce((s, g) => s + g.proposalValue, 0))]].map(([label, value]) => <div key={label} className="rounded-xl border border-[#ddddeb] bg-white p-5"><p className="text-xs text-[#71728a]">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}</div>
        <section className="overflow-hidden rounded-2xl border border-[#ddddeb] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
            <div><h3 className="font-semibold">Grupos que deixaram de comprar</h3><p className="mt-1 text-xs text-[#71728a]">{number(groups.length)} grupos · expanda para ver as unidades/filiais</p></div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs text-[#62637b]">Classificar por<select value={sortColumn} onChange={e => { const column = e.target.value as SortColumn; setSortColumn(column); setSortDirection(column === 'name' ? 'asc' : 'desc'); setPage(0); }} className={inputClass}><option value="name">Grupo</option><option value="proposalCount">Propostas qtd.</option><option value="proposalValue">R$ propostas</option><option value="lastOrder">Último pedido</option><option value="lastSale">Último faturamento</option><option value="hasBaseYearOrder">Atenção exclusiva</option></select></label>
              <label className="text-xs text-[#62637b]">Ordem<select value={sortDirection} onChange={e => { setSortDirection(e.target.value as 'asc' | 'desc'); setPage(0); }} className={inputClass}><option value="asc">{sortColumn === 'name' ? 'A → Z' : sortColumn === 'lastOrder' || sortColumn === 'lastSale' ? 'Mais antigos primeiro' : 'Crescente'}</option><option value="desc">{sortColumn === 'name' ? 'Z → A' : sortColumn === 'lastOrder' || sortColumn === 'lastSale' ? 'Mais recentes primeiro' : 'Decrescente'}</option></select></label>
              <label className="flex items-center gap-2 rounded-lg border px-3"><Search className="size-4 text-[#71728a]" /><input aria-label="Buscar grupo, unidade, código ou CNPJ" placeholder="Grupo, unidade, código ou CNPJ" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="w-64 max-w-full py-2 text-sm outline-none" /></label>
            </div>
          </div>
          <div className="overflow-x-auto"><table className="w-full"><thead className="bg-[#f7f9fc]"><tr><th className={th}>Grupo</th><th className={`${th} text-right`}>Propostas qtd.</th><th className={`${th} text-right`}>R$ propostas</th><th className={th}>Último pedido</th><th className={th}>Último faturamento</th><th className={th}><span className="sr-only">Atenção exclusiva</span></th></tr></thead><tbody>
            {groups.slice(page * 25, (page + 1) * 25).map(g => <Fragment key={g.id}><tr className="border-t"><td className={td}><button onClick={() => toggle(g.id)} aria-expanded={expanded.has(g.id)} className="flex items-center gap-2 text-left font-semibold text-[#312d5e]">{expanded.has(g.id) ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}<span>{g.name}<span className="mt-1 block text-xs font-normal text-[#71728a]">{g.members.length} unidade(s)</span></span></button></td><td className={`${td} text-right tabular-nums`}><button disabled={!g.proposalCount} aria-label={`Ver propostas do grupo ${g.name}`} onClick={() => openPanel(g)} className="font-semibold text-[#008ad0] underline underline-offset-4 disabled:text-[#71728a] disabled:no-underline">{number(g.proposalCount)}</button></td><td className={`${td} whitespace-nowrap text-right tabular-nums`}>{money(g.proposalValue)}</td><td className={`${td} whitespace-nowrap`}><OrderLink date={g.lastOrder} name={g.name} onClick={() => openPanel(g, undefined, true)} /></td><td className={`${td} whitespace-nowrap`}>{day(g.lastSale)}</td><td className={td}>{g.hasBaseYearOrder && <span tabIndex={0} role="img" aria-label={`Atenção exclusiva: possui pedido em ${data.filters.baseYear}`} title={`Atenção exclusiva: possui pedido em ${data.filters.baseYear}`} className="inline-flex rounded-full bg-amber-100 p-2 text-amber-600"><Lightbulb aria-hidden="true" className="size-5 fill-amber-300" /></span>}</td></tr>{expanded.has(g.id) && <tr><td colSpan={6} className="bg-[#f4f8fc] p-4"><Units key={`${data.generatedAt}-${g.id}`} units={g.members} onOpen={unit => openPanel(g, unit)} onOrder={unit => openPanel(g, unit, true)} /></td></tr>}</Fragment>)}
            {!groups.length && <tr><td colSpan={6} className="p-10 text-center text-sm text-[#71728a]">Nenhum grupo encontrado com estes critérios.</td></tr>}
          </tbody></table></div><Pages page={page} count={groups.length} size={25} onChange={setPage} />
        </section>
      </>}
    </div>
    <Sheet open={panel !== null} onOpenChange={open => { if (!open) setPanel(null); }}>
      <SheetContent showCloseButton={false} finalFocus={opener} className="data-[side=right]:w-full data-[side=right]:sm:max-w-[850px] gap-0 bg-white">
        {panel && data && panel.order && <OrderPanel key={`${data.generatedAt}-${panel.group.id}-${panel.unit?.id ?? 'all'}`} target={panel} filters={data.filters} cache={detailCache.current} />}
        {panel && data && !panel.order && <ProposalPanel key={`${data.generatedAt}-${panel.group.id}-${panel.unit?.id ?? 'all'}`} target={panel} filters={data.filters} cache={detailCache.current} />}
      </SheetContent>
    </Sheet>
  </main>;
}

function Units({ units, onOpen, onOrder }: { units: Unit[]; onOpen: (unit: Unit) => void; onOrder: (unit: Unit) => void }) {
  const [page, setPage] = useState(0);
  return <div className="overflow-hidden rounded-xl border bg-white"><p className="border-b px-4 py-3 text-sm font-semibold">Unidades / filiais do grupo</p><div className="overflow-x-auto"><table className="w-full"><thead><tr>{['Código / unidade', 'CNPJ', 'Propostas qtd.', 'R$ propostas', 'Último pedido'].map(t => <th key={t} className={th}>{t}</th>)}</tr></thead><tbody>{units.slice(page * 25, (page + 1) * 25).map(u => <tr key={u.id} className="border-t"><td className={td}><button aria-label={`Propostas de ${u.nome}`} disabled={!u.proposalCount} onClick={() => onOpen(u)} className="flex items-center gap-2 text-left disabled:cursor-default">{u.proposalCount > 0 && <ChevronRight className="size-4 shrink-0" />}<span><span className="block text-xs text-[#008ad0]">{u.codigo}</span>{u.nome}</span></button></td><td className={`${td} whitespace-nowrap`}>{u.documento || 'Não informado'}</td><td className={td}><button disabled={!u.proposalCount} aria-label={`Ver ${u.proposalCount} propostas de ${u.nome}`} onClick={() => onOpen(u)} className="font-semibold text-[#008ad0] underline underline-offset-4 disabled:text-[#71728a] disabled:no-underline">{number(u.proposalCount)}</button></td><td className={`${td} whitespace-nowrap`}>{money(u.proposalValue)}</td><td className={`${td} whitespace-nowrap`}><OrderLink date={u.lastOrder} name={u.nome} onClick={() => onOrder(u)} /></td></tr>)}</tbody></table></div><Pages page={page} count={units.length} size={25} onChange={setPage} /></div>;
}

function OrderLink({ date, name, onClick }: { date: string | null; name: string; onClick: () => void }) {
  return date ? <button onClick={onClick} aria-label={`Ver último pedido de ${name}, ${day(date)}`} className="font-semibold text-[#008ad0] underline underline-offset-4">{day(date)}</button> : <>—</>;
}

function OrderPanel({ target, filters, cache }: { target: PanelTarget; filters: Filters; cache: DetailCache }) {
  const [order, setOrder] = useState<ListedProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setOrder(null);
    async function load() {
      const units = target.unit ? [target.unit] : target.group.members.filter(u => u.lastOrder);
      const orders: ListedProposal[] = [];
      for (let i = 0; i < units.length; i += 4) {
        if (!active) return;
        const batch = await Promise.all(units.slice(i, i + 4).map(async unit => {
          const result = await cached<{ orders: Proposal[] }>(cache, `/api/portfolio?${query(filters, { action: 'lastOrder', personId: String(unit.id) })}`);
          return result.orders.map(o => ({ ...o, unit }));
        }));
        orders.push(...batch.flat());
      }
      if (active) setOrder(orders.sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)[0] ?? null);
    }
    void load().catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [target, filters, cache, attempt]);
  return <>
    <SheetHeader className="border-b p-5"><div className="flex items-start justify-between gap-3"><div><SheetTitle>Último pedido</SheetTitle><SheetDescription>{target.group.name} · {target.unit?.nome ?? 'Todas as unidades'}</SheetDescription></div><SheetClose render={<Button variant="outline" />}>Fechar</SheetClose></div><p className="mt-2 text-xs text-[#71728a]">{({ all: 'Geral', pecas: 'Peças', implementos: 'Implementos' } as Record<string, string>)[filters.category]} · Valores líquidos dos itens</p></SheetHeader>
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      {error ? <div role="alert" className="text-red-800">{error}<Button variant="outline" onClick={() => setAttempt(a => a + 1)}>Tentar novamente</Button></div> : loading ? <p role="status">Carregando último pedido…</p> : order ? <><div className="mb-4 rounded-xl bg-[#f0f7fc] p-4"><h3 className="font-semibold">Pedido {order.numero}</h3><p className="mt-1 text-sm">{day(order.data)} · {money(order.valor)}</p><p className="mt-2 text-xs text-[#62637b]">{order.unit.codigo} · {order.unit.nome} · CNPJ: {order.unit.documento || 'Não informado'}</p></div><Products proposal={order} filters={filters} cache={cache} order /></> : <p>Nenhum pedido disponível neste filtro. Os dados podem ter sido atualizados.</p>}
    </div>
  </>;
}

function cached<T>(cache: DetailCache, url: string): Promise<T> {
  let promise = cache.get(url);
  if (!promise) {
    promise = read<T>(url).catch(error => { cache.delete(url); throw error; });
    cache.set(url, promise);
  }
  return promise as Promise<T>;
}

function ProposalPanel({ target, filters, cache }: { target: PanelTarget; filters: Filters; cache: DetailCache }) {
  const [proposals, setProposals] = useState<ListedProposal[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const listScroll = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState('');
  useEffect(() => {
    let active = true;
    setError(''); setProposals(null);
    async function load() {
      const units = target.unit ? [target.unit] : target.group.members.filter(u => u.proposalCount > 0);
      const rows: ListedProposal[] = [];
      // Bound concurrent ERP reads when opening a whole group.
      for (let i = 0; i < units.length; i += 4) {
        if (!active) return;
        const batch = await Promise.all(units.slice(i, i + 4).map(async unit => {
          const data = await cached<{ proposals: Proposal[] }>(cache, `/api/portfolio?${query(filters, { action: 'proposals', personId: String(unit.id) })}`);
          return data.proposals.map(p => ({ ...p, unit }));
        }));
        rows.push(...batch.flat());
      }
      if (active) setProposals(rows.sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id));
    }
    void load().catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [target, filters, cache, attempt]);
  const term = normalize(search.trim());
  const rows = (proposals ?? []).filter(p => !term || normalize(`${p.numero} ${p.unit.nome} ${p.unit.codigo}`).includes(term));
  const index = rows.findIndex(p => p.id === selected);
  const current = index >= 0 ? rows[index] : null;
  async function printPanel() {
    setPrinting(true); setPrintError('');
    try {
      const chosen = current ? [current] : rows;
      const printed: PrintableProposal[] = [];
      for (let i = 0; i < chosen.length; i += 4) {
        const batch = await Promise.all(chosen.slice(i, i + 4).map(async proposal => {
          const result = await cached<{ items: Product[] }>(cache, `/api/portfolio?${query(filters, { action: 'products', proposalId: String(proposal.id), personId: String(proposal.unit.id) })}`);
          return { ...proposal, items: result.items };
        }));
        printed.push(...batch);
      }
      const user = await read<{ login?: string }>('/api/me').catch(() => null);
      await printProposalDocument(proposalPrintHtml({ group: target.group.name, category: ({ all: 'Geral', pecas: 'Peças', implementos: 'Implementos' } as Record<string,string>)[filters.category], years: filters.years, baseYear: filters.baseYear, mode: filters.mode === 'base' ? 'No ano-base' : 'No ano-base e no ano anterior', search: current ? '' : search.trim(), login: user?.login || 'Não identificado (sem autenticação Windows)', printedAt: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }), logo: new URL('/logo-dmb.jpg', window.location.origin).href, proposals: printed }));
    } catch (e) { setPrintError(e instanceof Error ? e.message : 'Não foi possível preparar a impressão.'); }
    finally { setPrinting(false); }
  }

  return <>
    <SheetHeader className="border-b p-5">
      <div className="flex items-start justify-between gap-3"><div><SheetTitle>Conferir propostas</SheetTitle><SheetDescription>Sua pesquisa permanece aberta. Feche o painel para continuar de onde parou.</SheetDescription></div><SheetClose render={<Button variant="outline" />}>Fechar</SheetClose></div>
      <div className="mt-3"><Button variant="outline" disabled={printing || !proposals || !rows.length || !!error} onClick={() => void printPanel()} title="Escolha uma impressora ou Salvar como PDF"><Printer className="size-4" />{printing ? 'Preparando impressão…' : 'Imprimir / Salvar PDF'}</Button><p className="mt-2 text-xs text-[#71728a]">{current ? 'Imprime esta proposta e todos os seus produtos.' : 'Imprime todas as propostas da busca e seus produtos, incluindo outras páginas.'}</p>{printError && <p role="alert" className="mt-2 text-sm text-red-800">{printError}</p>}</div>
      <nav aria-label="Caminho da proposta" className="mt-4 flex flex-wrap items-center gap-1 text-sm text-[#62637b]"><button className="font-semibold text-[#312d5e]" onClick={() => setSelected(null)}>{target.group.name}</button><ChevronRight className="size-3" /><span>{current?.unit.nome ?? target.unit?.nome ?? 'Todas as unidades'}</span>{current && <><ChevronRight className="size-3" /><strong>{current.numero}</strong></>}</nav>
      <p className="mt-2 text-xs text-[#71728a]">{({ all: 'Geral', pecas: 'Peças', implementos: 'Implementos' } as Record<string, string>)[filters.category]} · Em elaboração · Valores líquidos dos itens</p>
    </SheetHeader>
    <div ref={listScroll} hidden={current !== null} className="min-h-0 flex-1 overflow-y-auto">
      <div className="border-b p-4"><label className="text-sm">Buscar proposta ou unidade<input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className={inputClass} placeholder="Número, unidade ou código" /></label>{proposals && <p className="mt-2 text-xs text-[#71728a]">{number(rows.length)} propostas · {money(rows.reduce((s, p) => s + p.valor, 0))}</p>}</div>
      {error ? <div role="alert" className="p-4 text-red-800">{error}<Button variant="outline" onClick={() => setAttempt(a => a + 1)}>Tentar novamente</Button></div> : !proposals ? <p role="status" className="p-5">Carregando propostas…</p> : <>
        <div className="overflow-x-auto"><table className="w-full"><thead className="bg-[#f7f9fc]"><tr>{['Proposta / unidade', 'Data', 'Situação', 'Valor'].map(t => <th key={t} className={th}>{t}</th>)}</tr></thead><tbody>{rows.slice(page * 20, (page + 1) * 20).map(p => <Fragment key={p.id}><tr className="border-t"><td className={td}><button onClick={() => setSelected(p.id)} aria-label={`Conferir proposta ${p.numero}`} className="font-semibold text-[#008ad0] underline underline-offset-4">{p.numero}</button><span className="mt-1 block text-xs text-[#71728a]">{p.unit.codigo} · {p.unit.nome}</span></td><td className={`${td} whitespace-nowrap`}>{day(p.data)}</td><td className={td}>Em elaboração</td><td className={`${td} whitespace-nowrap`}>{money(p.valor)}</td></tr><tr><td colSpan={4} className="bg-[#f7fafd] px-4 pb-4"><Products proposal={p} filters={filters} cache={cache} compact /></td></tr></Fragment>)}</tbody></table></div>
        {!rows.length && <p className="p-5 text-sm">Nenhuma proposta nesta seleção.</p>}
        <Pages page={page} count={rows.length} size={20} onChange={setPage} />
      </>}
    </div>
    {current && <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4"><Button variant="outline" onClick={() => setSelected(null)}><ArrowLeft className="size-4" />Voltar às propostas</Button><div className="flex items-center gap-2"><Button variant="outline" disabled={index <= 0} onClick={() => setSelected(rows[index - 1].id)}>Anterior</Button><span className="text-xs">{index + 1} de {rows.length}</span><Button variant="outline" disabled={index + 1 >= rows.length} onClick={() => setSelected(rows[index + 1].id)}>Próxima</Button></div></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4" key={current.id}><div className="mb-4 rounded-xl bg-[#f0f7fc] p-4"><h3 className="font-semibold">{current.numero}</h3><p className="mt-1 text-sm">{day(current.data)} · Em elaboração · {money(current.valor)}</p><p className="mt-2 text-xs text-[#62637b]">{current.unit.nome} · CNPJ: {current.unit.documento || 'Não informado'}</p></div><Products proposal={current} filters={filters} cache={cache} /></div>
    </div>}
  </>;
}

function Products({ proposal, filters, cache, compact = false, order = false }: { proposal: ListedProposal; filters: Filters; cache: DetailCache; compact?: boolean; order?: boolean }) {
  const [data, setData] = useState<{ items: Product[] } | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(0);
  useEffect(() => {
    let active = true;
    const url = `/api/portfolio?${query(filters, { action: order ? 'orderProducts' : 'products', [order ? 'orderId' : 'proposalId']: String(proposal.id), personId: String(proposal.unit.id) })}`;
    setError('');
    void cached<{ items: Product[] }>(cache, url).then(d => { if (active) setData(d); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [proposal, filters, cache, attempt, order]);
  if (error) return <div role="alert">{error}<Button variant="outline" onClick={() => setAttempt(a => a + 1)}>Tentar novamente</Button></div>;
  if (!data) return <p role="status" className="py-2 text-xs text-[#71728a]">Carregando produtos…</p>;
  if (compact) return <div className="border-l-2 border-[#b6dff2] pl-3"><p className="py-2 text-xs font-semibold text-[#62637b]">Produtos</p><ul className="space-y-2">{data.items.slice(page * 25, (page + 1) * 25).map(p => <li key={p.id} className="flex items-start justify-between gap-4 text-sm"><div><span className="block text-xs font-medium text-[#008ad0]">{p.codigo}</span><span className="whitespace-normal">{p.nome}</span></div><span className="shrink-0 whitespace-nowrap text-xs text-[#62637b]">Qtd.: {number(p.quantidade)}</span></li>)}</ul>{!data.items.length && <p className="text-xs text-[#71728a]">Nenhum produto disponível neste filtro.</p>}{data.items.length > 25 && <Pages page={page} count={data.items.length} size={25} onChange={setPage} />}</div>;
  return <div className="overflow-hidden rounded-lg border bg-white"><p className="px-4 py-3 text-sm font-semibold">Produtos {order ? 'do pedido' : 'da proposta'} {proposal.numero}</p><div className="overflow-x-auto"><table className="w-full"><thead><tr>{['Código / produto', 'Quantidade', 'Valor líquido'].map(t => <th key={t} className={th}>{t}</th>)}</tr></thead><tbody>{data.items.slice(page * 25, (page + 1) * 25).map(p => <tr key={p.id} className="border-t"><td className={td}><span className="block text-xs text-[#008ad0]">{p.codigo}</span>{p.nome}<span className="block text-xs text-[#71728a]">{p.familia}</span></td><td className={td}>{number(p.quantidade)}</td><td className={`${td} whitespace-nowrap`}>{money(p.valor)}</td></tr>)}</tbody></table></div>{!data.items.length && <p className="p-4 text-sm">Nenhum produto disponível neste filtro. A proposta pode ter sido atualizada.</p>}<Pages page={page} count={data.items.length} size={25} onChange={setPage} /></div>;
}
