'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpRight,
  Bot,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  FileText,
  LayoutDashboard,
  Mic,
  PackageSearch,
  Search,
  RefreshCw,
  Send,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, XAxis, YAxis } from 'recharts';
import { OpenDocumentsView, type OpenItem } from '@/components/open-documents-view';
import { Button } from '@/components/ui/button';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type ReportData = {
  client: { codigo?: string; nome: string; documento?: string; groupName?: string | null; branchCount: number; ids: number[] };
  year: number;
  period?: { start: string; end: string };
  category: 'pecas' | 'implementos' | 'servicos' | null;
  understoodAs?: string | null;
  grouping?: 'cnpj' | 'grupoempresarial' | 'named_group' | 'connected_group';
  matrixCode?: number | null;
  openOrders?: number;
  openOrdersCount?: number;
  openOrderItems?: OpenItem[];
  openProposalItems?: OpenItem[];
  openProposals?: number;
  openProposalsCount?: number;
  openByCategory?: Record<'pecas' | 'implementos' | 'servicos', {
    openOrders: number;
    openOrdersCount: number;
    openProposals: number;
    openProposalsCount: number;
  }>;
  totals: Record<
    | 'faturamento'
    | 'devolucoes'
    | 'liquido'
    | 'impostos'
    | 'quantidade'
    | 'documentos',
    number
  >;
  monthly: Array<{
    mes: string;
    faturamento: number;
    devolucoes: number;
    liquido: number;
  }>;
  details: Array<{
    documento: string;
    emissao: string;
    codigoProduto: string;
    produto: string;
    familia: string;
    quantidade: number;
    valorLiquido: number;
    impostos: number;
  }>;
  products?: Array<{
    codigoProduto: string;
    produto: string;
    familia: string;
    familiaApelido: string;
    categoria: 'pecas' | 'implementos' | 'servicos' | 'outros';
    quantidade: number;
    faturamento: number;
    documentos: number;
    clientes: number;
    ultimaVenda: string;
  }>;
  branches: Array<{
    id: number;
    codigo: string;
    nome: string;
    documento: string;
    uf: string;
    faturamento: number;
    devolucoes: number;
    liquido: number;
    quantidade: number;
    documentos: number;
    share: number;
  }>;
  categoryTotals: { pecas: number; implementos: number; servicos: number };
  categoryMonthly: Record<
    'pecas' | 'implementos' | 'servicos',
    Array<{
      mes: string;
      faturamento: number;
      devolucoes: number;
      liquido: number;
    }>
  >;
  comparison: {
    totals: Record<
      | 'faturamento'
      | 'devolucoes'
      | 'liquido'
      | 'impostos'
      | 'quantidade'
      | 'documentos',
      number
    >;
    monthly: Array<{
      mes: string;
      faturamento: number;
      devolucoes: number;
      liquido: number;
    }>;
    categoryTotals: { pecas: number; implementos: number; servicos: number };
    categoryMonthly: Record<
      'pecas' | 'implementos' | 'servicos',
      Array<{
        mes: string;
        faturamento: number;
        devolucoes: number;
        liquido: number;
      }>
    >;
    start: string;
    end: string;
  };
};
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: (event: {
    results: ArrayLike<ArrayLike<{ transcript: string }>>;
  }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
};
type ClientOption = {
  codigo: string;
  nome: string;
  documento: string;
  groupName?: string | null;
};
const chartConfig = {
  value: { label: 'Faturamento', color: 'var(--chart-1)' },
} satisfies ChartConfig;
const yoyChartConfig = {
  atual: { label: 'Ano consultado', color: '#008ad0' },
  anterior: { label: 'Ano anterior', color: '#312d5e' },
} satisfies ChartConfig;
const compositionChartConfig = {
  value: { label: 'Participação' },
} satisfies ChartConfig;
const brl = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
const pct = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);

