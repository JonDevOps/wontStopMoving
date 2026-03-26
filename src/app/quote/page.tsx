import { QuoteForm } from "@/components/forms/quote-form";
import { PublicLayout } from "@/components/layout/public-layout";

export default async function QuotePage({ searchParams }: { searchParams: Promise<{ providerId?: string }> }) {
  const params = await searchParams;
  const providerId = params.providerId;
  
  return (
    <PublicLayout>
      <div className="min-h-screen bg-gray-50 pt-32 pb-20">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-12 animate-fade-in">
              <h1 className="text-4xl md:text-5xl font-black text-primary mb-4 uppercase">Get Your <span className="text-accent">Free Quote</span></h1>
              <p className="text-lg text-muted-foreground">Just a few details and we'll have a tailored moving plan ready for you in minutes.</p>
            </div>
            <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
              <QuoteForm providerId={providerId} />
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}