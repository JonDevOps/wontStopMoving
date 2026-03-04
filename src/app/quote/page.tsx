import { QuoteForm } from "@/components/forms/quote-form";

export default function QuotePage() {
  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-black text-primary mb-4 uppercase">Get Your <span className="text-accent">Free Quote</span></h1>
            <p className="text-lg text-muted-foreground">Just a few details and we'll have a tailored moving plan ready for you in minutes.</p>
          </div>
          <QuoteForm />
        </div>
      </div>
    </div>
  );
}
