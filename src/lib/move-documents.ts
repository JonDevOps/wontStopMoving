/**
 * The documents a customer signs (or acknowledges) before their move. Which
 * ones apply depends on the move: interstate household moves need the FMCSA
 * booklets and a written valuation choice (49 CFR 375); storage adds a
 * storage agreement. Signatures are typed names, kept with time, IP and the
 * document version in moveDocuments/{jobId} (server-only).
 */
export const MOVE_DOCS_VERSION = '2026-11-12';

export type MoveDocId = 'order-for-service' | 'valuation' | 'inventory' | 'rights-responsibilities' | 'ready-to-move' | 'storage' | 'bill-of-lading';
export type MoveDoc = {
  id: MoveDocId; title: string; summary: string; link?: string;
  /** 'sign' = typed-name signature; 'ack' = confirm you received/read it; 'info' = happens on moving day. */
  kind: 'sign' | 'ack' | 'info';
  required: boolean;
};

export const VALUATION_CHOICES = {
  released: 'Released value: $0.60 per pound per item, at no extra cost',
  full: 'Full value protection: repair, replace or pay current value (priced separately)',
} as const;
export type ValuationChoice = keyof typeof VALUATION_CHOICES;
export const isValuationChoice = (v: unknown): v is ValuationChoice => typeof v === 'string' && v in VALUATION_CHOICES;

export type MoveFacts = { interstate: boolean; storage: boolean };

export function documentsFor(f: MoveFacts): MoveDoc[] {
  const docs: MoveDoc[] = [
    { id: 'order-for-service', kind: 'sign', required: true, title: 'Order for service', summary: 'Confirms your move date, addresses, home size, extras and the price you paid. Changes on moving day (extra items, stairs not listed) are added in writing before work starts.' },
    { id: 'valuation', kind: 'sign', required: true, title: 'Protection (valuation) choice', summary: 'How your belongings are covered if something is lost or damaged. Released value is included at no cost; full value protection costs extra and is quoted before your move.', link: '/services/protection-plans' },
    { id: 'inventory', kind: 'ack', required: true, title: 'Inventory', summary: 'Your crew lists every item and its condition at pickup. Check the list at delivery and note anything missing or damaged before you sign it.' },
  ];
  if (f.interstate) docs.push(
    { id: 'rights-responsibilities', kind: 'ack', required: true, title: 'Your Rights and Responsibilities When You Move', summary: 'Federal booklet (FMCSA) every interstate mover must give you before the move.', link: 'https://www.fmcsa.dot.gov/protect-your-move/rights-and-responsibilities' },
    { id: 'ready-to-move', kind: 'ack', required: true, title: 'Ready to Move?', summary: 'Federal (FMCSA) brochure on planning an interstate move and avoiding moving fraud.', link: 'https://www.fmcsa.dot.gov/protect-your-move/ready-move' },
  );
  if (f.storage) docs.push({ id: 'storage', kind: 'sign', required: true, title: 'Storage agreement', summary: 'Your items are stored in a secure, climate-controlled facility. Storage is billed monthly after the included period, and items are released after charges are paid.' });
  docs.push({ id: 'bill-of-lading', kind: 'info', required: false, title: 'Bill of lading', summary: 'The contract for carrying your goods. You and your crew sign it at pickup and you get a copy; it matches this order for service.' });
  return docs;
}

export type Signature = { docId: MoveDocId; signedName: string; choice?: ValuationChoice | null; at: string | null; version: string };
export const outstanding = (docs: MoveDoc[], signed: Pick<Signature, 'docId'>[]) =>
  docs.filter(d => d.required && d.kind !== 'info' && !signed.some(s => s.docId === d.id));
