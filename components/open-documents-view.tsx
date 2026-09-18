'use client';

import { useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell, TableFooter } from '@/components/ui/table';

export type OpenItem = {
  id: number;
  documentoId: number;
  pedido?: string | number;
  proposta: string | number | null;
  codigoProduto: string | null;
  descricaoProduto: string | null;
  dataInclusao: string | null;
  status?: string;
  quantidade: number;
  valor: number;
  familia: string;
  categoria: string;
};

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const number = (value: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(value);
const categories = [
  { key: 'pecas', name: 'Peças', color: '#008ad0' },
  { key: 'implementos', name: 'Implementos', color: '#312d5e' },
  { key: 'servicos', name: 'Serviços', color: '#55b9e9' },
  { key: 'outros', name: 'Outros', color: '#71728a' },
];
const sum = (items: OpenItem[]) => items.reduce((total, item) => total + Number(item.valor || 0), 0);
const count = (items: OpenItem[]) => new Set(items.map((item) => item.documentoId)).size;

export function OpenDocumentsView({ kind, detail, client, items, total, documents, onNavigate }: {
  kind: 'orders' | 'proposals';
  detail: boolean;
  client?: string;
  items?: OpenItem[];
  total?: number;
  documents?: number;
  onNavigate: (detail: boolean) => void;
}) {
  const [category, setCategory] = useState<string | null>(null);
  const [family, setFamily] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const tableRef = useRef<HTMLDivElement>(null);
  const title = kind === 'orders' ? 'Pedidos' : 'Propostas';
  const all = items ?? [];
  const selected = category ? all.filter((item) => item.categoria === category) : all;
  const selectedTotal = sum(selected);
  const familyTotals = new Map<string, number>();
  selected.forEach((item) => familyTotals.set(item.familia || 'Sem família', (familyTotals.get(item.familia || 'Sem família') ?? 0) + Number(item.valor || 0)));
  const families = [...familyTotals].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const term = search.trim().toLocaleLowerCase('pt-BR');
  const rows = selected.filter((item) => (!family || (item.familia || 'Sem família') === family) && (!term || [item.pedido, item.proposta, item.codigoProduto, item.descricaoProduto].some((value) => String(value ?? '').toLocaleLowerCase('pt-BR').includes(term))));
  const cols = kind === 'orders' ? 8 : 6;
  const toggleCategory = (key: string) => { setCategory((current) => current === key ? null : key); setFamily(null); setSearch(''); };
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#dce4e0] bg-white p-5">
      <div><h3 className="font-semibold">{title} em aberto{detail ? ' / Produtos' : ''}</h3>
        <p className="mt-1 text-sm text-[#71728a]">{client ? `${client} · todas as empresas vinculadas · todas as datas` : 'Pesquise um cliente ou grupo para consultar os dados.'}</p></div>
      {client && <div className="flex flex-wrap gap-2">
        {detail && <Button variant="outline" onClick={() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Ver tabela ({items?.length ?? 0} itens)</Button>}
        <Button variant="outline" onClick={() => onNavigate(!detail)}>{detail ? `Voltar a ${title}` : 'Explorar produtos'}</Button>
      </div>}
    </div>
    {client && <>
      <div className="grid gap-3 md:grid-cols-2">
        <article className="rounded-[18px] border border-[#dce4e0] bg-white p-5"><p className="text-xs text-[#71728a]">Quantidade de {title.toLowerCase()}</p><p className="mt-3 text-2xl font-semibold">{category ? count(selected) : documents ?? '—'}</p><p className="mt-2 text-xs text-[#71728a]">Documentos únicos{category ? ' na categoria selecionada' : ' em aberto'}</p></article>
        <article className="rounded-[18px] border border-[#dce4e0] bg-white p-5"><p className="text-xs text-[#71728a]">{category || detail ? 'Valor dos itens analisados' : 'Valor total em aberto'}</p><p className="mt-3 text-2xl font-semibold">{category || detail ? (items ? money(selectedTotal) : '—') : total != null ? money(total) : '—'}</p><p className="mt-2 text-xs text-[#71728a]">{category || detail ? 'Soma do valor líquido dos itens' : 'Valor total dos documentos do grupo'}</p></article>
      </div>
      <div className="rounded-[18px] border border-[#dce4e0] bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="font-semibold">Composição por tipo de produto</h3><p className="mt-1 text-xs text-[#71728a]">Valores líquidos dos itens · clique para filtrar{detail ? ' o gráfico e a tabela' : ''}</p></div>{category && <Button variant="outline" onClick={() => { setCategory(null); setFamily(null); setSearch(''); }}>Geral</Button>}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {categories.filter((c) => ['pecas', 'implementos'].includes(c.key) || all.some((item) => item.categoria === c.key)).map((c) => {
            const matches = all.filter((item) => item.categoria === c.key);
            const amount = sum(matches);
            const share = sum(all) > 0 ? amount / sum(all) : 0;
            return <button key={c.key} aria-pressed={category === c.key} onClick={() => toggleCategory(c.key)} className={`rounded-xl border p-4 text-left ${category === c.key ? 'border-[#008ad0] bg-[#f2faff]' : 'border-[#ddddeb] bg-[#fafafe]'}`}>
              <div className="flex justify-between"><span className="font-semibold">{c.name}</span><span className="text-sm">{(share * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span></div>
              <p className="mt-2 font-semibold">{items ? money(amount) : '—'}</p><p className="mt-1 text-xs text-[#71728a]">{count(matches)} {title.toLowerCase()}</p>
              <div className="mt-3 h-1 overflow-hidden rounded bg-[#e4e5ee]"><div className="h-full" style={{ width: `${Math.max(0, Math.min(100, share * 100))}%`, background: c.color }} /></div>
            </button>;
          })}
        </div>
        <p className="mt-3 text-xs text-[#71728a]">Cada categoria soma apenas seus itens. Um documento com tipos diferentes pode ser contado em mais de uma categoria.</p>
        {items && total != null && Math.abs(total - sum(all)) > 0.01 && <p className="mt-2 text-xs text-[#71728a]">Total líquido dos itens: {money(sum(all))}. O total dos documentos é {money(total)}; os valores usam bases diferentes.</p>}
      </div>
      {detail && <>
        <div className="rounded-[18px] border border-[#dce4e0] bg-white p-5">
          <div className="flex justify-between gap-3"><h3 className="font-semibold">Valor por família</h3>{family && <Button variant="outline" onClick={() => setFamily(null)}>Limpar família</Button>}</div>
          <p className="mt-1 text-xs text-[#71728a]">Clique em uma família para consultar seus itens · percentual sobre a categoria selecionada</p>
          {families.length ? <div className="mt-4 max-h-[320px] overflow-y-auto" role="region" aria-label="Gráfico por família" tabIndex={0}><ChartContainer config={{ value: { label: 'Valor dos itens', color: '#008ad0' } }} className="w-full" style={{ height: Math.max(240, families.length * 45) }}>
            <BarChart data={families} layout="vertical" margin={{ left: 8, right: 76 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" /><XAxis type="number" tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} /><YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => money(Number(value))} />} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}><LabelList dataKey="value" position="right" fontSize={12} formatter={(value) => `${(selectedTotal > 0 ? Number(value) / selectedTotal * 100 : 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`} />
                {families.map((f) => <Cell key={f.name} fill={!family || family === f.name ? '#008ad0' : '#cbd5e1'} className="cursor-pointer" onClick={() => setFamily((current) => current === f.name ? null : f.name)} />)}
              </Bar>
            </BarChart>
          </ChartContainer></div> : <p className="py-8 text-center text-sm text-[#71728a]">Nenhum item nesta categoria.</p>}
        </div>
        <div ref={tableRef} className="scroll-mt-4 overflow-hidden rounded-[18px] border border-[#dce4e0] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><h3 className="font-semibold">Itens das {kind === 'orders' ? 'ordens de venda' : 'propostas'}</h3><p className="mt-1 text-xs text-[#71728a]">{family ? `${family} · ` : ''}{rows.length} itens · valor líquido por item</p></div><input aria-label="Filtrar itens" placeholder="Documento, código ou produto" value={search} onChange={(event) => setSearch(event.target.value)} className="rounded-lg border px-3 py-2 text-sm" /></div>
          <Table><TableHeader><TableRow>{kind === 'orders' && <TableHead>Pedido</TableHead>}<TableHead>Proposta</TableHead><TableHead>Data de inclusão</TableHead>{kind === 'orders' && <TableHead>Status da OV</TableHead>}<TableHead>Código do produto</TableHead><TableHead>Descrição do produto</TableHead><TableHead className="text-right">Quantidade</TableHead><TableHead className="text-right">Valor do item</TableHead></TableRow></TableHeader>
            <TableBody>{rows.map((item) => <TableRow key={item.id}>{kind === 'orders' && <TableCell>{item.pedido}</TableCell>}<TableCell>{item.proposta ?? '—'}</TableCell><TableCell>{item.dataInclusao?.slice(0, 10).split('-').reverse().join('/') ?? '—'}</TableCell>{kind === 'orders' && <TableCell>{item.status ?? '—'}</TableCell>}<TableCell>{item.codigoProduto ?? '—'}</TableCell><TableCell className="min-w-[240px] whitespace-normal">{item.descricaoProduto ?? '—'}</TableCell><TableCell className="text-right">{number(item.quantidade)}</TableCell><TableCell className="text-right whitespace-nowrap">{money(item.valor)}</TableCell></TableRow>)}{!rows.length && <TableRow><TableCell colSpan={cols} className="py-8 text-center">{items ? 'Nenhum item encontrado.' : 'Refaça a pesquisa para carregar os itens.'}</TableCell></TableRow>}</TableBody>
            <TableFooter><TableRow><TableCell colSpan={cols - 1}>Valor total dos itens exibidos</TableCell><TableCell className="text-right whitespace-nowrap">{items ? money(sum(rows)) : '—'}</TableCell></TableRow></TableFooter>
          </Table>
        </div>
      </>}
    </>}
  </section>;
}
