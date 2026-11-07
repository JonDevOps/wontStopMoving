import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: "Accessibility",
  description: "Our commitment to making the Wont Stop Moving website usable for everyone.",
  path: "/accessibility",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
