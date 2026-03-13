import { PublicLayout } from '@/components/layout/public-layout';

export default function PrivacyPolicyPage() {
  const lastUpdated = "March 10, 2026";

  return (
    <PublicLayout>
      <div className="min-h-screen bg-gray-50 pt-32 pb-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto bg-white rounded-3xl p-8 md:p-16 shadow-sm border border-gray-100">
            <header className="mb-12 border-b pb-8">
              <h1 className="text-4xl md:text-5xl font-black text-primary uppercase tracking-tighter mb-4">
                PRIVACY <span className="text-accent">POLICY</span>
              </h1>
              <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">
                Last Updated: {lastUpdated}
              </p>
            </header>

            <div className="prose prose-primary max-w-none space-y-8">
              <section className="space-y-4">
                <h2 className="text-2xl font-black text-primary uppercase tracking-tight">1. Introduction</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Wont Stop Moving, Inc. ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website, use our mobile application, or engage our nationwide moving and logistics services across our 51 service regions.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-black text-primary uppercase tracking-tight">2. Information We Collect</h2>
                <div className="grid md:grid-cols-2 gap-6 mt-4">
                  <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                    <h3 className="font-bold text-primary mb-2">Personal Data</h3>
                    <p className="text-sm text-muted-foreground">Name, email address, telephone number, and physical addresses (pickup and dropoff locations) provided when requesting a quote or booking a move.</p>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                    <h3 className="font-bold text-primary mb-2">Technical Data</h3>
                    <p className="text-sm text-muted-foreground">IP address, browser type, operating system, and GPS location data (for real-time shipment tracking functionality).</p>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-black text-primary uppercase tracking-tight">3. How We Use Your Information</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We use the information we collect to provide and maintain our services, including:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Generating accurate AI-driven moving quotes.</li>
                  <li>Scheduling and coordinating your relocation with our 51,000 professional movers.</li>
                  <li>Providing real-time GPS tracking of your shipment.</li>
                  <li>Processing payments and managing account history.</li>
                  <li>Communicating updates, safety alerts, and promotional offers.</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-black text-primary uppercase tracking-tight">4. Information Sharing</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We do not sell your personal data. We may share information with third-party service providers (such as payment processors or regional logistics partners) who perform services for us and are bound by confidentiality agreements. We may also disclose information to comply with legal obligations or protect our rights and safety.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-black text-primary uppercase tracking-tight">5. Data Security</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We implement industry-standard security measures, including encryption and secure socket layer (SSL) technology, to protect your personal information. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-black text-primary uppercase tracking-tight">6. Your Rights</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Depending on your location, you may have the right to access, correct, or delete your personal information. You can manage your preferences or request data deletion by contacting our support team at privacy@wontstopmoving.com.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-black text-primary uppercase tracking-tight">7. Changes to This Policy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last Updated" date.
                </p>
              </section>

              <footer className="pt-8 border-t">
                <p className="text-sm text-primary font-bold">
                  Questions? Contact us at <span className="text-accent">support@wontstopmoving.com</span> or call 1-800-MOVE-NOW.
                </p>
              </footer>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