export default function Home() {
  const [currentUser, setCurrentUser] = useState<{ login: string; name: string; initials: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/me', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const user = await response.json();
        if (!controller.signal.aborted && user && typeof user === 'object' &&
            'authenticated' in user && user.authenticated === true &&
            'login' in user && 'name' in user && 'initials' in user &&
            typeof user.login === 'string' && typeof user.name === 'string' &&
            typeof user.initials === 'string') setCurrentUser({ login: user.login, name: user.name, initials: user.initials });
      })
      .catch(() => { /* Keep a neutral greeting when identity is unavailable. */ });
    return () => controller.abort();
  }, []);
  const [activeView, setActiveView] = useState<'overview' | 'products' | 'orders' | 'proposals' | 'order-products' | 'proposal-products'>('overview');
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [listening, setListening] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const requestRunning = useRef(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [lastRequest, setLastRequest] = useState<{ question: string; filters?: { clientTerm?: string; groupName?: string; start?: string; end?: string } } | null>(null);
  const [productsLoading, setProductsLoading] = useState(false);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [clientFilter, setClientFilter] = useState('');
  const [clientPreview, setClientPreview] = useState<ClientOption | null>(null);
  const [clientMatches, setClientMatches] = useState<ClientOption[]>([]);
  const [clientSearching, setClientSearching] = useState(false);
  const [groupFilter, setGroupFilter] = useState('');
  const [startFilter, setStartFilter] = useState(
    () => `${new Date().getFullYear()}-01-01`,
  );
  const [endFilter, setEndFilter] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [selectedChartCategory, setSelectedChartCategory] = useState<
    'pecas' | 'implementos' | 'servicos' | null
  >(null);
  const submit = async (
    question = query,
    filters?: { clientTerm?: string; groupName?: string; start?: string; end?: string },
    speechAlternatives: string[] = [],
    refreshing = false,
  ) => {
    if (!question.trim() && !filters?.clientTerm && !filters?.groupName) return;
    if (requestRunning.current) return;
    requestRunning.current = true;
    setLoading(true);
    setError('');
    try {
      const candidates = [...new Set([question, ...speechAlternatives])];
      let response: Response | null = null;
      let result: ReportData & { error?: string } | null = null;
      let successfulQuestion = question;
      for (const candidate of candidates) {
        successfulQuestion = candidate;
        response = await fetch('/api/ask', {
          method: 'POST',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: candidate, ...filters }),
        });
        result = await response.json();
        if (response.ok || response.status !== 404) break;
      }
      if (!response || !result) throw new Error('Não foi possível concluir a consulta.');
      if (!response.ok)
        throw new Error(
          result.error || 'Não foi possível concluir a consulta.',
        );
      setData(result);
      setUpdatedAt(new Date());
      setLastRequest({ question: successfulQuestion, filters: filters ? { ...filters } : undefined });
      setAnswer(result.client.nome);
      if (!refreshing) setSelectedChartCategory(result.category ?? null);
      if (filters && !refreshing) {
        setClientPreview({
          codigo: result.client.codigo ?? clientFilter,
          nome: result.client.nome,
          documento: result.client.documento ?? 'CNPJ não informado',
        });
        if (result.client.groupName) setGroupFilter(result.client.groupName);
        const filterStart = filters.start ?? result.period?.start ?? startFilter;
        const filterEnd = filters.end ?? endFilter;
        setQuery(
          `faturamento ${result.client.groupName || result.client.nome} no período de ${formatIsoDate(filterStart)} a ${formatIsoDate(filterEnd)}`,
        );
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha na consulta.');
    } finally {
      requestRunning.current = false;
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!data?.period) return;
    setStartFilter(data.period.start);
    const inclusiveEnd = new Date(`${data.period.end}T12:00:00`);
    inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);
    setEndFilter(inclusiveEnd.toISOString().slice(0, 10));
  }, [data?.period?.start, data?.period?.end]);
  useEffect(() => {
    if (activeView !== 'products' || !data?.period || data.products) return;
    const params = new URLSearchParams({
      clientId: data.client.ids.join(','),
      start: data.period.start,
      end: data.period.end,
    });
    if (data.category) params.set('category', data.category);
    setProductsLoading(true);
    let cancelled = false;
    fetch(`/api/products?${params}`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('Não foi possível carregar os produtos.');
        return response.json() as Promise<{ products: ReportData['products'] }>;
      })
      .then((result) => {
        if (!cancelled) setData((current) => current === data ? { ...current, products: result.products ?? [] } : current);
      })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Falha ao carregar produtos.'); })
      .finally(() => { if (!cancelled) setProductsLoading(false); });
    return () => { cancelled = true; setProductsLoading(false); };
  }, [activeView, data]);
  useEffect(() => {
    const term = clientFilter.trim();
    if (clientPreview?.codigo === term || term.length < 2) {
      setClientMatches([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setClientSearching(true);
      try {
        const response = await fetch(
          `/api/clients?q=${encodeURIComponent(term)}`,
        );
        const result = (await response.json()) as { clients?: ClientOption[] };
        setClientMatches((result.clients ?? []).slice(0, 10));
      } catch {
        setClientMatches([]);
      } finally {
        setClientSearching(false);
      }
    }, 280);
    return () => window.clearTimeout(timer);
  }, [clientFilter, clientPreview?.codigo]);
  const applyFilters = () => {
    void submit(query, {
      clientTerm: clientFilter || undefined,
      groupName: clientFilter ? undefined : groupFilter || undefined,
      start: startFilter || undefined,
      end: endFilter || undefined,
    });
  };
  const previewClient = async () => {
    if (!clientFilter.trim()) {
      setClientPreview(null);
      return;
    }
    try {
      const response = await fetch(
        `/api/clients?q=${encodeURIComponent(clientFilter.trim())}`,
      );
      const result = (await response.json()) as { clients?: ClientOption[] };
      const matches = (result.clients ?? []) as ClientOption[];
      const normalized = clientFilter.trim().toLocaleLowerCase('pt-BR');
      const selected =
        matches.find(
          (item) =>
            item.codigo === clientFilter.trim() ||
            item.documento === clientFilter.trim() ||
            item.nome.toLocaleLowerCase('pt-BR') === normalized,
        ) ?? null;
      setClientPreview(selected ?? null);
    } catch {
      setClientPreview(null);
    }
  };
  const startListening = () => {
    const speechWindow = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Recognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError('O reconhecimento de voz não está disponível neste navegador.');
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 5;
    recognition.onresult = (event) => {
      const alternatives = Array.from(event.results[0], (item) => item.transcript)
        .map((item) => item.trim())
        .filter(Boolean);
      const spoken = alternatives[0] ?? '';
      setQuery(spoken);
      void submit(spoken, undefined, alternatives.slice(1));
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setError('Não foi possível reconhecer a fala.');
    };
    setListening(true);
    recognition.start();
  };
  const selectedMonthly = selectedChartCategory
    ? data?.categoryMonthly?.[selectedChartCategory]
    : data?.monthly;
  const monthly = (selectedMonthly ?? []).map((item) => ({
    month: new Intl.DateTimeFormat('pt-BR', { month: 'short' })
      .format(new Date(`${item.mes}T12:00:00`))
      .replace('.', ''),
    value: item.liquido,
  }));
  const categoryLabel =
    data?.category === 'pecas'
      ? 'Peças'
      : data?.category === 'implementos'
        ? 'Implementos'
        : data?.category === 'servicos'
          ? 'Serviços'
          : 'Geral';
  const categoryGrandTotal = Object.values(data?.categoryTotals ?? {}).reduce(
    (sum, value) => sum + value,
    0,
  );
  const hasServiceRevenue = (data?.categoryTotals.servicos ?? 0) > 0;
  const categoryNames = {
    pecas: 'Peças',
    implementos: 'Implementos',
    servicos: 'Serviços',
  } as const;
  const compositionData = [
    { key: 'pecas' as const, label: 'Peças', value: data?.categoryTotals.pecas ?? 0, color: '#008ad0' },
    { key: 'implementos' as const, label: 'Implementos', value: data?.categoryTotals.implementos ?? 0, color: '#312d5e' },
    { key: 'servicos' as const, label: 'Serviços', value: data?.categoryTotals.servicos ?? 0, color: '#55b9e9' },
  ].filter((item) => item.value > 0);
  const selectedCompositionValue = selectedChartCategory
    ? (data?.categoryTotals[selectedChartCategory] ?? 0)
    : categoryGrandTotal;
  const selectedCompositionShare = categoryGrandTotal
    ? selectedCompositionValue / categoryGrandTotal
    : 0;
  const isBusinessGroup = data?.grouping === 'grupoempresarial';
  const isNamedGroup = data?.grouping === 'named_group';
  const isConnectedGroup = data?.grouping === 'connected_group';
  const consolidatedLabel =
    isBusinessGroup || isNamedGroup || isConnectedGroup
      ? 'empresas do grupo'
      : 'filiais consolidadas';
  const chartCategoryLabel = selectedChartCategory
    ? categoryNames[selectedChartCategory]
    : 'Geral';
  const selectedOpen = selectedChartCategory ? data?.openByCategory?.[selectedChartCategory] : data;
  const intelligenceCurrentNet = selectedChartCategory
    ? (data?.categoryTotals?.[selectedChartCategory] ?? 0)
    : (data?.totals.liquido ?? 0);
  const previousNet = selectedChartCategory
    ? (data?.comparison?.categoryTotals?.[selectedChartCategory] ?? 0)
    : (data?.comparison?.totals.liquido ?? 0);
  const yoyDelta = intelligenceCurrentNet - previousNet;
  const yoyRate = previousNet ? yoyDelta / previousNet : null;
  const monthLabels = [
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez',
  ];
  const intelligenceCurrentMonthly = selectedChartCategory
    ? data?.categoryMonthly?.[selectedChartCategory]
    : data?.monthly;
  const intelligencePreviousMonthly = selectedChartCategory
    ? data?.comparison?.categoryMonthly?.[selectedChartCategory]
    : data?.comparison?.monthly;
  const currentByMonth = new Map(
    (intelligenceCurrentMonthly ?? []).map((item) => [
      new Date(`${item.mes}T12:00:00`).getMonth(),
      item.liquido,
    ]),
  );
  const previousByMonth = new Map(
    (intelligencePreviousMonthly ?? []).map((item) => [
      new Date(`${item.mes}T12:00:00`).getMonth(),
      item.liquido,
    ]),
  );
  const yoyMonthly = monthLabels
    .map((month, index) => {
      const atual = currentByMonth.get(index) ?? 0;
      const anterior = previousByMonth.get(index) ?? 0;
      return {
        month,
        atual,
        anterior,
        variacao: anterior ? (atual - anterior) / anterior : null,
      };
    })
    .filter(
      (_, index) => currentByMonth.has(index) || previousByMonth.has(index),
    );
  const categoryChanges = (['pecas', 'implementos', 'servicos'] as const)
    .map((key) => {
      const current = data?.categoryTotals[key] ?? 0;
      const previous = data?.comparison?.categoryTotals[key] ?? 0;
      const delta = current - previous;
      return { key, delta, rate: previous ? delta / previous : null };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const leadingCategory = categoryChanges[0];
  const insightCategory = selectedChartCategory
    ? categoryChanges.find((item) => item.key === selectedChartCategory)
    : leadingCategory;
  const periodLabel = formatPeriod(data?.period, data?.year ?? 2026);
  const billedBranches = (data?.branches ?? []).filter(
    (branch) => branch.faturamento > 0,
  );

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-[#24233d]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[248px] flex-col border-r border-[#464174] bg-[#312d5e] px-4 py-5 text-white lg:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="grid size-10 place-items-center rounded-xl bg-[#008ad0] text-white">
            <TrendingUp className="size-5" />
          </div>
          <div>
            <p className="font-semibold tracking-tight">Pulso Comercial</p>
            <p className="text-xs text-white/55">Inteligência gerencial</p>
          </div>
        </div>
        <nav className="mt-9 space-y-1" aria-label="Navegação principal">
          <div className="group/nav">
          <NavItem icon={LayoutDashboard} label="Análise de Faturamento" active={activeView === 'overview'} onClick={() => setActiveView('overview')} />
          <div className={`ml-5 border-l border-white/20 pl-3 ${activeView === 'overview' || activeView === 'products' ? 'block' : 'hidden group-hover/nav:block group-focus-within/nav:block'}`} role="group" aria-label="Análise de Faturamento">
            <NavItem icon={PackageSearch} label="Produtos" active={activeView === 'products'} onClick={() => setActiveView('products')} />
          </div>
          </div>
          <div className="group/nav">
          <NavItem icon={FileText} label="Pedidos" active={activeView === 'orders'} onClick={() => setActiveView('orders')} />
          <div className={`ml-5 border-l border-white/20 pl-3 ${activeView === 'orders' || activeView === 'order-products' ? 'block' : 'hidden group-hover/nav:block group-focus-within/nav:block'}`} role="group" aria-label="Pedidos">
            <NavItem icon={PackageSearch} label="Produtos" active={activeView === 'order-products'} onClick={() => setActiveView('order-products')} />
          </div>
          </div>
          <div className="group/nav">
          <NavItem icon={FileText} label="Propostas" active={activeView === 'proposals'} onClick={() => setActiveView('proposals')} />
          <div className={`ml-5 border-l border-white/20 pl-3 ${activeView === 'proposals' || activeView === 'proposal-products' ? 'block' : 'hidden group-hover/nav:block group-focus-within/nav:block'}`} role="group" aria-label="Propostas">
            <NavItem icon={PackageSearch} label="Produtos" active={activeView === 'proposal-products'} onClick={() => setActiveView('proposal-products')} />
          </div>
          </div>
          <NavItem icon={Sparkles} label="Perguntar aos dados" />
          <NavItem icon={Users} label="Clientes" />
          <NavItem icon={FileText} label="Relatórios" />
        </nav>
        <div className="mt-auto rounded-2xl border border-white/10 bg-white/[.06] p-4">
          <div className="mb-3 grid size-9 place-items-center rounded-lg bg-white/10">
            <Bot className="size-4 text-[#42b9f2]" />
          </div>
          <p className="text-sm font-medium">Precisa de ajuda?</p>
          <p className="mt-1 text-xs leading-relaxed text-white/55">
            Pergunte naturalmente. Eu encontro e organizo os dados para você.
          </p>
        </div>
      </aside>

      <section className="min-h-screen lg:ml-[248px]">
        <header className="flex h-[72px] items-center justify-between border-b border-[#ddddeb] bg-white/80 px-5 backdrop-blur md:px-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-[.14em] text-[#686980]">
              {activeView.startsWith('order') ? 'Pedidos' : activeView.startsWith('proposal') ? 'Propostas' : 'Faturamento'}
            </p>
            <h1 className="text-lg font-semibold tracking-tight">
              {activeView === 'products' ? 'Análise de Faturamento / Produtos' : activeView.startsWith('order') ? (activeView === 'order-products' ? 'Pedidos / Produtos' : 'Pedidos em aberto') : activeView.startsWith('proposal') ? (activeView === 'proposal-products' ? 'Propostas / Produtos' : 'Propostas em aberto') : 'Análise de Faturamento'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-9 rounded-full border-[#d9daea] px-3 text-[#312d5e]"
            >
              <CircleHelp className="size-4" />
              <span className="hidden sm:inline">Como perguntar</span>
            </Button>
            <div title={currentUser?.login ?? 'Usuário não identificado'} aria-label={currentUser ? `Usuário: ${currentUser.login}` : 'Usuário não identificado'} className="grid size-9 place-items-center rounded-full bg-[#e1f3fc] text-xs font-bold text-[#006da6]">
              {currentUser?.initials ?? <Users className="size-4" aria-hidden="true" />}
            </div>
          </div>
        </header>
        <div className="mx-auto w-full max-w-[1400px] px-5 py-7 md:px-8">
          <div className="mb-7 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
            <div>
              <p className="mb-1 text-sm text-[#686980]">{currentUser ? `Olá, ${currentUser.name}.` : 'Olá!'}</p>
              <h2 className="text-2xl font-semibold tracking-[-.035em] md:text-[30px]">
                {activeView === 'products'
                  ? data
                    ? `Produtos comprados por ${answer}`
                    : 'Qual cliente você quer analisar?'
                  : 'O que você quer descobrir hoje?'}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-[#62637b]">
              <span role="status" className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${updatedAt ? 'bg-[#008ad0]' : 'bg-[#b5b6c5]'}`} />
                {loading ? 'Consultando dados…' : updatedAt ? `Última consulta concluída: ${updatedAt.toLocaleString('pt-BR')}` : 'Nenhuma consulta realizada'}
              </span>
              <Button variant="outline" disabled={!lastRequest || loading || productsLoading} onClick={() => lastRequest && void submit(lastRequest.question, lastRequest.filters, [], true)}>
                <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar dados
              </Button>
            </div>
          </div>
          <div className="mb-7 rounded-[22px] border border-[#d9dbea] bg-white p-2 shadow-[0_12px_40px_rgba(49,45,94,.08)]">
            <div className="flex items-center gap-2 rounded-2xl bg-[#f7f8fc] px-4 py-3">
              <Search className="size-5 shrink-0 text-[#74758f]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void submit()}
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#9698aa]"
                placeholder="Digite ou fale o cliente ou grupo. Ex.: BP 2026 ou Vale Verde"
                aria-label="Pergunte aos dados comerciais"
              />
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label="Falar pergunta"
                onClick={startListening}
                className={
                  listening
                    ? 'rounded-xl bg-red-50 text-red-600'
                    : 'rounded-xl text-[#312d5e] hover:bg-[#e9f6fc]'
                }
              >
                <Mic className="size-5" />
              </Button>
              <Button
                size="icon-lg"
                aria-label="Enviar pergunta"
                onClick={() => void submit()}
                disabled={loading}
                className="rounded-xl bg-[#312d5e] hover:bg-[#403b78]"
              >
                <Send className="size-4" />
              </Button>
            </div>
            {listening && (
              <p className="px-4 pb-2 pt-1 text-xs font-medium text-red-600">
                Ouvindo… fale sua pergunta.
              </p>
            )}
            {loading && (
              <p className="px-4 pb-2 pt-1 text-xs font-medium text-[#0079b7]">
                Consultando o modelo comercial…
              </p>
            )}
            {error && (
              <p className="px-4 pb-2 pt-1 text-xs font-medium text-red-600">
                {error}
              </p>
            )}
          </div>
          {(['orders', 'proposals', 'order-products', 'proposal-products'].includes(activeView)) && (
            <OpenDocumentsView
              key={`${activeView.startsWith('order') ? 'orders' : 'proposals'}-${data?.client.ids.join(',') ?? ''}`}
              kind={activeView.startsWith('order') ? 'orders' : 'proposals'}
              detail={activeView.endsWith('-products')}
              client={data ? answer : undefined}
              items={activeView.startsWith('order') ? data?.openOrderItems : data?.openProposalItems}
              total={activeView.startsWith('order') ? data?.openOrders : data?.openProposals}
              documents={activeView.startsWith('order') ? data?.openOrdersCount : data?.openProposalsCount}
              onNavigate={(detail) => setActiveView(activeView.startsWith('order') ? (detail ? 'order-products' : 'orders') : (detail ? 'proposal-products' : 'proposals'))}
            />
          )}
          {activeView === 'products' && (
            <ProductsView
              data={data}
              loading={productsLoading}
              answer={answer}
              periodLabel={periodLabel}
              onBack={() => setActiveView('overview')}
            />
          )}
          {activeView === 'overview' && (<>
          {data && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4 text-[#008ad0]" /> Resultado para{' '}
                {answer}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-[#71728a]">
                <span>{periodLabel} ·</span>
                <HoverCard>
                  <HoverCardTrigger className="cursor-help border-b border-dashed border-[#7a7b91] font-semibold text-[#312d5e]">
                    {data?.client.branchCount ?? 0} {consolidatedLabel}
                  </HoverCardTrigger>
                  <HoverCardContent align="start" className="w-[520px] p-4">
                    <p className="mb-3 text-sm font-semibold text-[#312d5e]">
                      {isBusinessGroup
                        ? `Empresas vinculadas à matriz código ${data?.matrixCode}`
                        : isConnectedGroup
                          ? 'Unidades vinculadas por CNPJ-base, Grupo Empresarial ou nome do grupo'
                        : isNamedGroup
                          ? `Unidades encontradas para o grupo ${data?.understoodAs ?? answer}`
                        : 'Clientes incluídos no consolidado'}
                    </p>
                    <div className="space-y-2">
                      {data?.branches.map((branch) => (
                        <div
                          key={branch.id}
                          className="flex items-start justify-between gap-4 border-t border-[#e4e5ed] pt-2 first:border-0 first:pt-0"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-semibold leading-4">
                              {branch.codigo} — {branch.nome} —{' '}
                              {branch.uf || 'UF não informada'}
                            </p>
                            <p className="text-[11px] leading-4 text-[#71728a]">
                              {branch.documento}
                            </p>
                          </div>
                          <p className="shrink-0 font-mono text-[11px] font-semibold">
                            {brl(branch.liquido)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </HoverCardContent>
                </HoverCard>
                <span>
                  · Categoria:{' '}
                  <strong className="text-[#312d5e]">{categoryLabel}</strong>
                </span>
                {data?.understoodAs && (
                  <span className="ml-1 rounded-full bg-[#eef7fc] px-2 py-0.5 font-medium text-[#0079b7]">
                    “{clientTermFromQuestion(query)}” entendido como “
                    {data.understoodAs}”
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="rounded-lg border-[#d8d9e7] bg-white"
                onClick={() => setFiltersOpen((current) => !current)}
              >
                <CalendarDays /> Filtros e período
              </Button>
              <Button
                variant="outline"
                className="rounded-lg border-[#d8d9e7] bg-white"
              >
                <ArrowDownToLine /> Exportar
              </Button>
            </div>
          </div>
          )}
          {filtersOpen && (
            <section className="mb-4 grid gap-3 rounded-[18px] border border-[#d9dbea] bg-white p-4 shadow-[0_10px_30px_rgba(49,45,94,.06)] md:grid-cols-2 xl:grid-cols-[1.4fr_1.1fr_.75fr_.75fr_auto] xl:items-end">
              <div className="relative grid gap-1.5 text-xs font-semibold text-[#56576f]">
                <span>Cliente</span>
                <input
                  value={clientFilter}
                  onChange={(event) => {
                    setClientFilter(event.target.value);
                    setClientPreview(null);
                    if (event.target.value) setGroupFilter('');
                  }}
                  onBlur={() => void previewClient()}
                  placeholder="Código, nome ou CNPJ"
                  autoComplete="off"
                  className="h-10 rounded-lg border border-[#d9dbea] bg-[#fafafe] px-3 text-sm font-normal outline-none transition focus:border-[#008ad0] focus:ring-2 focus:ring-[#008ad0]/15"
                />
                {(clientSearching || clientMatches.length > 0) && !clientPreview && (
                  <div className="absolute left-0 right-0 top-[66px] z-30 max-h-72 overflow-y-auto rounded-xl border border-[#d9dbea] bg-white p-1.5 shadow-xl">
                    {clientSearching && (
                      <p className="px-3 py-2 text-[11px] font-normal text-[#71728a]">
                        Buscando clientes…
                      </p>
                    )}
                    {!clientSearching &&
                      clientMatches.map((item) => (
                        <button
                          key={`${item.codigo}-${item.documento}`}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setClientFilter(item.codigo);
                            setClientPreview(item);
                            setClientMatches([]);
                            setGroupFilter(item.groupName ?? '');
                          }}
                          className="w-full rounded-lg px-3 py-2 text-left transition hover:bg-[#eef7fc] focus:bg-[#eef7fc] focus:outline-none"
                        >
                          <strong className="block text-[11px] text-[#312d5e]">
                            {item.codigo} — {item.nome}
                          </strong>
                          <span className="mt-0.5 block text-[10px] font-normal text-[#71728a]">
                            CNPJ {item.documento || 'não informado'}
                            {item.groupName ? ` · Grupo ${item.groupName}` : ''}
                          </span>
                        </button>
                      ))}
                  </div>
                )}
                {clientPreview && (
                  <span className="rounded-md bg-[#eef7fc] px-2 py-1.5 text-[11px] font-normal leading-4 text-[#31576b]">
                    <strong className="text-[#312d5e]">
                      {clientPreview.codigo} — {clientPreview.nome}
                    </strong>
                    <span className="block">CNPJ {clientPreview.documento}</span>
                  </span>
                )}
              </div>
              <label className="grid gap-1.5 text-xs font-semibold text-[#56576f]">
                Coligada / grupo
                <input
                  value={groupFilter}
                  onChange={(event) => {
                    setGroupFilter(event.target.value);
                    if (event.target.value) {
                      setClientFilter('');
                      setClientPreview(null);
                    }
                  }}
                  placeholder="Nome da coligada"
                  className="h-10 rounded-lg border border-[#d9dbea] bg-[#fafafe] px-3 text-sm font-normal outline-none transition focus:border-[#008ad0] focus:ring-2 focus:ring-[#008ad0]/15"
                />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-[#56576f]">
                Data inicial
                <input
                  type="date"
                  value={startFilter}
                  onChange={(event) => setStartFilter(event.target.value)}
                  className="h-10 rounded-lg border border-[#d9dbea] bg-[#fafafe] px-3 text-sm font-normal outline-none focus:border-[#008ad0]"
                />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-[#56576f]">
                Data final
                <input
                  type="date"
                  value={endFilter}
                  min={startFilter}
                  onChange={(event) => setEndFilter(event.target.value)}
                  className="h-10 rounded-lg border border-[#d9dbea] bg-[#fafafe] px-3 text-sm font-normal outline-none focus:border-[#008ad0]"
                />
              </label>
              <Button
                onClick={applyFilters}
                disabled={
                  loading ||
                  Boolean(clientFilter && !clientPreview) ||
                  (!data && !clientPreview && !groupFilter)
                }
                className="h-10 rounded-lg bg-[#312d5e] px-5 hover:bg-[#403b78]"
              >
                Aplicar
              </Button>
            </section>
          )}
          {data && (
            <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Faturamento bruto"
              value={brl(data?.totals.faturamento ?? 0)}
              caption="antes das devoluções"
            />
            <Metric
              label="Devoluções"
              value={brl(data?.totals.devolucoes ?? 0)}
              caption="deduzidas no período"
              danger={(data?.totals.devolucoes ?? 0) > 0}
            />
            <Metric
              label="Faturamento líquido"
              value={brl(data?.totals.liquido ?? 0)}
              caption="medida oficial Fat − Dev"
            />
            <Metric
              label="Documentos"
              value={String(data?.totals.documentos ?? 0)}
              caption={`${new Intl.NumberFormat('pt-BR').format(data?.totals.quantidade ?? 0)} unidades`}
            />
          </section>
          <section className="mt-4 rounded-[18px] border border-[#dce4e0] bg-white p-3.5">
            <div className="mb-2.5">
              <h3 className="text-sm font-semibold">
                Composição do faturamento
              </h3>
              <p className="mt-0.5 text-[11px] text-[#71827b]">
                Clique em uma categoria para filtrar o gráfico, os pedidos e as propostas
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px] md:items-center">
              <div
                className={`grid gap-2 ${hasServiceRevenue ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}
              >
              <CategoryCard
                label="Peças"
                value={data?.categoryTotals.pecas ?? 0}
                total={categoryGrandTotal}
                active={selectedChartCategory === 'pecas'}
                color="#008ad0"
                onClick={() =>
                  setSelectedChartCategory((current) =>
                    current === 'pecas' ? null : 'pecas',
                  )
                }
              />
              <CategoryCard
                label="Implementos"
                value={data?.categoryTotals.implementos ?? 0}
                total={categoryGrandTotal}
                active={selectedChartCategory === 'implementos'}
                color="#312d5e"
                onClick={() =>
                  setSelectedChartCategory((current) =>
                    current === 'implementos' ? null : 'implementos',
                  )
                }
              />
              {hasServiceRevenue && (
                <CategoryCard
                  label="Serviços"
                  value={data?.categoryTotals.servicos ?? 0}
                  total={categoryGrandTotal}
                  active={selectedChartCategory === 'servicos'}
                  color="#55b9e9"
                  onClick={() =>
                    setSelectedChartCategory((current) =>
                      current === 'servicos' ? null : 'servicos',
                    )
                  }
                />
              )}
              </div>
              <div className="flex items-center justify-center rounded-xl border border-[#e1e2ec] bg-[#fafafe] p-1.5">
                <div className="relative">
                  <ChartContainer
                    config={compositionChartConfig}
                    className="h-[118px] w-[118px] aspect-square"
                  >
                    <PieChart accessibilityLayer>
                      <Pie
                        data={compositionData}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={36}
                        outerRadius={52}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {compositionData.map((item) => (
                          <Cell
                            key={item.key}
                            fill={item.color}
                            opacity={
                              selectedChartCategory &&
                              selectedChartCategory !== item.key
                                ? 0.25
                                : 1
                            }
                            className="cursor-pointer outline-none transition-opacity"
                            onClick={() =>
                              setSelectedChartCategory((current) =>
                                current === item.key ? null : item.key,
                              )
                            }
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
                    <strong className="text-lg leading-none text-[#312d5e]">
                      {pct(selectedCompositionShare)}
                    </strong>
                    <span className="mt-1 text-[9px] font-semibold uppercase tracking-[.08em] text-[#77788d]">
                      {selectedChartCategory
                        ? categoryNames[selectedChartCategory]
                        : 'do total'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.75fr)]">
            <div className="rounded-[18px] border border-[#dce4e0] bg-white p-5 md:p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Evolução do faturamento</h3>
                  <p className="mt-1 text-xs text-[#71827b]">
                    Valores líquidos por mês · {chartCategoryLabel}
                  </p>
                </div>
                {selectedChartCategory && (
                  <button
                    onClick={() => setSelectedChartCategory(null)}
                    className="rounded-full bg-[#eef7fc] px-2.5 py-1 text-[10px] font-semibold text-[#0079b7] transition hover:bg-[#dff2fb]"
                  >
                    Limpar filtro
                  </button>
                )}
              </div>
              <ChartContainer
                config={chartConfig}
                className="h-[260px] w-full aspect-auto"
              >
                <AreaChart
                  data={monthly}
                  margin={{ left: 0, right: 12, top: 10 }}
                >
                  <defs>
                    <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="var(--color-value)"
                        stopOpacity={0.28}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--color-value)"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="4 4" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={54}
                    tickFormatter={(v) => `${v / 1000}k`}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        formatter={(value) => (
                          <span className="ml-auto font-mono font-medium">
                            {brl(Number(value))}
                          </span>
                        )}
                      />
                    }
                  />
                  <Area
                    dataKey="value"
                    type="monotone"
                    fill="url(#fillValue)"
                    stroke="var(--color-value)"
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ChartContainer>
            </div>
            <div className="rounded-[18px] border border-[#dce4e0] bg-[#312d5e] p-6 text-white">
              <div className="mb-6 flex items-center gap-2 text-sm font-medium text-[#55c7ff]">
                <Sparkles className="size-4" /> Leitura rápida
              </div>
              <p className="text-lg font-medium leading-relaxed tracking-[-.02em]">
                O grupo {answer} alcançou{' '}
                <strong className="text-[#55c7ff]">
                  {brl(data?.totals.liquido ?? 0)}
                </strong>{' '}
                de faturamento líquido em {data?.year ?? 2026}.
              </p>
              <div className="my-6 h-px bg-white/10" />
              <ul className="space-y-4 text-sm text-white/75">
                <li>
                  • {data?.client.branchCount ?? 0}{' '}
                  {isBusinessGroup
                    ? 'empresas vinculadas pelo campo Grupo Empresarial.'
                    : isConnectedGroup
                      ? 'empresas consolidadas pelos três vínculos cadastrais.'
                    : isNamedGroup
                      ? 'unidades consolidadas pelo nome do grupo informado.'
                    : 'filiais consolidadas pelo CNPJ-base.'}
                </li>
                <li>
                  • Pedidos em Aberto: Qtd.: {selectedOpen?.openOrdersCount != null ? selectedOpen.openOrdersCount.toLocaleString('pt-BR') : '—'} - {selectedOpen?.openOrders != null ? brl(selectedOpen.openOrders) : '—'}
                  <span className="mt-1 block text-xs text-[#c4c5df]">{chartCategoryLabel} · posição atual do grupo · todas as datas</span>
                </li>
                <li>
                  • Propostas em Aberto: Qtd.: {selectedOpen?.openProposalsCount != null ? selectedOpen.openProposalsCount.toLocaleString('pt-BR') : '—'} - {selectedOpen?.openProposals != null ? brl(selectedOpen.openProposals) : '—'}
                  <span className="mt-1 block text-xs text-[#c4c5df]">{chartCategoryLabel} · posição atual do grupo · todas as datas</span>
                </li>
              </ul>
              <Button
                variant="ghost"
                onClick={() => setActiveView('products')}
                className="mt-6 px-0 text-[#55c7ff] hover:bg-transparent hover:text-white"
              >
                Explorar análise <ArrowUpRight />
              </Button>
            </div>
          </section>
          <details className="group mt-4 overflow-hidden rounded-[18px] border border-[#dce4e0] bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 outline-none transition hover:bg-[#f8f9fc] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#008ad0] md:px-6">
              <div>
                <h3 className="font-semibold">Venda por unidade do cliente</h3>
                <p className="mt-1 text-xs text-[#71827b]">
                  {isBusinessGroup
                    ? 'Composição oficial pelo campo Grupo Empresarial'
                    : isConnectedGroup
                      ? 'Composição por CNPJ-base, Grupo Empresarial e nome do grupo'
                    : isNamedGroup
                      ? 'Composição pelo nome comercial do grupo'
                    : 'Composição do grupo empresarial pelo CNPJ-base'}{' '}
                  · {billedBranches.length}{' '}
                  {isBusinessGroup || isNamedGroup || isConnectedGroup
                    ? 'empresas com faturamento'
                    : 'unidades com faturamento'}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-[#312d5e]">
                Ver unidades{' '}
                <ChevronDown className="size-4 transition-transform duration-200 group-open:rotate-180" />
              </span>
            </summary>
            <div className="border-t border-[#e2e8e5]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#f7f9f8]">
                    <TableHead className="pl-6">Código</TableHead>
                    <TableHead>Unidade / CNPJ</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">Devoluções</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead className="pr-6 text-right">
                      Participação
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billedBranches.map((branch) => (
                    <TableRow key={branch.id}>
                      <TableCell className="pl-6 font-semibold">
                        {branch.codigo}
                      </TableCell>
                      <TableCell>
                        <span className="block max-w-[420px] truncate">
                          {branch.nome} — {branch.uf || 'UF não informada'}
                        </span>
                        <span className="text-xs text-[#71827b]">
                          {branch.documento} · {branch.documentos} documentos
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {brl(branch.faturamento)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {brl(branch.devolucoes)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {brl(branch.liquido)}
                      </TableCell>
                      <TableCell className="pr-6 text-right tabular-nums">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'percent',
                          maximumFractionDigits: 1,
                        }).format(branch.share)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {data && billedBranches.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-sm text-[#71728a]"
                      >
                        Nenhuma unidade com faturamento maior que zero no período.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </details>
          <section className="mt-4 overflow-hidden rounded-[18px] border border-[#dce4e0] bg-white">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e2e3ec] px-5 py-4 md:px-6">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-[#008ad0]" />
                  <h3 className="font-semibold">Inteligência comercial</h3>
                </div>
                <p className="mt-1 text-xs text-[#71728a]">
                  Comparativo YoY · {data?.year ?? 2026} contra{' '}
                  {(data?.year ?? 2026) - 1} no mesmo período ·{' '}
                  {chartCategoryLabel}
                </p>
              </div>
              <div
                className={`rounded-full px-3 py-1 text-sm font-semibold ${yoyDelta >= 0 ? 'bg-[#e9f7fd] text-[#0079b7]' : 'bg-red-50 text-red-700'}`}
              >
                {yoyRate === null
                  ? 'Sem base comparativa'
                  : `${yoyDelta >= 0 ? '+' : ''}${pct(yoyRate)} YoY`}
              </div>
            </div>
            <div className="grid xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)]">
              <div className="border-b border-[#e2e3ec] p-5 xl:border-b-0 xl:border-r md:p-6">
                <div className="mb-5 grid gap-3 sm:grid-cols-3">
                  <InsightMetric
                    label={`${data?.year ?? 2026}`}
                    value={brl(intelligenceCurrentNet)}
                  />
                  <InsightMetric
                    label={`${(data?.year ?? 2026) - 1}`}
                    value={brl(previousNet)}
                  />
                  <InsightMetric
                    label="Variação"
                    value={`${yoyDelta >= 0 ? '+' : '−'} ${brl(Math.abs(yoyDelta))}`}
                    accent={yoyDelta >= 0}
                  />
                </div>
                <ChartContainer
                  config={yoyChartConfig}
                  className="h-[230px] w-full aspect-auto"
                >
                  <AreaChart
                    data={yoyMonthly}
                    margin={{ left: 0, right: 12, top: 10 }}
                  >
                    <defs>
                      <linearGradient
                        id="fillYoyCurrent"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#008ad0"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="95%"
                          stopColor="#008ad0"
                          stopOpacity={0.01}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="4 4" />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={54}
                      tickFormatter={(value) => `${Number(value) / 1000}k`}
                    />
                    <ChartTooltip
                      content={<YoyTooltip currentYear={data?.year ?? 2026} />}
                    />
                    <Area
                      dataKey="anterior"
                      type="monotone"
                      fill="transparent"
                      stroke="#312d5e"
                      strokeDasharray="5 4"
                      strokeWidth={2}
                    />
                    <Area
                      dataKey="atual"
                      type="monotone"
                      fill="url(#fillYoyCurrent)"
                      stroke="#008ad0"
                      strokeWidth={2.5}
                    />
                  </AreaChart>
                </ChartContainer>
                <div className="mt-2 flex justify-center gap-5 text-[11px] text-[#6d6e84]">
                  <span className="flex items-center gap-1.5">
                    <i className="size-2 rounded-full bg-[#008ad0]" />
                    {data?.year ?? 2026}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <i className="size-2 rounded-full bg-[#312d5e]" />
                    {(data?.year ?? 2026) - 1}
                  </span>
                </div>
              </div>
              <div className="bg-[#fafafe] p-5 md:p-6">
                <p className="mb-4 text-xs font-semibold uppercase tracking-[.12em] text-[#6e6f87]">
                  Leituras gerenciais
                </p>
                <ul className="space-y-4 text-sm leading-relaxed text-[#4e4d69]">
                  <li className="rounded-xl border border-[#e3e4ed] bg-white p-3">
                    {yoyRate === null ? (
                      `Ainda não existe faturamento de ${chartCategoryLabel.toLowerCase()} no período comparativo anterior.`
                    ) : (
                      <>
                        <strong>Faturamento {chartCategoryLabel}</strong> em{' '}
                        <strong>{data?.year ?? 2026}</strong> está{' '}
                        <strong
                          className={
                            yoyDelta >= 0 ? 'text-[#0079b7]' : 'text-red-700'
                          }
                        >
                          {yoyDelta >= 0 ? 'acima' : 'abaixo'} em{' '}
                          {pct(Math.abs(yoyRate))}
                        </strong>{' '}
                        frente ao mesmo período de {(data?.year ?? 2026) - 1}.
                      </>
                    )}
                  </li>
                  <li className="rounded-xl border border-[#e3e4ed] bg-white p-3">
                    <strong>
                      {insightCategory
                        ? categoryNames[insightCategory.key]
                        : 'Categorias'}
                    </strong>{' '}
                    {selectedChartCategory
                      ? 'apresentou'
                      : 'foi a categoria de maior impacto, com'}{' '}
                    <strong
                      className={
                        (insightCategory?.delta ?? 0) >= 0
                          ? 'text-[#0079b7]'
                          : 'text-red-700'
                      }
                    >
                      {(insightCategory?.delta ?? 0) >= 0
                        ? 'crescimento'
                        : 'redução'}{' '}
                      de {brl(Math.abs(insightCategory?.delta ?? 0))}
                    </strong>
                    {insightCategory?.rate === null ? (
                      '.'
                    ) : (
                      <>
                        , o que representa{' '}
                        {(insightCategory?.delta ?? 0) >= 0 ? 'alta' : 'queda'}{' '}
                        de{' '}
                        <strong>
                          {pct(Math.abs(insightCategory?.rate ?? 0))}
                        </strong>
                        .
                      </>
                    )}
                  </li>
                </ul>
              </div>
            </div>
          </section>
          <p className="mt-5 text-center text-xs text-[#84938e]">
            Dados consultados em tempo real no ERP_PROD · Conexão somente
            leitura · Regras extraídas do modelo Power BI.
          </p>
            </>
          )}
            </>)}
        </div>
      </section>
    </main>
  );
}

function ProductsView({
  data,
  loading,
  answer,
  periodLabel,
  onBack,
}: {
  data: ReportData | null;
  loading: boolean;
  answer: string;
  periodLabel: string;
  onBack: () => void;
}) {
  const [productFilter, setProductFilter] = useState('');
  const [productCategory, setProductCategory] = useState<
    'all' | 'pecas' | 'implementos' | 'servicos'
  >(data?.category ?? 'all');
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [productsOpen, setProductsOpen] = useState(false);
  if (!data) {
    return (
      <section className="rounded-[22px] border border-dashed border-[#cfd3e4] bg-white px-6 py-14 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#e4f5fd] text-[#008ad0]">
          <PackageSearch className="size-6" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">Comece escolhendo um cliente ou grupo</h3>
        <p className="mx-auto mt-2 max-w-xl text-sm text-[#71728a]">
          Use a pesquisa acima por voz ou texto. O cliente, o período e a categoria serão aplicados automaticamente à análise dos produtos.
        </p>
      </section>
    );
  }
  const allProducts = data.products ?? [];
  const categoryProducts = allProducts.filter(
    (item) => productCategory === 'all' || item.categoria === productCategory,
  );
  const familyMap = new Map<string, { name: string; value: number; products: number }>();
  for (const item of categoryProducts) {
    const name = item.familiaApelido || item.familia || 'Sem família';
    const current = familyMap.get(name) ?? { name, value: 0, products: 0 };
    current.value += Number(item.faturamento || 0);
    current.products += 1;
    familyMap.set(name, current);
  }
  const families = [...familyMap.values()].sort((a, b) => b.value - a.value);
  const normalizedFilter = productFilter.trim().toLocaleLowerCase('pt-BR');
  const products = categoryProducts.filter((item) =>
    (!selectedFamily || (item.familiaApelido || item.familia || 'Sem família') === selectedFamily) &&
    (!normalizedFilter ||
      item.codigoProduto?.toLocaleLowerCase('pt-BR').includes(normalizedFilter) ||
      item.produto?.toLocaleLowerCase('pt-BR').includes(normalizedFilter) ||
      item.familia?.toLocaleLowerCase('pt-BR').includes(normalizedFilter) ||
      item.familiaApelido?.toLocaleLowerCase('pt-BR').includes(normalizedFilter)),
  );
  const total = categoryProducts.reduce((sum, item) => sum + Number(item.faturamento || 0), 0);
  const categoryText = data.category
    ? ({ pecas: 'Peças', implementos: 'Implementos', servicos: 'Serviços' } as const)[data.category]
    : 'Todas as categorias';
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#dce4e0] bg-white px-5 py-4">
        <div>
          <p className="flex items-center gap-2 font-semibold text-[#24233d]">
            <PackageSearch className="size-4 text-[#008ad0]" /> Produtos da Análise de Faturamento
          </p>
          <p className="mt-1 text-xs text-[#71728a]">
            {answer} · {periodLabel} · {categoryText}
          </p>
        </div>
        <Button variant="outline" className="rounded-full" onClick={onBack}>Voltar à Análise de Faturamento</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-[18px] border border-[#dce4e0] bg-white px-5 py-3">
        <span className="mr-2 text-xs font-semibold uppercase tracking-[.08em] text-[#71728a]">Tipo de produto</span>
        {([
          ['all', 'Geral'],
          ['pecas', 'Peças'],
          ['implementos', 'Implementos'],
          ...(allProducts.some((item) => item.categoria === 'servicos') ? [['servicos', 'Serviços']] : []),
        ] as Array<['all' | 'pecas' | 'implementos' | 'servicos', string]>).map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setProductCategory(key);
              setSelectedFamily(null);
              setProductFilter('');
            }}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${productCategory === key ? 'border-[#312d5e] bg-[#312d5e] text-white' : 'border-[#d9dbea] bg-white text-[#56576f] hover:border-[#008ad0] hover:text-[#0079b7]'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {loading && (
        <div className="rounded-[18px] border border-[#cfe9f5] bg-[#f2faff] px-5 py-4 text-sm font-medium text-[#0079b7]">
          Carregando famílias e produtos deste cliente…
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <Metric label="Produtos com venda" value={String(categoryProducts.length)} caption="itens distintos no filtro selecionado" />
        <Metric label="Valor analisado" value={brl(total)} caption="faturamento bruto dos produtos listados" />
      </div>
      <div
        className="rounded-[18px] border border-[#dce4e0] bg-white p-5"
        onClick={(event) => {
          const target = event.target as Element;
          if (!target.closest('[data-family-bar]') && !target.closest('[data-family-action]')) {
            setSelectedFamily(null);
          }
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">Faturamento por família</h3>
            <p className="mt-1 text-xs text-[#71728a]">Agrupamento pro Familia</p>
          </div>
          {selectedFamily && (
            <Button data-family-action variant="outline" className="h-8 rounded-full text-xs" onClick={() => setSelectedFamily(null)}>Limpar seleção</Button>
          )}
        </div>
        {families.length ? (
          <ChartContainer config={{ value: { label: 'Faturamento', color: '#008ad0' } }} className="mt-4 h-[320px] w-full">
            <BarChart data={families.slice(0, 12)} layout="vertical" margin={{ left: 8, right: 76 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" width={150} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => brl(Number(value))} />} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                <LabelList
                  dataKey="value"
                  position="right"
                  offset={8}
                  fill="#56576f"
                  fontSize={12}
                  fontWeight={600}
                  formatter={(value) => new Intl.NumberFormat('pt-BR', {
                    style: 'percent',
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  }).format(total > 0 ? Number(value) / total : 0)}
                />
                {families.slice(0, 12).map((family) => (
                  <Cell
                    data-family-bar
                    key={family.name}
                    fill={!selectedFamily || selectedFamily === family.name ? '#008ad0' : '#cbd5e1'}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedFamily((current) => current === family.name ? null : family.name);
                      setProductsOpen(true);
                    }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        ) : (
          <p className="py-10 text-center text-sm text-[#71728a]">Não há famílias com faturamento neste período.</p>
        )}
      </div>
      <div className="overflow-hidden rounded-[18px] border border-[#dce4e0] bg-white">
        <div className="flex flex-col justify-between gap-3 border-b border-[#e2e3ec] px-5 py-4 md:flex-row md:items-center">
          <button className="flex min-w-0 items-center gap-3 text-left" onClick={() => setProductsOpen((open) => !open)} aria-expanded={productsOpen}>
            <ChevronDown className={`size-4 shrink-0 text-[#312d5e] transition-transform ${productsOpen ? 'rotate-180' : ''}`} />
            <div>
              <h3 className="font-semibold">Produtos adquiridos pelo cliente</h3>
              <p className="mt-1 text-xs text-[#71728a]">
                {selectedFamily ? `Família selecionada: ${selectedFamily} · ${products.length} produtos` : `${categoryProducts.length} produtos · clique para expandir`}
              </p>
            </div>
          </button>
          {productsOpen && (
            <div className="flex min-w-0 items-center gap-2 rounded-xl border border-[#d9dbea] bg-[#f8f9fc] px-3 py-2 md:w-[360px]">
              <Search className="size-4 shrink-0 text-[#74758f]" />
              <input value={productFilter} onChange={(event) => setProductFilter(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Código, produto ou família" aria-label="Filtrar produtos analisados" />
            </div>
          )}
        </div>
        {productsOpen && (
        <Table>
          <TableHeader>
            <TableRow className="bg-[#f7f9f8]">
              <TableHead className="pl-6">Produto</TableHead>
              <TableHead>Família</TableHead>
              <TableHead className="text-right">Quantidade</TableHead>
              <TableHead className="text-right">Documentos</TableHead>
              <TableHead className="text-right">Faturamento</TableHead>
              <TableHead className="pr-6 text-right">Participação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((item) => (
              <TableRow key={`${item.codigoProduto}-${item.produto}`}>
                <TableCell className="pl-6">
                  <span className="block text-xs font-semibold text-[#008ad0]">{item.codigoProduto}</span>
                  <span className="block max-w-[420px] truncate font-medium">{item.produto}</span>
                </TableCell>
                <TableCell className="max-w-[240px] truncate text-sm text-[#62637b]">{item.familia}</TableCell>
                <TableCell className="text-right tabular-nums">{new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(item.quantidade)}</TableCell>
                <TableCell className="text-right tabular-nums">{item.documentos}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{brl(item.faturamento)}</TableCell>
                <TableCell className="pr-6 text-right font-semibold tabular-nums text-[#312d5e]">{pct(total ? item.faturamento / total : 0)}</TableCell>
              </TableRow>
            ))}
            {!products.length && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-[#71728a]">Nenhum produto encontrado neste contexto.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        )}
      </div>
    </section>
  );
}

function NavItem({
  icon: Icon,
  label,
  active = false,
  onClick,
}: {
  icon: typeof LayoutDashboard;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${active ? 'bg-white/10 font-medium text-white' : 'text-white/60 hover:bg-white/[.06] hover:text-white'}`}
    >
      <Icon className={`size-4 ${active ? 'text-[#36b8f7]' : ''}`} />
      {label}
    </button>
  );
}
function clientTermFromQuestion(question: string) {
  return (
    question
      .match(
        /cliente\s+(.+?)(?=\s+(?:no|em|de|do|entre)\b.*?\b20\d{2}\b|$)/i,
      )?.[1]
      ?.trim() ?? ''
  );
}
function formatIsoDate(value: string) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}
function formatPeriod(period: ReportData['period'], fallbackYear: number) {
  if (!period) return `01 jan — 31 dez ${fallbackYear}`;
  const start = new Date(`${period.start}T12:00:00`);
  const end = new Date(`${period.end}T12:00:00`);
  end.setDate(end.getDate() - 1);
  const dayMonth = (value: Date) =>
    new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
      .format(value)
      .replace('.', '');
  return `${dayMonth(start)} — ${dayMonth(end)} ${end.getFullYear()}`;
}
function Metric({
  label,
  value,
  caption,
  danger = false,
}: {
  label: string;
  value: string;
  caption: string;
  danger?: boolean;
}) {
  return (
    <article className={`rounded-[18px] border bg-white p-5 ${danger ? 'border-red-200' : 'border-[#dce4e0]'}`}>
      <p className={`text-xs font-medium ${danger ? 'text-red-600' : 'text-[#6d7f78]'}`}>{label}</p>
      <p className={`mt-3 text-[25px] font-semibold tracking-[-.04em] ${danger ? 'text-red-600' : ''}`}>
        {value}
      </p>
      <p className="mt-2 text-xs text-[#84938e]">{caption}</p>
    </article>
  );
}
function InsightMetric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#e1e2ec] bg-[#fafafe] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#73748a]">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-semibold tracking-[-.03em] ${accent ? 'text-[#008ad0]' : 'text-[#312d5e]'}`}
      >
        {value}
      </p>
    </div>
  );
}
function YoyTooltip({
  active,
  payload,
  label,
  currentYear,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey?: string | number;
    value?: number;
    color?: string;
    payload?: { variacao: number | null };
  }>;
  label?: string | number;
  currentYear: number;
}) {
  if (!active || !payload?.length) return null;
  const atual = Number(
    payload.find((item) => item.dataKey === 'atual')?.value ?? 0,
  );
  const anterior = Number(
    payload.find((item) => item.dataKey === 'anterior')?.value ?? 0,
  );
  const variacao = payload[0]?.payload?.variacao ?? null;
  return (
    <div className="min-w-[190px] rounded-xl border border-[#dfe1eb] bg-white p-3 text-xs shadow-xl">
      <p className="mb-2 font-semibold capitalize text-[#312d5e]">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-5">
          <span className="flex items-center gap-1.5 text-[#6e6f85]">
            <i className="size-2 rounded-full bg-[#008ad0]" />
            {currentYear}
          </span>
          <strong className="font-mono">{brl(atual)}</strong>
        </div>
        <div className="flex items-center justify-between gap-5">
          <span className="flex items-center gap-1.5 text-[#6e6f85]">
            <i className="size-2 rounded-full bg-[#312d5e]" />
            {currentYear - 1}
          </span>
          <strong className="font-mono">{brl(anterior)}</strong>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-[#e8e9f0] pt-2">
        <span className="font-medium text-[#6e6f85]">Variação mensal</span>
        {variacao === null ? (
          <strong className="text-[#77788d]">Sem base</strong>
        ) : (
          <strong className={variacao >= 0 ? 'text-[#0079b7]' : 'text-red-700'}>
            {variacao >= 0 ? '↑ +' : '↓ '}
            {pct(variacao)}
          </strong>
        )}
      </div>
    </div>
  );
}
function CategoryCard({
  label,
  value,
  total,
  active,
  color,
  onClick,
}: {
  label: string;
  value: number;
  total: number;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  const share = total ? value / total : 0;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`w-full rounded-lg border px-3 py-2 text-left transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008ad0] ${active ? 'border-[#008ad0] bg-[#f0f9fe] ring-1 ring-[#008ad0]/30' : 'border-[#e0e2ec] bg-[#fbfbfd]'}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#62627b]">
            {label}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold tracking-[-.02em]">
            {brl(value)}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold text-white shadow-sm"
          style={{ backgroundColor: color }}
        >
          {new Intl.NumberFormat('pt-BR', {
            style: 'percent',
            maximumFractionDigits: 1,
          }).format(share)}
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#e7e8f0]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(share * 100, value ? 2 : 0)}%`,
            backgroundColor: color,
          }}
        />
      </div>
      {active && (
        <p className="mt-1.5 text-[10px] font-semibold leading-none text-[#0079b7]">
          Categoria selecionada
        </p>
      )}
    </button>
  );
}
