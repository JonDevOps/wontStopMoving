import { NextResponse } from "next/server";
import { completeJobWithCode } from "@/lib/server/jobs";
import { errorResponse, HttpError, isId, readJson, requireRole, requireStripe } from "@/lib/server/auth";

/**
 * The assigned provider (or an admin) enters the customer's 6-digit release
 * code. The code, the amount and the payout account all come from Firestore.
 */
export async function POST(req: Request) {
  try {
    const { user, role } = await requireRole(req, ["provider", "admin"]);
    requireStripe();
    const { jobId, code } = await readJson(req);
    if (!isId(jobId)) throw new HttpError(400, "Choose a job.");
    if (typeof code !== "string" || !/^\d{6}$/.test(code.trim())) throw new HttpError(400, "Enter the 6-digit release code.");

    const result = await completeJobWithCode({ jobId, code: code.trim(), uid: user.uid, isAdmin: role === "admin" });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
