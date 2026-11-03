"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  PhoneCall,
  CheckCircle2,
  RotateCcw,
  Calculator,
  Copy,
  Sparkles,
  ShieldCheck,
  MessageSquareWarning,
  Save,
} from "lucide-react";
import {
  MOVE_PRICING,
  ADDON_PRICING,
  calculateMoveTotal,
} from "@/lib/pricing";
import { useFirestore, useUser } from "@/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface ScriptItem {
  id: string;
  label: string;
  script: string;
  tip?: string;
}

interface ScriptPhase {
  id: string;
  phase: string;
  title: string;
  items: ScriptItem[];
}

const CALL_PHASES: ScriptPhase[] = [
  {
    id: "opening",
    phase: "Phase 1",
    title: "Warm Opening & Rapport",
    items: [
      {
        id: "open_1",
        label: "Energized greeting & introduce yourself",
        script:
          '"Thank you for calling Wont Stop Moving! This is [Your Name] on the relocation team. Who do I have the pleasure of speaking with today?"',
      },
      {
        id: "open_2",
        label: "Confirm best callback phone number & email",
        script:
          '"Great to meet you, [Customer Name]! Before we dive in, just in case we get disconnected, what is the best phone number and email to send your written estimate to?"',
      },
      {
        id: "open_3",
        label: "Set a 3-minute agenda & build excitement",
        script:
          '"Moving is a big milestone, and my job today is to make this 100% stress-free. I\'ll ask a few quick questions about where you\'re moving, check our crew availability, and give you a locked-in flat-rate quote right on this call. Sound good?"',
      },
    ],
  },
  {
    id: "discovery",
    phase: "Phase 2",
    title: "Discovery & Move Qualification",
    items: [
      {
        id: "disc_1",
        label: "Confirm Pickup & Dropoff addresses (and local vs. long-distance)",
        script:
          '"Where are we picking up from, and what city or address are we heading to?"',
      },
      {
        id: "disc_2",
        label: "Check access details: stairs, elevators, parking distance",
        script:
          '"At both locations, are we working with ground-floor access, stairs, or a freight elevator? And how close can a 26-foot moving truck park to the entrance?"',
        tip: "Note if a Certificate of Insurance (COI) is required by either building.",
      },
      {
        id: "disc_3",
        label: "Confirm Target Move Date & time window flexibility",
        script:
          '"What is your ideal move date? Do you have a 1-to-2 day window of flexibility if it saves you on priority dispatch?"',
      },
      {
        id: "disc_4",
        label: "Identify property size (Studio/1BR, 2BR, 3BR, 4BR+, Commercial)",
        script:
          '"How many bedrooms or offices are we moving today, and would you say it\'s lightly furnished, standard, or heavily furnished?"',
      },
    ],
  },
  {
    id: "inventory",
    phase: "Phase 3",
    title: "Inventory & Specialty Items Check",
    items: [
      {
        id: "inv_1",
        label: "Ask about heavy or specialty items (Pianos, Gun Safes, Gym Gear)",
        script:
          '"Do you have any specialty or extra-heavy pieces over 250 lbs—like an upright piano, gun safe, pool table, or commercial equipment?"',
      },
      {
        id: "inv_2",
        label: "Ask about fragile items needing custom crating (Art, Glass, Marble)",
        script:
          '"Are there any high-value fragile pieces like large glass tabletops, marble, chandeliers, or fine art that need custom protective crating?"',
      },
      {
        id: "inv_3",
        label: "Check bed frames / furniture disassembly & reassembly needs",
        script:
          '"Will you need our crew to disassemble and reassemble beds, sectionals, or desks at the new place?"',
      },
    ],
  },
  {
    id: "upsell",
    phase: "Phase 4",
    title: "Value Pitch, Protection & Add-On Upsells",
    items: [
      {
        id: "up_1",
        label: "Pitch White-Glove Packing & Unpacking (+$350)",
        script:
          '"Most of our clients love our Full White-Glove Packing service—we bring all boxes, shrink-wrap, and dish packs so you don\'t have to lift a finger. Would you like me to include packing in your quote?"',
      },
      {
        id: "up_2",
        label: "Pitch Move-Out Deep Cleaning (+$425) or Junk Removal (+$250)",
        script:
          '"We also offer post-move Deep Cleaning so you get your security deposit back, plus Junk Removal for anything you\'re leaving behind. Would either of those help?"',
      },
      {
        id: "up_3",
        label: "Check eligibility for Student (-5%) or Military (-5%) discount",
        script:
          '"We proudly offer a 5% discount for active military, veterans, and students—do either of those apply to your household?"',
      },
    ],
  },
  {
    id: "quote",
    phase: "Phase 5",
    title: "Quote Presentation & Objection Handling",
    items: [
      {
        id: "qt_1",
        label: "Present the all-inclusive price with confidence",
        script:
          '"Based on everything we covered for your [Move Size] relocation, including vetted background-checked movers, padded blanket wrapping, and full dispatch tracking, your flat-rate investment comes out to $[Total Price]."',
      },
      {
        id: "qt_2",
        label: "Explain the Wont Stop Moving Escrow Guarantee",
        script:
          '"Unlike brokers who surprise you with hidden stair or fuel fees on move day, your payment is held safely in escrow until your move is completed to your satisfaction."',
      },
      {
        id: "qt_3",
        label: "Ask for the booking / address any questions",
        script:
          '"We still have a morning crew slot open for [Move Date]. Shall I lock in that crew for you right now?"',
      },
    ],
  },
  {
    id: "close",
    phase: "Phase 6",
    title: "Close, Stripe Link & Next Steps",
    items: [
      {
        id: "cl_1",
        label: "Save quote & send customer portal / Stripe checkout link",
        script:
          '"I\'ve just saved your official quote to your account! You can click \'Pay & Book\' right from your Customer Dashboard to reserve your crew via Stripe."',
      },
      {
        id: "cl_2",
        label: "Confirm move-day coordinator follow-up & thank customer",
        script:
          '"You\'re all set! Your dedicated move coordinator will reach out 48 hours before your move to re-confirm arrival times. Welcome to Wont Stop Moving!"',
      },
    ],
  },
];

