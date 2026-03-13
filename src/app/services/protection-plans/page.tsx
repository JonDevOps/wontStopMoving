import { PublicLayout } from '@/components/layout/public-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  FileText, 
  AlertCircle, 
  ArrowRight,
  Scale,
  Gem
} from 'lucide-react';
import Link from 'next/link';

export default function ProtectionPlansPage() {
  return (
    <PublicLayout>
      <div className="flex flex-col min-h-screen">
        {/* Hero Section */}
        <section className="bg-primary pt-40 pb-24 text-white relative overflow-hidden">
          <div className="container mx-auto px-4 relative z-10 text-center">
            <div className="inline-block bg-accent text-white px-4 py-1 rounded-full text-xs font-black mb-6 tracking-widest uppercase">
              Valuation & Security
            </div>
            <h1 className="text-5xl md:text-8xl font-black mb-6 uppercase tracking-tighter leading-tight">
              PROTECT YOUR <span className="text-accent">ASSETS</span>
            </h1>
            <p className="text-xl opacity-80 max-w-2xl mx-auto leading-relaxed">
              Moving your life is a major investment. We provide transparent, robust protection plans to ensure your belongings are secured from start to finish.
            </p>
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent opacity-30" />
        </section>

        {/* Comparison Section */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-black text-primary uppercase">CHOOSE YOUR LEVEL OF CARE</h2>
              <div className="w-24 h-2 bg-accent mx-auto mt-4" />
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* Standard Released Value */}
              <Card className="border-none bg-gray-50 overflow-hidden group hover:shadow-xl transition-all">
                <div className="h-2 bg-gray-300" />
                <CardHeader className="p-8">
                  <div className="bg-gray-200 text-gray-600 p-3 rounded-xl w-fit mb-4">
                    <ShieldAlert className="h-8 w-8" />
                  </div>
                  <CardTitle className="text-3xl font-black text-primary uppercase">STANDARD RELEASED VALUE</CardTitle>
                  <p className="text-muted-foreground font-bold">Included at no extra cost</p>
                </CardHeader>
                <CardContent className="p-8 pt-0 space-y-6">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    This is the basic level of protection required by federal law. It provides coverage based on weight rather than value.
                  </p>
                  <ul className="space-y-4">
                    {[
                      "Coverage at $0.60 per pound per article",
                      "Standard inventory logging",
                      "Uniformed, background-checked handlers",
                      "Basic claims processing support"
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm font-bold text-primary">
                        <CheckCircle2 className="h-5 w-5 text-gray-400 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 flex gap-3">
                    <AlertCircle className="h-5 w-5 text-accent shrink-0" />
                    <p className="text-[10px] text-accent font-bold leading-tight uppercase">
                      Best for low-value items or short distances where risk is minimal.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Full Value Protection */}
              <Card className="border-none bg-primary text-white overflow-hidden shadow-2xl scale-105 relative z-10">
                <div className="h-2 bg-accent" />
                <CardHeader className="p-8">
                  <div className="bg-accent text-white p-3 rounded-xl w-fit mb-4">
                    <ShieldCheck className="h-8 w-8" />
                  </div>
                  <CardTitle className="text-3xl font-black uppercase">FULL VALUE PROTECTION</CardTitle>
                  <p className="text-accent font-black tracking-widest text-xs uppercase">Highly Recommended</p>
                </CardHeader>
                <CardContent className="p-8 pt-0 space-y-6">
                  <p className="text-sm opacity-80 leading-relaxed">
                    Our premium comprehensive plan. If an item is lost or damaged, we will repair it, replace it with a like item, or offer a cash settlement for the current market value.
                  </p>
                  <ul className="space-y-4">
                    {[
                      "Full repair or replacement coverage",
                      "High-value inventory (over $100/lb) supported",
                      "Priority claims handling (48-hour response)",
                      "White-glove handling protocols included",
                      "Peace of mind for entire household value"
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm font-bold">
                        <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="w-full bg-accent hover:bg-accent/90 text-white rounded-xl h-12 font-bold uppercase tracking-widest text-xs">
                    <Link href="/quote">Request Premium Quote</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Why it matters */}
        <section className="py-24 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row items-center gap-16">
              <div className="lg:w-1/2 space-y-8">
                <h2 className="text-4xl font-black text-primary uppercase">WHY PROTECTION <span className="text-accent">MATTERS</span></h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Accidents are rare, but road conditions, weather, and logistics involve variables beyond anyone's control. A professional protection plan transforms a potential crisis into a simple administrative process.
                </p>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="bg-white p-3 rounded-xl shadow-sm w-fit text-accent">
                      <Scale className="h-6 w-6" />
                    </div>
                    <h4 className="font-black text-primary uppercase text-sm">Legal Compliance</h4>
                    <p className="text-xs text-muted-foreground">Fully compliant with DOT and state regulatory insurance requirements.</p>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-white p-3 rounded-xl shadow-sm w-fit text-accent">
                      <Gem className="h-6 w-6" />
                    </div>
                    <h4 className="font-black text-primary uppercase text-sm">Asset Valuation</h4>
                    <p className="text-xs text-muted-foreground">Expert assistance in valuing your collection, from electronics to fine art.</p>
                  </div>
                </div>
              </div>
              <div className="lg:w-1/2 bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-gray-100">
                <h3 className="text-2xl font-black text-primary uppercase mb-6 flex items-center gap-2">
                  <FileText className="h-6 w-6 text-accent" />
                  CLAIMS PROCESS
                </h3>
                <div className="space-y-8">
                  {[
                    { step: "01", title: "Document", desc: "Take photos of items before the move and note their condition on the inventory list." },
                    { step: "02", title: "Report", desc: "Notify your Move Coordinator within 24 hours if any damage is discovered upon delivery." },
                    { step: "03", title: "Resolve", desc: "Our claims team works with local repair experts or vendors to settle the claim quickly." }
                  ].map((item, i) => (
                    <div key={i} className="flex gap-6">
                      <div className="text-3xl font-black text-accent opacity-20">{item.step}</div>
                      <div>
                        <h4 className="font-bold text-primary uppercase text-sm mb-1">{item.title}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 bg-accent text-white">
          <div className="container mx-auto px-4 text-center space-y-8">
            <ShieldCheck className="h-16 w-16 mx-auto animate-pulse" />
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">SECURE YOUR JOURNEY</h2>
            <p className="text-xl max-w-2xl mx-auto opacity-90">
              Talk to a Move Coordinator today to find the perfect protection balance for your upcoming relocation.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-white rounded-full px-12 h-16 text-xl font-bold shadow-2xl uppercase">
                <Link href="/book">Book Protected Move</Link>
              </Button>
              <Button asChild size="lg" className="bg-secondary hover:bg-secondary/90 text-white rounded-full px-12 h-16 text-xl font-bold uppercase shadow-xl">
                <Link href="/contact">Contact Support</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
