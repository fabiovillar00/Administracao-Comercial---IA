export type PrintableProposal = {
  numero: string; data: string; valor: number;
  unit: { codigo: string; nome: string; documento: string };
  items: Array<{ codigo: string; nome: string; quantidade: number; valor: number }>;
};
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function proposalPrintHtml(input: { group: string; category: string; years: number; baseYear: number; mode: string; search: string; login: string; printedAt: string; logo: string; proposals: PrintableProposal[] }) {
  const e = escape;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Propostas — ${e(input.group)}</title><style>
  @page { size: A4 portrait; margin: 12mm; }
  body { font: 11px Arial,sans-serif; color: #24233d; margin: 0; }
  header { display:flex; gap:20px; align-items:center; border-bottom:2px solid #312d5e; padding-bottom:12px; }
  header img { width:140px; height:auto; } h1 { font-size:18px; } h2 { font-size:14px; margin-bottom:6px; }
  p { margin:5px 0; } .context { margin:16px 0; } .proposal-heading { break-inside:avoid; break-after:avoid; margin-top:18px; }
  table { border-collapse:collapse; width:100%; table-layout:fixed; } thead { display:table-header-group; }
  th,td { border-bottom:1px solid #d9dbea; padding:7px 5px; text-align:left; overflow-wrap:anywhere; }
  th { background:#eef3f8; } tr { break-inside:avoid; } th:nth-child(1) { width:21%; } th:nth-child(2) { width:44%; } th:nth-child(3) { width:12%; }
  td:nth-child(3),td:nth-child(4),th:nth-child(3),th:nth-child(4) { text-align:right; }
  .total { margin-top:18px; font-weight:bold; } footer { margin-top:20px; font-size:10px; color:#62637b; }
  </style></head><body><header><img src="${e(input.logo)}" alt="DMB"><div><h1>Carteira inteligente · Propostas</h1><p>Impresso em: ${e(input.printedAt)} (Brasília)</p><p>Usuário: ${e(input.login)}</p></div></header>
  <div class="context"><h2>Grupo: ${e(input.group)}</h2><p>Categoria: ${e(input.category)} · Em elaboração · Valores líquidos dos itens</p><p>Histórico: ${input.years} anos · Ano-base: ${input.baseYear} · Sem faturamento: ${e(input.mode)}</p>${input.search ? `<p>Busca nas propostas: ${e(input.search)}</p>` : ''}<p>${input.proposals.length} proposta(s) neste relatório</p></div>
  ${input.proposals.map(p => `<div class="proposal-heading"><h2>${e(p.numero)} · ${e(p.data.slice(0,10).split('-').reverse().join('/'))} · ${e(money(p.valor))}</h2><p>${e(p.unit.codigo)} · ${e(p.unit.nome)}</p><p>CNPJ: ${e(p.unit.documento || 'Não informado')}</p></div><table><thead><tr><th>Código</th><th>Produto</th><th>Quantidade</th><th>Valor líquido</th></tr></thead><tbody>${p.items.map(i => `<tr><td>${e(i.codigo)}</td><td>${e(i.nome)}</td><td>${e(i.quantidade.toLocaleString('pt-BR', { maximumFractionDigits:4 }))}</td><td>${e(money(i.valor))}</td></tr>`).join('') || '<tr><td colspan="4">Nenhum produto disponível neste filtro.</td></tr>'}</tbody></table>`).join('')}
  <p class="total">Total das propostas deste relatório: ${e(money(input.proposals.reduce((s,p) => s+p.valor,0)))}</p><footer>Pulso Comercial · Departamento de Tecnologia e Informação — DMB</footer></body></html>`;
}

export function printProposalDocument(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    document.getElementById('proposal-print-frame')?.remove();
    const frame = document.createElement('iframe');
    frame.id = 'proposal-print-frame'; frame.title = 'Impressão das propostas';
    frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-10000px;top:0;border:0';
    frame.onload = async () => {
      try {
        const doc = frame.contentDocument, target = frame.contentWindow;
        if (!doc || !target) throw new Error('Não foi possível preparar a impressão.');
        await Promise.all(Array.from(doc.images).map(img => img.decode()));
        target.addEventListener('afterprint', () => setTimeout(() => frame.remove(), 0), { once: true });
        target.focus(); target.print(); resolve();
      } catch (error) { frame.remove(); reject(error); }
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}

type PortfolioPrintRow = { hasBaseYearOrder?: boolean; proposalCount: number; proposalValue: number; lastOrder: string | null; lastSale: string | null };
export function portfolioPrintHtml(input: {
  groups: Array<PortfolioPrintRow & { id: string; name: string; members: Array<PortfolioPrintRow & { codigo: string; nome: string; documento: string }> }>;
  expanded: Set<string>; category: string; years: number; baseYear: number; search: string;
  period: { historyStart: string; historyEnd: string; inactiveStart: string; inactiveEnd: string };
  login: string; printedAt: string; generatedAt: string; logo: string;
}) {
  const e = escape;
  const day = (s: string | null) => s ? s.slice(0,10).split('-').reverse().join('/') : '—';
  const cells = (r: PortfolioPrintRow) => `<td class="numeric">${r.proposalCount.toLocaleString('pt-BR')}</td><td class="numeric">${e(money(r.proposalValue))}</td><td>${day(r.lastOrder)}</td><td>${day(r.lastSale)}${r.hasBaseYearOrder ? `<small>💡 Atenção exclusiva: pedido em ${input.baseYear}</small>` : ''}</td>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Carteira inteligente — Clientes sem compras</title><style>
  @page { size:A4 portrait; margin:12mm; } body { font:11px Arial,sans-serif; color:#24233d; margin:0; }
  header { display:flex; gap:20px; align-items:center; padding-bottom:12px; border-bottom:2px solid #312d5e; }
  header img { width:140px; height:auto; } h1 { font-size:18px; } p { margin:6px 0; } .context { margin:16px 0; }
  table { width:100%; table-layout:fixed; border-collapse:collapse; } thead { display:table-header-group; }
  th,td { text-align:left; border-bottom:1px solid #d9dbea; padding:7px 5px; overflow-wrap:anywhere; }
  th { background:#eef3f8; } th:first-child { width:34%; } th:nth-child(2) { width:12%; } th:nth-child(3) { width:22%; }
  tr { break-inside:avoid; } .numeric { text-align:right; } .unit td { font-size:10px; background:#f6f9fc; } .unit td:first-child { padding-left:16px; }
  small { display:block; margin-top:3px; color:#62637b; } footer { margin-top:16px; font-size:10px; }
  </style></head><body><header><img src="${e(input.logo)}" alt="DMB"><div><h1>Carteira inteligente</h1><p>Clientes que deixaram de comprar</p><p>Impresso em: ${e(input.printedAt)} (Brasília)</p><p>Usuário: ${e(input.login)}</p></div></header>
  <div class="context"><p><strong>${e(input.category)} · Histórico de ${input.years} anos · Ano-base ${input.baseYear}</strong></p><p>Comprou de ${day(input.period.historyStart)} a ${day(input.period.historyEnd)}</p><p>Sem faturamento de ${day(input.period.inactiveStart)} a ${day(input.period.inactiveEnd)}</p><p>Análise consultada em: ${e(input.generatedAt)}</p>${input.search ? `<p>Busca: ${e(input.search)}</p>` : ''}<p><strong>${input.groups.length} grupos · ${input.groups.reduce((s,g)=>s+g.proposalCount,0).toLocaleString('pt-BR')} propostas · ${e(money(input.groups.reduce((s,g)=>s+g.proposalValue,0)))}</strong></p><p>Propostas em elaboração · Valores líquidos dos itens · Unidades incluídas nos grupos expandidos.</p></div>
  <table><thead><tr><th>Grupo / unidade</th><th class="numeric">Propostas qtd.</th><th class="numeric">R$ propostas</th><th>Último pedido</th><th>Último faturamento</th></tr></thead><tbody>${input.groups.map(g=>`<tr><td><strong>${e(g.name)}</strong><small>${g.members.length} unidade(s)</small></td>${cells(g)}</tr>${input.expanded.has(g.id) ? g.members.map(u=>`<tr class="unit"><td>${e(u.codigo)} · ${e(u.nome)}<small>CNPJ: ${e(u.documento || 'Não informado')}</small></td>${cells(u)}</tr>`).join('') : ''}`).join('') || '<tr><td colspan="5">Nenhum grupo nesta seleção.</td></tr>'}</tbody></table><footer>Pulso Comercial · Departamento de Tecnologia e Informação — DMB</footer></body></html>`;
}
