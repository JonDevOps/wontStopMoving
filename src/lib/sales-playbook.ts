/**
 * Sales and service call playbook. A script is assembled from the call type
 * (who called whom, and why) and the service being discussed.
 *
 * Accuracy rules for every line here (calls may be recorded and quoted back):
 * - Only promise what the platform does: instant quotes, online booking,
 *   card payment through Stripe, ID-verified independent movers, and the
 *   mover is paid only after the customer confirms with a 6-digit code.
 * - No invented scarcity ("2 slots left"), guarantees, insurance claims or
 *   reschedule policies. Where policy varies, the rep checks and says so.
 * Placeholders: [Your Name], [Customer Name], [Move Size], [Total Price],
 * [Move Date], [Service], [Pickup], [Dropoff].
 */

export type ScriptLine = { id: string; label: string; script: string; tip?: string };
export type ScriptPhase = { id: string; title: string; items: ScriptLine[] };

export type CallTypeId = 'inbound' | 'web-lead' | 'quote-followup' | 'past-customer' | 'commercial-prospect' | 'service';
export type ServiceId = 'residential' | 'long-distance' | 'commercial' | 'specialty' | 'junk-removal' | 'cleaning' | 'storage' | 'labor-only' | 'military-student';

export const CALL_TYPES: { id: CallTypeId; label: string; direction: 'Inbound' | 'Outbound'; goal: string }[] = [
  { id: 'inbound', label: 'Inbound: new caller', direction: 'Inbound', goal: 'Qualify, quote and book on this call.' },
  { id: 'web-lead', label: 'Outbound: new web lead (call within 5 minutes)', direction: 'Outbound', goal: 'Reach the lead while they are still shopping, confirm details, quote and book.' },
  { id: 'quote-followup', label: 'Outbound: unbooked quote follow-up', direction: 'Outbound', goal: 'Find what is holding them back, resolve it, and book or set a firm next step.' },
  { id: 'past-customer', label: 'Outbound: past customer (review, referral, repeat)', direction: 'Outbound', goal: 'Check satisfaction, ask for a review and referrals, and offer related services.' },
  { id: 'commercial-prospect', label: 'Outbound: business prospect (B2B)', direction: 'Outbound', goal: 'Reach the decision maker, find an upcoming move or recurring need, and set a walkthrough or proposal.' },
  { id: 'service', label: 'Customer service: existing booking', direction: 'Inbound', goal: 'Solve the problem on the first call, document it, and keep the customer.' },
];

export const SERVICES: { id: ServiceId; label: string; addOns: string[] }[] = [
  { id: 'residential', label: 'Local home move', addOns: ['packing', 'assembly', 'cleaning', 'junk'] },
  { id: 'long-distance', label: 'Long-distance / interstate move', addOns: ['packing', 'storage', 'crating', 'assembly'] },
  { id: 'commercial', label: 'Office / commercial move', addOns: ['packing', 'assembly', 'storage', 'junk'] },
  { id: 'specialty', label: 'Specialty item (piano, safe, art, antiques)', addOns: ['piano', 'crating'] },
  { id: 'junk-removal', label: 'Junk removal', addOns: ['junk', 'cleaning'] },
  { id: 'cleaning', label: 'Move-in / move-out cleaning', addOns: ['cleaning', 'junk'] },
  { id: 'storage', label: 'Storage', addOns: ['storage', 'packing'] },
  { id: 'labor-only', label: 'Labor only (loading / unloading help)', addOns: ['assembly', 'packing'] },
  { id: 'military-student', label: 'Military PCS or student move', addOns: ['packing', 'storage'] },
];

