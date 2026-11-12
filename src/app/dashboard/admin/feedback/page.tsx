'use client';
import { EmployeeLayout } from '@/components/layout/employee-layout';
import { FeedbackInbox } from '@/components/feedback/feedback-inbox';
export default function AdminFeedbackPage() { return <EmployeeLayout isAdmin><FeedbackInbox /></EmployeeLayout>; }
