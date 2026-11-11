'use client';

import { useEffect, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarDays } from 'lucide-react';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { toast } from '@/hooks/use-toast';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Weekdays a provider usually works and specific dates they can't, used to match them to jobs. */
export function ProviderAvailability() {
  const { user } = useUser();
  const firestore = useFirestore();
  const providerRef = useMemoFirebase(() => user ? doc(firestore, 'providers', user.uid) : null, [firestore, user]);
  const { data: provider } = useDoc(providerRef);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [newDate, setNewDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!provider) return;
    if (Array.isArray(provider.availableDays)) setDays(provider.availableDays.filter((d: unknown) => Number.isInteger(d)));
    if (Array.isArray(provider.unavailableDates)) setBlocked(provider.unavailableDates.filter((d: unknown) => typeof d === 'string'));
  }, [provider]);

  const today = new Date().toISOString().slice(0, 10);
  async function save() {
    if (!providerRef) return;
    setSaving(true);
    try {
      await updateDoc(providerRef, { availableDays: [...days].sort(), unavailableDates: blocked.filter(d => d >= today).sort().slice(0, 120) });
      toast({ title: 'Availability saved', description: 'We’ll use it when matching you to jobs.' });
    } catch { toast({ variant: 'destructive', title: 'Couldn’t save', description: 'Please try again.' }); }
    finally { setSaving(false); }
  }

  return <Card className="border-none shadow-xl bg-white">
    <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-accent" /> Availability</CardTitle>
      <CardDescription>Days you usually take jobs, and dates you can’t work. This helps us send you jobs you can do.</CardDescription></CardHeader>
    <CardContent className="space-y-5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Days you usually work">
        {DAYS.map((d, i) => <button key={d} type="button" aria-pressed={days.includes(i)} onClick={() => setDays(days.includes(i) ? days.filter(x => x !== i) : [...days, i])}
          className={`px-4 h-10 rounded-xl border text-sm font-bold ${days.includes(i) ? 'bg-primary text-white border-primary' : 'bg-gray-50 text-primary'}`}>{d}</button>)}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-bold">Dates you can’t work</p>
        <div className="flex gap-2"><Input type="date" min={today} value={newDate} onChange={e => setNewDate(e.target.value)} aria-label="Date you can’t work" className="max-w-xs" />
          <Button type="button" variant="outline" disabled={!newDate} onClick={() => { if (newDate && !blocked.includes(newDate)) setBlocked([...blocked, newDate].sort()); setNewDate(''); }}>Add</Button></div>
        {blocked.filter(d => d >= today).length > 0 && <div className="flex flex-wrap gap-2">{blocked.filter(d => d >= today).map(d =>
          <button key={d} type="button" onClick={() => setBlocked(blocked.filter(x => x !== d))} className="px-3 h-8 rounded-full bg-amber-100 text-amber-900 text-xs font-bold" aria-label={`Remove ${d}`}>{d} ✕</button>)}</div>}
      </div>
      <Button onClick={() => void save()} disabled={saving} className="bg-accent hover:bg-accent/90 text-white">{saving ? 'Saving…' : 'Save availability'}</Button>
    </CardContent>
  </Card>;
}
