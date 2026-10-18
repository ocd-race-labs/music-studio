// Is a newer version published? GitHub Pages lets browsers keep the old page for a few minutes, and a Home
// Screen app can keep it longer. version.json is fetched without cache; a different build id means update.

import { useEffect, useState } from 'react';

export function useUpdateAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let stopped = false;
    const check = async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const { build } = (await res.json()) as { build?: string };
        if (!stopped && build && build !== __BUILD__) setAvailable(true);
      } catch { /* offline or a dev server: nothing to compare */ }
    };
    check();
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    const id = window.setInterval(check, 5 * 60 * 1000);
    return () => { stopped = true; document.removeEventListener('visibilitychange', onVisible); window.clearInterval(id); };
  }, []);
  return available;
}
