'use client';
import { useEffect, useState } from 'react';
import { useAuth, useUser } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { SMS_DISCLOSURE_VERSION, normalizeSmsPhone } from '@/lib/sms-consent';
import { SmsConsent } from '@/components/forms/sms-consent';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
export function TextPreferences({ provider = false }: { provider?: boolean }) {
  const auth = useAuth(), {user} = useUser();
  const [phone,setPhone] = useState(''), [choice,setChoice] = useState(false), [current,setCurrent] = useState('Not enrolled'), [busy,setBusy] = useState(false), [message,setMessage] = useState('');
  useEffect(() => { if (!user) return; apiFetch<{phone:string;enabled:boolean;optedOut:boolean}>(auth,'/api/sms/preferences').then(p => {setPhone(p.phone);setCurrent(p.optedOut?'Opted out':p.enabled?'Enrolled; sending awaits carrier approval':'Not enrolled');}).catch(()=>setMessage('Could not load text preferences.')); },[auth,user]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (choice && !normalizeSmsPhone(phone)) {setMessage('Enter a valid mobile number, including country code outside the US or Canada.');return;}
    setBusy(true);
    try { await apiFetch(auth,'/api/sms/preferences',{phone,smsConsent:choice,smsDisclosureVersion:SMS_DISCLOSURE_VERSION,smsSourcePage:window.location.pathname}); setCurrent(choice?'Enrolled; sending awaits carrier approval':'Opted out'); setMessage('Text preferences saved. Email and dashboard access remain available.');setChoice(false); }
    catch(error) {setMessage(error instanceof Error?error.message:'Could not save preferences.');} finally {setBusy(false);}
  }
  return <form onSubmit={save} className="bg-white rounded-2xl border p-6 space-y-4"><h2 className="text-xl font-bold">{provider?'Job text notifications':'Moving text updates'}</h2><p>Current preference: {current}. To turn texts off, leave the checkbox empty and save.</p><Label htmlFor={provider?'provider-text-phone':'customer-text-phone'}>Mobile number</Label><Input id={provider?'provider-text-phone':'customer-text-phone'} type="tel" autoComplete="tel" value={phone} maxLength={40} onChange={e=>setPhone(e.target.value)}/><SmsConsent id={provider?'provider-sms-consent':'customer-sms-consent'} checked={choice} onChange={setChoice} provider={provider} disabled={busy}/><Button disabled={busy} type="submit">{busy?'Saving…':'Save text preferences'}</Button>{message&&<p role="status">{message}</p>}</form>;
}
