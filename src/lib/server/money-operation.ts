import { FieldValue, Timestamp, type Firestore, type DocumentData } from 'firebase-admin/firestore';

/** Durable request + Stripe idempotency key. Never blindly replay beyond Stripe's retention window. */
export async function moneyOperation(
  db: Firestore, key: string, request: Record<string, unknown>,
  perform: (request: Record<string, unknown>, key: string) => Promise<{ id: string; status?: string | null }>,
) {
  const ref = db.doc(`moneyOperations/${key}`);
  const operation: DocumentData = await db.runTransaction(async tx => {
    const saved = (await tx.get(ref)).data();
    if (saved?.resultId) return saved;
    if (saved && (saved.status === 'needs_review' || Date.now() - saved.startedAt.toMillis() > 23 * 3600000)) {
      tx.update(ref, { status: 'needs_review' });
      return { ...saved, status: 'needs_review' };
    }
    if (saved) return saved;
    const next = { request, startedAt: Timestamp.now(), status: 'processing' };
    tx.create(ref, next);
    return next;
  });
  if (operation.resultId) return { id: String(operation.resultId), status: String(operation.resultStatus || 'succeeded') };
  if (operation.status === 'needs_review') throw new Error('MONEY_OPERATION_NEEDS_REVIEW');
  try {
    // Concurrent calls have identical persisted parameters and idempotency key.
    const result = await perform(operation.request, key);
    await ref.update({ resultId: result.id, resultStatus: result.status || 'succeeded', status: 'recorded', recordedAt: FieldValue.serverTimestamp() });
    return result;
  } catch (error) {
    // Do not log Stripe errors containing request details or credentials.
    await ref.update({ lastFailureAt: FieldValue.serverTimestamp() });
    throw error;
  }
}
