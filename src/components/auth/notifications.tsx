'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { collection, doc, query, where } from 'firebase/firestore';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function Notifications() {
  const db = useFirestore(); const { user } = useUser();
  const profileRef = useMemoFirebase(() => user ? doc(db, 'users', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(profileRef);
  const role = profile?.role;
  const providerRef = useMemoFirebase(() => user && role === 'provider' ? doc(db, 'providers', user.uid) : null, [db, user, role]);
  const employeeRef = useMemoFirebase(() => user && role === 'employee' ? doc(db, 'employees', user.uid) : null, [db, user, role]);
  const { data: provider } = useDoc(providerRef); const { data: employee } = useDoc(employeeRef);
  const jobsQuery = useMemoFirebase(() => {
    if (!user || !role) return null;
    const jobs = collection(db, 'jobs');
    if (role === 'admin') return query(jobs);
    if (role === 'customer') return query(jobs, where('customerId', '==', user.uid));
    return query(jobs, where(role === 'provider' ? 'providerIds' : 'employeeIds', 'array-contains', user.uid));
  }, [db, user, role]);
  const { data: jobs, isLoading } = useCollection(jobsQuery);
  const [seen, setSeen] = useState<string[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const storageKey = `wsm-notifications:${user?.uid || ''}`;
  useEffect(() => {
    setStorageReady(false); setSeen([]);
    try { const stored = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (Array.isArray(stored) && stored.every(id => typeof id === 'string')) setSeen(stored); } catch {}
    setStorageReady(true);
  }, [storageKey]);
  const base = role === 'admin' ? '/dashboard/admin' : `/dashboard/${role}`;
  const items = (jobs || []).filter(job => job.paymentStatus === 'paid').sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)).slice(0, 20).map(job => ({ id: `job:${job.id}`, title: role === 'customer' ? 'Your move is confirmed' : role === 'admin' ? 'Paid booking received' : 'Job assigned to you', detail: `${job.moveDate || 'Date pending'} · ${job.pickupAddress || 'View job details'}`, href: `${base}/${role === 'customer' ? 'moves' : 'jobs'}/${job.id}` }));
  if (provider?.status === 'approved' || employee?.status === 'approved' || employee?.status === 'active') items.unshift({ id: 'account-approved', title: 'Your account is approved', detail: 'Review your dashboard for your next steps.', href: base });
  const unread = storageReady ? items.filter(item => !seen.includes(item.id)).length : 0;
  function markRead() { const next = [...new Set([...seen, ...items.map(item => item.id)])].slice(-1000); setSeen(next); try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {} }
  return <Dialog><DialogTrigger asChild><Button variant="ghost" size="icon" className="relative text-primary" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}><Bell className="h-5 w-5"/>{unread > 0 && <span className="absolute -top-1 -right-1 rounded-full bg-accent text-white text-xs px-1">{unread}</span>}</Button></DialogTrigger>
    <DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Notifications</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">Recent paid jobs and account approvals. Read status is saved in this browser.</p>
      {isLoading ? <p>Loading…</p> : items.length ? <><Button variant="outline" onClick={markRead}>Mark all as read</Button><ul className="space-y-3">{items.map(item => <li key={item.id} className="border rounded-lg p-3"><Link href={item.href} className="block"><strong>{!seen.includes(item.id) && '• '}{item.title}</strong><p className="text-sm">{item.detail}</p></Link></li>)}</ul></> : <p>No notifications yet.</p>}
    </DialogContent></Dialog>;
}
