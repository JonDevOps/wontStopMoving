'use client';

import { EmployeeLayout } from '@/components/layout/employee-layout';
import { LeadInbox } from '@/components/sales/lead-inbox';

export default function EmployeeLeadsPage() {
  return <EmployeeLayout><LeadInbox playbookPath="/dashboard/employee/sales-script" /></EmployeeLayout>;
}
