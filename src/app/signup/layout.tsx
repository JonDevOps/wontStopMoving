import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: "Create an Account",
  description: "Create a free Wont Stop Moving account to request quotes and book your move.",
  path: "/signup",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
