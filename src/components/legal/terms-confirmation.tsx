'use client';

import { useEffect, useId, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TermsAcceptance } from './terms-acceptance';

interface Props {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TermsConfirmation({ open, title, description, confirmLabel, busy, onConfirm, onCancel }: Props) {
  const [accepted, setAccepted] = useState(false);
  const id = useId();
  useEffect(() => { if (open) setAccepted(false); }, [open]);
  return <Dialog open={open} onOpenChange={value => { if (!value && !busy) onCancel(); }}>
    <DialogContent onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (accepted && !busy) onConfirm(); }}>
        <TermsAcceptance id={`terms-${id}`} checked={accepted} onChange={setAccepted} disabled={busy}/>
        <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Please wait…' : confirmLabel}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
