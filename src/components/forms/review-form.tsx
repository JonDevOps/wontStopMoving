"use client";

import { useState } from "react";
import { useAuth } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";

interface ReviewFormProps {
  jobId: string;
  providerId: string;
  onReviewSubmitted: () => void;
}

/** Rate the provider after a completed move. Saved on the server, which updates the provider's rating. */
export function ReviewForm({ jobId, onReviewSubmitted }: ReviewFormProps) {
  const auth = useAuth();
  const { toast } = useToast();

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleReviewUrl, setGoogleReviewUrl] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast({ variant: "destructive", title: "Rating required", description: "Please choose a star rating before submitting." });
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await apiFetch<{ googleReviewUrl: string | null }>(auth, "/api/reviews", { jobId, rating, comment });
      toast({ title: "Thanks for your review!", description: "Your feedback helps other customers book with confidence." });
      if (result.googleReviewUrl) { setGoogleReviewUrl(result.googleReviewUrl); setDone(true); }
      else onReviewSubmitted();
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't submit your review", description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-none shadow-xl bg-accent text-white mt-8 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32" />
      <CardHeader className="relative z-10 pb-4">
        <CardTitle className="text-2xl font-black uppercase tracking-widest text-white">{done ? "Thank you!" : "Rate your provider"}</CardTitle>
        <CardDescription className="text-accent-foreground font-medium">
          {done ? "Glad the move went well. Would you share your review on Google too? It helps other families find us." : "How was your move? Your feedback helps others book with confidence."}
        </CardDescription>
      </CardHeader>
      <CardContent className="relative z-10">
        {done && googleReviewUrl ? (
          <div className="flex flex-wrap gap-3">
            <Button asChild className="h-12 bg-white text-accent hover:bg-slate-50 font-black uppercase tracking-widest"><a href={googleReviewUrl} target="_blank" rel="noopener noreferrer">Review us on Google</a></Button>
            <Button type="button" variant="ghost" className="h-12 text-white hover:bg-white/10" onClick={onReviewSubmitted}>No thanks</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex gap-2" role="radiogroup" aria-label="Star rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" role="radio" aria-checked={rating === star} aria-label={`${star} star${star === 1 ? "" : "s"}`}
                  className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
                  onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)} onClick={() => setRating(star)}>
                  <Star className={`w-10 h-10 ${(hoverRating || rating) >= star ? "fill-white text-white drop-shadow-md" : "text-white/30 fill-transparent"} transition-all duration-200`} />
                </button>
              ))}
            </div>
            <Textarea placeholder="Tell us what you loved, or what could be better…" value={comment} maxLength={2000} onChange={(e) => setComment(e.target.value)} aria-label="Your review"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50 min-h-[100px] focus-visible:ring-white" />
            <Button type="submit" disabled={isSubmitting} className="w-full h-12 bg-white text-accent hover:bg-slate-50 font-black uppercase tracking-widest">
              {isSubmitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting</> : <><Send className="w-4 h-4 mr-2" /> Submit review</>}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
