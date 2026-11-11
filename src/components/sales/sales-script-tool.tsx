"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PhoneCall, PhoneIncoming, PhoneOutgoing, CheckCircle2, RotateCcw, Calculator, Copy, Sparkles, ShieldCheck, MessageSquareWarning, Save, CalendarClock, Target } from "lucide-react";
import { MOVE_PRICING, ADDON_PRICING, MILEAGE, calculateMoveTotal } from "@/lib/pricing";
import { useAuth } from "@/firebase";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { buildScript, CALL_TYPES, SERVICES, OBJECTIONS, DISPOSITIONS, COMPLIANCE_NOTES, type CallTypeId, type ServiceId, type Disposition, type Objection } from "@/lib/sales-playbook";

const ADDON_LABELS: Record<string, string> = {
  packing: "Packing", crating: "Specialty crating", cleaning: "Move-out cleaning", junk: "Junk removal (¼ truck)",
  assembly: "Disassembly / assembly", storage: "Storage", piano: "Piano / specialty item",
};

type FollowUp = { id: string; customerName: string; customerPhone: string; customerEmail: string; callType: CallTypeId; service: ServiceId; disposition: Disposition; estimatedTotal: number | null; notes: string; repName: string; followUpAt: string | null };

/** `datetime-local` value for a date in the rep's own time zone. */
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const tomorrowAt10 = () => { const d = new Date(Date.now() + 86400000); d.setHours(10, 0, 0, 0); return toLocalInput(d); };

