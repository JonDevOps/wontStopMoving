'use client';

import { EmployeeLayout } from '@/components/layout/employee-layout';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useAccountActivity } from '@/hooks/use-account-activity';
import Link from 'next/link';

function AccountActivity() {
  const db = useFirestore();
  const usersQuery = useMemoFirebase(() => collection(db, 'users'), [db]);
  const jobsQuery = useMemoFirebase(() => collection(db, 'jobs'), [db]);
  const quotesQuery = useMemoFirebase(() => collection(db, 'quotes'), [db]);
  const { data: users, isLoading } = useCollection(usersQuery);
  const { data: jobs } = useCollection(jobsQuery);
  const { data: quotes } = useCollection(quotesQuery);
  const { accounts, error } = useAccountActivity((users || []).map(user => user.id));
  const date = (value: string | null | undefined) => value ? new Date(value).toLocaleString() : 'Unknown';
  return <div className="space-y-6"><h1 className="text-3xl font-bold">Account activity</h1><p>Creation and last sign-in dates come from Firebase Authentication. Job and quote counts reflect current records. Refresh this page to reload account dates.</p>
    {error && <p role="status">{error}</p>}
    {isLoading ? <p>Loading accounts…</p> : <div className="overflow-x-auto bg-white rounded-xl"><table className="w-full text-sm text-left"><thead><tr>{['Account', 'Role', 'Created', 'Last sign-in', 'Quotes', 'Jobs', 'Completed', 'Last completed job'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{(users || []).map(user => {
      const assigned = (jobs || []).filter(job => job.customerId === user.id || job.providerIds?.includes(user.id) || job.employeeIds?.includes(user.id));
      const completed = assigned.filter(job => job.status === 'completed');
      const last = completed.map(job => job.completedAt?.toDate?.()).filter(Boolean).sort((a, b) => b.getTime() - a.getTime())[0];
      const href = user.role === 'customer' ? `/dashboard/admin/customers/${user.id}` : user.role === 'employee' ? `/dashboard/admin/employees/${user.id}` : '/dashboard/admin/providers';
      return <tr key={user.id} className="border-t"><td className="p-3"><Link className="underline" href={href}>{user.name || user.email || user.id}</Link></td><td className="p-3">{user.role}</td><td className="p-3">{date(accounts[user.id]?.createdAt)}</td><td className="p-3">{date(accounts[user.id]?.lastSignInAt)}</td><td className="p-3">{(quotes || []).filter(quote => quote.customerId === user.id).length}</td><td className="p-3">{assigned.length}</td><td className="p-3">{completed.length}</td><td className="p-3">{last ? last.toLocaleString() : 'None recorded'}</td></tr>;
    })}</tbody></table></div>}
  </div>;
}
export default function AccountActivityPage() { return <EmployeeLayout isAdmin><AccountActivity/></EmployeeLayout>; }
