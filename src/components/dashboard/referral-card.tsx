'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Gift } from 'lucide-react';
import { useAuth } from '@/firebase';
import { apiFetch } from '@/lib/api-client';

type Referral = { link: string; rewardUsd: number; referrals: { status: string }[]; earnedUsd: number };

/** The customer's referral link, with what they've earned so far. */
export function ReferralCard() {
  const auth = useAuth();
  const [data, setData] = useState<Referral | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { apiFetch<Referral>(auth, '/api/referrals/me').then(setData).catch(() => setData(null)); }, [auth]);
  if (!data) return null;

  const share = async () => {
    const text = `I booked my move with Wont Stop Moving. Get an instant quote here: ${data.link}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Wont Stop Moving', text, url: data.link });
      else { await navigator.clipboard.writeText(data.link); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    } catch { /* share cancelled */ }
  };

  return <Card className="border-none shadow-sm bg-white rounded-2xl">
    <CardContent className="p-6 space-y-3">
      <p className="text-sm font-black uppercase tracking-tight text-primary flex items-center gap-2"><Gift className="h-5 w-5 text-accent" /> Refer a friend, get ${data.rewardUsd}</p>
      <p className="text-sm text-muted-foreground">Share your link. When someone books their move through it, you earn a ${data.rewardUsd} reward.</p>
      <div className="flex gap-2">
        <input readOnly value={data.link} aria-label="Your referral link" className="flex-1 min-w-0 h-10 rounded-xl border px-3 text-sm bg-gray-50" onFocus={e => e.currentTarget.select()} />
        <Button onClick={() => void share()} className="bg-accent hover:bg-accent/90 text-white">{copied ? 'Copied!' : 'Share'}</Button>
      </div>
      {data.referrals.length > 0 && <p className="text-xs font-bold text-green-700" role="status">{data.referrals.length} friend{data.referrals.length === 1 ? '' : 's'} booked · ${data.earnedUsd} earned</p>}
    </CardContent>
  </Card>;
}
