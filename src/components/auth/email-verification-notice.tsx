'use client';

import { useEffect, useState } from 'react';
import { reload, sendEmailVerification } from 'firebase/auth';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';

export function EmailVerificationNotice() {
  const { user } = useUser();
  const [verified, setVerified] = useState(user?.emailVerified ?? false);
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState(0);
  const [message, setMessage] = useState('');
  useEffect(() => { setVerified(user?.emailVerified ?? false); setMessage(''); setSentAt(0); }, [user?.uid, user?.emailVerified]);
  if (!user?.email || verified || !user.providerData.some(provider => provider.providerId === 'password')) return null;

  async function resend() {
    if (!user || busy) return;
    if (Date.now() - sentAt < 60000) { setMessage('Please wait a minute before sending another email.'); return; }
    setBusy(true);
    try {
      await sendEmailVerification(user);
      setSentAt(Date.now());
      setMessage('Verification email sent. Check your inbox and spam folder.');
    } catch { setMessage('Unable to send right now. Please wait a minute and try again.'); }
    finally { setBusy(false); }
  }

  async function check() {
    if (!user || busy) return;
    setBusy(true);
    try {
      await reload(user);
      await user.getIdToken(true);
      setVerified(user.emailVerified);
      if (!user.emailVerified) setMessage('Your email is not verified yet. Open the link in your verification email, then check again.');
    } catch { setMessage('Unable to check verification. Please try again.'); }
    finally { setBusy(false); }
  }

  return <section aria-label="Email verification" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
    <p className="font-bold">Verify your email address</p>
    <p className="text-sm break-words">Open the verification link sent to {user.email}. You can continue using your account while you verify.</p>
    <div className="flex flex-wrap gap-3 mt-3">
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void resend()}>Send verification email</Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void check()}>I’ve verified my email</Button>
    </div>
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </section>;
}