// ---------- Openings (by call type) ----------
const OPENINGS: Record<CallTypeId, ScriptLine[]> = {
  inbound: [
    { id: 'in_open_1', label: 'Greet, give your name, get theirs', script: '"Thank you for calling Wont Stop Moving, this is [Your Name]. Who am I speaking with?"' },
    { id: 'in_open_2', label: 'Find out why they called', script: '"Thanks, [Customer Name]. What can I help you with today, are you planning a move or another service?"' },
    { id: 'in_open_3', label: 'Get callback details early', script: '"In case we get disconnected, what\'s the best number and email for you? I\'ll send your quote there too."' },
    { id: 'in_open_4', label: 'Set the agenda', script: '"I\'ll ask a few quick questions, give you a price on this call, and if it works for you, we can book it right away. Sound good?"' },
  ],
  'web-lead': [
    { id: 'wl_open_1', label: 'Introduce and reference their request', script: '"Hi, is this [Customer Name]? This is [Your Name] with Wont Stop Moving. You just requested a moving quote on our website, do you have two minutes?"', tip: 'Call within 5 minutes of the request. Speed is the single biggest factor in reaching and converting web leads.' },
    { id: 'wl_open_2', label: 'If it is a bad time, book a callback', script: '"No problem. When is a better time today, would [time] or [time] work?"' },
    { id: 'wl_open_3', label: 'Confirm they asked to be contacted', script: '"I see you asked about a [Service] from [Pickup] on [Move Date]. Is that still right?"', tip: 'Only call leads who submitted a request or gave permission. Honor any request to stop calling and note it.' },
  ],
  'quote-followup': [
    { id: 'qf_open_1', label: 'Reference the quote, not a hard sell', script: '"Hi [Customer Name], it\'s [Your Name] from Wont Stop Moving. I\'m following up on the quote for your [Move Size] move on [Move Date]. Did you get a chance to look it over?"' },
    { id: 'qf_open_2', label: 'Ask what is holding them back', script: '"Is there anything about the quote you\'d like to change, or any question I can answer before you decide?"', tip: 'Listen for the real objection: price, timing, trust, or a competing quote. Go to the objection library.' },
  ],
  'past-customer': [
    { id: 'pc_open_1', label: 'Thank them and check satisfaction', script: '"Hi [Customer Name], this is [Your Name] from Wont Stop Moving. We helped with your move recently, and I wanted to check how everything went."' },
    { id: 'pc_open_2', label: 'If anything went wrong, switch to service', script: '"I\'m sorry to hear that. Let me get the details so we can make it right."', tip: 'Switch the call type to Customer service and log the issue before asking for anything.' },
  ],
  'commercial-prospect': [
    { id: 'cp_open_1', label: 'Short, relevant introduction', script: '"Hi, this is [Your Name] with Wont Stop Moving. We help businesses with office moves, equipment moves and storage. Who handles facilities or relocations for your team?"' },
    { id: 'cp_open_2', label: 'Earn 30 seconds with a reason', script: '"I\'m calling because companies your size often have a move, a buildout or an expansion coming up in the next year. Is anything like that on your radar?"', tip: 'Business numbers only. Respect gatekeepers and do-not-call requests, and keep the first call under five minutes.' },
  ],
  service: [
    { id: 'sv_open_1', label: 'Greet and verify the booking', script: '"Thank you for calling Wont Stop Moving, this is [Your Name]. Can I have your name and the email on the booking so I can pull it up?"' },
    { id: 'sv_open_2', label: 'Let them explain fully, then summarize', script: '"Thanks for explaining. So I have it right: [summary]. Is that correct?"', tip: 'Do not interrupt. Summarizing back is the fastest way to calm a frustrated customer.' },
  ],
};

