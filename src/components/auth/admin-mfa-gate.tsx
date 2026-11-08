'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { onIdTokenChanged, signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { hasVerifiedSecondFactor } from '@/lib/mfa';
import { TwoFactorCard } from '@/components/security/two-factor-card';
import { EmailVerificationNotice } from './email-verification-notice';
import { Button } from '@/components/ui/button';

export function AdminMfaGate({ required, children }: { required: boolean; children: ReactNode }) {
  const auth = useAuth();
  const [verified, setVerified] = useState<boolean | null>(null);
  useEffect(() => {
    let current = true;
    const unsubscribe = onIdTokenChanged(auth, async user => {
      try {
        const token = await user?.getIdTokenResult();
        if (current) setVerified(hasVerifiedSecondFactor(token?.claims.firebase));
      } catch { if (current) setVerified(false); }
    });
    return () => { current = false; unsubscribe(); };
  }, [auth]);
  if (!required) return children;
  if (verified === null) return <div className="p-12 text-center">Checking account security…</div>;
  if (verified) return children;
  return <main className="min-h-screen bg-gray-50 p-6 flex items-center justify-center"><div className="w-full max-w-lg space-y-5">
    <h1 className="text-2xl font-bold">Secure your admin account</h1>
    <p>Admin tools require two-factor authentication. Set up your authenticator, then sign in again with its code to continue.</p>
    <EmailVerificationNotice/>
    <TwoFactorCard roleLabel="Admin"/>
    <Button variant="outline" onClick={async () => { await signOut(auth); window.location.assign('/login?role=admin'); }}>Sign out and sign in again</Button>
  </div></main>;
}
