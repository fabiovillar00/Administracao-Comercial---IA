import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { portfolioWorkbook } from '../lib/portfolio-excel.ts';

const activity = { uf: 'SP', municipio: 'Matão', proposalCount: 2, proposalValue: 1234.56, lastOrder: '2025-03-24T15:00:00', lastSale: null, hasBaseYearOrder: true };
const input = {
  groups: Array.from({ length: 26 }, (_, i) => ({ ...activity, name: `Grupo ${i} & Cia`, members: [{ ...activity, codigo: '00123', nome: '=Teste', documento: '00123456000100' }] })),
  filters: { years: 3, baseYear: 2026, category: 'all', mode: 'base' },
  period: { historyStart: '2023-01-01', historyEnd: '2025-12-31', inactiveStart: '2026-01-01', inactiveEnd: '2026-10-08' },
  generatedAt: '2026-10-08T12:00:00Z', search: 'Cia',
};
const output = await portfolioWorkbook(input).xlsx.writeBuffer();
const loaded = new ExcelJS.Workbook();
await loaded.xlsx.load(output);
assert.deepEqual(loaded.worksheets.map(s => s.name), ['Grupos', 'Unidades', 'Critérios']);
const groups = loaded.getWorksheet('Grupos');
const units = loaded.getWorksheet('Unidades');
assert.equal(groups.rowCount, 27);
assert.equal(units.rowCount, 27);
assert.equal(groups.getCell('F2').value, 1234.56);
assert.equal(groups.getCell('G2').value.toISOString(), '2025-03-24T00:00:00.000Z');
assert.equal(groups.getCell('H2').value, null);
assert.equal(units.getCell('B2').value, '00123');
assert.equal(units.getCell('C2').value, '=Teste');
assert.equal(units.getCell('C2').type, ExcelJS.ValueType.String);
assert.equal(units.getCell('F2').value, '00123456000100');
assert.equal(groups.getCell('B1').value, 'UF');
assert.equal(groups.getCell('C1').value, 'Município');
assert.equal(groups.getCell('B2').value, 'SP');
assert.equal(groups.getCell('C2').value, 'Matão');
assert.equal(units.getCell('D2').value, 'SP');
assert.equal(units.getCell('E2').value, 'Matão');
assert.equal(groups.views[0].ySplit, 1);
assert.ok(groups.autoFilter);
const filtered = portfolioWorkbook({ ...input, groups: input.groups.slice(0, 1) });
assert.equal(filtered.getWorksheet('Grupos').rowCount, 2);
assert.equal(filtered.getWorksheet('Unidades').rowCount, 2);
console.log('Excel: round-trip OK; all pages, filtered rows, dates, amounts, text identifiers and safe text cells verified.');
