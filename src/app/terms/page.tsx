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

            <div className="prose prose-primary max-w-none space-y-8">
              <section className="space-y-4">
                <h2 className="text-2xl font-black text-primary uppercase tracking-tight">1. Acceptance of Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  By accessing or using the services provided by Wont Stop Moving, Inc. ("Wont Stop Moving," "we," "us," or "our"), you agree to be bound by these Terms of Service. If you do not agree to all of these terms, you must not use our services.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-black text-primary uppercase tracking-tight">2. Scope of Services</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Wont Stop Moving provides nationwide moving, packing, storage, and logistics services across 50 US States and Puerto Rico. All service requests are subject to regional availability and crew capacity within our 51 service regions.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-black text-primary uppercase tracking-tight">3. Quotes and Estimates</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Quotes provided via our AI-driven system are professional estimates based on the inventory and distances provided by the user. "Binding Not-to-Exceed" quotes are final based on the agreed-upon inventory; any additional items added on moving day will result in adjusted charges.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-black text-primary uppercase tracking-tight">4. User Responsibilities</h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Providing accurate inventory lists and location details.</li>
                  <li>Ensuring safe and legal access for our 26-foot moving vehicles at both origin and destination.</li>
                  <li>Securing necessary parking permits or elevator reservations as required by local authorities or building management.</li>
                  <li>Being present (or appointing a representative) during the loading and unloading process to verify inventory.</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-black text-primary uppercase tracking-tight">5. Valuation and Protection</h2>
                <p className="text-muted-foreground leading-relaxed">
                  All moves include standard Released Value Protection ($0.60 per lb per article) as required by law. Customers may elect to purchase "Full Value Protection" for additional coverage. Wont Stop Moving is not liable for items packed by the customer ("PBO") unless external damage to the box is visible and noted upon delivery.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-black text-primary uppercase tracking-tight">6. Cancellation and Rescheduling</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Cancellations made within 72 hours of the scheduled move date may be subject to a service fee. Rescheduling is subject to availability and may result in rate adjustments based on seasonal demand.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-black text-primary uppercase tracking-tight">7. Prohibited Items</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We are prohibited by law from transporting hazardous materials, including but not limited to: explosives, pressurized gases, flammable liquids, and certain chemicals. A full list of "Non-Allowables" is provided in your booking packet.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-black text-primary uppercase tracking-tight">8. Governing Law</h2>
                <p className="text-muted-foreground leading-relaxed">
                  These terms are governed by the laws of the State of California, without regard to its conflict of law principles. Any disputes arising from our services will be settled via binding arbitration in Santa Clara County, CA.
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
