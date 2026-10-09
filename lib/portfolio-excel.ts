import ExcelJS from 'exceljs';

type Activity = { uf?: string; municipio?: string; proposalCount: number; proposalValue: number; lastOrder: string | null; lastSale: string | null; hasBaseYearOrder?: boolean };
type ExportGroup = Activity & { name: string; members: (Activity & { codigo: string; nome: string; documento: string })[] };
type ExportInput = {
  groups: ExportGroup[];
  filters: { years: number; baseYear: number; category: string; mode: string };
  period: { historyStart: string; historyEnd: string; inactiveStart: string; inactiveEnd: string };
  generatedAt: string;
  search: string;
};
const date = (value: string | null) => value ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : null;

export function portfolioWorkbook(input: ExportInput) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Pulso Comercial';
  const locationColumns = [{ header: 'UF', key: 'uf', width: 18 }, { header: 'Município', key: 'municipio', width: 50 }];
  const columns = [
    { header: 'Propostas qtd.', key: 'proposalCount', width: 18 },
    { header: 'Valor das propostas (R$)', key: 'proposalValue', width: 26, style: { numFmt: '"R$" #,##0.00' } },
    { header: 'Último pedido', key: 'lastOrder', width: 19, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Último faturamento', key: 'lastSale', width: 23, style: { numFmt: 'dd/mm/yyyy' } },
    { header: `Pedido em ${input.filters.baseYear} (atenção exclusiva)`, key: 'attention', width: 38 },
  ];
  const activity = (row: Activity) => ({ ...row, lastOrder: date(row.lastOrder), lastSale: date(row.lastSale), attention: row.hasBaseYearOrder ? 'Sim' : 'Não' });
  const groups = workbook.addWorksheet('Grupos');
  groups.columns = [{ header: 'Grupo', key: 'group', width: 60 }, ...locationColumns, { header: 'Unidades qtd.', key: 'units', width: 18 }, ...columns];
  const units = workbook.addWorksheet('Unidades');
  units.columns = [{ header: 'Grupo', key: 'group', width: 60 }, { header: 'Código da unidade', key: 'codigo', width: 22, style: { numFmt: '@' } }, { header: 'Unidade / filial', key: 'nome', width: 60 }, ...locationColumns, { header: 'CNPJ / CPF', key: 'documento', width: 24, style: { numFmt: '@' } }, ...columns];
  for (const group of input.groups) {
    groups.addRow({ ...activity(group), group: group.name, units: group.members.length });
    for (const unit of group.members) units.addRow({ ...activity(unit), group: group.name, codigo: String(unit.codigo ?? ''), documento: String(unit.documento ?? '') });
  }
  const filters = workbook.addWorksheet('Critérios');
  filters.columns = [{ header: 'Critério', key: 'label', width: 34 }, { header: 'Valor', key: 'value', width: 75 }];
  const category = ({ all: 'Geral', pecas: 'Peças', implementos: 'Implementos' } as Record<string, string>)[input.filters.category];
  const rows = [
    ['Fonte', 'Pulso Comercial — Carteira inteligente'],
    ['Consulta concluída em', new Date(input.generatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })],
    ['Ano-base', input.filters.baseYear], ['Histórico (anos)', input.filters.years], ['Tipo de produto', category],
    ['Sem faturamento', input.filters.mode === 'both' ? 'No ano-base e no ano anterior' : 'No ano-base'],
    ['Início do histórico', date(input.period.historyStart)], ['Fim do histórico', date(input.period.historyEnd)],
    ['Início sem faturamento', date(input.period.inactiveStart)], ['Fim sem faturamento', date(input.period.inactiveEnd)],
    ['Busca', input.search || 'Sem filtro de busca'], ['Grupos exportados', input.groups.length],
    ['Escopo', 'Todos os grupos da busca e suas unidades, incluindo todas as páginas.'],
  ];
  for (const [label, value] of rows) {
    const row = filters.addRow({ label, value });
    if (value instanceof Date) row.getCell(2).numFmt = 'dd/mm/yyyy';
  }
  for (const sheet of workbook.worksheets) {
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: sheet.rowCount, column: sheet.columnCount } };
    sheet.getRow(1).height = 32;
    sheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF312D5E' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
  }
  return workbook;
}

export async function exportPortfolioExcel(input: ExportInput) {
  const buffer = await portfolioWorkbook(input).xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `carteira-${input.filters.baseYear}-${input.filters.category}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
