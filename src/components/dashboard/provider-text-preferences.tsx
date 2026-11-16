'use client';
import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
export function ProviderTextPreferences() {
  const db = useFirestore(), {user} = useUser();
  const [phone,setPhone] = useState(''), [enabled,setEnabled] = useState(false), [busy,setBusy] = useState(false), [message,setMessage] = useState('');
  useEffect(() => { if (!db || !user) return; getDoc(doc(db,'providerSmsPreferences',user.uid)).then(snapshot => { if(snapshot.exists()) {setPhone(snapshot.data().phone || '');setEnabled(snapshot.data().enabled === true);} }).catch(()=>setMessage('Could not load text preferences.')); },[db,user]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!db || !user) return;
    if (enabled && !/^\+[1-9]\d{7,14}$/.test(phone)) {setMessage('Use a mobile number with country code, such as +14155550123.');return;}
    setBusy(true);
    try {await setDoc(doc(db,'providerSmsPreferences',user.uid),{phone,enabled,consentedAt:serverTimestamp()});setMessage('Text preferences saved.');} catch {setMessage('Could not save text preferences.');} finally {setBusy(false);}
  }
  return <form onSubmit={save} className="bg-white rounded-2xl border p-6 space-y-4"><h2 className="text-xl font-bold">Job text notifications</h2><Label htmlFor="provider-text-phone">Mobile number with country code</Label><Input id="provider-text-phone" type="tel" value={phone} maxLength={16} onChange={e=>setPhone(e.target.value)}/><label className="flex gap-3 items-start"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>I agree to receive transactional texts for new jobs and accepted payment codes. Message frequency varies. Message/data rates may apply. Reply STOP to opt out. Optional; job details remain in my dashboard.</label><Button disabled={busy} type="submit">Save text preferences</Button>{message && <p role="status">{message}</p>}</form>;
}
