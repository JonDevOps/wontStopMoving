import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: "Become a Moving Provider",
  description: "Join the Wont Stop Moving marketplace as an independent moving provider and get paid through Stripe.",
  path: "/provider-signup",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
