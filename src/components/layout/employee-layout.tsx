
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Truck, 
  LayoutDashboard, 
  Calendar, 
  User, 
  Bell, 
  LogOut, 
  Menu,
  X,
  ShieldCheck,
  FileText
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  href: string;
  icon: any;
}

export function EmployeeLayout({ children, isAdmin = false }: { children: React.ReactNode, isAdmin?: boolean }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const employeeNav: NavItem[] = [
    { label: "Dashboard", href: "/dashboard/employee", icon: LayoutDashboard },
    { label: "My Jobs", href: "/dashboard/employee/jobs", icon: Truck },
    { label: "Calendar", href: "/dashboard/employee/calendar", icon: Calendar },
    { label: "Profile", href: "/dashboard/employee/profile", icon: User },
  ];

  const adminNav: NavItem[] = [
    { label: "Overview", href: "/dashboard/admin", icon: LayoutDashboard },
    { label: "Jobs", href: "/dashboard/admin/jobs", icon: Truck },
    { label: "Employees", href: "/dashboard/admin/employees", icon: ShieldCheck },
    { label: "Applications", href: "/dashboard/admin/careers", icon: FileText },
    { label: "Customers", href: "/dashboard/admin/customers", icon: User },
  ];

  const currentNav = isAdmin ? adminNav : employeeNav;

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col w-72 bg-primary text-white fixed h-full z-40">
        <div className="p-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-accent text-white p-2 rounded-lg">
              <Truck className="h-5 w-5" />
            </div>
            <span className="text-lg font-headline font-black uppercase tracking-tighter">
              Wont Stop <span className="text-accent">Moving</span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 px-6 space-y-2 mt-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 px-4 mb-4">
            {isAdmin ? "ADMIN CONTROL" : "EMPLOYEE PORTAL"}
          </p>
          {currentNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-bold transition-all ${isActive ? 'bg-accent text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-white/10">
          <Button variant="ghost" className="w-full justify-start text-white/60 hover:text-white hover:bg-white/5 gap-4">
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
              <span className="text-sm font-bold text-muted-foreground">Current Route / </span>
              <span className="text-sm font-black text-primary capitalize">{pathname.split('/').pop() || 'Dashboard'}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative text-primary">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-accent rounded-full border-2 border-white" />
            </Button>
            <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center font-black">
              M
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
          <aside className="absolute top-0 left-0 w-80 h-full bg-primary text-white flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-8 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2">
                <Truck className="h-6 w-6 text-accent" />
                <span className="text-xl font-headline font-black tracking-tighter">WONT STOP</span>
              </Link>
              <button onClick={() => setMobileOpen(false)}><X className="h-6 w-6" /></button>
            </div>
            <nav className="flex-1 px-6 space-y-2">
              {currentNav.map((item) => (
                <Link 
                  key={item.href} 
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-4 px-4 py-4 rounded-xl text-lg font-bold ${pathname === item.href ? 'bg-accent' : ''}`}
                >
                  <item.icon className="h-6 w-6" />
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="p-8">
              <Button className="w-full bg-white/10 hover:bg-white/20 text-white rounded-xl h-12">Log Out</Button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
