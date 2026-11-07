import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: "Reset Password",
  description: "Reset Password",
  path: "/forgot-password",
  noindex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
