'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, BellRing, CalendarClock, Check, ChevronRight, CircleAlert, RefreshCw, Search, TrendingDown, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Alert = { kind: string; title: string; evidence: string; action: string; impact: number; score: number };
type FollowUp = { owner: string; due: string; note: string; reason: string; created_at: string };
type Group = {
  id: string; name: string; members: Array<{ id: number; codigo: string; nome: string; documento: string }>;
  alerts: Alert[]; score: number; priority: string; impact: number; annualRevenue: number;
  priorityReason: string; nextAction: string;
  recentRevenue: number; priorRevenue: number; lastSale: string | null; lastOrder: string | null;
  openOrders: number; openOrdersCount: number; openProposals: number; openProposalsCount: number;
  recentProposalsCount: number; oldestProposal: string | null;
  monthly: Array<{ month: string; value: number }>;
  followUp: FollowUp | null; escalated: boolean; overdue: boolean;
  status: 'attention' | 'scheduled' | 'clear' | 'review';
};
type Snapshot = { asOf: string; generatedAt: string; analyzedGroups: number; groups: Group[]; error?: string; refreshing: boolean; period: { start: string; end: string } };
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const day = (v: string | null) => v ? new Date(v.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem registro no histórico';
const normalize = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const kinds = { proposals: 'Propostas sem compra', cadence: 'Recompra atrasada', decline: 'Queda de faturamento', categories: 'Perda de categorias', inactive: 'Cliente inativo' };
const inputClass = 'min-h-11 w-full rounded-lg border border-[#dcdde7] bg-white px-3 py-2 text-sm text-[#312d5e] focus:outline-none focus:ring-2 focus:ring-[#008ad0]';

export default function PortfolioPage() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('attention');
  const [kind, setKind] = useState('all');
  const [priority, setPriority] = useState('all');
  const [sort, setSort] = useState('priority');
  const [page, setPage] = useState(0);
  const [newSignals, setNewSignals] = useState(0);
  const [saved, setSaved] = useState(false);
  const previous = useRef<Map<string, string> | null>(null);
  const running = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    controller.current = new AbortController();
    try {
      const response = await fetch('/api/portfolio', { cache: 'no-store', signal: controller.current.signal });
      const payload = await response.json() as Snapshot & { error?: string };
      if (response.status === 202) { setError(''); return; }
      if (!response.ok) throw new Error(payload.error || 'Não foi possível consultar a carteira.');
      const snapshot = payload as Snapshot;
      const signatures = new Map(snapshot.groups.map(g => [g.id, g.alerts.map(a => a.kind).sort().join(',') + ':' + g.priority]));
      if (previous.current) {
        const prior = previous.current;
        const changed = snapshot.groups.filter(g => g.alerts.length && signatures.get(g.id) !== prior.get(g.id)).length;
        if (changed) setNewSignals(changed);
      }
      previous.current = signatures;
      setData(snapshot);
      setError(snapshot.error || '');
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') setError(err.message);
    } finally { running.current = false; setBusy(false); }
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 15000);
    const onFocus = () => { void load(); };
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); controller.current?.abort(); };
  }, [load]);
  useEffect(() => { setPage(0); }, [search, status, kind, priority, sort]);
  useEffect(() => {
    if (selected && window.innerWidth < 1280) document.getElementById('portfolio-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selected]);
  const groups = data?.groups || [];
  const actionable = groups.filter(g => g.status === 'attention' || g.status === 'review');
  const filtered = groups.filter(g =>
    (status === 'all' || (status === 'attention' ? ['attention', 'review'].includes(g.status) : g.status === status)) &&
    (kind === 'all' || g.alerts.some(a => a.kind === kind)) &&
    (priority === 'all' || g.priority === priority) &&
    (!search || normalize([g.name, g.followUp?.owner || '', ...g.members.flatMap(m => [m.nome, m.codigo, m.documento || ''])].join(' ')).includes(normalize(search)))
  ).sort((a, b) => sort === 'impact' ? b.impact-a.impact : Number(b.overdue)-Number(a.overdue) || b.score-a.score || b.impact-a.impact);
  useEffect(() => { setPage(p => Math.min(p, Math.max(0, Math.ceil(filtered.length / 20)-1))); }, [filtered.length]);
  const visible = filtered.slice(page * 20, page * 20 + 20);
  const current = filtered.find(g => g.id === selected) || visible[0];
  const stale = data && (Boolean(error) || Date.now() - new Date(data.generatedAt).getTime() > 20 * 60000);

  return (
    <main className="min-h-screen bg-[#f5f6fa] text-[#292747]">
      <header className="border-b border-[#ddddeb] bg-[#312d5e] text-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-5 py-5 md:px-8">
          <div className="flex items-center gap-4">
            <a href="/" aria-label="Voltar à análise de faturamento" className="rounded-lg p-2 hover:bg-white/10"><ArrowLeft className="size-5" /></a>
            <div><p className="text-sm text-white/70">Pulso Comercial</p><h1 className="text-xl font-semibold">Carteira inteligente</h1></div>
          </div>
          <div className="flex items-center gap-3 text-sm"><span className="rounded-full border border-white/20 px-3 py-1">Visão geral · todos os grupos</span><Button variant="outline" onClick={() => void load()} disabled={busy} className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"><RefreshCw className={`size-4 ${busy ? 'animate-spin' : ''}`} /> Consultar</Button></div>
        </div>
      </header>
      <div className="mx-auto max-w-[1600px] space-y-5 px-5 py-6 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-2xl font-semibold tracking-tight">Onde agir agora</h2><p className="mt-1 text-sm text-[#686980]">Sinais consolidados entre empresas do mesmo grupo, com contexto para a próxima conversa.</p></div>
          <p className="text-sm text-[#686980]">{data ? <>Calculado em {new Date(data.generatedAt).toLocaleString('pt-BR')}<br />{data.analyzedGroups.toLocaleString('pt-BR')} grupos analisados · recálculo a cada 15 min</> : 'Preparando a primeira análise…'}</p>
        </div>
        {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900"><span>{error} {data && 'Os dados abaixo são da última análise disponível.'}</span><Button variant="outline" onClick={() => void load()}>Tentar novamente</Button></div>}
        {stale && !error && <p role="status" className="rounded-xl bg-amber-50 p-4 text-amber-900">A última análise tem mais de 20 minutos. Aguarde a atualização antes de tomar decisões.</p>}
        {newSignals > 0 && <div role="status" className="flex items-center justify-between gap-3 rounded-xl bg-[#e1f3fc] p-4 text-[#006da6]"><span>{newSignals} grupo(s) com sinal novo ou mudança de prioridade nesta atualização.</span><button onClick={() => setNewSignals(0)} className="font-semibold underline">Entendi</button></div>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {saved && <p role="status" className="rounded-xl bg-[#e1f3fc] p-4 text-sm text-[#006da6] sm:col-span-2 xl:col-span-4">Acompanhamento salvo. Consulte o grupo em “Em acompanhamento” ou “Todas as situações”. <button onClick={() => setSaved(false)} className="ml-2 underline">Entendi</button></p>}
          <Metric icon={BellRing} label="Para agir" value={data ? String(actionable.length) : '—'} detail="Sem ação, prazo atingido ou novo sinal" />
          <Metric icon={CircleAlert} label="Prioridade alta" value={data ? String(actionable.filter(g => g.priority === 'Alta').length) : '—'} detail="Na fila de ação" />
          <Metric icon={CalendarClock} label="Acompanhamentos vencidos" value={data ? String(groups.filter(g => g.overdue).length) : '—'} detail="Prazo anterior à data de hoje" />
          <Metric icon={Users} label="Em acompanhamento" value={data ? String(groups.filter(g => g.status === 'scheduled').length) : '—'} detail="Próximo contato já registrado" />
        </div>
        <details className="rounded-xl border border-[#ddddeb] bg-white px-4 py-3 text-sm text-[#686980]">
          <summary className="cursor-pointer font-medium text-[#312d5e]">Como os sinais são calculados</summary>
          <div className="mt-3 grid gap-3 leading-relaxed md:grid-cols-2">
            <p><strong>Prioridade:</strong> combina a urgência dos sinais e o valor já comprado pelo grupo. O histórico disponível desde o início dos 24 meses completos recebe peso adicional a partir de R$ 100 mil e R$ 500 mil. Valores de propostas não são usados como venda futura garantida.</p>
            <p><strong>Inatividade:</strong> pelo menos 180 dias sem faturar, R$ 1.000 ou mais de compras no histórico disponível, sem pedido novo nos últimos 90 dias e sem pedido em aberto. Sinaliza uma oportunidade de reativação, sujeita à confirmação de necessidade e sazonalidade. Inatividade e recompra contam como um único motivo na prioridade.</p>
            <p><strong>Grupo completo:</strong> vínculos transitivos por raiz de CNPJ, grupo empresarial e nome de grupo. O cadastro atual é aplicado a todo o histórico. CPF não é agrupado por raiz.</p>
            <p><strong>Propostas:</strong> abertas e sem conversão, com pelo menos uma criada nos últimos 365 dias, sem novo pedido ou faturamento há 90 dias e sem pedido em aberto. Propostas apenas antigas não geram alerta ativo. Recompra exige pelo menos cinco dias de compra e considera a variação do intervalo habitual.</p>
            <p><strong>Queda:</strong> três meses completos contra os três anteriores. Limite inicial de 30% a 60%, conforme a oscilação do grupo, e redução mínima de R$ 1.000. Com base sazonal positiva, exige também queda de pelo menos 20% contra o mesmo trimestre do ano anterior.</p>
            <p><strong>Categorias:</strong> compradas em pelo menos três meses anteriores, com R$ 1.000 ou mais, sem faturamento há 90 dias, enquanto outras seguem ativas. Pedidos em aberto precisam ser conferidos pelo vendedor.</p>
            <p><strong>Valores:</strong> faturamento antes das devoluções, com as mesmas regras fiscais da análise de faturamento. O gráfico mostra os últimos 12 meses completos. Limites iniciais para calibração; os sinais não são probabilidades de perda.</p>
            <p><strong>Acompanhamento:</strong> um registro retira o grupo da fila até a data marcada. Um novo tipo de sinal ou aumento de 15 pontos na pontuação reabre a atenção. O monitor recalcula enquanto a API está ligada; avisos aparecem nesta tela, sem envio externo.</p>
          </div>
        </details>
        <section aria-label="Filtros da carteira" className="flex flex-wrap gap-3 rounded-xl border border-[#ddddeb] bg-white p-4">
          <label className="relative min-w-[200px] flex-1"><span className="sr-only">Buscar grupo, empresa, código ou responsável</span><Search className="absolute left-3 top-3 size-5 text-[#85869a]" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Grupo, empresa, código ou responsável" className={`${inputClass} pl-10`} /></label>
          <label><span className="sr-only">Situação</span><select value={status} onChange={e => setStatus(e.target.value)} className={inputClass}><option value="attention">Para agir</option><option value="scheduled">Em acompanhamento</option><option value="clear">Sem sinais atuais</option><option value="all">Todas as situações</option></select></label>
          <label><span className="sr-only">Tipo de sinal</span><select value={kind} onChange={e => setKind(e.target.value)} className={inputClass}><option value="all">Todos os sinais</option>{Object.entries(kinds).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label><span className="sr-only">Prioridade</span><select value={priority} onChange={e => setPriority(e.target.value)} className={inputClass}><option value="all">Todas as prioridades</option><option>Alta</option><option>Média</option></select></label>
          <label><span className="sr-only">Ordenação</span><select value={sort} onChange={e => setSort(e.target.value)} className={inputClass}><option value="priority">Urgência primeiro</option><option value="impact">Maior valor de referência</option></select></label>
        </section>
        {!data && <div role="status" className="rounded-xl border border-[#ddddeb] bg-white p-12 text-center"><RefreshCw className={`mx-auto mb-4 size-7 text-[#008ad0] ${!error ? 'animate-spin' : ''}`} /><p>{error ? 'A análise está indisponível no momento.' : 'Consolidando grupos, faturamento, pedidos e propostas…'}</p><p className="mt-2 text-sm text-[#686980]">A primeira consulta pode levar alguns instantes.</p></div>}
        {data && filtered.length === 0 && <div className="rounded-xl border border-[#ddddeb] bg-white p-12 text-center"><Check className="mx-auto mb-3 size-7 text-[#008ad0]" /><h3 className="font-semibold">Nenhum grupo nesta seleção</h3><p className="mt-2 text-sm text-[#686980]">{groups.length ? 'Altere os filtros para consultar outros sinais e acompanhamentos.' : 'Nenhum grupo atingiu os critérios atuais. O monitor continua reavaliando a carteira.'}</p></div>}
        {data && filtered.length > 0 && <div className="grid items-start gap-5 xl:grid-cols-[minmax(320px,.85fr)_minmax(0,1.5fr)]">
          <section aria-label="Grupos prioritários" className="min-w-0 space-y-3">
            <p className="text-sm text-[#686980]">{filtered.length} grupo(s) · selecione para analisar</p>
            <div className="max-h-[65vh] space-y-3 overflow-y-auto p-1 xl:max-h-[1100px]">
            {visible.map(group => <button key={group.id} onClick={() => setSelected(group.id)} aria-pressed={current?.id === group.id} className={`w-full rounded-xl border bg-white p-4 text-left transition hover:border-[#008ad0] ${current?.id === group.id ? 'border-[#008ad0] ring-1 ring-[#008ad0]' : 'border-[#ddddeb]'}`}>
              <div className="flex items-center justify-between gap-2"><Badge group={group} /><ChevronRight className="size-4 shrink-0 text-[#85869a]" /></div>
              <h3 className="mt-3 break-words font-semibold">{group.name}</h3>
              <p className="mt-1 text-sm text-[#686980]">{group.members.length} empresa(s) · {group.alerts.length} sinal(is){group.overdue ? ' · prazo vencido' : ''}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">{group.alerts.map(a => <span key={a.kind} className="rounded bg-[#f0f2f8] px-2 py-1 text-xs text-[#514d74]">{kinds[a.kind as keyof typeof kinds]}</span>)}</div>
              <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-[#eeeff5] pt-3 text-sm"><span className="text-[#686980]">Faturamento em 12 meses</span><strong>{brl(group.annualRevenue)}</strong></div>
              {group.followUp && <p className="mt-2 text-sm text-[#686980]">{group.followUp.owner} · próximo contato {day(group.followUp.due)}</p>}
            </button>)}
            </div>
            <div className="flex items-center justify-between gap-2 text-sm"><Button variant="outline" disabled={page === 0} onClick={() => setPage(p => p-1)}>Anterior</Button><span>{page+1} / {Math.max(1, Math.ceil(filtered.length/20))}</span><Button variant="outline" disabled={(page+1)*20 >= filtered.length} onClick={() => setPage(p => p+1)}>Próxima</Button></div>
          </section>
          {current && <GroupDetail key={current.id} group={current} asOf={data.asOf} onSaved={async () => { setSaved(true); await load(); }} />}
        </div>}
        <p className="text-sm text-[#686980]">Os registros de acompanhamento ficam salvos no servidor local. A carteira exibida é geral; não há divisão automática por vendedor nesta versão.</p>
      </div>
    </main>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Users; label: string; value: string; detail: string }) {
  return <div className="rounded-xl border border-[#ddddeb] bg-white p-5"><div className="flex items-center gap-2 text-sm text-[#686980]"><Icon className="size-4 text-[#008ad0]" />{label}</div><p className="mt-3 text-3xl font-semibold">{value}</p><p className="mt-2 text-sm text-[#686980]">{detail}</p></div>;
}

function Badge({ group }: { group: Group }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${group.escalated || group.overdue || group.priority === 'Alta' ? 'bg-red-50 text-red-700' : 'bg-[#e1f3fc] text-[#006da6]'}`}>{group.escalated ? 'Novo sinal · reavaliar' : group.overdue ? 'Acompanhamento vencido' : group.status === 'scheduled' ? 'Em acompanhamento' : group.priority === 'Sem sinais' ? 'Sem sinais atuais' : `Prioridade ${group.priority.toLowerCase()}`}</span>;
}

function GroupDetail({ group, asOf, onSaved }: { group: Group; asOf: string; onSaved: () => Promise<void> }) {
  const [owner, setOwner] = useState(group.followUp?.owner || '');
  const [due, setDue] = useState('');
  const [reason, setReason] = useState('Contato pendente');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [saveError, setSaveError] = useState(false);
  const max = Math.max(1, ...group.monthly.map(m => m.value));
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage('');
    try {
      const response = await fetch('/api/portfolio/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId: group.id, owner, due, note, reason }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Não foi possível registrar a ação.');
      setSaveError(false); setMessage('Acompanhamento salvo. O grupo será reavaliado na data marcada ou se surgir um novo sinal.');
      await onSaved();
    } catch (err) { setSaveError(true); setMessage(err instanceof Error ? err.message : 'Falha ao registrar. Tente novamente.'); }
    finally { setSaving(false); }
  }
  return <section id="portfolio-detail" aria-label={`Análise de ${group.name}`} className="min-w-0 scroll-mt-5 overflow-hidden rounded-xl border border-[#ddddeb] bg-white">
    <div className="border-b border-[#e7e8ef] p-5 md:p-6"><Badge group={group} /><h2 className="mt-3 break-words text-xl font-semibold">{group.name}</h2><p className="mt-1 text-sm text-[#686980]">{group.members.length} empresa(s) consolidadas · análise até {day(asOf)}</p></div>
    <div className="space-y-6 p-5 md:p-6">
      <section className="rounded-xl border border-[#b9dff2] bg-[#eef8fd] p-4"><h3 className="font-semibold">Por que merece atenção</h3><p className="mt-2 text-sm leading-relaxed text-[#514d74]">{group.priorityReason}</p><h3 className="mt-4 font-semibold">Próxima ação sugerida</h3><p className="mt-2 text-sm leading-relaxed">{group.nextAction}</p></section>
      <div className="grid gap-4 sm:grid-cols-2"><Fact label="Último faturamento no histórico" value={day(group.lastSale)} /><Fact label="Último pedido válido" value={day(group.lastOrder)} /><Fact label={`${group.openOrdersCount} pedido(s) em aberto`} value={brl(group.openOrders)} /><Fact label={`${group.openProposalsCount} proposta(s) em aberto`} value={brl(group.openProposals)} /></div>
      {group.openOrdersCount > 0 && <p className="rounded-lg bg-[#eaf5fc] p-3 text-sm text-[#006da6]">Há pedidos em aberto no grupo. Verifique os produtos e a previsão de entrega antes de interpretar a queda como perda comercial.</p>}
      <details className="rounded-xl border border-[#e2e3ec] p-4"><summary className="cursor-pointer text-sm font-medium">Ver evidências e critérios ({group.alerts.length} sinais)</summary><div className="mt-4 space-y-3">{group.alerts.map(alert => <article key={alert.kind} className="rounded-xl border border-[#e2e3ec] p-4"><h3 className="flex items-center gap-2 font-semibold"><TrendingDown className="size-4 shrink-0 text-[#008ad0]" />{alert.title}</h3><p className="mt-2 text-sm leading-relaxed text-[#686980]">{alert.evidence}</p><p className="mt-3 flex gap-2 text-sm leading-relaxed"><ArrowUpRight className="mt-0.5 size-4 shrink-0 text-[#008ad0]" />{alert.action}</p></article>)}{!group.alerts.length && <p className="text-sm">Confirme o resultado do contato antes de considerar a recuperação concluída.</p>}</div></details>
      <section aria-label="Histórico de faturamento"><h3 className="font-semibold">Faturamento · 12 meses completos</h3><div className="mt-4 flex h-36 items-end gap-1.5" role="img" aria-label="Evolução mensal do faturamento; valores detalhados na tabela abaixo">{group.monthly.map(m => <div key={m.month} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2"><div title={`${day(m.month)}: ${brl(m.value)}`} className="min-h-0 rounded-t bg-[#008ad0]" style={{ height: `${Math.max(0, m.value)/max*100}%` }} /><span className="text-center text-xs text-[#686980]">{m.month.slice(5, 7)}</span></div>)}</div><details className="mt-3 text-sm"><summary className="cursor-pointer text-[#006da6]">Ver valores por mês</summary><table className="mt-3 w-full text-sm"><thead><tr className="border-b"><th className="py-2 text-left">Mês</th><th className="py-2 text-right">Faturamento</th></tr></thead><tbody>{group.monthly.map(m => <tr key={m.month} className="border-b border-[#eeeff5]"><td className="py-2">{m.month.slice(5, 7)}/{m.month.slice(0, 4)}</td><td className="text-right">{brl(m.value)}</td></tr>)}</tbody></table></details></section>
      <details className="rounded-lg border border-[#e2e3ec] p-3 text-sm"><summary className="cursor-pointer font-medium">Empresas consideradas ({group.members.length})</summary><ul className="mt-3 max-h-64 space-y-3 overflow-y-auto">{group.members.map(m => <li key={m.id}><p className="break-words font-medium">{m.codigo} · {m.nome}</p><p className="text-[#686980]">{m.documento || 'Sem documento'}</p></li>)}</ul></details>
      {group.followUp && <section className="rounded-xl bg-[#f5f6fa] p-4"><h3 className="font-semibold">Último acompanhamento</h3><p className="mt-2 text-sm">{group.followUp.owner} · {group.followUp.reason}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-[#686980]">{group.followUp.note}</p><p className="mt-3 text-sm font-medium">Próximo contato: {day(group.followUp.due)}</p></section>}
      <form onSubmit={save} className="space-y-4 border-t border-[#e2e3ec] pt-5"><h3 className="font-semibold">Registrar próxima ação</h3><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm"><span>Responsável</span><input required maxLength={120} value={owner} onChange={e => setOwner(e.target.value)} className={inputClass} placeholder="Nome do vendedor" /></label><label className="space-y-1 text-sm"><span>Próximo contato</span><input type="date" required min={asOf} value={due} onChange={e => setDue(e.target.value)} className={inputClass} /></label></div><label className="block space-y-1 text-sm"><span>Motivo / situação</span><select value={reason} onChange={e => setReason(e.target.value)} className={inputClass}>{['Contato pendente', 'Negociação em andamento', 'Sazonalidade', 'Concorrência', 'Entrega / operação', 'Outro'].map(r => <option key={r}>{r}</option>)}</select></label><label className="block space-y-1 text-sm"><span>Próxima ação e contexto do contato</span><textarea required rows={3} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} className={inputClass} placeholder="O que foi identificado e o que será feito até a próxima data?" /></label>{message && <p role={saveError ? 'alert' : 'status'} className={`text-sm ${saveError ? 'text-red-700' : 'text-[#006da6]'}`}>{message}</p>}<Button type="submit" disabled={saving} className="min-h-11 bg-[#312d5e] text-white">{saving ? 'Salvando…' : 'Salvar acompanhamento'}</Button><p className="text-sm text-[#686980]">A ação fica registrada no Pulso e não altera os pedidos ou propostas do ERP.</p></form>
    </div>
  </section>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><p className="text-sm text-[#686980]">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}
