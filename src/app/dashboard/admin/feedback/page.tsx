'use client';
import { EmployeeLayout } from '@/components/layout/employee-layout';
import { FeedbackInbox } from '@/components/feedback/feedback-inbox';
import { AdminNotes } from '@/components/admin/admin-notes';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminFeedbackPage() {
  return <EmployeeLayout isAdmin>
    <Tabs defaultValue="feedback" className="space-y-6">
      <TabsList>
        <TabsTrigger value="feedback">Feedback</TabsTrigger>
        <TabsTrigger value="notes">Admin notes</TabsTrigger>
      </TabsList>
      <TabsContent value="feedback"><FeedbackInbox /></TabsContent>
      <TabsContent value="notes"><AdminNotes /></TabsContent>
    </Tabs>
  </EmployeeLayout>;
}
