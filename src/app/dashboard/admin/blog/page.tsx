'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { EmployeeLayout } from '@/components/layout/employee-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/firebase';
import { apiFetch } from '@/lib/api-client';

type Post = {
  slug: string; title: string; excerpt: string; content: string; category: string; topicId: string;
  status: 'draft' | 'scheduled' | 'rejected'; source: 'ai' | 'admin'; readTime: string;
  publishAt: string | null; createdAt: string | null;
};
type Tab = 'draft' | 'scheduled' | 'rejected';

/** `datetime-local` value in the admin's own time zone. */
const toLocalInput = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const when = (iso: string | null) => iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function PostEditor({ post, nextSlot, busy, onAction }: { post: Post; nextSlot: string; busy: boolean; onAction: (action: string, extra?: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState({ title: post.title, excerpt: post.excerpt, category: post.category, content: post.content });
  const [publishAt, setPublishAt] = useState(toLocalInput(post.publishAt || nextSlot));
  useEffect(() => { setFields({ title: post.title, excerpt: post.excerpt, category: post.category, content: post.content }); }, [post]);
  const dirty = fields.title !== post.title || fields.excerpt !== post.excerpt || fields.category !== post.category || fields.content !== post.content;
  const live = post.status === 'scheduled' && post.publishAt && Date.parse(post.publishAt) <= Date.now();

  return <Card className="bg-white"><CardContent className="p-5 space-y-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="space-y-1 min-w-0">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">{post.category} · {post.readTime} · {post.source === 'ai' ? 'AI draft' : 'Admin'}</p>
        <h3 className="text-lg font-bold break-words">{post.title}</h3>
        <p className="text-sm text-muted-foreground">{post.excerpt}</p>
        {post.status === 'scheduled' && <p className="text-sm font-medium">{live ? <>Live since {when(post.publishAt)} · <Link className="underline" href={`/blog/${post.slug}`} target="_blank">View post</Link></> : <>Publishes {when(post.publishAt)}</>}</p>}
      </div>
      {post.status !== 'rejected' && <Button variant="outline" size="sm" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Close' : 'Review & edit'}</Button>}
    </div>
    {open && <div className="space-y-4 border-t pt-4">
      <div className="space-y-1"><Label htmlFor={`t-${post.slug}`}>Title</Label><Input id={`t-${post.slug}`} value={fields.title} maxLength={120} onChange={e => setFields({ ...fields, title: e.target.value })} /></div>
      <div className="space-y-1"><Label htmlFor={`e-${post.slug}`}>Summary</Label><textarea id={`e-${post.slug}`} className="w-full border rounded-md p-3 text-sm" rows={2} maxLength={300} value={fields.excerpt} onChange={e => setFields({ ...fields, excerpt: e.target.value })} /></div>
      <div className="space-y-1"><Label htmlFor={`c-${post.slug}`}>Category</Label><Input id={`c-${post.slug}`} value={fields.category} maxLength={60} onChange={e => setFields({ ...fields, category: e.target.value })} /></div>
      <div className="space-y-1"><Label htmlFor={`b-${post.slug}`}>Article (blank line between paragraphs)</Label><textarea id={`b-${post.slug}`} className="w-full border rounded-md p-3 text-sm leading-relaxed" rows={16} maxLength={20000} value={fields.content} onChange={e => setFields({ ...fields, content: e.target.value })} /></div>
      <p className="text-xs text-muted-foreground">Check facts before publishing. AI drafts are told not to invent statistics, prices or laws, but they can still be wrong.</p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !dirty} onClick={() => onAction('save', fields)}>Save changes</Button>
        {post.status === 'draft' && <Button variant="outline" disabled={busy} onClick={() => onAction('reject')}>Reject</Button>}
        {post.status === 'scheduled' && <Button variant="outline" disabled={busy} onClick={() => onAction('unschedule')}>Move back to drafts</Button>}
      </div>
      <div className="flex flex-wrap items-end gap-2 border-t pt-4">
        <div className="space-y-1"><Label htmlFor={`p-${post.slug}`}>Publish at (your time)</Label><Input id={`p-${post.slug}`} type="datetime-local" value={publishAt} onChange={e => setPublishAt(e.target.value)} /></div>
        <Button disabled={busy || dirty || !publishAt} onClick={() => onAction('schedule', { publishAt: new Date(publishAt).toISOString() })}>{post.status === 'scheduled' ? 'Reschedule' : 'Schedule'}</Button>
        {!live && <Button variant="outline" disabled={busy || dirty} onClick={() => onAction('schedule', { publishAt: new Date().toISOString() })}>Publish now</Button>}
        {dirty && <p className="text-xs text-muted-foreground w-full">Save your changes before scheduling.</p>}
      </div>
    </div>}
  </CardContent></Card>;
}

function BlogAdmin() {
  const auth = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [topics, setTopics] = useState<{ id: string; category: string }[]>([]);
  const [nextSlot, setNextSlot] = useState(new Date().toISOString());
  const [tab, setTab] = useState<Tab>('draft');
  const [topicId, setTopicId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await apiFetch<{ posts: Post[]; nextSlot: string; topics: { id: string; category: string }[] }>(auth, '/api/admin/blog');
      setPosts(r.posts); setNextSlot(r.nextSlot); setTopics(r.topics);
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not load posts.'); }
    finally { setLoading(false); }
  }, [auth]);
  useEffect(() => { void load(); }, [load]);

  async function run(body: Record<string, unknown>, done: (r: any) => string) {
    setBusy(true); setNotice('');
    try { const r = await apiFetch(auth, '/api/admin/blog', body); setNotice(done(r)); await load(); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'That didn’t work.'); }
    finally { setBusy(false); }
  }
  const generate = () => run(topicId ? { action: 'generate', topicId } : { action: 'generate' }, r => `Drafted “${r.drafted[0].title}”. Review it below.`);
  const act = (slug: string) => (action: string, extra?: Record<string, unknown>) => run({ action, slug, ...extra }, r => ({ saved: 'Saved.', scheduled: 'Scheduled.', published: 'Published. It appears on the blog within five minutes.', draft: 'Moved back to drafts and removed from the blog.', rejected: 'Rejected.' } as Record<string, string>)[r.status] || 'Done.');

  const counts = { draft: 0, scheduled: 0, rejected: 0 } as Record<Tab, number>;
  posts.forEach(p => { counts[p.status]++; });
  const shown = posts.filter(p => p.status === tab).sort((a, b) => tab === 'scheduled' ? Date.parse(b.publishAt || '') - Date.parse(a.publishAt || '') : 0);

  return <div className="space-y-6 max-w-5xl mx-auto">
    <div className="space-y-2">
      <h1 className="text-3xl font-bold">Blog</h1>
      <p className="text-muted-foreground">Every Monday the AI drafts posts for the next topics in rotation and emails you. Nothing is published until you schedule it. Scheduled posts go live on their own at the publish time.</p>
    </div>
    <Card className="bg-white"><CardContent className="p-5 flex flex-wrap items-end gap-3">
      <div className="space-y-1"><Label htmlFor="topic">Draft a post now</Label>
        <select id="topic" className="border rounded-md p-2 h-10 bg-white" value={topicId} onChange={e => setTopicId(e.target.value)}>
          <option value="">Next topic in rotation</option>
          {topics.map(t => <option key={t.id} value={t.id}>{t.category}</option>)}
        </select>
      </div>
      <Button disabled={busy} onClick={() => void generate()}>{busy ? 'Working…' : 'Write AI draft'}</Button>
      <p className="text-xs text-muted-foreground w-full">Takes about 20 seconds. Next open publishing slot: {when(nextSlot)}.</p>
    </CardContent></Card>
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Post status">
      {([['draft', 'Drafts'], ['scheduled', 'Scheduled & live'], ['rejected', 'Rejected']] as [Tab, string][]).map(([value, label]) =>
        <Button key={value} role="tab" aria-selected={tab === value} variant={tab === value ? 'default' : 'outline'} onClick={() => setTab(value)}>{label} ({counts[value]})</Button>)}
    </div>
    {notice && <p role="status" className="font-medium">{notice}</p>}
    {loading ? <p>Loading posts…</p> : shown.length === 0 ? <p>{tab === 'draft' ? 'No drafts waiting. New ones arrive every Monday, or write one now.' : tab === 'scheduled' ? 'Nothing scheduled yet.' : 'No rejected drafts.'}</p> :
      <div className="space-y-3">{shown.map(p => <PostEditor key={p.slug} post={p} nextSlot={nextSlot} busy={busy} onAction={act(p.slug)} />)}</div>}
  </div>;
}

export default function AdminBlogPage() { return <EmployeeLayout isAdmin><BlogAdmin /></EmployeeLayout>; }
