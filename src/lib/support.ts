import { z } from 'zod';

export const supportInquirySchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).default(''),
  subject: z.string().trim().min(2).max(200),
  message: z.string().trim().min(10).max(5000),
  website: z.string().max(200).default(''), // Honeypot; never stored with the ticket.
}).strict();

export const supportStatusSchema = z.enum(['new', 'in-progress', 'resolved']);
export type SupportStatus = z.infer<typeof supportStatusSchema>;
export type SupportTicket = {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: SupportStatus;
  createdAt: string | null;
  firstResponseAt?: string | null;
  satisfaction?: number | null;
};
