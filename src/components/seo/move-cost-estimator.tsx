'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ADDON_PRICING, MILEAGE, MOVE_PRICING, calculateMoveTotal, isLongDistance, mileageFee } from '@/lib/pricing';
import { Button } from '@/components/ui/button';

const SIZES = ['studio', '2br', '3br', '4br+'] as const;
const ADDONS: [string, string][] = [
  ['packing', 'Packing'], ['cleaning', 'Move-out cleaning'], ['junk', 'Junk removal'],
  ['assembly', 'Furniture assembly'], ['storage', 'Storage'], ['piano', 'Piano'],
];
const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;

/** Live flat-price estimate using the same pricing as the quote form. */
export function MoveCostEstimator({ city, campaign }: { city: string; campaign: string }) {
  const [size, setSize] = useState<(typeof SIZES)[number]>('2br');
  const [miles, setMiles] = useState(15);
  const [addOns, setAddOns] = useState<string[]>([]);
  const [express, setExpress] = useState(false);
  const [discount, setDiscount] = useState<'' | 'student' | 'military'>('');
  const total = useMemo(
    () => calculateMoveTotal(size, addOns, { miles, isExpress: express, isStudent: discount === 'student', isMilitary: discount === 'military' }),
    [size, miles, addOns, express, discount],
  );
  const toggle = (k: string) => setAddOns(a => (a.includes(k) ? a.filter(x => x !== k) : [...a, k]));
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-sm ${on ? 'border-accent bg-accent/10 font-bold' : 'border-gray-200'}`;

  return (
    <div className="bg-white rounded-3xl shadow-xl p-5 sm:p-7 space-y-5 text-slate-800">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-black text-primary">Estimate your {city} move</h2>
        <p className="text-sm text-muted-foreground">Flat price, no hourly surprises</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Home size">
        {SIZES.map(s => (
          <button key={s} type="button" role="radio" aria-checked={size === s} onClick={() => setSize(s)}
            className={`rounded-xl border-2 px-2 py-3 text-sm font-bold ${size === s ? 'border-accent bg-accent/10 text-primary' : 'border-gray-200 text-slate-600'}`}>
            {MOVE_PRICING[s].description}
          </button>
        ))}
      </div>
      <div>
        <label htmlFor="est-miles" className="flex justify-between text-sm font-bold"><span>Distance between homes</span><span>{miles} miles</span></label>
        <input id="est-miles" type="range" min={1} max={300} value={miles} onChange={e => setMiles(Number(e.target.value))} className="w-full accent-orange-500" />
        <p className="text-xs text-muted-foreground">First {MILEAGE.includedMiles} miles included, then ${MILEAGE.perMile} a mile{mileageFee(miles) ? ` (+${usd(mileageFee(miles))})` : ''}.</p>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-bold">Extras</legend>
        <div className="flex flex-wrap gap-2">
          {ADDONS.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={addOns.includes(k)} onClick={() => toggle(k)} className={chip(addOns.includes(k))}>
              {label} <span className="text-muted-foreground">+{usd(ADDON_PRICING[k])}</span>
            </button>
          ))}
          <button type="button" aria-pressed={express} onClick={() => setExpress(e => !e)} className={chip(express)}>
            Express date <span className="text-muted-foreground">+25% of base</span>
          </button>
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-4 text-sm">
        {(['', 'student', 'military'] as const).map(d => (
          <label key={d || 'none'} className="inline-flex items-center gap-1.5">
            <input type="radio" name="est-discount" checked={discount === d} onChange={() => setDiscount(d)} />
            {d === '' ? 'No discount' : d === 'student' ? 'Student (5% off)' : 'Military (5% off)'}
          </label>
        ))}
      </div>
      <div className="rounded-2xl bg-primary text-white p-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/70">Estimated flat price</p>
          <p className="text-4xl font-black" aria-live="polite">{usd(total)}</p>
          {isLongDistance(miles) && <p className="text-xs text-white/80 mt-1">Over {MILEAGE.longDistanceMiles} miles we confirm the price with a custom long-distance quote.</p>}
        </div>
        <Button asChild size="lg" className="bg-accent hover:bg-accent/90 font-black uppercase">
          <Link href={`/quote?size=${encodeURIComponent(size)}&utm_source=moving-cost&utm_medium=seo&utm_campaign=${campaign}`}>Get my exact quote</Link>
        </Button>
      </div>
    </div>
  );
}