// ---------- Discovery (by service) ----------
const DISCOVERY: Record<ServiceId, ScriptLine[]> = {
  residential: [
    { id: 'res_d1', label: 'Pickup and drop-off', script: '"Where are we picking up from, and where are you moving to?"' },
    { id: 'res_d2', label: 'Home size and how full it is', script: '"How many bedrooms is the home, and would you say it\'s lightly furnished, average, or very full?"' },
    { id: 'res_d3', label: 'Access at both ends', script: '"At each address, is it ground floor, stairs, or an elevator? And how close can a truck park?"', tip: 'Note elevator reservations, building move-in rules and long carries. They change time and cost.' },
    { id: 'res_d4', label: 'Date and flexibility', script: '"What date are you aiming for, and is there any flexibility on that?"' },
  ],
  'long-distance': [
    { id: 'ld_d1', label: 'Origin, destination and timing', script: '"Where are you moving from and to, and when do you need to be out and in?"' },
    { id: 'ld_d2', label: 'Gap between move-out and move-in', script: '"Will you be able to receive your things right away, or is there a gap where you\'ll need storage?"' },
    { id: 'ld_d3', label: 'Inventory and high-value items', script: '"Roughly how much are we moving, and are there any high-value or fragile pieces I should know about?"' },
    { id: 'ld_d4', label: 'Explain how interstate moves are priced', script: '"For a long-distance move, the price depends on volume, distance and timing. I\'ll walk you through exactly what\'s included."', tip: 'Interstate moves have federal rules. Make sure the provider assigned holds the required authority.' },
  ],
  commercial: [
    { id: 'com_d1', label: 'Size and type of space', script: '"How many workstations or people are we moving, and is there specialty equipment like servers or lab gear?"' },
    { id: 'com_d2', label: 'Downtime and timing', script: '"How much downtime can the business afford? Do you need the move done after hours or over a weekend?"' },
    { id: 'com_d3', label: 'Building requirements', script: '"Does either building require a certificate of insurance, elevator reservations or specific move hours?"' },
    { id: 'com_d4', label: 'Decision process', script: '"Who else is involved in choosing a mover, and when do you need a proposal?"' },
  ],
  specialty: [
    { id: 'sp_d1', label: 'Identify the item', script: '"What\'s the item, and do you know its approximate size and weight?"' },
    { id: 'sp_d2', label: 'Path and obstacles', script: '"Are there stairs, tight turns or narrow doorways between the item and the truck at either end?"' },
    { id: 'sp_d3', label: 'Value and protection', script: '"Is it high-value or irreplaceable? If so, we can talk about crating and protection options."' },
  ],
  'junk-removal': [
    { id: 'jr_d1', label: 'What is going and how much', script: '"What are we hauling away, and roughly how much, a few items, a room, or a full garage?"' },
    { id: 'jr_d2', label: 'Restricted items', script: '"Is there anything like paint, chemicals, tires or electronics? Those may need special disposal."' },
    { id: 'jr_d3', label: 'Location and access', script: '"Where is everything located, and is it easy to reach from the driveway?"' },
  ],
  cleaning: [
    { id: 'cl_d1', label: 'Move-in or move-out', script: '"Is this cleaning for the home you\'re leaving or the one you\'re moving into?"' },
    { id: 'cl_d2', label: 'Size and condition', script: '"How many bedrooms and bathrooms, and will it be empty when we clean?"' },
    { id: 'cl_d3', label: 'Deadline', script: '"Is there an inspection or key handoff date we need to finish before?"' },
  ],
  storage: [
    { id: 'st_d1', label: 'How long and how much', script: '"How long do you expect to need storage, and roughly how much will we be storing?"' },
    { id: 'st_d2', label: 'Access needs', script: '"Will you need access to anything while it\'s in storage, or is this a straight hold until delivery?"' },
  ],
  'labor-only': [
    { id: 'lo_d1', label: 'What they have and what they need', script: '"Do you already have a truck or container, and you need help loading, unloading, or both?"' },
    { id: 'lo_d2', label: 'Crew size and hours', script: '"About how much are we loading, and how many hours do you expect it to take?"' },
  ],
  'military-student': [
    { id: 'ms_d1', label: 'Confirm eligibility for the discount', script: '"Are you active-duty military, a veteran, or a student? We offer a 5% discount for each."' },
    { id: 'ms_d2', label: 'Orders, dates and constraints', script: '"Do you have report or move-in dates set? Any base housing or dorm rules about move times?"' },
    { id: 'ms_d3', label: 'Size of the move', script: '"Is this a full household or a room or two?"' },
  ],
};