export function SalesScriptTool() {
  const auth = useAuth();
  const { toast } = useToast();

  const [callType, setCallType] = useState<CallTypeId>("inbound");
  const [service, setService] = useState<ServiceId>("residential");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [objectionFilter, setObjectionFilter] = useState<Objection["category"] | "All">("All");

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [moveDate, setMoveDate] = useState("");
  const [moveSize, setMoveSize] = useState<string>("2br");
  const [addOns, setAddOns] = useState<string[]>([]);
  const [isStudent, setIsStudent] = useState(false);
  const [isMilitary, setIsMilitary] = useState(false);
  const [isExpress, setIsExpress] = useState(false);
  const [notes, setNotes] = useState("");
  const [disposition, setDisposition] = useState<Disposition | "">("");
  const [followUpAt, setFollowUpAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);

  // Opened from the lead inbox: prefill the lead's details.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const lead = p.get("lead");
    if (!lead || !/^[A-Za-z0-9_-]{1,128}$/.test(lead)) return;
    setLeadId(lead);
    const type = p.get("callType");
    if (type && CALL_TYPES.some(t => t.id === type)) setCallType(type as CallTypeId);
    setCustomerName(p.get("name") || ""); setCustomerPhone(p.get("phone") || ""); setCustomerEmail(p.get("email") || ""); setMoveDate(p.get("date") || "");
  }, []);

  const [followUps, setFollowUps] = useState<FollowUp[] | null>(null);
  const [followUpError, setFollowUpError] = useState("");

  const callTypeInfo = CALL_TYPES.find(t => t.id === callType)!;
  const serviceInfo = SERVICES.find(s => s.id === service)!;
  const phases = useMemo(() => buildScript(callType, service), [callType, service]);
  const totalItems = phases.reduce((n, p) => n + p.items.length, 0);
  const doneCount = phases.reduce((n, p) => n + p.items.filter(i => checked[i.id]).length, 0);
  const progress = totalItems ? Math.round((doneCount / totalItems) * 100) : 0;
  const showsQuote = callType !== "service" && callType !== "past-customer";

  // Road miles between the ZIP codes in the pickup/drop-off fields (if both contain one).
  const [miles, setMiles] = useState<number | null>(null);
  const pickupZip = (pickup.match(/\b\d{5}\b/g) || []).pop() || "", dropoffZip = (dropoff.match(/\b\d{5}\b/g) || []).pop() || "";
  useEffect(() => {
    if (!pickupZip || !dropoffZip) { setMiles(null); return; }
    let cancelled = false;
    fetch(`/api/distance?from=${pickupZip}&to=${dropoffZip}`).then(r => r.json()).then(d => { if (!cancelled) setMiles(typeof d.miles === "number" ? d.miles : null); }).catch(() => {});
    return () => { cancelled = true; };
  }, [pickupZip, dropoffZip]);
  const total = calculateMoveTotal(moveSize, addOns, { isStudent, isMilitary, isExpress, miles });
  const platformFee = Math.round(total * 0.15);
  const dispositionInfo = DISPOSITIONS.find(d => d.id === disposition);

  const fill = (text: string) => text
    .replaceAll("[Customer Name]", customerName || "there")
    .replaceAll("[Move Size]", MOVE_PRICING[moveSize]?.description || moveSize)
    .replaceAll("[Total Price]", total.toLocaleString())
    .replaceAll("[Move Date]", moveDate || "your date")
    .replaceAll("[Service]", serviceInfo.label.toLowerCase())
    .replaceAll("[Pickup]", pickup || "your pickup address")
    .replaceAll("[Dropoff]", dropoff || "your new address");

  const loadFollowUps = useCallback(async () => {
    try { setFollowUps((await apiFetch<{ followUps: FollowUp[] }>(auth, "/api/sales/calls")).followUps); setFollowUpError(""); }
    catch (e) { setFollowUps([]); setFollowUpError(e instanceof Error ? e.message : "Could not load follow-ups."); }
  }, [auth]);
  useEffect(() => { void loadFollowUps(); }, [loadFollowUps]);

  useEffect(() => { if (dispositionInfo?.needsFollowUp && !followUpAt) setFollowUpAt(tomorrowAt10()); }, [dispositionInfo, followUpAt]);

  const toggle = (id: string) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleAddOn = (key: string) => setAddOns(prev => prev.includes(key) ? prev.filter(a => a !== key) : [...prev, key]);

  const reset = () => {
    setChecked({}); setCustomerName(""); setCustomerEmail(""); setCustomerPhone(""); setPickup(""); setDropoff("");
    setMoveDate(""); setMoveSize("2br"); setAddOns([]); setIsStudent(false); setIsMilitary(false); setIsExpress(false);
    setNotes(""); setDisposition(""); setFollowUpAt(""); setLeadId(null);
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
  };

  const copySummary = async () => {
    const text = `Wont Stop Moving quote
Customer: ${customerName || "—"}
Service: ${serviceInfo.label}
Move size: ${MOVE_PRICING[moveSize]?.description || moveSize}
From: ${pickup || "TBD"}  To: ${dropoff || "TBD"}
Date: ${moveDate || "Flexible"}
Add-ons: ${addOns.length ? addOns.map(a => ADDON_LABELS[a] || a).join(", ") : "None"}
Estimated total: $${total.toLocaleString()}${miles ? ` (about ${miles} road miles)` : ''}
Get your instant quote and book online: https://wontstopmoving.com/quote
Your mover is paid only after you confirm the job is done.`;
    try { await navigator.clipboard.writeText(text); toast({ title: "Quote summary copied", description: "Paste it into an email or text to the customer." }); }
    catch { toast({ variant: "destructive", title: "Couldn't copy", description: "Your browser blocked clipboard access." }); }
  };

  const saveCall = async () => {
    if (!disposition) { toast({ variant: "destructive", title: "Choose the call outcome first" }); return; }
    setSaving(true);
    try {
      await apiFetch(auth, "/api/sales/calls", {
        action: "log", callType, service, disposition, customerName, customerPhone, customerEmail, pickup, dropoff, moveDate,
        moveSize: showsQuote ? moveSize : undefined, addOns: showsQuote ? addOns : [], isStudent, isMilitary, isExpress,
        notes, checklistProgress: `${doneCount}/${totalItems}`, leadId: leadId || undefined, followUpAt: followUpAt ? new Date(followUpAt).toISOString() : undefined,
      });
      toast({ title: "Call logged", description: followUpAt && dispositionInfo?.needsFollowUp ? `Follow-up set for ${new Date(followUpAt).toLocaleString()}.` : "Saved to the call log." });
      reset();
      void loadFollowUps();
    } catch (e) {
      toast({ variant: "destructive", title: "Couldn't save the call", description: e instanceof Error ? e.message : "Please try again." });
    } finally { setSaving(false); }
  };

  const markDone = async (id: string) => {
    try { await apiFetch(auth, "/api/sales/calls", { action: "done", id }); void loadFollowUps(); }
    catch (e) { toast({ variant: "destructive", title: "Couldn't update", description: e instanceof Error ? e.message : "Please try again." }); }
  };

  const startFollowUp = (f: FollowUp) => {
    reset();
    setCallType(f.callType === "inbound" || f.callType === "web-lead" ? "quote-followup" : f.callType);
    setService(f.service); setCustomerName(f.customerName); setCustomerPhone(f.customerPhone); setCustomerEmail(f.customerEmail);
    setNotes(f.notes ? `Previous notes: ${f.notes}\n` : "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const now = Date.now();
  const due = (followUps || []).filter(f => f.followUpAt && Date.parse(f.followUpAt) <= now);
  const upcoming = (followUps || []).filter(f => !f.followUpAt || Date.parse(f.followUpAt) > now);
  const objections = OBJECTIONS.filter(o => objectionFilter === "All" || o.category === objectionFilter);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <Card className="border-none shadow-lg bg-primary text-white rounded-3xl overflow-hidden">
        <CardContent className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <Badge className="bg-accent text-white border-none text-[10px] font-black uppercase tracking-widest">Sales & service playbook</Badge>
              <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter flex items-center gap-3">
                <PhoneCall className="h-7 w-7 text-accent" /> Call <span className="text-accent">Playbook</span>
              </h1>
              {leadId && <p className="text-xs font-bold text-accent">Calling a lead from the inbox. Logging this call marks it contacted.</p>}
              <p className="text-sm text-white/70 max-w-2xl">Pick the call type and service. The script, questions and close adapt to the call. Check off each step, log the outcome, and set a follow-up.</p>
            </div>
            <div className="min-w-[240px] space-y-3">
              <div className="flex justify-between text-xs font-black uppercase"><span>Call progress</span><span className="text-accent">{doneCount}/{totalItems}</span></div>
              <Progress value={progress} className="h-2.5 bg-white/10" />
              <Button type="button" variant="outline" size="sm" onClick={reset} className="w-full border-white/20 bg-white/10 text-white hover:bg-white hover:text-primary font-bold uppercase text-xs rounded-xl gap-2">
                <RotateCcw className="h-3.5 w-3.5" /> New call
              </Button>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-black uppercase tracking-widest text-white/70">Call type</Label>
              <Select value={callType} onValueChange={v => { setCallType(v as CallTypeId); setChecked({}); }}>
                <SelectTrigger className="h-12 rounded-xl font-bold bg-white text-primary"><SelectValue /></SelectTrigger>
                <SelectContent>{CALL_TYPES.map(t => <SelectItem key={t.id} value={t.id} className="font-bold">{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-black uppercase tracking-widest text-white/70">Service</Label>
              <Select value={service} onValueChange={v => { setService(v as ServiceId); setChecked({}); }} disabled={callType === "service" || callType === "past-customer" || callType === "commercial-prospect"}>
                <SelectTrigger className="h-12 rounded-xl font-bold bg-white text-primary"><SelectValue /></SelectTrigger>
                <SelectContent>{SERVICES.map(s => <SelectItem key={s.id} value={s.id} className="font-bold">{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-sm flex items-start gap-2 text-white/90">
            {callTypeInfo.direction === "Inbound" ? <PhoneIncoming className="h-4 w-4 text-accent mt-0.5 shrink-0" /> : <PhoneOutgoing className="h-4 w-4 text-accent mt-0.5 shrink-0" />}
            <span><strong className="uppercase text-xs tracking-widest">{callTypeInfo.direction} goal:</strong> {callTypeInfo.goal}</span>
          </p>
        </CardContent>
      </Card>

      {/* Follow-up queue */}
      <Card className="border-none shadow-md bg-white rounded-2xl overflow-hidden">
        <CardHeader className="bg-slate-50 border-b py-4 px-6 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-black text-primary uppercase tracking-tight flex items-center gap-2"><CalendarClock className="h-5 w-5 text-accent" /> Follow-ups</CardTitle>
          <span className="text-xs font-black uppercase text-muted-foreground">{due.length} due · {upcoming.length} upcoming</span>
        </CardHeader>
        <CardContent className="p-6">
          {followUps === null ? <p className="text-sm text-muted-foreground">Loading follow-ups…</p>
            : followUpError ? <p className="text-sm text-muted-foreground" role="status">{followUpError}</p>
            : followUps.length === 0 ? <p className="text-sm text-muted-foreground">No follow-ups scheduled. Calls you log with a follow-up date appear here.</p>
            : <div className="space-y-2">{[...due, ...upcoming].slice(0, 25).map(f => {
                const overdue = f.followUpAt && Date.parse(f.followUpAt) <= now;
                return <div key={f.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border ${overdue ? "border-amber-300 bg-amber-50/50" : "border-gray-100"}`}>
                  <div className="min-w-0">
                    <p className="font-bold text-primary text-sm">{f.customerName} <span className="font-medium text-muted-foreground">· {CALL_TYPES.find(t => t.id === f.callType)?.label.split(":").pop()?.trim()} · {SERVICES.find(s => s.id === f.service)?.label}</span></p>
                    <p className="text-xs text-muted-foreground">{overdue ? "Due" : "Scheduled"} {f.followUpAt ? new Date(f.followUpAt).toLocaleString() : ""}{f.estimatedTotal ? ` · $${f.estimatedTotal.toLocaleString()}` : ""}{f.customerPhone ? ` · ${f.customerPhone}` : ""} · {f.repName}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {f.customerPhone && <Button asChild size="sm" variant="outline"><a href={`tel:${f.customerPhone}`}>Call</a></Button>}
                    <Button size="sm" onClick={() => startFollowUp(f)}>Start call</Button>
                    <Button size="sm" variant="ghost" onClick={() => void markDone(f.id)}>Done</Button>
                  </div>
                </div>;
              })}</div>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Script */}
        <div className="lg:col-span-7 space-y-6">
          {phases.map((phase, index) => {
            const phaseDone = phase.items.filter(i => checked[i.id]).length;
            const allDone = phaseDone === phase.items.length;
            return (
              <Card key={`${callType}-${service}-${phase.id}`} className={`border-2 rounded-2xl overflow-hidden shadow-sm ${allDone ? "border-green-500/40" : "border-transparent bg-white"}`}>
                <CardHeader className="bg-slate-50/80 border-b border-gray-100 py-4 px-6 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className={`${allDone ? "bg-green-600" : "bg-primary"} text-white border-none text-[10px] font-black uppercase`}>Step {index + 1}</Badge>
                    <CardTitle className="text-base sm:text-lg font-black text-primary uppercase tracking-tight">{phase.title}</CardTitle>
                  </div>
                  <span className="text-xs font-black text-muted-foreground uppercase">{phaseDone}/{phase.items.length}</span>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {phase.items.map(item => {
                    const isChecked = !!checked[item.id];
                    return (
                      <div key={item.id} onClick={() => toggle(item.id)} className={`p-4 rounded-2xl border cursor-pointer select-none transition-all ${isChecked ? "bg-green-50/60 border-green-300" : "bg-gray-50/70 border-gray-200/80 hover:border-accent"}`}>
                        <div className="flex items-start gap-3.5">
                          <Checkbox checked={isChecked} onCheckedChange={() => toggle(item.id)} onClick={e => e.stopPropagation()} className="mt-1 h-5 w-5 rounded-md" aria-label={item.label} />
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className={`font-black text-sm uppercase tracking-tight ${isChecked ? "line-through text-green-800" : "text-primary"}`}>{item.label}</p>
                              {isChecked && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
                            </div>
                            <p className="text-sm text-slate-700 bg-white p-3.5 rounded-xl border border-slate-100 italic leading-relaxed font-medium">{fill(item.script)}</p>
                            {item.tip && <p className="text-[11px] font-bold text-accent flex items-start gap-1.5"><Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {item.tip}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}

          {/* Objections */}
          <Card className="border-none shadow-md bg-white rounded-2xl overflow-hidden">
            <CardHeader className="bg-amber-50 border-b border-amber-100 py-4 px-6 space-y-3">
              <CardTitle className="text-base font-black text-amber-900 uppercase tracking-tight flex items-center gap-2"><MessageSquareWarning className="h-5 w-5 text-amber-600" /> Objection library</CardTitle>
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Objection type">
                {(["All", "Price", "Competition", "Timing", "Decision", "Trust"] as const).map(c =>
                  <Button key={c} size="sm" role="tab" aria-selected={objectionFilter === c} variant={objectionFilter === c ? "default" : "outline"} onClick={() => setObjectionFilter(c)} className="h-8 text-xs">{c}</Button>)}
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-xs text-muted-foreground mb-3">Acknowledge, ask a question to find the real concern, answer it, then ask for the next step.</p>
              <Accordion type="single" collapsible className="space-y-2">
                {objections.map(o => (
                  <AccordionItem key={o.id} value={o.id} className="border border-amber-200/60 rounded-xl px-4 bg-amber-50/20">
                    <AccordionTrigger className="font-black text-sm text-primary hover:no-underline text-left">{o.objection}</AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-700 leading-relaxed bg-white p-4 rounded-xl border mb-3 italic">{fill(o.response)}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          {/* Compliance */}
          <Card className="border-none shadow-sm bg-white rounded-2xl">
            <CardContent className="p-6 space-y-3">
              <p className="text-sm font-black uppercase tracking-tight text-primary flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-accent" /> Calling rules</p>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-700">{COMPLIANCE_NOTES.map(n => <li key={n}>{n}</li>)}</ul>
            </CardContent>
          </Card>
        </div>

        {/* Customer, quote and outcome */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
          <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2"><Calculator className="h-5 w-5 text-accent" /> {showsQuote ? "Customer & quote" : "Customer"}</CardTitle>
                {showsQuote && <Badge className="bg-accent text-white border-none text-xs font-black">${total.toLocaleString()}</Badge>}
              </div>
              <p className="text-xs text-slate-400">The script fills in these details as you type.</p>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="space-y-3">
                <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Contact</Label>
                <Input placeholder="Customer or company name" value={customerName} onChange={e => setCustomerName(e.target.value)} className="h-11 rounded-xl" />
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="h-11 rounded-xl" />
                  <Input type="email" placeholder="Email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className="h-11 rounded-xl" />
                </div>
                {showsQuote && <>
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="Pickup city / address" value={pickup} onChange={e => setPickup(e.target.value)} className="h-11 rounded-xl" />
                    <Input placeholder="Drop-off city / address" value={dropoff} onChange={e => setDropoff(e.target.value)} className="h-11 rounded-xl" />
                  </div>
                  <Input type="date" value={moveDate} onChange={e => setMoveDate(e.target.value)} className="h-11 rounded-xl" aria-label="Move date" />
                </>}
              </div>

              {showsQuote && <>
                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Size</Label>
                  <Select value={moveSize} onValueChange={setMoveSize}>
                    <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(MOVE_PRICING).map(([key, plan]) => <SelectItem key={key} value={key} className="font-bold">{plan.description} (${plan.baseFee.toLocaleString()} base)</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Add-ons <span className="normal-case font-medium tracking-normal">(suggested for {serviceInfo.label.toLowerCase()} marked ★)</span></Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.keys(ADDON_PRICING).map(key => (
                      <label key={key} className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer ${serviceInfo.addOns.includes(key) ? "border-accent/40 bg-accent/5" : "border-gray-100 bg-gray-50/50"}`}>
                        <Checkbox checked={addOns.includes(key)} onCheckedChange={() => toggleAddOn(key)} />
                        <span className="text-xs font-bold text-primary">{serviceInfo.addOns.includes(key) ? "★ " : ""}{ADDON_LABELS[key] || key} (+${ADDON_PRICING[key]})</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                  {([["Express (+25%)", isExpress, setIsExpress], ["Student (−5%)", isStudent, setIsStudent], ["Military (−5%)", isMilitary, setIsMilitary]] as const).map(([label, on, set]) =>
                    <button key={label} type="button" aria-pressed={on} onClick={() => set(!on)} className={`p-2.5 rounded-xl border text-[11px] font-black uppercase ${on ? "bg-primary text-white border-primary" : "bg-gray-50 text-primary border-gray-200"}`}>{label}</button>)}
                </div>
                <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-2">
                  <div className="flex justify-between items-center"><span className="text-xs font-bold uppercase text-slate-400">Estimated total</span><span className="text-3xl font-black text-accent">${total.toLocaleString()}</span></div>
                  <p className="text-xs text-slate-400">{miles ? `About ${miles.toLocaleString()} road miles${miles > MILEAGE.longDistanceMiles ? " · long distance: confirm a fixed price" : ""} (first ${MILEAGE.includedMiles} included, then $${MILEAGE.perMile}/mile)` : "Add ZIP codes to pickup and drop-off to include distance."}</p>
                  <div className="flex justify-between text-[11px] text-slate-400 pt-2 border-t border-white/10"><span>Platform fee (15%): ${platformFee.toLocaleString()}</span><span>Provider (85%): ${(total - platformFee).toLocaleString()}</span></div>
                </div>
              </>}

              <div className="space-y-2">
                <Label htmlFor="call-notes" className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Notes</Label>
                <Textarea id="call-notes" placeholder="Access details, concerns, what they compared us to, promises made…" value={notes} onChange={e => setNotes(e.target.value)} className="min-h-[90px] rounded-xl" />
              </div>

              <div className="space-y-3 pt-2 border-t">
                <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Target className="h-3.5 w-3.5" /> Call outcome</Label>
                <Select value={disposition} onValueChange={v => setDisposition(v as Disposition)}>
                  <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue placeholder="How did the call end?" /></SelectTrigger>
                  <SelectContent>{DISPOSITIONS.map(d => <SelectItem key={d.id} value={d.id} className="font-bold">{d.label}</SelectItem>)}</SelectContent>
                </Select>
                {disposition && disposition !== "do-not-call" && (
                  <div className="space-y-1">
                    <Label htmlFor="follow-up" className="text-xs font-bold">Follow up {dispositionInfo?.needsFollowUp ? "(required)" : "(optional)"}</Label>
                    <Input id="follow-up" type="datetime-local" value={followUpAt} onChange={e => setFollowUpAt(e.target.value)} className="h-11 rounded-xl" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {showsQuote && <Button type="button" variant="outline" onClick={() => void copySummary()} className="h-12 rounded-xl font-black uppercase text-xs tracking-wider gap-2"><Copy className="h-4 w-4" /> Copy quote</Button>}
                <Button type="button" onClick={() => void saveCall()} disabled={saving} className={`h-12 bg-accent hover:bg-accent/90 text-white rounded-xl font-black uppercase text-xs tracking-wider gap-2 ${showsQuote ? "" : "sm:col-span-2"}`}>
                  <Save className="h-4 w-4" /> {saving ? "Saving…" : "Log call"}
                </Button>
              </div>
              {showsQuote && <p className="text-[11px] text-muted-foreground">To book, send the customer to wontstopmoving.com/quote, or create a custom quote in Admin → Quotes for a link they can pay from.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
