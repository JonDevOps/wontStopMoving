import { NextResponse } from "next/server";
import { releaseJobByCustomer } from "@/lib/server/jobs";
import { errorResponse, HttpError, isId, readJson, requireRole, requireStripe } from "@/lib/server/auth";

/** The customer releases their crew's payment from the app (#152). */
export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ["customer"]);
    requireStripe();
    const { jobId } = await readJson(req);
    if (!isId(jobId)) throw new HttpError(400, "Choose a move.");
    const result = await releaseJobByCustomer({ jobId, uid: user.uid });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