// ---------- Value and add-ons (by service) ----------
const VALUE: Record<ServiceId, ScriptLine[]> = {
  residential: [{ id: 'res_v1', label: 'Offer packing and assembly', script: '"Would you like us to handle packing, or furniture disassembly and reassembly? Many customers find it saves them a full day."' }, { id: 'res_v2', label: 'Offer move-out cleaning or junk removal', script: '"If you\'re leaving a rental, we also offer move-out cleaning and junk removal so you can hand over the keys and be done."' }],
  'long-distance': [{ id: 'ld_v1', label: 'Offer storage for date gaps', script: '"If your dates don\'t line up, we can store your things until your new place is ready."' }, { id: 'ld_v2', label: 'Offer packing and crating', script: '"For a long trip, professional packing and crating for fragile items gives the best protection."' }],
  commercial: [{ id: 'com_v1', label: 'Position a planned, low-downtime move', script: '"We can plan the move around your hours and label everything by desk or room so your team is working again quickly."' }, { id: 'com_v2', label: 'Offer storage and disposal', script: '"We can also store surplus furniture or haul away what you\'re not taking."' }],
  specialty: [{ id: 'sp_v1', label: 'Explain specialty handling', script: '"Items like this need the right equipment and technique. We\'ll make sure the crew is prepared for it."' }, { id: 'sp_v2', label: 'Offer crating', script: '"For something irreplaceable, custom crating is the safest option. Want me to include it?"' }],
  'junk-removal': [{ id: 'jr_v1', label: 'One visit, everything gone', script: '"We load it, haul it and take care of disposal, so you don\'t have to make trips."' }],
  cleaning: [{ id: 'cl_v1', label: 'Tie it to their deadline', script: '"We\'ll schedule the clean before your inspection so you\'re ready for the walkthrough."' }],
  storage: [{ id: 'st_v1', label: 'Pair storage with the move', script: '"We can pick up, store and deliver, so it\'s one booking instead of three."' }],
  'labor-only': [{ id: 'lo_v1', label: 'Offer assembly or packing help', script: '"While the crew is there, they can also take apart and reassemble furniture if that helps."' }],
  'military-student': [{ id: 'ms_v1', label: 'Apply the discount and offer storage', script: '"I\'ve applied your 5% discount. If you\'re between assignments or semesters, we can also store your things."' }],
};

