"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, Users, BarChart3, Home } from "lucide-react";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/standings", label: "Standings", icon: BarChart3 },
  { href: "/managers", label: "Managers", icon: Users },
  { href: "/trades", label: "Trades", icon: ArrowLeftRight },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 border-t border-app bg-elev/95 backdrop-blur-md"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="flex h-16 items-stretch">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                  active ? "text-accent" : "text-muted hover:text-text"
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
