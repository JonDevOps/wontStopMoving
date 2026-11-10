'use client';

import { EmployeeLayout } from '@/components/layout/employee-layout';
import { LeadInbox } from '@/components/sales/lead-inbox';

export default function AdminLeadsPage() {
  return <EmployeeLayout isAdmin><LeadInbox playbookPath="/dashboard/admin/sales-script" /></EmployeeLayout>;
}
