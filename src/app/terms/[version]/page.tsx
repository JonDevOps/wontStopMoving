import { notFound } from 'next/navigation';
import Terms20261108 from '@/components/legal/terms-2026-11-08';
import Terms20261118 from '@/components/legal/terms-2026-11-18';

// Keep old documents in this registry when publishing a new version.
const documents = { '2026-11-08': Terms20261108, '2026-11-18': Terms20261118 };

export const metadata = { robots: { index: false, follow: true } };

export function generateStaticParams() {
  return Object.keys(documents).map(version => ({ version }));
}

export default async function VersionedTermsPage({ params }: { params: Promise<{ version: string }> }) {
  const { version } = await params;
  if (!Object.hasOwn(documents, version)) notFound();
  const Document = documents[version as keyof typeof documents];
  return <Document/>;
}
