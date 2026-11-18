import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, requireRole } from '@/lib/server/auth';
export async function GET(req:Request){try{
  await requireRole(req,['admin']);
  const inbox=await adminDb().collection('phoneInbox').orderBy('createdAt','desc').limit(50).get();
  return NextResponse.json({items:inbox.docs.map(d=>({id:d.id,kind:d.data().kind,phone:d.data().phone,body:d.data().body||'',mediaCount:d.data().mediaCount||0,status:d.data().status,createdAt:d.data().createdAt?.toDate?.().toISOString()||null}))},{headers:{'Cache-Control':'private, no-store'}});
}catch(error){return errorResponse(error);}}
