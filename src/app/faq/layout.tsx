import { JsonLd } from '@/components/seo/json-ld';
import { FAQ_CATEGORIES } from '@/lib/faq-data';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: "Moving FAQ",
  description: "Answers about quotes, booking, packing, coverage, protection plans and payments at Wont Stop Moving.",
  path: "/faq",
});

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_CATEGORIES.flatMap((c) =>
    c.items.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } }))
  ),
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={faqJsonLd} />
      {children}
    </>
  );
}
