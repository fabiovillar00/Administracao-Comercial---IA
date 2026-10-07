'use client';

import { usePathname } from 'next/navigation';

export function PortfolioNav() {
  const path = usePathname();
  return <nav aria-label="Análises da carteira" className="mx-auto flex max-w-[1500px] flex-wrap gap-2 px-5 pt-5">{[['/carteira', 'Clientes que deixaram de comprar'], ['/carteira/grupo', 'Visão do grupo']].map(([href, label]) => <a key={href} href={href} aria-current={path === href ? 'page' : undefined} className={`rounded-full border px-4 py-2 text-sm font-semibold ${path === href ? 'border-[#312d5e] bg-[#312d5e] text-white' : 'border-[#d9dbea] bg-white text-[#62637b] hover:border-[#008ad0]'}`}>{label}</a>)}</nav>;
}
