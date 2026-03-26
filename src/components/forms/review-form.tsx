"use client";

import { useState } from "react";
import { useFirestore, useUser } from "@/firebase";
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReviewFormProps {
  jobId: string;
  providerId: string;
  onReviewSubmitted: () => void;
}

export function ReviewForm({ jobId, providerId, onReviewSubmitted }: ReviewFormProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user) return;
    if (rating === 0) {
      toast({
        variant: "destructive",
        title: "Rating required",
        description: "Please select a star rating before submitting.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Add review to the provider's reviews subcollection
      await addDoc(collection(firestore, "providers", providerId, "reviews"), {
        jobId,
        customerId: user.uid,
        customerName: user.displayName || "Anonymous",
        rating,
        comment,
        createdAt: serverTimestamp(),
      });

      // 2. Mark the job as reviewed so we don't prompt again
      await updateDoc(doc(firestore, "jobs", jobId), {
        reviewed: true,
      });

      toast({
        title: "Review Submitted! 🎉",
        description: "Thank you for sharing your experience.",
      });
      
      onReviewSubmitted();
    } catch (error) {
      console.error("Error submitting review:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to submit review. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-none shadow-xl bg-accent text-white mt-8 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32" />
      <CardHeader className="relative z-10 pb-4">
        <CardTitle className="text-2xl font-black uppercase tracking-widest text-white">Rate your Provider</CardTitle>
        <CardDescription className="text-accent-foreground font-medium">
          How was your moving experience? Your feedback helps others book with confidence.
        </CardDescription>
      </CardHeader>
      <CardContent className="relative z-10">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
              >
                <Star 
                  className={`w-10 h-10 ${
                    (hoverRating || rating) >= star 
                      ? "fill-white text-white drop-shadow-md" 
                      : "text-white/30 fill-transparent"
                  } transition-all duration-200`} 
                />
              </button>
            ))}
          </div>
          
          <Textarea 
            placeholder="Tell us what you loved (or what could be improved)..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="bg-white/10 border-white/20 text-white placeholder:text-white/50 min-h-[100px] focus-visible:ring-white"
          />

          <Button 
            type="submit" 
            disabled={isSubmitting} 
            className="w-full h-12 bg-white text-accent hover:bg-slate-50 font-black uppercase tracking-widest"
          >
            {isSubmitting ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting</>
            ) : (
              <><Send className="w-4 h-4 mr-2" /> Submit Review</>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
