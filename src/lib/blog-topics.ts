/**
 * The blog's topic rotation. Each AI draft run takes the next topics in this
 * order, so coverage stays balanced across everything Wont Stop Moving offers.
 * `category` is what readers see; `services` keeps drafts tied to real offerings.
 */
export type BlogTopic = {
  id: string;
  category: string;
  focus: string;
  services: string[];
  images: string[];
};

export const BLOG_TOPICS: BlogTopic[] = [
  { id: 'home-moves', category: 'Home Moves', focus: 'Practical advice for household moves: local, long-distance, express, student and military PCS moves. Planning timelines, choosing a move date, preparing kids and pets, and what to expect on move day.', services: ['local-moving', 'long-distance', 'express-moving', 'student-moves', 'military-relocation'], images: ['blog-home', 'blog-checklist', 'blog-kids', 'blog-pets'] },
  { id: 'packing-specialty', category: 'Packing & Specialty Items', focus: 'How to pack and protect belongings, and how professionals handle fragile, valuable or heavy items such as pianos, gun safes, art, antiques and electronics.', services: ['white-glove-packing', 'specialty-crating', 'piano-moving', 'gun-safe-moving'], images: ['blog-packing', 'blog-fragile', 'blog-electronics', 'blog-luxury'] },
  { id: 'business-logistics', category: 'Business Moves & Logistics', focus: 'Moving offices, data centers, hotels and restaurants, and warehousing. Minimizing downtime, IT and equipment handling, planning around business hours, and coordinating with building management.', services: ['commercial', 'workplace-solutions', 'data-center', 'hospitality', 'warehousing-logistics'], images: ['blog-logistics', 'blog-electronics'] },
  { id: 'storage', category: 'Storage', focus: 'When short- or long-term storage makes sense during a move, how to prepare items for storage, climate considerations, and keeping an inventory.', services: ['vaulted-storage'], images: ['blog-logistics', 'blog-winter'] },
  { id: 'cleaning-junk-handyman', category: 'Cleaning, Junk Removal & Assembly', focus: 'Move-out and move-in cleaning checklists, getting a deposit back, decluttering and junk removal before a move, donating and recycling, and furniture disassembly and assembly.', services: ['cleaning-services', 'junk-removal', 'handyman-assembly'], images: ['blog-junk', 'blog-home', 'blog-checklist'] },
  { id: 'costs-protection', category: 'Costs & Protection', focus: 'What drives moving costs, how to read a quote, hourly versus fixed pricing, avoiding surprise fees, budgeting, and what moving protection plans and valuation coverage do and do not cover.', services: ['protection-plans'], images: ['blog-budget', 'blog-checklist'] },
  { id: 'seasonal-local', category: 'Seasonal & Local Guides', focus: 'Season-specific moving advice (weather, peak season, holidays) and practical guides for moving to or within US and Canadian cities and regions: permits, parking, building rules, and settling in.', services: ['local-moving', 'long-distance'], images: ['blog-winter', 'blog-holiday', 'blog-texas', 'blog-newyear'] },
  { id: 'settling-in', category: 'Settling In', focus: 'The first days and weeks after a move: unpacking order, utilities and address changes, safety checks in a new home, and helping the household adjust.', services: ['handyman-assembly', 'cleaning-services'], images: ['blog-home', 'blog-kids', 'blog-pets'] },
];

export const topicById = (id: string) => BLOG_TOPICS.find(t => t.id === id);
