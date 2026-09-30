import { test } from 'node:test';
import assert from 'node:assert/strict';
import { revenueEvolution } from './revenue-evolution.ts';

test('full single year stays monthly with exclusive January end', () => {
  const result = revenueEvolution([{ mes: '2025-12-01', liquido: 120 }], { start: '2025-01-01', end: '2026-01-01' });
  assert.equal(result.annual, false);
  assert.deepEqual(result.points, [{ label: 'dez', value: 120 }]);
});
test('multiple years aggregate net revenue, preserve empty years and totals', () => {
  const result = revenueEvolution([
    { mes: '2026-02-01', liquido: 80 },
    { mes: '2018-02-01', liquido: -20 },
    { mes: '2018-01-01', liquido: 120 },
  ], { start: '2018-01-01', end: '2027-01-01' });
  assert.equal(result.annual, true);
  assert.equal(result.points.length, 9);
  assert.deepEqual(result.points[0], { label: '2018', value: 100 });
  assert.deepEqual(result.points[1], { label: '2019', value: 0 });
  assert.equal(result.points.reduce((sum, point) => sum + point.value, 0), 180);
});
test('partial boundary years and category values are respected', () => {
  const result = revenueEvolution([{ mes: '2025-12-01', liquido: 17 }], { start: '2025-12-15', end: '2026-02-01' });
  assert.deepEqual(result.points, [{ label: '2025 (parcial)', value: 17 }, { label: '2026 (parcial)', value: 0 }]);
});
test('no report returns an empty series', () => {
  assert.deepEqual(revenueEvolution([]), { annual: false, points: [] });
});
