'use client';
import Link from 'next/link';
import { SMS_DISCLOSURE, PROVIDER_SMS_DISCLOSURE } from '@/lib/sms-consent';

export function SmsConsent({ id, checked, onChange, disabled = false, provider = false }: { id: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean; provider?: boolean }) {
  return <div id={id} className="scroll-mt-28 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2 text-sm leading-relaxed">
    <label className="flex gap-3 items-start" htmlFor={`${id}-checkbox`}><input id={`${id}-checkbox`} name="smsConsent" type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} /><span>{provider ? PROVIDER_SMS_DISCLOSURE : SMS_DISCLOSURE}</span></label>
    <p className="pl-7"><Link href="/terms#sms" target="_blank" rel="noopener noreferrer" className="underline">Terms and Conditions</Link> and <Link href="/privacy#sms" target="_blank" rel="noopener noreferrer" className="underline">Privacy Policy</Link>.</p>
    <p className="pl-7 text-xs text-muted-foreground">SMS activation is pending carrier verification. Email and dashboard access remain available. Choosing this option records your preference; it does not start texts before approval.</p>
  </div>;
}
