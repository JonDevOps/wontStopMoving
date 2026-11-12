'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { LayoutDashboard, LogOut, MessageSquareHeart, Settings, User, Users, ShoppingBag, LifeBuoy, Building2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/firebase';
import { FeedbackDialog } from '@/components/feedback/feedback-dialog';

type Role = 'admin' | 'employee' | 'customer' | 'provider' | 'agent';
type Item = { label: string; href: string; icon: typeof User };

const ITEMS: Record<Role, Item[]> = {
  admin: [
    { label: 'Dashboard', href: '/dashboard/admin', icon: LayoutDashboard },
    { label: 'My profile', href: '/dashboard/admin/profile', icon: User },
    { label: 'Team & admins', href: '/dashboard/admin/team', icon: Users },
    { label: 'Market radar settings', href: '/dashboard/admin/market', icon: Settings },
  ],
  employee: [
    { label: 'Dashboard', href: '/dashboard/employee', icon: LayoutDashboard },
    { label: 'My profile', href: '/dashboard/employee/profile', icon: User },
  ],
  customer: [
    { label: 'Dashboard', href: '/dashboard/customer', icon: LayoutDashboard },
    { label: 'My profile & settings', href: '/dashboard/customer/profile', icon: User },
    { label: 'Moving supplies', href: '/shop', icon: ShoppingBag },
    { label: 'Help & support', href: '/contact', icon: LifeBuoy },
  ],
  provider: [
    { label: 'Dashboard', href: '/dashboard/provider', icon: LayoutDashboard },
    { label: 'Settings', href: '/dashboard/provider/settings', icon: Settings },
  ],
  agent: [
    { label: 'Dashboard', href: '/dashboard/agent', icon: LayoutDashboard },
    { label: 'Company & capacity', href: '/dashboard/agent#company', icon: Building2 },
  ],
};

/** The avatar in each portal's header: a menu with the right links, feedback and sign out. */
export function ProfileMenu({ role, name, email, avatarClassName = 'bg-accent' }: { role: Role; name?: string; email?: string | null; avatarClassName?: string }) {
  const auth = useAuth();
  const router = useRouter();
  const [feedback, setFeedback] = useState(false);
  const initial = (name || email || '?').trim()[0]?.toUpperCase() || '?';
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-black focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${avatarClassName}`} aria-label="Account menu">
        {initial}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal"><p className="font-semibold truncate">{name || 'My account'}</p>{email && <p className="text-xs text-muted-foreground truncate">{email}</p>}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ITEMS[role].map(i => <DropdownMenuItem key={i.href} asChild><Link href={i.href} className="cursor-pointer"><i.icon className="h-4 w-4 mr-2" />{i.label}</Link></DropdownMenuItem>)}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onSelect={() => setFeedback(true)}><MessageSquareHeart className="h-4 w-4 mr-2" />Send feedback</DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onSelect={async () => { await signOut(auth); router.push('/login'); }}><LogOut className="h-4 w-4 mr-2" />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <FeedbackDialog open={feedback} onOpenChange={setFeedback} />
  </>;
}
