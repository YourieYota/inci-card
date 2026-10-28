'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { WifiOff } from 'lucide-react';
import { getFieldMode } from '@/app/actions/fieldMode';

export default function FieldModeBanner() {
  const pathname = usePathname();
  const [state, setState] = useState<{ enabled: boolean; pendingCount: number } | null>(null);

  useEffect(() => {
    getFieldMode()
      .then((s) => setState({ enabled: s.enabled, pendingCount: s.pendingCount }))
      .catch((e) => console.warn('Lecture du mode terrain impossible :', e));
  }, [pathname]);

  if (!state?.enabled) return null;

  return (
    <div className="shrink-0 bg-amber-500 text-amber-950 px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span className="uppercase tracking-wide">Mode terrain – hors ligne</span>
      <span className="font-semibold">
        Numéros d&apos;enrôlement attribués à la synchronisation · Impression et lots désactivés
      </span>
      <Link href="/settings?tab=terrain" className="ml-auto underline underline-offset-2 whitespace-nowrap">
        {state.pendingCount} fiche(s) à synchroniser
      </Link>
    </div>
  );
}
