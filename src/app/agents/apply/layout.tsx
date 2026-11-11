import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Apply to the Agent Network',
  description: 'Apply to join the Wont Stop Moving agent network as an origin, destination, hauling or storage agent.',
  alternates: { canonical: '/agents/apply' },
};

export default function AgentApplyLayout({ children }: { children: React.ReactNode }) { return children; }
