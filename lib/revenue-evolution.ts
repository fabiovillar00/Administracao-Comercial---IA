type MonthlyRevenue = { mes: string; liquido: number };

// API periods use an exclusive end date.
export function revenueEvolution(rows: MonthlyRevenue[], period?: { start: string; end: string }) {
  const sorted = [...rows].sort((a, b) => a.mes.localeCompare(b.mes));
  const lastDay = period ? new Date(`${period.end}T12:00:00Z`) : null;
  lastDay?.setUTCDate(lastDay.getUTCDate() - 1);
  const start = period?.start ?? sorted[0]?.mes;
  const end = lastDay?.toISOString().slice(0, 10) ?? sorted.at(-1)?.mes;
  const annual = Boolean(start && end && start.slice(0, 4) !== end.slice(0, 4));
  if (!annual) return {
    annual,
    points: sorted.map(row => ({
      label: new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })
        .format(new Date(`${row.mes}T12:00:00Z`)).replace('.', ''),
      value: row.liquido,
    })),
  };
  const totals = new Map<number, number>();
  for (let year = Number(start!.slice(0, 4)); year <= Number(end!.slice(0, 4)); year++) totals.set(year, 0);
  for (const row of sorted) {
    const year = Number(row.mes.slice(0, 4));
    totals.set(year, (totals.get(year) ?? 0) + row.liquido);
  }
  return {
    annual,
    points: [...totals].map(([year, value]) => ({
      label: `${year}${(start! > `${year}-01-01` || end! < `${year}-12-31`) ? ' (parcial)' : ''}`,
      value,
    })),
  };
}
