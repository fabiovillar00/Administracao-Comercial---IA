'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Person = { login: string; lastSeen: number; lastActive: number | null; view: string; sessions: number; state: string };
type Usage = { people: Person[]; summary: Array<{ login: string; accesses: number; queries: number; errors: number; lastUse: number }>;
  events: Array<{ id: number; at: number; login: string; kind: string; view: string; status: number | null }>;
  users: string[]; total: number; limit: number; offset: number; generatedAt: number; start: string; end: string; retentionDays: number };
const stamp = (seconds: number | null) => seconds ? new Date(seconds*1000).toLocaleString('pt-BR', {timeZone:'America/Sao_Paulo'}) : '—';
const field = 'rounded-lg border border-[#ddddeb] bg-white px-3 py-2 text-sm min-h-11';
const labels: Record<string, string> = { access:'Acesso / retorno', navigation:'Mudança de tela', query:'Consulta', error:'Erro de consulta' };

export default function UsagePage() {
  const [data, setData] = useState<Usage | null>(null);
  const [error, setError] = useState('');
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [login, setLogin] = useState('');
  const [filter, setFilter] = useState({ start:'', end:'', login:'', offset:0 });
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ offset:String(filter.offset) });
      for (const key of ['start','end','login'] as const) if (filter[key]) params.set(key, filter[key]);
      const response = await fetch(`/api/admin/usage?${params}`, { cache:'no-store', signal });
      const payload = await response.json() as Usage & { error?: string };
      if (response.status === 403 || response.status === 401) { setDenied(true); setData(null); throw new Error('Esta área está disponível somente para DMB\\fabio.andrade, com autenticação Windows no site corporativo.'); }
      if (!response.ok) throw new Error(payload.error || 'Não foi possível consultar o histórico.');
      setDenied(false); setError(''); setData(payload);
      setStart(s => s || payload.start); setEnd(e => e || payload.end);
    } catch (e) { if (e instanceof Error && e.name !== 'AbortError') setError(e.message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [filter]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = setInterval(() => { if (!document.hidden) void load(controller.signal); }, 30000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [load]);
  const connected = data?.people.filter(p => p.sessions > 0) || [];
  return <main className="min-h-screen bg-[#f6f7fb] text-[#292747]">
    <header className="bg-[#312d5e] text-white"><div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-5 py-5 md:px-8"><div className="flex items-center gap-4"><a href="/" aria-label="Voltar ao faturamento" className="p-2"><ArrowLeft className="size-5" /></a><div><p className="text-sm text-white/70">Pulso Comercial · Gestão</p><h1 className="text-xl font-semibold">Uso da plataforma</h1></div></div><ShieldCheck className="size-6" /></div></header>
    <div className="mx-auto max-w-[1400px] space-y-5 px-5 py-6 md:px-8">
      {error && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">{error}{data && ' Os dados exibidos são da última consulta concluída.'}</p>}
      {!data && loading && <p role="status">Verificando acesso e carregando o histórico…</p>}
      {!denied && !loading && !data && <Button onClick={() => void load()}>Tentar novamente</Button>}
      {data && <>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Presença agora</h2><p className="mt-1 text-sm text-[#686980]">{connected.length} usuário(s) conectado(s) · atualizado em {stamp(data.generatedAt)}</p></div><Button disabled={loading} variant="outline" onClick={() => void load()}><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />Atualizar</Button></div>
        <p className="text-sm text-[#686980]">Presença estimada por sinais a cada 30 segundos. “Ativo” indica interação recente; após dois minutos sem sinal, a conexão é considerada encerrada. Abas em segundo plano podem deixar de enviar sinais. Isso não mede produtividade ou tempo efetivo de trabalho.</p>
        <div className="overflow-x-auto rounded-xl border border-[#ddddeb] bg-white"><table className="w-full text-left text-sm"><thead className="bg-[#f0f1f7]"><tr>{['Usuário','Situação','Tela mais recente','Último sinal','Abas / sessões'].map(s => <th key={s} className="p-4 font-medium">{s}</th>)}</tr></thead><tbody>{connected.map(p => <tr key={p.login} className="border-t border-[#eeeff5]"><td className="p-4 font-medium">{p.login}</td><td className="p-4">{p.state}</td><td className="p-4">{p.view}</td><td className="p-4 whitespace-nowrap">{stamp(p.lastSeen)}</td><td className="p-4">{p.sessions}</td></tr>)}{!connected.length && <tr><td colSpan={5} className="p-6 text-[#686980]">Nenhum usuário com sinal nos últimos dois minutos.</td></tr>}</tbody></table></div>
        <section className="space-y-4"><h2 className="text-xl font-semibold">Histórico de utilização</h2><p className="text-sm text-[#686980]">Registros dos últimos {data.retentionDays} dias, a partir da implantação. Datas no horário de Brasília. O filtro de usuário também se aplica à presença; o período filtra apenas o histórico.</p>
          <form onSubmit={e => { e.preventDefault(); setFilter({start,end,login,offset:0}); }} className="flex flex-wrap items-end gap-3 rounded-xl border border-[#ddddeb] bg-white p-4"><label className="flex flex-col gap-1 text-sm">De<input required type="date" value={start} onChange={e => setStart(e.target.value)} className={field} /></label><label className="flex flex-col gap-1 text-sm">Até<input required type="date" value={end} onChange={e => setEnd(e.target.value)} className={field} /></label><label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm">Usuário<select value={login} onChange={e => setLogin(e.target.value)} className={field}><option value="">Todos os usuários</option>{data.users.map(u => <option key={u}>{u}</option>)}</select></label><Button type="submit" disabled={loading} className="min-h-11">Aplicar filtros</Button></form>
          <div className="overflow-x-auto rounded-xl border border-[#ddddeb] bg-white"><table className="w-full text-left text-sm"><thead className="bg-[#f0f1f7]"><tr>{['Usuário','Acessos / retornos','Consultas','Erros','Última utilização'].map(s => <th key={s} className="p-4 font-medium">{s}</th>)}</tr></thead><tbody>{data.summary.map(p => <tr key={p.login} className="border-t border-[#eeeff5]"><td className="p-4 font-medium">{p.login}</td><td className="p-4">{p.accesses}</td><td className="p-4">{p.queries}</td><td className="p-4">{p.errors}</td><td className="p-4 whitespace-nowrap">{stamp(p.lastUse)}</td></tr>)}{!data.summary.length && <tr><td colSpan={5} className="p-6 text-[#686980]">Nenhum registro neste período.</td></tr>}</tbody></table></div>
          <p className="text-sm text-[#686980]">Consultas incluem carregamentos e atualizações automáticas dos relatórios. Acessos representam abertura ou retorno de uma sessão após ausência de sinais; não são contagens de login do Windows.</p>
        </section>
        <section className="space-y-3"><h2 className="text-xl font-semibold">Eventos recentes</h2><div className="overflow-x-auto rounded-xl border border-[#ddddeb] bg-white"><table className="w-full text-left text-sm"><thead className="bg-[#f0f1f7]"><tr>{['Quando','Usuário','Evento','Tela','Resultado'].map(s => <th key={s} className="p-4 font-medium">{s}</th>)}</tr></thead><tbody>{data.events.map(event => <tr key={event.id} className="border-t border-[#eeeff5]"><td className="p-4 whitespace-nowrap">{stamp(event.at)}</td><td className="p-4">{event.login}</td><td className="p-4">{labels[event.kind] || event.kind}</td><td className="p-4">{event.view}</td><td className="p-4">{event.status ? event.status >= 400 ? `Erro ${event.status}` : 'Concluída' : '—'}</td></tr>)}</tbody></table></div><div className="flex items-center justify-between gap-3 text-sm"><Button variant="outline" disabled={loading || data.offset === 0} onClick={() => setFilter(f => ({...f,offset:Math.max(0,f.offset-100)}))}>Anterior</Button><span>{data.total} evento(s) · página {Math.floor(data.offset/100)+1}</span><Button variant="outline" disabled={loading || data.offset+data.limit >= data.total} onClick={() => setFilter(f => ({...f,offset:f.offset+100}))}>Próxima</Button></div></section>
        <p className="text-sm text-[#686980]">Não são armazenados texto das pesquisas, clientes consultados, valores comerciais, senhas ou teclas digitadas.</p>
      </>}
    </div>
  </main>;
}
