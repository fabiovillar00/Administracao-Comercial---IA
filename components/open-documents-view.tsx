'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell, TableFooter } from '@/components/ui/table';

export type OpenItem = {
  id: number;
  documentoId: number;
  clienteId?: number | null;
  clienteCodigo?: string | null;
  clienteNome?: string | null;
  clienteDocumento?: string | null;
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
  const [customersExpanded, setCustomersExpanded] = useState(false);
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [category, family, search, items]);
  const tableRef = useRef<HTMLDivElement>(null);
  const title = kind === 'orders' ? 'Pedidos' : 'Propostas';
  const all = items ?? [];
  const selected = category ? all.filter((item) => item.categoria === category) : all;
  const selectedTotal = sum(selected);
  const allTotal = sum(all);
  const familyTotals = new Map<string, number>();
  selected.forEach((item) => familyTotals.set(item.familia || 'Sem família', (familyTotals.get(item.familia || 'Sem família') ?? 0) + Number(item.valor || 0)));
  const families = [...familyTotals].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const term = search.trim().toLocaleLowerCase('pt-BR');
  const rows = selected.filter((item) => (!family || (item.familia || 'Sem família') === family) && (!term || [item.pedido, item.proposta, item.codigoProduto, item.descricaoProduto].some((value) => String(value ?? '').toLocaleLowerCase('pt-BR').includes(term))));
  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRows = rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
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
            const share = allTotal > 0 ? amount / allTotal : 0;
            return <button key={c.key} aria-pressed={category === c.key} onClick={() => toggleCategory(c.key)} className={`rounded-xl border p-4 text-left ${category === c.key ? 'border-[#008ad0] bg-[#f2faff]' : 'border-[#ddddeb] bg-[#fafafe]'}`}>
              <div className="flex justify-between"><span className="font-semibold">{c.name}</span><span className="text-sm">{(share * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span></div>
              <p className="mt-2 font-semibold">{items ? money(amount) : '—'}</p><p className="mt-1 text-xs text-[#71728a]">{count(matches)} {title.toLowerCase()}</p>
              <div className="mt-3 h-1 overflow-hidden rounded bg-[#e4e5ee]"><div className="h-full" style={{ width: `${Math.max(0, Math.min(100, share * 100))}%`, background: c.color }} /></div>
            </button>;
          })}
        </div>
        <p className="mt-3 text-xs text-[#71728a]">Cada categoria soma apenas seus itens. Um documento com tipos diferentes pode ser contado em mais de uma categoria.</p>
        {items && total != null && Math.abs(total - allTotal) > 0.01 && <p className="mt-2 text-xs text-[#71728a]">Total líquido dos itens: {money(allTotal)}. O total dos documentos é {money(total)}; os valores usam bases diferentes.</p>}
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><h3 className="font-semibold">Itens das {kind === 'orders' ? 'ordens de venda' : 'propostas'}</h3><p className="mt-1 text-xs text-[#71728a]">{family ? `${family} · ` : ''}{rows.length} itens · valor líquido por item</p></div><div className="flex flex-wrap items-center gap-2"><Button variant="outline" className="rounded-full" disabled={!rows.length} aria-expanded={customersExpanded} onClick={() => setCustomersExpanded((expanded) => !expanded)}><Users className="size-4" />{customersExpanded ? 'Recolher clientes de todos' : 'Expandir clientes de todos'}</Button><input aria-label="Filtrar itens" placeholder="Documento, código ou produto" value={search} onChange={(event) => setSearch(event.target.value)} className="rounded-lg border px-3 py-2 text-sm" /></div></div>
          <Table><TableHeader><TableRow>{kind === 'orders' && <TableHead>Pedido</TableHead>}<TableHead>Proposta</TableHead><TableHead>Data de inclusão</TableHead>{kind === 'orders' && <TableHead>Status da OV</TableHead>}<TableHead>Código do produto</TableHead><TableHead>Descrição do produto</TableHead><TableHead className="text-right">Quantidade</TableHead><TableHead className="text-right">Valor do item</TableHead></TableRow></TableHeader>
            <TableBody>{visibleRows.map((item) => <Fragment key={item.id}><TableRow>{kind === 'orders' && <TableCell>{item.pedido}</TableCell>}<TableCell>{item.proposta ?? '—'}</TableCell><TableCell>{item.dataInclusao?.slice(0, 10).split('-').reverse().join('/') ?? '—'}</TableCell>{kind === 'orders' && <TableCell>{item.status ?? '—'}</TableCell>}<TableCell>{item.codigoProduto ?? '—'}</TableCell><TableCell className="min-w-[240px] whitespace-normal">{item.descricaoProduto ?? '—'}</TableCell><TableCell className="text-right">{number(item.quantidade)}</TableCell><TableCell className="text-right whitespace-nowrap">{money(item.valor)}</TableCell></TableRow>
              {customersExpanded && <TableRow className="bg-[#f5f9fc] hover:bg-[#f5f9fc]"><TableCell colSpan={cols} className="px-6 py-3">
                <div className="border-l-2 border-[#b6dff2] pl-4">
                  <p className="mb-2 text-xs font-semibold text-[#62637b]">Cliente que compõe a quantidade deste item</p>
                  {item.clienteId != null ? <table className="w-full text-sm" aria-label={`Cliente do produto ${item.codigoProduto ?? 'sem código'} no documento ${item.pedido ?? item.proposta}`}>
                    <thead><tr className="text-left text-xs text-[#62637b]">
                      <th scope="col" className="py-1 pr-4">Código do cliente</th><th scope="col" className="py-1 pr-4">Nome</th><th scope="col" className="py-1 pr-4">CNPJ</th><th scope="col" className="py-1 text-right">Quantidade</th>
                    </tr></thead>
                    <tbody><tr className="border-t border-[#e2eaf0]">
                      <td className="py-1.5 pr-4 text-[#008ad0]">{item.clienteCodigo ?? '—'}</td><td className="whitespace-normal py-1.5 pr-4">{item.clienteNome ?? '—'}</td><td className="py-1.5 pr-4">{item.clienteDocumento || 'Não informado'}</td><td className="py-1.5 text-right tabular-nums">{number(item.quantidade)}</td>
                    </tr></tbody>
                  </table> : <p className="text-xs text-[#71728a]">Detalhamento de clientes indisponível. Atualize a análise para carregar os dados.</p>}
                </div>
              </TableCell></TableRow>}
            </Fragment>)}{!rows.length && <TableRow><TableCell colSpan={cols} className="py-8 text-center">{items ? 'Nenhum item encontrado.' : 'Refaça a pesquisa para carregar os itens.'}</TableCell></TableRow>}</TableBody>
            <TableFooter><TableRow><TableCell colSpan={cols - 1}>Valor total dos itens filtrados</TableCell><TableCell className="text-right whitespace-nowrap">{items ? money(sum(rows)) : '—'}</TableCell></TableRow></TableFooter>
          </Table>
          {rows.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
            <p className="text-xs text-[#71728a]">Exibindo {number(currentPage * pageSize + 1)}–{number(Math.min((currentPage + 1) * pageSize, rows.length))} de {number(rows.length)} itens · totais consideram todos os itens filtrados</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anterior</Button>
              <span className="text-xs">Página {number(currentPage + 1)} de {number(pageCount)}</span>
              <Button variant="outline" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>Próxima</Button>
            </div>
          </div>}
        </div>
      </>}
    </>}
  </section>;
}
