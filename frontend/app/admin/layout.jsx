"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "../components/ThemeToggle";
import {
  HomeIcon,
  BookOpenIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

const nav = [
  { href: "/admin/dashboard", label: "Dashboard", icon: HomeIcon },
  { href: "/admin/knowledge", label: "Knowledge", icon: BookOpenIcon },
  { href: "/admin/memories", label: "Memories", icon: SparklesIcon },
  { href: "/admin/chats", label: "Chats", icon: ChatBubbleLeftRightIcon },
  { href: "/admin/analytics", label: "Analytics", icon: ChartBarIcon },
  { href: "/admin/training", label: "Training", icon: WrenchScrewdriverIcon },
  { href: "/admin/tools", label: "Tools", icon: WrenchScrewdriverIcon },
  { href: "/admin/settings", label: "Settings", icon: Cog6ToothIcon },
  { href: "/admin/users", label: "Users", icon: UserGroupIcon },
  { href: "/admin/security", label: "Security", icon: ShieldCheckIcon },
];

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const current = nav.find(n => pathname?.startsWith(n.href))?.label || "Admin";
  return (
    <div className="h-[100dvh] md:h-screen flex overflow-hidden">
      <aside className="w-64 shrink-0 bg-zinc-950/80 border-r border-zinc-800/60 p-4 sticky top-0 h-[100dvh] overflow-y-auto scroll-unique">
        <div className="mb-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#00B8FF] to-[#FFD25A]" />
          <h2 className="text-lg font-semibold">Taliyo Admin</h2>
        </div>
        <nav className="space-y-1">
          {nav.map((n) => {
            const active = pathname?.startsWith(n.href);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`nav-link ${active ? 'nav-link-active' : ''}`}
              >
                <Icon className="w-5 h-5" />
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 border-b border-zinc-800/60 bg-zinc-950/70 backdrop-blur px-4 md:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="hidden md:inline">Admin</span>
            <span className="hidden md:inline">/</span>
            <span className="text-zinc-200 font-medium">{current}</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-y-auto scroll-unique">
          {children}
        </main>
      </div>
    </div>
  );
}
