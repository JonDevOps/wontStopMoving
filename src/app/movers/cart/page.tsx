import { PublicLayout } from '@/components/layout/public-layout';
import { MoverCart } from '@/components/marketplace/mover-cart';
export const metadata = { title: 'Your moving cart', robots: { index: false, follow: true } };
export default function CartPage() { return <PublicLayout><div className="bg-slate-50 pt-32 pb-20"><div className="container mx-auto max-w-4xl px-4"><MoverCart/></div></div></PublicLayout>; }
