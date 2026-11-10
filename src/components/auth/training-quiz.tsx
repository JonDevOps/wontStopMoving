'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

type Quiz = { version: string; questions: { id: string; prompt: string; choices: string[] }[]; passed: boolean };
export function TrainingQuiz() {
  const auth = useAuth(); const [quiz, setQuiz] = useState<Quiz | null>(null); const [answers, setAnswers] = useState<Record<string, number>>({}); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; apiFetch<Quiz>(auth, '/api/training').then(data => { if (active) setQuiz(data); }).catch(() => { if (active) setMessage('Could not load the quiz. Refresh to try again.'); }); return () => { active = false; }; }, [auth]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!quiz) return; setBusy(true); setMessage('');
    try { const result = await apiFetch<{ passed: boolean; score: number; total: number }>(auth, '/api/training', { version: quiz.version, answers: quiz.questions.map(question => answers[question.id]) }); setQuiz({ ...quiz, passed: result.passed }); setMessage(result.passed ? 'Quiz passed and saved. Account approval is reviewed separately.' : `You answered ${result.score} of ${result.total} correctly. Review your answers and try again.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save your answers.'); } finally { setBusy(false); }
  }
  return <section className="bg-white border rounded-xl p-6 space-y-4"><h2 className="text-xl font-bold">Platform onboarding quiz</h2><p>This quiz checks platform procedures. Account approval and any job-specific training are reviewed separately.</p>{quiz?.passed ? <p className="font-bold text-green-700">Passed — completion saved</p> : quiz ? <form onSubmit={submit} className="space-y-6">{quiz.questions.map(question => <fieldset key={question.id} className="space-y-2"><legend className="font-bold">{question.prompt}</legend>{question.choices.map((choice, index) => <label key={index} className="flex gap-3 items-start"><input required type="radio" name={question.id} value={index} checked={answers[question.id] === index} onChange={() => setAnswers({ ...answers, [question.id]: index })}/>{choice}</label>)}</fieldset>)}<Button disabled={busy} type="submit">{busy ? 'Checking…' : 'Submit quiz'}</Button></form> : !message && <p>Loading quiz…</p>}{message && <p role="status">{message}</p>}</section>;
}
