import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: "Get a Free Moving Quote",
  description: "Get an instant moving estimate in minutes. Tell us your move size, ZIP codes and date.",
  path: "/quote",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
