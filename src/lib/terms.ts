/** Every published version has a permanent /terms/<version> page. */
export const TERMS_VERSION = '2026-11-08';
export const TERMS_DOCUMENT_PATH = `/terms/${TERMS_VERSION}`;

export type TermsContext = 'signup' | 'quote' | 'booking';

/** Call only after explicit acceptance. Timestamps come from Firebase, not the browser clock. */
export function termsAcceptance<T>(uid: string, context: TermsContext, acceptedAt: T) {
  return {
    accepted: true,
    version: TERMS_VERSION,
    documentPath: TERMS_DOCUMENT_PATH,
    acceptedBy: uid,
    context,
    acceptedAt,
  };
}
