'use client';

import { EmployeeLayout } from '@/components/layout/employee-layout';
import { NewsletterAdmin } from '@/components/newsletter/Newsletter';
import { useUser } from '@/firebase';

export default function AdminNewsletterPage() {
  const { user } = useUser();
  return <EmployeeLayout isAdmin>{user && <NewsletterAdmin user={user} region="us-central1" />}</EmployeeLayout>;
}