// ---------- Close (by call type) ----------
const CLOSES: Record<CallTypeId, ScriptLine[]> = {
  inbound: [
    { id: 'in_cl1', label: 'Present the price clearly', script: '"For your [Move Size] [Service] on [Move Date], your total comes to $[Total Price]. That includes everything we just discussed."' },
    { id: 'in_cl2', label: 'Explain pay-after-completion', script: '"You pay securely by card when you book, and your mover isn\'t paid until you confirm the job is done with your private 6-digit code."' },
    { id: 'in_cl3', label: 'Ask for the booking', script: '"Would you like me to get that booked for you now?"' },
    { id: 'in_cl4', label: 'Send the booking link and confirm next steps', script: '"I\'ve sent the quote to your email. Click Book & Pay to confirm, and you\'ll see your booking and release code in your dashboard."' },
  ],
  'web-lead': [
    { id: 'wl_cl1', label: 'Present the price and ask for the booking', script: '"Your total for [Move Date] is $[Total Price]. Would you like to lock that in now?"' },
    { id: 'wl_cl2', label: 'If not ready, set a specific next step', script: '"No problem. I\'ll email the quote now. When should I call you back, tomorrow morning or afternoon?"' },
  ],
  'quote-followup': [
    { id: 'qf_cl1', label: 'Restate value after resolving the concern', script: '"With that sorted, your total is $[Total Price] for [Move Date]. Shall we go ahead and book it?"' },
    { id: 'qf_cl2', label: 'If still undecided, agree on a date', script: '"When will you have decided? I\'ll check back then, and you can always book from the link in your email."' },
  ],
  'past-customer': [
    { id: 'pc_cl1', label: 'Ask for a review', script: '"Would you be willing to leave a quick review? It really helps other families find us. I can text you the link."' },
    { id: 'pc_cl2', label: 'Ask for referrals', script: '"Do you know anyone else planning a move this year? We\'d be glad to take care of them too."' },
    { id: 'pc_cl3', label: 'Offer related services', script: '"Now that you\'re settled, do you need anything else, like hauling away leftover boxes or help assembling furniture?"' },
  ],
  'commercial-prospect': [
    { id: 'cp_cl1', label: 'Ask for a walkthrough or proposal meeting', script: '"Could we set up a quick walkthrough so I can give you an accurate proposal? Would [day] or [day] work?"' },
    { id: 'cp_cl2', label: 'If no current need, earn permission to follow up', script: '"Understood. Would it be alright if I checked back in [timeframe] when planning starts?"' },
  ],
  service: [
    { id: 'sv_cl1', label: 'State the fix and the timeline', script: '"Here\'s what I\'m going to do: [action], and you\'ll hear back from me by [time]."', tip: 'Only commit to what you can deliver. If you need approval, say so and give a time.' },
    { id: 'sv_cl2', label: 'Confirm it is resolved', script: '"Does that resolve it for you? Is there anything else I can help with?"' },
    { id: 'sv_cl3', label: 'Log it and follow up', script: '"I\'ve documented everything on your booking so you won\'t have to explain it again."' },
  ],
};

const SERVICE_ISSUES: ScriptLine[] = [
  { id: 'sv_i1', label: 'Reschedule request', script: '"Let me check what dates are available and whether a change affects your price, and I\'ll confirm before changing anything."' },
  { id: 'sv_i2', label: 'Late or no-show crew', script: '"I\'m sorry. Let me contact the crew right now and get you an arrival time. I\'ll stay on this until it\'s resolved."' },
  { id: 'sv_i3', label: 'Damage or missing item', script: '"I\'m sorry that happened. Please send photos and a description, and I\'ll open a claim and explain the next steps today."' },
  { id: 'sv_i4', label: 'Billing or payment question', script: '"Let me pull up the payment. Remember, your mover isn\'t paid until you give them your 6-digit release code."' },
  { id: 'sv_i5', label: 'Lost release code', script: '"Your release code is in your Wont Stop Moving dashboard under your move. I can walk you through finding it."' },
];

/** Builds the call script for this call type and service. */
export function buildScript(callType: CallTypeId, service: ServiceId): ScriptPhase[] {
  if (callType === 'service') {
    return [
      { id: 'open', title: 'Greet and understand the issue', items: OPENINGS.service },
      { id: 'issues', title: 'Common issues (use what applies)', items: SERVICE_ISSUES },
      { id: 'close', title: 'Resolve and confirm', items: CLOSES.service },
    ];
  }
  if (callType === 'past-customer') {
    return [
      { id: 'open', title: 'Check in', items: OPENINGS['past-customer'] },
      { id: 'close', title: 'Reviews, referrals and repeat business', items: CLOSES['past-customer'] },
    ];
  }
  if (callType === 'commercial-prospect') {
    return [
      { id: 'open', title: 'Reach the right person', items: OPENINGS['commercial-prospect'] },
      { id: 'discovery', title: 'Discovery', items: DISCOVERY.commercial },
      { id: 'value', title: 'Value', items: VALUE.commercial },
      { id: 'close', title: 'Next step', items: CLOSES['commercial-prospect'] },
    ];
  }
  return [
    { id: 'open', title: 'Opening', items: OPENINGS[callType] },
    { id: 'discovery', title: 'Discovery and qualification', items: DISCOVERY[service] },
    { id: 'value', title: 'Value and add-ons', items: VALUE[service] },
    { id: 'close', title: 'Price and close', items: CLOSES[callType] },
  ];
}

