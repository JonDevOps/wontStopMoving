import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: "Book a Mover",
  description: "Book vetted movers online with upfront pricing. Your payment is held in escrow until the job is done.",
  path: "/book",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
