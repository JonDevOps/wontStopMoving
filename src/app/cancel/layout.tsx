import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Cancel or Reschedule a Move',
  description: 'Need to change your moving date or cancel? Signed-in customers can do it from their move page; anyone can send a request here and we reply within 4 business hours.',
  path: '/cancel',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
