'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export function UsageAdminLink() {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/me', { cache: 'no-store', signal: controller.signal })
      .then(async r => { if (r.ok) { const identity = await r.json() as { canManageUsage?: boolean }; setAllowed(identity.canManageUsage === true); } })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return allowed ? <a href="/uso" className="block rounded-xl px-3 py-3 text-sm text-white/80 hover:bg-white/10">Uso da plataforma</a> : null;
}

export function UsageTracker() {
  const pathname = usePathname();
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let identityTimer: ReturnType<typeof setInterval> | undefined;
    let lastInteraction = 0;
    let pending = false;
    const session = crypto.randomUUID();
    const activity = () => { if (!document.hidden) lastInteraction = Date.now(); };
    const controller = new AbortController();
    const send = async () => {
      const view = pathname === '/' ? document.querySelector('[data-usage-view]')?.getAttribute('data-usage-view') : pathname === '/uso' ? 'usage' : null;
      if (!view || pending || stopped) return;
      pending = true;
      try {
        await fetch('/api/usage/heartbeat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ session, view, active: !document.hidden && Date.now()-lastInteraction < 30000 }),
        });
      } catch { /* Telemetry must not interrupt commercial work. */ }
      finally { pending = false; }
    };
    const change = () => { void send(); };
    void fetch('/api/me', { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) return;
      const identity = await response.json() as { authenticated?: boolean; usageReady?: boolean };
      if (stopped || !identity.authenticated || !identity.usageReady) return;
      for (const event of ['pointerdown', 'keydown', 'scroll']) window.addEventListener(event, activity, { passive: true });
      window.addEventListener('pulso-view', change);
      document.addEventListener('visibilitychange', change);
      void send();
      timer = setInterval(() => { void send(); }, 30000);
      identityTimer = setInterval(() => {
        void fetch('/api/me', { cache:'no-store', signal:controller.signal }).catch(() => {});
      }, 120000);
    }).catch(() => {});
    return () => {
      stopped = true; controller.abort(); clearInterval(timer); clearInterval(identityTimer);
      for (const event of ['pointerdown', 'keydown', 'scroll']) window.removeEventListener(event, activity);
      window.removeEventListener('pulso-view', change);
      document.removeEventListener('visibilitychange', change);
    };
  }, [pathname]);
  return null;
}
