export const TRAINING_VERSION = '2026-11-08';
export const trainingQuestions = [
  { id: 'assignment', prompt: 'Which jobs should you perform through your account?', choices: ['Any job visible on the website', 'Jobs assigned to you through the platform', 'Jobs belonging to another provider'] },
  { id: 'release', prompt: 'When should the customer authorize payment release with their code?', choices: ['Before work begins', 'When creating an account', 'After the move is complete and they are satisfied'] },
  { id: 'payment', prompt: 'What should you do if payment or job details look wrong?', choices: ['Contact support or an administrator before proceeding', 'Change the payment status yourself', 'Use another person’s account'] },
  { id: 'identity', prompt: 'Which identity documents should you submit for verification?', choices: ['A friend’s documents', 'Your own accurate documents through the secure upload flow', 'Documents posted in a public message'] },
];
const correctAnswers = [1, 2, 0, 1];
export function scoreTraining(answers: number[]) { return answers.reduce((score, answer, index) => score + (answer === correctAnswers[index] ? 1 : 0), 0); }
