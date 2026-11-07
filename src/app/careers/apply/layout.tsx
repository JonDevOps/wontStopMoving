import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: "Apply to Join Our Crew",
  description: "Apply to work with Wont Stop Moving as a mover or crew member.",
  path: "/careers/apply",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