const OBJECTION_HANDLERS = [
  {
    id: "obj_price",
    objection: '"Another moving company gave me a cheaper quote."',
    response:
      '"I completely understand wanting the best value! Keep in mind that many lowball quotes are non-binding hourly estimates that add truck, fuel, stair, and shrink-wrap fees on move day. Our price is transparent, our crews are ID-verified and insured, and your payment is protected in escrow until the job is done. If we lock in your date today, I can also check if you qualify for our 5% promotional discount."',
  },
  {
    id: "obj_think",
    objection: '"I need to think about it / talk to my partner first."',
    response:
      '"That makes total sense! What I can do right now is save this exact locked-in quote to your email so you and your partner can review the itemized breakdown together. Just keep in mind we only have 2 crew slots left for that week—what time tomorrow should I follow up with you?"',
  },
  {
    id: "obj_date",
    objection: '"I don\'t know my exact closing / move-in date yet."',
    response:
      '"No problem at all—closings shift all the time! When you book with Wont Stop Moving, you get free date rescheduling up to 72 hours before your move. Locking in your target date now guarantees your rate and priority crew access."',
  },
];

const ADDON_LABELS: Record<string, string> = {
  packing: "Full White-Glove Packing (+$350)",
  crating: "Specialty Crating (+$400)",
  cleaning: "Move-Out Deep Cleaning (+$425)",
  junk: "Junk Removal 1/4 Truck (+$250)",
  assembly: "Handyman Disassembly/Assembly (+$200)",
  storage: "Vaulted Storage (+$225)",
  piano: "Specialty Item / Piano (+$450)",
};

