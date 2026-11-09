'use client';

import Link from 'next/link';
import { TERMS_DOCUMENT_PATH } from '@/lib/terms';

interface Props {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  form?: string;
}

export function TermsAcceptance({ id, checked, onChange, disabled, form }: Props) {
  return <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-sm leading-relaxed">
    <input id={id} type="checkbox" name="termsAccepted" checked={checked} onChange={event => onChange(event.target.checked)} required disabled={disabled} form={form} className="mt-1 h-4 w-4 shrink-0 accent-primary"/>
    <label htmlFor={id} className="cursor-pointer text-muted-foreground">I agree to the <Link href={TERMS_DOCUMENT_PATH} target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline">Terms of Service</Link>.</label>
  </div>;
}
