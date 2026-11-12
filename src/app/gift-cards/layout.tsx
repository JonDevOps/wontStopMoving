import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Moving Gift Cards',
  description: 'Give a Wont Stop Moving gift card for a friend’s next move. Any amount from $25 to $1,000, delivered by email, never expires.',
  path: '/gift-cards',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
