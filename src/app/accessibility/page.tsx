import { PublicLayout } from '@/components/layout/public-layout';
import { ShieldCheck, MessageSquare, Monitor, Search } from 'lucide-react';

export default function AccessibilityPage() {
  return (
    <PublicLayout>
      <div className="min-h-screen bg-gray-50 pt-32 pb-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-12">
            {/* Header */}
            <div className="text-center space-y-6">
              <h1 className="text-5xl md:text-8xl font-black text-primary uppercase tracking-tighter leading-tight">
                ACCESSIBILITY <span className="text-accent">STATEMENT</span>
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                Wont Stop Moving is dedicated to ensuring that our digital experience and nationwide services are accessible to everyone.
              </p>
            </div>

            {/* Main Content */}
            <div className="bg-white rounded-3xl p-8 md:p-16 shadow-sm border border-gray-100">
              <div className="prose prose-primary max-w-none space-y-12">
                <section className="space-y-4">
                  <h2 className="text-3xl font-black text-primary uppercase tracking-tight">Our Commitment</h2>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    At Wont Stop Moving, we believe that moving should be stress-free for everyone. We are committed to digital accessibility and to conforming to the Web Content Accessibility Guidelines (WCAG) 2.1, Level AA and Level AAA standards. We continuously work to improve our user experience for everyone and apply the relevant accessibility standards.
                  </p>
                </section>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100 space-y-4">
                    <div className="bg-primary text-white p-3 rounded-2xl w-fit">
                      <Monitor className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-bold text-primary uppercase">Digital Standards</h3>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li>• High-contrast color ratios for readability.</li>
                      <li>• Descriptive ALT text for all informative imagery.</li>
                      <li>• Keyboard-only navigation support.</li>
                      <li>• Screen-reader friendly architecture.</li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100 space-y-4">
                    <div className="bg-accent text-white p-3 rounded-2xl w-fit">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-bold text-primary uppercase">Physical Service</h3>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li>• Specialized support for senior relocations.</li>
                      <li>• Assisted packing for those with limited mobility.</li>
                      <li>• ADA-compliant logistical planning.</li>
                      <li>• Clear communication protocols for all abilities.</li>
                    </ul>
                  </div>
                </div>

                <section className="space-y-4 pt-8">
                  <h2 className="text-2xl font-black text-primary uppercase tracking-tight">Assistance & Feedback</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    If you encounter any difficulty in accessing any part of our website or mobile application, please contact us immediately. We will work with you to provide the information, item, or transaction you seek through an alternate communication method that is accessible for you (e.g., telephone support).
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-6 mt-8 p-8 bg-primary text-white rounded-3xl">
                    <div className="flex-1 space-y-2">
                      <p className="text-xs font-black uppercase tracking-widest text-accent">Contact Support</p>
                      <p className="text-2xl font-black">(650) 569-0584</p>
                      <p className="text-sm opacity-60">Available 24/7 for immediate assistance.</p>
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-xs font-black uppercase tracking-widest text-accent">Email Accessibility</p>
                      <p className="text-2xl font-black">access@wontstopmoving.com</p>
                      <p className="text-sm opacity-60">Average response time: 2 hours.</p>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-black text-primary uppercase tracking-tight">Ongoing Efforts</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We view accessibility as an ongoing effort and are currently in the process of auditing and implementing additional improvements to our digital platforms. Our team of 51,000 professionals is trained to be inclusive and helpful in every service region we serve.
                  </p>
                </section>
              </div>
            </div>

            {/* Footer help */}
            <div className="text-center">
              <p className="text-muted-foreground text-sm">
                Wont Stop Moving, Inc. is committed to equal opportunity and inclusion in all our 51 US regions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
