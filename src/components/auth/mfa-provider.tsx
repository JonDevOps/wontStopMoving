'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { FirebaseError } from 'firebase/app';
import { getMultiFactorResolver, TotpMultiFactorGenerator, type MultiFactorError, type MultiFactorResolver, type UserCredential } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { mfaErrorMessage } from '@/lib/mfa';

export type CompleteSignIn = (operation: () => Promise<UserCredential>) => Promise<UserCredential>;
const MfaContext = createContext<CompleteSignIn | null>(null);
type Pending = { resolver: MultiFactorResolver; resolve: (credential: UserCredential) => void; reject: (error: unknown) => void };

/** Shared by password, Google, quote sign-in, and security reauthentication. */
export function MfaProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const pendingRef = useRef<Pending | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const cancel = useCallback(() => {
    pendingRef.current?.reject(new FirebaseError('auth/mfa-cancelled', 'Verification cancelled.'));
    pendingRef.current = null;
    setPending(null); setCode(''); setError('');
  }, []);
  useEffect(() => () => { pendingRef.current?.reject(new FirebaseError('auth/mfa-cancelled', 'Verification cancelled.')); }, []);

  const completeSignIn = useCallback<CompleteSignIn>(async operation => {
    try { return await operation(); }
    catch (error) {
      if ((error as { code?: string }).code !== 'auth/multi-factor-auth-required') throw error;
      if (pendingRef.current) throw new FirebaseError('auth/mfa-cancelled', 'Another verification is in progress.');
      const resolver = getMultiFactorResolver(auth, error as MultiFactorError);
      return new Promise<UserCredential>((resolve, reject) => {
        const request = { resolver, resolve, reject };
        pendingRef.current = request; setPending(request);
        setFactorId(resolver.hints.find(hint => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID)?.uid ?? '');
        setCode(''); setError('');
      });
    }
  }, [auth]);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!pending || !factorId || !/^\d{6}$/.test(code) || busy) return;
    setBusy(true); setError('');
    try {
      const result = await pending.resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(factorId, code));
      pendingRef.current = null; setPending(null); setCode('');
      pending.resolve(result);
    } catch (error) { setError(mfaErrorMessage(error)); setCode(''); }
    finally { setBusy(false); }
  }

  const factors = pending?.resolver.hints.filter(hint => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID) ?? [];
  return <MfaContext.Provider value={completeSignIn}>
    {children}
    <Dialog open={!!pending} onOpenChange={open => { if (!open && !busy) cancel(); }}>
      <DialogContent onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>Verify your sign-in</DialogTitle><DialogDescription>Enter the six-digit code from your authenticator app to finish signing in.</DialogDescription></DialogHeader>
        {factors.length ? <form onSubmit={verify} className="space-y-4">
          {factors.length > 1 && <div className="space-y-2"><Label htmlFor="mfa-factor">Authenticator</Label><select id="mfa-factor" className="w-full border rounded-md p-2" value={factorId} onChange={event => { setFactorId(event.target.value); setCode(''); }} disabled={busy}>{factors.map(factor => <option key={factor.uid} value={factor.uid}>{factor.displayName || 'Authenticator app'}</option>)}</select></div>}
          <div className="space-y-2"><Label htmlFor="mfa-code">Authenticator code</Label><Input id="mfa-code" autoFocus inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} required disabled={busy}/></div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <p className="text-xs text-muted-foreground">Lost your authenticator? Contact support for account recovery.</p>
          <div className="flex gap-3"><Button type="button" variant="outline" disabled={busy} onClick={cancel}>Cancel</Button><Button type="submit" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify and continue'}</Button></div>
        </form> : <div className="space-y-4"><p role="alert">This account needs an unsupported verification method. Contact support for account recovery.</p><Button onClick={cancel}>Return to sign-in</Button></div>}
      </DialogContent>
    </Dialog>
  </MfaContext.Provider>;
}

export function useMfaSignIn() {
  const completeSignIn = useContext(MfaContext);
  if (!completeSignIn) throw new Error('MfaProvider is required.');
  return completeSignIn;
}
