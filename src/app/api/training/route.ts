import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/server/firebase-admin';
import { errorResponse, HttpError, readJson, requireRole } from '@/lib/server/auth';
import { scoreTraining, trainingQuestions, TRAINING_VERSION } from '@/lib/server/training';

export async function GET(req: Request) {
  try {
    const { user } = await requireRole(req, ['provider', 'employee', 'admin']);
    const result = (await adminDb().doc(`trainingResults/${user.uid}`).get()).data();
    return NextResponse.json({ version: TRAINING_VERSION, questions: trainingQuestions, passed: result?.version === TRAINING_VERSION && result?.passed === true }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}
export async function POST(req: Request) {
  try {
    const { user } = await requireRole(req, ['provider', 'employee', 'admin']);
    const { answers, version } = await readJson(req);
    if (version !== TRAINING_VERSION) throw new HttpError(409, 'Reload the quiz to get the current questions.');
    if (!Array.isArray(answers) || answers.length !== trainingQuestions.length || !answers.every((answer, index) => Number.isInteger(answer) && answer >= 0 && answer < trainingQuestions[index].choices.length)) throw new HttpError(400, 'Answer each question.');
    const score = scoreTraining(answers);
    const passed = score === trainingQuestions.length;
    if (passed) await adminDb().doc(`trainingResults/${user.uid}`).set({ uid: user.uid, version, score, passed: true, completedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ passed, score, total: trainingQuestions.length });
  } catch (error) { return errorResponse(error); }
}
