import { notFound } from 'next/navigation';
import { PublicLayout } from '@/components/layout/public-layout';
import { CartBooking } from '@/components/marketplace/cart-booking';
import { moverCity } from '@/lib/server/mover-locations';
import { isId } from '@/lib/server/auth';
export const metadata = { title: 'Customize your crew', robots: { index: false, follow: true } };
export default async function CustomizeCrew({ params }: { params: Promise<{ region: string; city: string; providerId: string }> }) {
  const { region, city, providerId } = await params;
  if (!moverCity(region, city) || !isId(providerId)) notFound();
  return <PublicLayout><div className="bg-slate-50 pt-32 pb-20"><div className="container mx-auto max-w-4xl px-4"><CartBooking providerId={providerId} region={region} city={city}/></div></div></PublicLayout>;
}
