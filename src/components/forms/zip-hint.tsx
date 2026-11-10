'use client';

import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';

export type ZipInfo = {
  zip: string; city: string; stateCode: string; state: string;
  servedState: boolean; servedCity: boolean; href: string | null;
};

/** Looks up a 5-digit ZIP once it's typed; null until then or if unknown. */
export function useZipLookup(value: string | undefined) {
  const zip = (value || '').trim().slice(0, 5);
  const [info, setInfo] = useState<ZipInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  useEffect(() => {
    setInfo(null); setNotFound(false);
    if (!/^\d{5}$/.test(zip)) return;
    const controller = new AbortController();
    fetch(`/api/zip/${zip}`, { signal: controller.signal })
      .then(async r => { if (r.ok) setInfo(await r.json()); else if (r.status === 404) setNotFound(true); })
      .catch(() => {});
    return () => controller.abort();
  }, [zip]);
  return { info, notFound };
}

/** "Dallas, Texas · We serve this area" under a ZIP field. */
export function ZipHint({ value }: { value: string | undefined }) {
  const { info, notFound } = useZipLookup(value);
  if (notFound) return <p className="text-xs text-muted-foreground" role="status">We couldn’t find that ZIP code. Check it and try again.</p>;
  if (!info) return null;
  return <p className="text-xs font-medium flex items-center gap-1" role="status">
    <MapPin className="h-3 w-3 text-accent shrink-0" />
    <span>{info.city}, {info.state}</span>
    <span className={info.servedState ? 'text-green-700' : 'text-amber-700'}>· {info.servedState ? 'We serve this area' : 'Outside our listed service area. Contact us to check availability.'}</span>
  </p>;
}
