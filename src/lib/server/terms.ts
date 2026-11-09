import { FieldValue } from 'firebase-admin/firestore';
import { HttpError } from './auth';
import { TERMS_VERSION, termsAcceptance } from '../terms';

export function requireCurrentTerms(body: Record<string, unknown>) {
  if (body.termsAccepted !== true || typeof body.termsVersion !== 'string') {
    throw new HttpError(400, 'Please review and accept the Terms of Service before continuing to payment.');
  }
  if (body.termsVersion !== TERMS_VERSION) {
    throw new HttpError(409, 'The Terms of Service have changed. Refresh this page and review the current terms before continuing.');
  }
}

export function bookingTermsAcceptance(uid: string) {
  return termsAcceptance(uid, 'booking', FieldValue.serverTimestamp());
}