export type Objection = { id: string; category: 'Price' | 'Timing' | 'Trust' | 'Decision' | 'Competition'; objection: string; response: string };

export const OBJECTIONS: Objection[] = [
  { id: 'o_cheaper', category: 'Competition', objection: '"Another company quoted me less."', response: '"That\'s worth comparing carefully. Can you tell me what their quote includes? Some low quotes are hourly estimates that grow on move day with stairs, travel or packing fees. Ours covers what we discussed, and your mover isn\'t paid until you confirm the job is done."' },
  { id: 'o_expensive', category: 'Price', objection: '"That\'s more than I expected."', response: '"I understand. Let\'s look at what\'s driving the price. If we adjust the date, skip an add-on, or you pack some things yourself, I can show you how that changes the total."' },
  { id: 'o_think', category: 'Decision', objection: '"I need to think about it."', response: '"Of course. What part would you like to think over? If it\'s something I can answer now, I\'m happy to. Otherwise I\'ll email the quote and check back at a time that suits you."' },
  { id: 'o_partner', category: 'Decision', objection: '"I need to talk to my partner first."', response: '"That makes sense. I\'ll email the full quote so you can look at it together. When would be a good time for me to call back, after you\'ve talked?"' },
  { id: 'o_date', category: 'Timing', objection: '"I don\'t know my exact date yet."', response: '"That\'s very common. Let\'s quote your most likely date now so you know the cost, and when your date firms up, you can book it in a minute online."' },
  { id: 'o_later', category: 'Timing', objection: '"My move is months away."', response: '"Great, that gives us time. I\'ll send the quote now and follow up closer to the date. When do you expect to have your plans set?"' },
  { id: 'o_trust', category: 'Trust', objection: '"How do I know your movers are any good?"', response: '"Every mover on our platform goes through identity verification, and customers review them after each job. And you\'re protected: the mover isn\'t paid until you confirm the job is done with your private code."' },
  { id: 'o_broker', category: 'Trust', objection: '"Are you a broker? I\'ve heard bad things."', response: '"We\'re an online marketplace: you book vetted, independent movers directly through us, and payment is held until you confirm the job is complete. You\'ll see exactly who your mover is in your dashboard."' },
  { id: 'o_diy', category: 'Price', objection: '"I\'ll just do it myself with friends."', response: '"That works for some moves. If it helps, we can do labor-only, just loading and unloading the heavy pieces, which usually costs much less than a full move."' },
  { id: 'o_deposit', category: 'Trust', objection: '"Why do I have to pay when I book?"', response: '"Paying when you book reserves your crew. But your mover doesn\'t receive the money until the job is finished and you give them your 6-digit release code."' },
];

export type Disposition = 'booked' | 'quote-sent' | 'follow-up' | 'not-interested' | 'no-answer' | 'resolved' | 'escalated' | 'do-not-call';
export const DISPOSITIONS: { id: Disposition; label: string; needsFollowUp?: boolean }[] = [
  { id: 'booked', label: 'Booked' },
  { id: 'quote-sent', label: 'Quote sent', needsFollowUp: true },
  { id: 'follow-up', label: 'Follow-up scheduled', needsFollowUp: true },
  { id: 'no-answer', label: 'No answer / left voicemail', needsFollowUp: true },
  { id: 'not-interested', label: 'Not interested' },
  { id: 'resolved', label: 'Service issue resolved' },
  { id: 'escalated', label: 'Escalated to manager', needsFollowUp: true },
  { id: 'do-not-call', label: 'Asked not to be called' },
];

export const COMPLIANCE_NOTES = [
  'Only call people who requested a quote, are existing or past customers, or are business numbers. Honor every request to stop calling and log it as "Asked not to be called".',
  'If calls are recorded, say so at the start of the call where the law requires it.',
  'Never promise a date, price, coverage or policy you have not confirmed in the system.',
  'Call web leads within 5 minutes, and follow up unbooked quotes within 24 hours.',
];
