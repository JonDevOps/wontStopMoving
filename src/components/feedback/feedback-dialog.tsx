'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';

const TYPES = [['idea', 'Idea or request'], ['problem', 'Something isn’t working'], ['praise', 'Something I like'], ['other', 'Other']] as const;

/** Send product feedback to the Wont Stop Moving team (any signed-in user). */
export function FeedbackDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const auth = useAuth();
  const { toast } = useToast();
  const [type, setType] = useState<string>('idea');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      await apiFetch(auth, '/api/app-feedback', { type, message, page: window.location.pathname });
      toast({ title: 'Thanks for the feedback!', description: 'Our team reads every message.' });
      setMessage(''); onOpenChange(false);
    } catch (err) { toast({ variant: 'destructive', title: 'Couldn’t send', description: err instanceof Error ? err.message : '' }); }
    finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader><DialogTitle>Send feedback</DialogTitle><DialogDescription>Ideas, problems or praise. It goes straight to the Wont Stop Moving team.</DialogDescription></DialogHeader>
      <form onSubmit={send} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">{TYPES.map(([v, l]) => <label key={v} className={`text-sm border rounded-lg p-2 cursor-pointer ${type === v ? 'border-accent bg-accent/5 font-semibold' : ''}`}><input type="radio" name="feedback-type" className="sr-only" checked={type === v} onChange={() => setType(v)} />{l}</label>)}</div>
        <Textarea required minLength={5} rows={5} placeholder="What’s on your mind?" value={message} onChange={e => setMessage(e.target.value)} aria-label="Your feedback" />
        <Button type="submit" className="w-full" disabled={busy || message.trim().length < 5}>{busy ? 'Sending…' : 'Send feedback'}</Button>
      </form>
    </DialogContent>
  </Dialog>;
}
