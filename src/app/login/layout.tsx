import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: "Sign In",
  description: "Sign in to your Wont Stop Moving account as a customer, provider, crew member or admin.",
  path: "/login",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
