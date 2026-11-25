'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { formatMoveDate } from '@/lib/move-details';

/** Lets the customer pay their crew from the app once the work is done (#152). */
export function ReleasePayment({ jobId, crewName, moveDate }: { jobId: string; crewName: string; moveDate?: string }) {
  const auth = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const tooEarly = !!moveDate && /^\d{4}-\d{2}-\d{2}$/.test(moveDate) && moveDate > today;

  async function release() {
    setBusy(true);
    try {
      await apiFetch(auth, '/api/jobs/release', { jobId });
      toast({ title: 'Payment released', description: `${crewName} is being paid. Thanks for moving with us!` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Could not release payment', description: e instanceof Error ? e.message : 'Try again or contact support.' });
    } finally { setBusy(false); }
  }

  return <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button disabled={busy || tooEarly} className="w-full bg-white text-accent hover:bg-white/90 font-black uppercase tracking-widest text-xs h-12 mt-4">
        {busy ? 'Releasing…' : tooEarly ? `Release available ${formatMoveDate(moveDate)}` : `Release payment to ${crewName}`}
      </Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Release payment to {crewName}?</AlertDialogTitle>
        <AlertDialogDescription>
          Only do this once the work is completely finished to your satisfaction. Your crew is paid right away and this can&apos;t be undone. If something went wrong, use Get help on this page instead.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Not yet</AlertDialogCancel>
        <AlertDialogAction onClick={() => void release()}>Yes, release payment</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
