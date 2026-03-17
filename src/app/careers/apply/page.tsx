
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { ArrowLeft, AlertCircle, Truck } from "lucide-react";
import Link from "next/link";
import { useFirestore, useAuth } from "@/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,30}$/;

const signUpSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Invalid phone number"),
  password: z.string().regex(
    passwordRegex,
    "Password must be 8-30 characters, contain 1 uppercase, 1 lowercase, 1 number and 1 special character"
  ),
  agreeTerms: z.boolean().refine(val => val === true, "You must agree to the terms"),
});

type SignUpValues = z.infer<typeof signUpSchema>;

export default function EmployeeSignUpPage() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();
  
  const [isLoading, setIsLoading] = useState(false);
  const [termsOpened, setTermsOpened] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [existingAccountError, setExistingAccountError] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      agreeTerms: false
    }
  });

  const onSubmit = async (data: SignUpValues) => {
    if (!termsOpened) {
      setTermsError("You must review the terms and conditions prior to agreeing");
      return;
    }
    setTermsError(null);
    setExistingAccountError(false);
    setIsLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;

      await setDoc(doc(firestore, "users", user.uid), {
        id: user.uid,
        email: data.email,
        name: `${data.firstName} ${data.lastName}`,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: 'employee',
        state: "Pending",
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(firestore, "employees", user.uid), {
        id: user.uid,
        userId: user.uid,
        status: 'applicant',
        onboardingStep: 2,
        createdAt: serverTimestamp(),
      });

      toast({
        title: "Account Created",
        description: "Moving to Phase 2: Your Details.",
      });
      
      router.push('/careers/apply/details');

    } catch (error: any) {
      console.error("Signup Error:", error);
      if (error.code === 'auth/email-already-in-use') {
        setExistingAccountError(true);
      } else {
        toast({
          variant: "destructive",
          title: "Registration Error",
          description: error.message || "Failed to create account.",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTermsClick = () => {
    setTermsOpened(true);
    setTermsError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-24">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <Link href="/careers" className="inline-flex items-center gap-2 text-primary font-bold mb-8 hover:text-accent transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Careers
          </Link>

          <div className="mb-12 text-center">
            <div className="bg-primary text-white p-3 rounded-2xl w-fit mx-auto mb-6">
              <Truck className="h-8 w-8" />
            </div>
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="bg-accent text-white text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest">Phase 1</span>
              <h1 className="text-3xl sm:text-4xl font-black text-primary uppercase">Provider <span className="text-accent">Sign Up</span></h1>
            </div>
            <p className="text-muted-foreground font-medium">Create your secure account to join our 51,000+ member network.</p>
          </div>

          {existingAccountError && (
            <Alert variant="destructive" className="mb-8 border-red-200 bg-red-50 text-red-900">
              <AlertCircle className="h-5 w-5" />
              <AlertTitle className="font-black uppercase tracking-tight">Existing Account Found</AlertTitle>
              <AlertDescription className="text-sm font-medium">
                Our records indicate your information matches an existing Wont Stop Moving account. Please email <span className="font-bold">support@wontstopmoving.com</span> for further instructions.
              </AlertDescription>
            </Alert>
          )}

          <Card className="border-none shadow-xl overflow-hidden bg-white">
            <div className="h-1.5 bg-gray-100">
              <div className="h-full bg-accent w-1/3 transition-all duration-500" />
            </div>
            <CardContent className="p-6 sm:p-12">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">First Name</Label>
                    <Input id="firstName" {...register("firstName")} placeholder="Jane" className="h-12 border-gray-200 focus:ring-accent" />
                    {errors.firstName && <p className="text-xs text-destructive font-bold">{errors.firstName.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Last Name</Label>
                    <Input id="lastName" {...register("lastName")} placeholder="Doe" className="h-12 border-gray-200 focus:ring-accent" />
                    {errors.lastName && <p className="text-xs text-destructive font-bold">{errors.lastName.message}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Email Address</Label>
                  <Input id="email" type="email" {...register("email")} placeholder="jane@example.com" className="h-12 border-gray-200 focus:ring-accent" />
                  {errors.email && <p className="text-xs text-destructive font-bold">{errors.email.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Phone Number</Label>
                  <Input id="phone" {...register("phone")} placeholder="(555) 000-0000" className="h-12 border-gray-200 focus:ring-accent" />
                  {errors.phone && <p className="text-xs text-destructive font-bold">{errors.phone.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Password</Label>
                  <Input id="password" type="password" {...register("password")} className="h-12 border-gray-200 focus:ring-accent" />
                  <p className="text-[10px] text-muted-foreground font-medium">Must be 8-30 characters with uppercase, lowercase, number, and special character.</p>
                  {errors.password && <p className="text-xs text-destructive font-bold leading-tight">{errors.password.message}</p>}
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-start space-x-3">
                    <Checkbox 
                      id="agreeTerms" 
                      onCheckedChange={(val) => setValue("agreeTerms", val === true)} 
                      className="mt-1"
                    />
                    <div className="space-y-1 leading-none">
                      <Label htmlFor="agreeTerms" className="text-sm font-medium text-primary leading-relaxed">
                        I agree to Wont Stop Moving®{" "}
                        <Dialog>
                          <DialogTrigger asChild>
                            <button 
                              type="button" 
                              onClick={handleTermsClick}
                              className="text-accent font-black hover:underline underline-offset-2"
                            >
                              Terms of Service
                            </button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden">
                            <DialogHeader className="p-6 border-b shrink-0">
                              <DialogTitle className="text-2xl font-black uppercase tracking-tight">Terms of Service</DialogTitle>
                            </DialogHeader>
                            
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                              <div className="prose prose-sm prose-primary max-w-none text-muted-foreground">
                                <div>
                                  <h2 className="text-primary font-black uppercase text-lg">Wont Stop Moving® Affiliate Agreement</h2>
                                  <p className="font-bold text-primary">Effective July 26, 2023</p>
                                </div>

                                <section>
                                  <h3 className="text-primary font-bold uppercase mt-6">AGREEMENT:</h3>
                                  <p>You acknowledge and agree to the following terms and conditions when You use the Wont Stop Moving® MarketPlace. Our responsibilities are specific and limited to the terms of this Agreement. You must read, agree with, and accept all of the terms and conditions contained in this Agreement which are those terms, conditions and definitions expressly set out below.</p>
                                </section>

                                <section>
                                  <h3 className="text-primary font-bold uppercase mt-6">1. Arbitration Agreement:</h3>
                                  <p className="font-bold text-destructive uppercase">YOU ACKNOWLEDGE AND AGREE THAT THIS AGREEMENT INCLUDES THE WONT STOP MOVING COMMERCIAL ARBITRATION AGREEMENT, AVAILABLE AT APPENDIX “A” TO THIS AGREEMENT, THAT GOVERNS ANY DISPUTES BETWEEN YOU AND WONT STOP MOVING, INC. THIS ARBITRATION AGREEMENT WILL:</p>
                                  <ul className="list-disc pl-5 font-bold text-destructive">
                                    <li>ELIMINATE YOUR RIGHT TO A JURY TRIAL; AND</li>
                                    <li>SUBSTANTIALLY AFFECT YOUR RIGHTS, INCLUDING PREVENTING YOU FROM BRINGING, JOINING, OR PARTICIPATING IN CLASS ACTION OR CONSOLIDATED PROCEEDINGS.</li>
                                  </ul>
                                </section>

                                <section>
                                  <h3 className="text-primary font-bold uppercase mt-6">2. Definitions:</h3>
                                  <p>A. The following is a non-exhaustive list of definitions that shall apply to the use of this MarketPlace; other definitions are included through out the text:</p>
                                  <ul className="list-disc pl-5">
                                    <li><strong>"You", "Your", "User", "mover", "Wont Stop Moving® affiliate", "service provider"</strong> - you, individually, or You for and on behalf of, an entity, organization or corporation, who provides services, such as Wont Stop Moving® services and others, to the consuming public;</li>
                                    <li><strong>"We", "Us", "Our"</strong> - WONT STOP MOVING, Inc., a Delware Corporation with a principal place of business in Mountain View, California;</li>
                                    <li><strong>"Services"</strong> - The services that You offer to provide and/or provide to the consuming public;</li>
                                    <li><strong>"WONT STOP MOVING® MarketPlace"</strong> or "MarketPlace": Our MarketPlace located at www.wontstopmoving.com</li>
                                    <li><strong>"Customer(s)"</strong> - individual who desires to obtain Services;</li>
                                    <li><strong>"Agreement"</strong> - the agreement for use of the WONT STOP MOVING® MarketPlace;</li>
                                  </ul>
                                </section>

                                <section>
                                  <h3 className="text-primary font-bold uppercase mt-6">3. Free Sign up and Advertising Acknowledgement; Common Sense and Business Judgment:</h3>
                                  <p>You acknowledge that We allow You to sign up on the MarketPlace free of charge and allow You to advertise Yourself and Your Services free of charge. You agree to use common sense and good business judgment when using the WONT STOP MOVING® MarketPlace.</p>
                                </section>

                                <section>
                                  <h3 className="text-primary font-bold uppercase mt-6">4. Modification of Agreement:</h3>
                                  <p>We may modify the Agreement by sending to You, by email to Your provided email address, a copy of the modified Agreement. If You reject the modified Agreement, then You must terminate this Agreement immediately with notice to Us no later than thirty (30) days after the modified Agreement is sent to You by Us. You agree that Your continued participation as a WONT STOP MOVING® affiliate thirty (30) days after the Agreement is sent to You by Us is Your express consent and agreement to the Modified Agreement.</p>
                                </section>

                                <section>
                                  <h3 className="text-primary font-bold uppercase mt-6">5. Neutral Venue and Online Clearinghouse:</h3>
                                  <p>We and Our WONT STOP MOVING® MarketPlace function solely as a neutral venue and online clearinghouse. We are the neutral venue for the connection between You and the Customer. You do not work for Us or represent Us. You agree that We are not your employer. We do not provide any endorsement for You or Your Services.</p>
                                </section>

                                <section>
                                  <h3 className="text-primary font-bold uppercase mt-6">6. Labor Only:</h3>
                                  <p>You agree that the MarketPlace is a place where You offer labor services only and that the Services that You provide will only involve labor.</p>
                                </section>

                                <section>
                                  <h3 className="text-primary font-bold uppercase mt-6">7. Disputes:</h3>
                                  <p>Because we are a neutral venue, We are not responsible for resolving any disputes between You and the Customer regarding the Services. All disputes must be resolved between You and the Customer. You expressly authorize Us to release Your provided contact information to the Customer to settle disputes.</p>
                                </section>

                                <section>
                                  <h3 className="text-primary font-bold uppercase mt-6">8. Effective Offer and Acceptance for Services:</h3>
                                  <p>You agree and acknowledge that when a request for the Services has been submitted to You by a Customer, the Customer has effectively communicated an offer to You to enter into a contract for the Services. If You accept, You and the Customer have entered into a contract. Rate changes based on specific addresses are handled between You and the Customer.</p>
                                </section>

                                <section>
                                  <h3 className="text-primary font-bold uppercase mt-6">9. MarketPlace Fee:</h3>
                                  <p>You acknowledge and agree that We shall receive a "MarketPlace Fee". Our MarketPlace Fee is NOT an additional charge to the total amount to be paid by the Customer. Our MarketPlace Fee is calculated as a 15% cut from the total amount paid by the Customer for the Services.</p>
                                </section>

                                <section>
                                  <h3 className="text-primary font-bold uppercase mt-6">10. Payment for Services:</h3>
                                  <p>You acknowledge and agree that payment for the provided Services will be made pursuant to the provision of the Payment Authorization Code ("Code") to You by the Customer. Payments are to be released to You upon Your input of the Code.</p>
                                </section>

                                <section>
                                  <h3 className="text-primary font-bold uppercase mt-6">11. Your Financial Obligation to Us:</h3>
                                  <p>By entering the Code you represent and warrant that the Services have been completed and You accept the MarketPlace Fee deduction.</p>
                                </section>

                                <section>
                                  <h3 className="text-primary font-bold uppercase mt-6">12. Additional Services:</h3>
                                  <p>Additional Services must be reported to Us. You agree to remit a 15% MarketPlace Fee for any additional compensation received. Failure to comply results in penalties and potential account termination.</p>
                                </section>

                                <section>
                                  <h3 className="text-primary font-bold uppercase mt-6">13. Authorization to credit and debit Your identified account:</h3>
                                  <p>You irrevocably and expressly authorize Us to credit monies to Your account, and to withhold or debit monies for customer disputes, chargebacks, fees, or adjustments.</p>
                                </section>

                                <section>
                                  <h3 className="text-primary font-bold uppercase mt-6">14. Prohibited Actions:</h3>
                                  <p>You shall NOT attempt to circumvent the MarketPlace Fee, improperly influence Customer reviews, or create multiple accounts/profiles.</p>
                                </section>

                                <section>
                                  <h3 className="text-primary font-bold uppercase mt-6">19. Confidentiality/Non-Disclosure:</h3>
                                  <p>You agree that all Our documents, source code, business practices, and systems are Our sole and exclusive intellectual property. Unauthorized disclosure is strictly prohibited.</p>
                                </section>

                                <section>
                                  <h3 className="text-primary font-bold uppercase mt-6">20. Non-Competition:</h3>
                                  <p>You shall not engage in or assist others in the operation of a similar internet-based moving marketplace during the term of this Agreement and for one year thereafter.</p>
                                </section>

                                <section className="bg-primary/5 p-6 rounded-2xl border border-primary/10 mt-8">
                                  <h2 className="text-primary font-black uppercase text-xl text-center">APPENDIX A</h2>
                                  <h3 className="text-primary font-black uppercase text-lg text-center mt-2">ARBITRATION AGREEMENT</h3>
                                  <div className="mt-4 space-y-4 text-xs">
                                    <p>1. <strong>General:</strong> You agree that any and all Claims arising out of or relating to this Agreement shall be submitted to binding arbitration on an individual basis only and not by court or jury trial.</p>
                                    <p>3. <strong>Class Action Waiver:</strong> You and the Company agree to resolve any Claim in arbitration on an individual basis only, and not on a class, collective action, or representative basis.</p>
                                    <p>9. <strong>Governing Law:</strong> Interpretation of this Arbitration Agreement shall be governed by the laws of the state of California. Jurisdiction shall be in the City and County of Mountain View, California.</p>
                                  </div>
                                </section>

                                <div className="text-[10px] text-center opacity-50 uppercase font-bold py-8">
                                  Full Agreement Version 2023.07.26 - All Rights Reserved
                                </div>
                              </div>
                            </div>

                            <DialogFooter className="p-6 border-t bg-gray-50 shrink-0">
                              <DialogClose asChild>
                                <Button type="button" className="bg-primary text-white rounded-xl px-8 h-12 font-bold uppercase tracking-widest text-xs w-full sm:w-auto">
                                  I have read and accept the terms
                                </Button>
                              </DialogClose>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </Label>
                      {errors.agreeTerms && <p className="text-xs text-destructive font-bold">{errors.agreeTerms.message}</p>}
                      {termsError && !errors.agreeTerms && <p className="text-xs text-destructive font-bold">{termsError}</p>}
                    </div>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full bg-accent hover:bg-accent/90 min-h-14 text-lg font-black rounded-xl uppercase tracking-widest shadow-xl shadow-accent/20 mt-4 px-6"
                >
                  {isLoading ? "Processing..." : "Create Account & Continue"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
