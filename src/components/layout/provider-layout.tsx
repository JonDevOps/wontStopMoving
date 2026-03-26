"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  Truck, 
  LayoutDashboard, 
  Briefcase, 
  User, 
  Settings,
  Bell, 
  LogOut, 
  Menu,
  X,
  CreditCard,
  Tags
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useUser, useFirestore, useDoc, useMemoFirebase, useAuth } from "@/firebase";
import { doc } from "firebase/firestore";
import { signOut } from "firebase/auth";

interface NavItem {
  label: string;
  href: string;
  icon: any;
}

export function ProviderLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileOpen]);

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "users", user.uid);
  }, [firestore, user]);

  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace("/login");
    }
    if (!isProfileLoading && profile && profile.role !== 'provider' && profile.role !== 'admin') {
      router.replace("/dashboard/" + (profile.role || 'customer'));
    }
  }, [user, isUserLoading, profile, isProfileLoading, router]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const providerNav: NavItem[] = [
    { label: "Dashboard", href: "/dashboard/provider", icon: LayoutDashboard },
    { label: "My Jobs", href: "/dashboard/provider/jobs", icon: Briefcase },
    { label: "Services & Pricing", href: "/dashboard/provider/services", icon: Tags },
    { label: "Earnings", href: "/dashboard/provider/earnings", icon: CreditCard },
    { label: "Settings", href: "/dashboard/provider/settings", icon: Settings },
  ];

  const isAuthorized = !isProfileLoading && (profile?.role === 'provider' || profile?.role === 'admin');

  if (isUserLoading || isProfileLoading || !isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse font-black text-primary uppercase tracking-tighter">
          {isProfileLoading ? "Loading Provider Data..." : "Checking Permissions..."}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="hidden lg:flex flex-col w-72 bg-slate-900 border-r border-slate-800 fixed h-full z-40 text-white">
        <div className="p-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-accent text-white p-2 rounded-lg">
              <Truck className="h-5 w-5" />
            </div>
            <span className="text-lg font-headline font-black uppercase tracking-tighter text-white">
              Wont Stop <span className="text-accent">Moving</span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 px-6 space-y-2 mt-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-4 mb-4">
            PROVIDER PORTAL
          </p>
          {providerNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-bold transition-all ${isActive ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-slate-800">
          <Button 
            variant="ghost" 
            onClick={handleSignOut}
            className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800 gap-4"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </Button>
        </div>
      </aside>

      <div className="flex-1 lg:ml-72 flex flex-col min-h-screen">
        <header className="h-20 bg-white border-b flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 text-primary"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="hidden sm:block">
              <span className="text-sm font-bold text-muted-foreground">Provider Access: </span>
              <span className="text-sm font-black text-primary uppercase">{profile?.name || 'Provider'}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative text-primary">
              <Bell className="h-5 w-5" />
            </Button>
            <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center font-black">
              {profile?.name?.[0] || 'P'}
            </div>
          </div>
        </header>

        <main className="p-6 lg:p-10 flex-1">
          {children}
        </main>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute top-0 left-0 w-80 h-full bg-slate-900 flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-8 flex items-center justify-between shrink-0">
              <Link href="/" className="flex items-center gap-2">
                <Truck className="h-6 w-6 text-accent" />
                <span className="text-xl font-headline font-black tracking-tighter text-white">
                  Wont Stop <span className="text-accent">Moving</span>
                </span>
              </Link>
              <button onClick={() => setMobileOpen(false)}><X className="h-6 w-6 text-white" /></button>
            </div>
            <nav className="flex-1 px-6 space-y-2 overflow-y-auto py-4">
              {providerNav.map((item) => (
                <Link 
                  key={item.href} 
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-4 px-4 py-4 rounded-xl text-lg font-bold ${pathname === item.href ? 'bg-accent text-white' : 'text-slate-400'}`}
                >
                  <item.icon className="h-6 w-6" />
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="p-8 border-t border-slate-800 shrink-0">
              <Button 
                onClick={handleSignOut} 
                className="w-full bg-accent text-white rounded-xl h-14 font-black uppercase tracking-widest text-xs gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
