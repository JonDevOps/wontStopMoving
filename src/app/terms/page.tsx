import { PublicLayout } from '@/components/layout/public-layout';

export default function TermsOfServicePage() {
  const lastUpdated = "March 10, 2026";

  return (
    <PublicLayout>
      <div className="min-h-screen bg-gray-50 pt-32 pb-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto bg-white rounded-3xl p-8 md:p-16 shadow-sm border border-gray-100">
            <header className="mb-12 border-b pb-8">
              <h1 className="text-4xl md:text-5xl font-black text-primary uppercase tracking-tighter mb-4">
                TERMS OF <span className="text-accent">SERVICE</span>
              </h1>
              <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">
                Last Updated: {lastUpdated}
              </p>
            </header>

            <div className="prose prose-primary max-w-none space-y-12">
              <section className="space-y-4">
                <h2 className="text-2xl font-black text-primary uppercase tracking-tight">1. Estimates & Final Charges</h2>
                <div className="space-y-4 text-muted-foreground leading-relaxed">
                  <p><strong>Hourly Services:</strong> All hourly moves are subject to a strict 3-hour minimum. The final cost is calculated based on actual time worked, plus applicable travel time (compliant with state Double Drive Time regulations where applicable).</p>
                  <p><strong>Flat-Rate Services:</strong> Flat-rate quotes are based entirely on the inventory and home size declared at the time of booking. Additional items, flights of stairs, or undeclared heavy items (e.g., pianos, safes) added on moving day will incur additional fees or revert the job to an hourly rate.</p>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-black text-primary uppercase tracking-tight">2. Valuation & Liability</h2>
                <div className="space-y-4 text-muted-foreground leading-relaxed">
                  <p><strong>Standard Protection:</strong> By default, all moves include Released Value Protection at no additional charge. Under this federally mandated minimum, Wont Stop Moving’s liability for lost or damaged goods is strictly limited to $0.60 per pound per article, regardless of the item's actual value.</p>
                  <p><strong>Full Value Protection (FVP):</strong> Customers requiring comprehensive coverage must explicitly declare a total shipment value and purchase FVP or Third-Party Insurance prior to the start of the move.</p>
                  <p><strong>High-Value Items:</strong> Items valued at more than $100 per pound (e.g., jewelry, fine art, electronics) must be disclosed in writing prior to the move to be eligible for coverage.</p>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-black text-primary uppercase tracking-tight">3. Packing & Exclusions</h2>
                <div className="space-y-4 text-muted-foreground leading-relaxed">
                  <p><strong>Customer-Packed Boxes (PBO):</strong> Wont Stop Moving is not liable for damage to the contents of boxes packed by the customer (Packed By Owner) unless the box itself shows clear signs of exterior damage caused by our crew (e.g., dropped or crushed).</p>
                  <p><strong>Pressed Wood/Particle Board:</strong> Due to the inherent instability of pressed wood or particle board furniture (e.g., standard IKEA items), Wont Stop Moving assumes no liability for damage to these items during transport or reassembly.</p>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-black text-primary uppercase tracking-tight">4. Cancellations & Rescheduling</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Cancellations or rescheduling requests must be made at least 48 hours prior to the scheduled move date. Changes made within 48 hours may be subject to a cancellation fee or forfeiture of the booking deposit.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-black text-primary uppercase tracking-tight">5. Prohibited Items</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We are prohibited by law from transporting hazardous materials, including but not limited to: explosives, pressurized gases, flammable liquids, and certain chemicals. A full list of "Non-Allowables" is provided in your booking packet.
                </p>
              </section>

              <footer className="pt-8 border-t">
                <p className="text-sm text-primary font-bold">
                  Questions regarding these terms? Contact us at <span className="text-accent">legal@wontstopmoving.com</span>.
                </p>
              </footer>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
