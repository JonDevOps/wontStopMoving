
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Truck, 
  LayoutDashboard, 
  FileText, 
  User, 
  Bell, 
  LogOut, 
  Menu,
  X
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  href: string;
  icon: any;
}

export function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const customerNav: NavItem[] = [
    { label: "Overview", href: "/dashboard/customer", icon: LayoutDashboard },
    { label: "My Moves", href: "/dashboard/customer/moves", icon: Truck },
    { label: "My Quotes", href: "/dashboard/customer/quotes", icon: FileText },
    { label: "Profile", href: "/dashboard/customer/profile", icon: User },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col w-72 bg-white border-r fixed h-full z-40">
        <div className="p-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-primary text-white p-2 rounded-lg">
              <Truck className="h-5 w-5" />
            </div>
            <span className="text-lg font-headline font-black uppercase tracking-tighter text-primary">
              Wont Stop <span className="text-accent">Moving</span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 px-6 space-y-2 mt-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-4 mb-4">
            CUSTOMER PORTAL
          </p>
          {customerNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-bold transition-all ${isActive ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-primary hover:bg-gray-100'}`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t">
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-primary hover:bg-gray-100 gap-4">
            <LogOut className="h-5 w-5" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 lg:ml-72 flex flex-col">
        {/* Top Header */}
        <header className="h-20 bg-white border-b flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 text-primary"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="hidden sm:block">
              <span className="text-sm font-bold text-muted-foreground">Welcome back, </span>
              <span className="text-sm font-black text-primary uppercase">Customer</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative text-primary">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-accent rounded-full border-2 border-white" />
            </Button>
            <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-black">
              C
            </div>
          </div>
        </header>

        <main className="p-6 lg:p-10 flex-1">
          {children}
        </main>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute top-0 left-0 w-80 h-full bg-white flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-8 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2">
                <Truck className="h-6 w-6 text-accent" />
                <span className="text-xl font-headline font-black tracking-tighter text-primary">WONT STOP</span>
              </Link>
              <button onClick={() => setMobileOpen(false)}><X className="h-6 w-6 text-primary" /></button>
            </div>
            <nav className="flex-1 px-6 space-y-2">
              {customerNav.map((item) => (
                <Link 
                  key={item.href} 
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-4 px-4 py-4 rounded-xl text-lg font-bold ${pathname === item.href ? 'bg-primary text-white' : 'text-primary'}`}
                >
                  <item.icon className="h-6 w-6" />
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="p-8">
              <Button className="w-full bg-primary text-white rounded-xl h-12">Log Out</Button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