export function SalesScriptTool() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [moveDate, setMoveDate] = useState("");
  const [moveSize, setMoveSize] = useState<string>("2br");
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [isStudent, setIsStudent] = useState(false);
  const [isMilitary, setIsMilitary] = useState(false);
  const [isExpress, setIsExpress] = useState(false);
  const [callNotes, setCallNotes] = useState("");
  const [isSavingQuote, setIsSavingQuote] = useState(false);

  const totalItems = CALL_PHASES.reduce(
    (sum, phase) => sum + phase.items.length,
    0
  );
  const completedCount = Object.values(checkedItems).filter(Boolean).length;
  const progressPercent = Math.round((completedCount / totalItems) * 100);

  const estimatedTotal = calculateMoveTotal(moveSize, selectedAddOns, {
    isStudent,
    isMilitary,
    isExpress,
  });
  const platformFee = Math.round(estimatedTotal * 0.15);
  const providerPayout = estimatedTotal - platformFee;

  const toggleChecklist = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAddOn = (addonKey: string) => {
    setSelectedAddOns((prev) =>
      prev.includes(addonKey)
        ? prev.filter((a) => a !== addonKey)
        : [...prev, addonKey]
    );
  };

  const handleResetCall = () => {
    setCheckedItems({});
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setPickupAddress("");
    setDropoffAddress("");
    setMoveDate("");
    setMoveSize("2br");
    setSelectedAddOns([]);
    setIsStudent(false);
    setIsMilitary(false);
    setIsExpress(false);
    setCallNotes("");
    toast({
      title: "Call Script Reset",
      description: "Ready for your next inbound or outbound sales call!",
    });
  };

  const handleCopyQuoteSummary = () => {
    const summary = `Wont Stop Moving - Official Quote
Customer: ${customerName || "Valued Customer"}
Move Size: ${MOVE_PRICING[moveSize]?.description || moveSize}
Origin: ${pickupAddress || "TBD"} -> Destination: ${dropoffAddress || "TBD"}
Target Date: ${moveDate || "Flexible"}
Add-Ons: ${selectedAddOns.length ? selectedAddOns.join(", ") : "Standard Protection"}
Estimated Flat-Rate Total: $${estimatedTotal.toLocaleString()}
Book online: https://wontstopmoving.com/login?role=customer`;

    navigator.clipboard.writeText(summary);
    toast({
      title: "Quote Copied to Clipboard",
      description: "You can paste this directly into an email or SMS to the customer.",
    });
  };

  const handleSaveQuoteToSystem = async () => {
    if (!customerName || !customerEmail) {
      toast({
        variant: "destructive",
        title: "Customer Name & Email Required",
        description: "Please fill in the customer's name and email before saving the quote.",
      });
      return;
    }

    setIsSavingQuote(true);
    try {
      await addDoc(collection(firestore, "quotes"), {
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
        pickupAddress,
        dropoffAddress,
        moveDate,
        moveSize,
        addOns: selectedAddOns,
        isStudent,
        isMilitary,
        isExpress,
        estimatedTotal,
        notes: callNotes,
        checklistProgress: `${completedCount}/${totalItems}`,
        salesRepId: user?.uid || "sales_rep",
        status: "new",
        createdAt: serverTimestamp(),
      });

      toast({
        title: "Quote & Call Log Saved!",
        description: `Saved $${estimatedTotal.toLocaleString()} quote for ${customerName}.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Could Not Save to Firestore",
        description:
          error.message || "Make sure you are signed in, or use 'Copy Quote Summary'.",
      });
    } finally {
      setIsSavingQuote(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Call Progress Bar */}
      <Card className="border-none shadow-lg bg-primary text-white rounded-3xl overflow-hidden">
        <CardContent className="p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-accent text-white border-none text-[10px] font-black uppercase tracking-widest">
                Live Sales Call Playbook
              </Badge>
              <span className="text-xs font-bold text-white/70">
                {completedCount} of {totalItems} steps checked off ({progressPercent}%)
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter flex items-center gap-3">
              <PhoneCall className="h-7 w-7 text-accent" />
              Sales Call <span className="text-accent">Script & Checklist</span>
            </h1>
            <p className="text-xs sm:text-sm text-white/70 max-w-2xl">
              Check off each talking point as you qualify the customer, build value, handle objections, and lock in the move.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center md:items-end gap-3 min-w-[240px]">
            <div className="w-full space-y-1.5">
              <div className="flex justify-between text-xs font-black uppercase">
                <span>Call Completion</span>
                <span className="text-accent">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2.5 bg-white/10" />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetCall}
              className="border-white/20 bg-white/10 text-white hover:bg-white hover:text-primary font-bold uppercase text-xs rounded-xl gap-2"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset for Next Call
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 7 Columns: Interactive Step-by-Step Script & Objection Handlers */}
        <div className="lg:col-span-7 space-y-6">
          {CALL_PHASES.map((phase) => {
            const phaseDoneCount = phase.items.filter(
              (item) => checkedItems[item.id]
            ).length;
            const allPhaseDone = phaseDoneCount === phase.items.length;

            return (
              <Card
                key={phase.id}
                className={`border-2 transition-all rounded-2xl overflow-hidden shadow-sm ${
                  allPhaseDone
                    ? "border-green-500/40 bg-green-50/10"
                    : "border-transparent bg-white"
                }`}
              >
                <CardHeader className="bg-slate-50/80 border-b border-gray-100 py-4 px-6 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge
                      className={
                        allPhaseDone
                          ? "bg-green-600 text-white border-none text-[10px] font-black uppercase"
                          : "bg-primary text-white border-none text-[10px] font-black uppercase"
                      }
                    >
                      {phase.phase}
                    </Badge>
                    <CardTitle className="text-base sm:text-lg font-black text-primary uppercase tracking-tight">
                      {phase.title}
                    </CardTitle>
                  </div>
                  <span className="text-xs font-black text-muted-foreground uppercase">
                    {phaseDoneCount}/{phase.items.length} Done
                  </span>
                </CardHeader>

                <CardContent className="p-6 space-y-4">
                  {phase.items.map((item) => {
                    const isChecked = Boolean(checkedItems[item.id]);
                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleChecklist(item.id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer select-none ${
                          isChecked
                            ? "bg-green-50/60 border-green-300"
                            : "bg-gray-50/70 border-gray-200/80 hover:border-accent"
                        }`}
                      >
                        <div className="flex items-start gap-3.5">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => toggleChecklist(item.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 h-5 w-5 rounded-md"
                          />
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p
                                className={`font-black text-sm uppercase tracking-tight ${
                                  isChecked
                                    ? "line-through text-green-800"
                                    : "text-primary"
                                }`}
                              >
                                {item.label}
                              </p>
                              {isChecked && (
                                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                              )}
                            </div>
                            <p className="text-sm text-slate-700 bg-white p-3.5 rounded-xl border border-slate-100 italic leading-relaxed font-medium">
                              {item.script
                                .replace(
                                  "[Customer Name]",
                                  customerName || "there"
                                )
                                .replace(
                                  "[Move Size]",
                                  MOVE_PRICING[moveSize]?.description || moveSize
                                )
                                .replace(
                                  "[Total Price]",
                                  estimatedTotal.toLocaleString()
                                )
                                .replace(
                                  "[Move Date]",
                                  moveDate || "your preferred date"
                                )}
                            </p>
                            {item.tip && (
                              <p className="text-[11px] font-bold text-accent flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5" /> Pro Tip:{" "}
                                {item.tip}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}

          {/* Objection Handling Quick-Reference */}
          <Card className="border-none shadow-md bg-white rounded-2xl overflow-hidden">
            <CardHeader className="bg-amber-50 border-b border-amber-100 py-4 px-6">
              <CardTitle className="text-base font-black text-amber-900 uppercase tracking-tight flex items-center gap-2">
                <MessageSquareWarning className="h-5 w-5 text-amber-600" />
                Live Objection Rebuttals (Click to Expand)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <Accordion type="single" collapsible className="space-y-2">
                {OBJECTION_HANDLERS.map((obj) => (
                  <AccordionItem
                    key={obj.id}
                    value={obj.id}
                    className="border border-amber-200/60 rounded-xl px-4 bg-amber-50/20"
                  >
                    <AccordionTrigger className="font-black text-sm text-primary hover:no-underline">
                      {obj.objection}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-700 leading-relaxed bg-white p-4 rounded-xl border mb-3 italic">
                      {obj.response}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>

        {/* Right 5 Columns: Live Quote Calculator & Customer Call Notes */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
          <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-accent" />
                  Live Quote Calculator
                </CardTitle>
                <Badge className="bg-accent text-white border-none text-xs font-black">
                  ${estimatedTotal.toLocaleString()}
                </Badge>
              </div>
              <p className="text-xs text-slate-400">
                Updates the script talking points in real time as you fill in the call details.
              </p>
            </CardHeader>

            <CardContent className="p-6 space-y-5">
              {/* Customer Lead Info */}
              <div className="space-y-3">
                <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  1. Customer Contact Details
                </Label>
                <Input
                  placeholder="Customer Full Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-11 rounded-xl"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Phone Number"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                  <Input
                    type="email"
                    placeholder="Email Address"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Pickup City / Address"
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                  <Input
                    placeholder="Dropoff City / Address"
                    value={dropoffAddress}
                    onChange={(e) => setDropoffAddress(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
                <Input
                  type="date"
                  value={moveDate}
                  onChange={(e) => setMoveDate(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>

              {/* Move Size */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  2. Property / Move Size
                </Label>
                <Select value={moveSize} onValueChange={setMoveSize}>
                  <SelectTrigger className="h-12 rounded-xl font-bold">
                    <SelectValue placeholder="Select Move Size" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MOVE_PRICING).map(([key, plan]) => (
                      <SelectItem key={key} value={key} className="font-bold">
                        {plan.description} (${plan.baseFee.toLocaleString()} base)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Add-Ons */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  3. Add-On Services (Check all that apply)
                </Label>
                <div className="space-y-2">
                  {Object.keys(ADDON_PRICING).map((addonKey) => (
                    <div
                      key={addonKey}
                      onClick={() => toggleAddOn(addonKey)}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 hover:border-accent/40 cursor-pointer bg-gray-50/50"
                    >
                      <div className="flex items-center gap-2.5">
                        <Checkbox
                          checked={selectedAddOns.includes(addonKey)}
                          onCheckedChange={() => toggleAddOn(addonKey)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-xs font-bold text-primary">
                          {ADDON_LABELS[addonKey] || addonKey}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Priority & Discounts */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  4. Priority & Discounts
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsExpress(!isExpress)}
                    className={`p-2.5 rounded-xl border text-[11px] font-black uppercase transition-all ${
                      isExpress
                        ? "bg-accent text-white border-accent"
                        : "bg-gray-50 text-primary border-gray-200"
                    }`}
                  >
                    Express (+25%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsStudent(!isStudent)}
                    className={`p-2.5 rounded-xl border text-[11px] font-black uppercase transition-all ${
                      isStudent
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-gray-50 text-primary border-gray-200"
                    }`}
                  >
                    Student (-5%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMilitary(!isMilitary)}
                    className={`p-2.5 rounded-xl border text-[11px] font-black uppercase transition-all ${
                      isMilitary
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-gray-50 text-primary border-gray-200"
                    }`}
                  >
                    Military (-5%)
                  </button>
                </div>
              </div>

              {/* Price Summary Box */}
              <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase text-slate-400">
                    Customer Flat-Rate Total
                  </span>
                  <span className="text-3xl font-black text-accent">
                    ${estimatedTotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 pt-2 border-t border-white/10">
                  <span>Platform Fee (15%): ${platformFee.toLocaleString()}</span>
                  <span>Provider Payout (85%): ${providerPayout.toLocaleString()}</span>
                </div>
              </div>

              {/* Call Notes */}
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  Call Notes & Special Instructions
                </Label>
                <Textarea
                  placeholder="Gate code, elevator hours, parking notes, items discussed..."
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  className="min-h-[80px] rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopyQuoteSummary}
                  className="h-12 rounded-xl font-black uppercase text-xs tracking-wider gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Copy Quote
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveQuoteToSystem}
                  disabled={isSavingQuote}
                  className="h-12 bg-accent hover:bg-accent/90 text-white rounded-xl font-black uppercase text-xs tracking-wider gap-2 shadow-lg shadow-accent/20"
                >
                  <Save className="h-4 w-4" />
                  {isSavingQuote ? "Saving..." : "Save Quote"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

