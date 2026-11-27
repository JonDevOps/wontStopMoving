'use client';

import Link from 'next/link';
import { NewsletterSubscription } from '@/components/newsletter/Newsletter';
import { useUser } from '@/firebase';
import { PublicLayout } from '@/components/layout/public-layout';

export default function NewsletterPage() {
  const { user, isUserLoading } = useUser();
  return (
    <PublicLayout><main className="container mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-4 text-3xl font-bold">Wont Stop Moving newsletter</h1>
      {isUserLoading ? <p>Checking your sign-in…</p> : user ? <NewsletterSubscription user={user} region="us-central1" /> :
        <Link className="underline" href="/login?redirect=%2Fnewsletter">Sign in to subscribe</Link>}
    </main></PublicLayout>
  );
}
