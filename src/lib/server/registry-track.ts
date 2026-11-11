import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { yearsInBusiness, type Mover } from '@/lib/registry';

/** Competitors already tracked, by DOT number. */
export async function trackedByDot(): Promise<Map<string, string>> {
  const snap = await adminDb().collection('competitors').where('dot', '>', '').select('dot').limit(5000).get();
  return new Map(snap.docs.map(d => [String(d.data().dot), d.id]));
}

const nice = (s: string) => s.toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\b(Llc|Inc|Co|Dba)\b/g, w => w.toUpperCase());

/** Adds registry companies to the competitor tracker (skipping ones already there). */
export async function trackMovers(movers: Mover[], tier: 'challenger' | 'legend', by: string) {
  const db = adminDb(), existing = await trackedByDot();
  const fresh = movers.filter(m => !existing.has(m.dot));
  const ids: Record<string, string> = {};
  for (let i = 0; i < fresh.length; i += 200) {
    const batch = db.batch();
    for (const m of fresh.slice(i, i + 200)) {
      const ref = db.collection('competitors').doc();
      const name = nice(m.dba || m.name);
      batch.set(ref, {
        name, nameLower: name.toLowerCase(), website: m.site || '', location: `${nice(m.city)}, ${m.state}`, tier, status: 'tracking',
        dot: m.dot, state: m.state, phone: m.phone, legalName: m.name, mc: m.mc || null,
        metrics: { trucks: m.units, drivers: m.drivers, yearsInBusiness: yearsInBusiness(m) },
        registry: { units: m.units, drivers: m.drivers, miles: m.miles, hhgAuth: m.hhgAuth, interstate: m.interstate, updated: m.updated },
        notes: {}, actions: [], source: 'registry', createdBy: by, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
      batch.set(db.doc(`registryEnrichment/${m.dot}`), { dot: m.dot, state: m.state, competitorId: ref.id }, { merge: true });
      ids[m.dot] = ref.id;
    }
    await batch.commit();
  }
  return { added: fresh.length, skipped: movers.length - fresh.length, ids };
}
