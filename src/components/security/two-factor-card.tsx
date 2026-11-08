'use client';

import { useEffect, useState } from 'react';
import { EmailAuthProvider, GoogleAuthProvider, TotpMultiFactorGenerator, multiFactor, onIdTokenChanged, reauthenticateWithCredential, reauthenticateWithPopup, reload, signOut, type MultiFactorInfo, type TotpSecret } from 'firebase/auth';
import { useAuth, useUser } from '@/firebase';
import { useMfaSignIn } from '@/components/auth/mfa-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck } from 'lucide-react';
import { mfaErrorMessage } from '@/lib/mfa';

interface TwoFactorCardProps {
  // Kept for existing dashboard callers. Enrollment status comes only from Firebase Auth.
  userProfile?: unknown;
  compact?: boolean;
  roleLabel?: string;
}

export function TwoFactorCard({ compact = false, roleLabel }: TwoFactorCardProps) {
  const { user } = useUser();
  const auth = useAuth();
  const completeSignIn = useMfaSignIn();
  const [factors, setFactors] = useState<MultiFactorInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('My authenticator');
  const [secret, setSecret] = useState<TotpSecret | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [action, setAction] = useState<string>('add');
  const [reauthenticated, setReauthenticated] = useState(false);
  const isAdmin = roleLabel === 'Admin';

  useEffect(() => onIdTokenChanged(auth, current => {
    setFactors(current ? [...multiFactor(current).enrolledFactors] : []);
  }), [auth]);
  const enabled = factors.length > 0;
  const passwordAccount = user?.providerData.some(provider => provider.providerId === 'password');

  function changeOpen(value: boolean) {
    if (busy) return;
    setOpen(value); setSecret(null); setPassword(''); setCode(''); setError(''); setAction('add'); setReauthenticated(false);
  }

  async function prepare(event: React.FormEvent) {
    event.preventDefault();
    if (!user || busy) return;
    setBusy(true); setError('');
    try {
      await reload(user);
      if (!user.emailVerified) { setError('Verify your email address first, then return here to set up your authenticator.'); return; }
      if (passwordAccount && user.email) {
        await completeSignIn(() => reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email!, password)));
      } else if (user.providerData.some(provider => provider.providerId === 'google.com')) {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await completeSignIn(() => reauthenticateWithPopup(user, provider));
      } else { setError('Sign in with email/password or Google to manage two-factor authentication.'); return; }
      setPassword('');
      if (action === 'add') {
        setSecret(await TotpMultiFactorGenerator.generateSecret(await multiFactor(user).getSession()));
      }
      setReauthenticated(true);
    } catch (error) { setError(mfaErrorMessage(error)); }
    finally { setBusy(false); }
  }

  async function finish(event: React.FormEvent) {
    event.preventDefault();
    if (!user || busy) return;
    setBusy(true); setError('');
    try {
      if (action === 'add') {
        if (!secret || !/^\d{6}$/.test(code)) return;
        await multiFactor(user).enroll(TotpMultiFactorGenerator.assertionForEnrollment(secret, code), name.trim() || 'Authenticator app');
      } else {
        await multiFactor(user).unenroll(action);
      }
      setSecret(null); setCode(''); setPassword('');
      // Enrollment is not proof of a second-factor sign-in. Require a fresh login.
      await signOut(auth);
      window.location.assign(`/login?${isAdmin ? 'role=admin&' : ''}security=updated`);
    } catch (error) {
      if ((error as { code?: string }).code === 'auth/user-token-expired') {
        await signOut(auth);
        window.location.assign('/login?security=updated');
        return;
      }
      setError(mfaErrorMessage(error));
    } finally { setBusy(false); }
  }

  return <>
    <Card className={compact ? 'shadow-none bg-slate-50' : 'shadow-sm'}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4"/>Two-factor authentication</CardTitle>
        <Badge variant={enabled ? 'default' : 'outline'}>{enabled ? 'Active' : 'Not enabled'}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{enabled ? 'Firebase requires an authenticator code when you sign in.' : 'Use an authenticator app to protect your account with a second verification step.'}</p>
        <Button onClick={() => changeOpen(true)} disabled={!user}>{enabled ? 'Manage authenticators' : 'Set up authenticator'}</Button>
      </CardContent>
    </Card>
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>{enabled ? 'Manage authenticators' : 'Set up two-factor authentication'}</DialogTitle><DialogDescription>Use Google Authenticator, Apple Passwords, or another app that supports time-based codes.</DialogDescription></DialogHeader>
        {!reauthenticated ? <form onSubmit={prepare} className="space-y-4">
          {enabled && <div className="space-y-2"><Label htmlFor="authenticator-action">Action</Label><select id="authenticator-action" value={action} onChange={event => setAction(event.target.value)} disabled={busy} className="w-full border rounded-md p-2"><option value="add">Add a backup authenticator</option>{factors.map(factor => <option key={factor.uid} value={factor.uid}>Remove {factor.displayName || 'authenticator'}</option>)}</select></div>}
          <p className="text-sm">Confirm your sign-in to change your security settings.</p>
          {passwordAccount && <div className="space-y-2"><Label htmlFor="mfa-password">Current password</Label><Input id="mfa-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required disabled={busy}/></div>}
          <Button type="submit" disabled={busy || (!!passwordAccount && !password)}>{busy ? 'Verifying…' : passwordAccount ? 'Confirm sign-in' : 'Confirm with Google'}</Button>
        </form> : <form onSubmit={finish} className="space-y-4">
          {action === 'add' && secret ? <>
            <p className="text-sm">In your authenticator app, add an account using a setup key. Select <strong>Time based</strong> and enter this key:</p>
            <code className="block select-all break-all rounded-lg border bg-slate-50 p-4 text-sm">{secret.secretKey}</code>
            <p className="text-xs text-muted-foreground">Account: {user?.email}. Keep this key private. Save a backup in a secure password manager; it can restore access if you lose your phone.</p>
            <div className="space-y-2"><Label htmlFor="authenticator-name">Authenticator name</Label><Input id="authenticator-name" value={name} maxLength={50} onChange={event => setName(event.target.value)} disabled={busy}/></div>
            <div className="space-y-2"><Label htmlFor="enrollment-code">Six-digit code from your app</Label><Input id="enrollment-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} required disabled={busy}/></div>
          </> : <p className="text-sm">Remove this authenticator? You will be signed out. Admin access requires an authenticator to be enrolled again.</p>}
          <Button type="submit" variant={action === 'add' ? 'default' : 'destructive'} disabled={busy || (action === 'add' && code.length !== 6)}>{busy ? 'Saving…' : action === 'add' ? 'Verify and enable' : 'Remove authenticator'}</Button>
        </form>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <p className="text-xs text-muted-foreground">After a change, sign in again to verify your account. If you lose every authenticator and your backup key, contact support for recovery.</p>
      </DialogContent>
    </Dialog>
  </>;
}
