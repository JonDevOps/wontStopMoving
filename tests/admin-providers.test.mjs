import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, setDoc, getDocs, Timestamp } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { isPendingProvider, providerCreatedMillis } from '../src/lib/provider-status.ts';

test('admin list includes undated legacy applications and shares pending totals with overview', async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-wsm-admin-regression', firestore: {host:'127.0.0.1',port:8180,rules:readFileSync('firestore.rules','utf8')} });
  try {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async ctx => {
      const db=ctx.firestore();
      await setDoc(doc(db,'users/admin'),{role:'admin'});
      for (const [id,data] of Object.entries({legacy:{status:'pending'},older:{status:'pending_approval',createdAt:Timestamp.fromMillis(100)},newer:{status:'approved',createdAt:Timestamp.fromMillis(200)},missingStatus:{},suspended:{status:'suspended'}})) await setDoc(doc(db,'providers',id),data);
    });
    const snap=await assertSucceeds(getDocs(collection(env.authenticatedContext('admin').firestore(),'providers')));
    const rows=snap.docs.map(d=>({...d.data(),id:d.id}));
    assert.equal(rows.length,5);
    const pending=rows.filter(p=>isPendingProvider(p.status));
    assert.deepEqual(pending.map(p=>p.id).sort(),['legacy','missingStatus','older']);
    assert.equal(pending.slice(0,5).length,pending.length);
    rows.sort((a,b)=>providerCreatedMillis(b)-providerCreatedMillis(a)||a.id.localeCompare(b.id));
    assert.equal(rows[0].id,'newer');
    assert.ok(rows.some(p=>p.id==='legacy'));
    assert.equal(isPendingProvider('approved'),false);
    assert.equal(isPendingProvider('suspended'),false);
  } finally { await env.clearFirestore(); await env.cleanup(); }
});
