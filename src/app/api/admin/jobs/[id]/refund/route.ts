import { NextResponse } from 'next/server';
import { errorResponse, HttpError, isId, readJson, requireRole } from '@/lib/server/auth';
import { cancelAndRefundBooking } from '@/lib/server/booking-refunds';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const {user}=await requireRole(req,['admin']);
    const {id}=await params,body=await readJson(req);
    if (!isId(id)||body.confirmFullRefund!==true) throw new HttpError(400,'Confirm cancellation and the full original-payment refund.');
    return NextResponse.json(await cancelAndRefundBooking(id,user.uid));
  } catch(error) {return errorResponse(error);}
}
