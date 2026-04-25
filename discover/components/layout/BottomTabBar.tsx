"use client";

/**
 * Mobile-only fixed bottom tab-bar.
 * Uses pathname for the active state. Desktop is hidden via lg:hidden.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  PlaySquare,
  Search,
  MessageCircle,
  User,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Tab {
  href: string;
  label: string;
  Icon: LucideIcon;
  showFeedDot?: boolean;
}

const TABS: Tab[] = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/feed", label: "Feed", Icon: PlaySquare, showFeedDot: true },
  { href: "/search", label: "Suche", Icon: Search },
  { href: "/messages", label: "Nachrichten", Icon: MessageCircle },
  { href: "/profile", label: "Profil", Icon: User },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Hauptnavigation"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 h-16 lg:hidden",
        "border-t border-white/[0.06]",
        "bg-[color:var(--bg-primary)]/85 backdrop-blur-xl",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="mx-auto flex h-16 max-w-[480px] items-stretch justify-between px-2">
        {TABS.map(({ href, label, Icon, showFeedDot }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex h-full flex-col items-center justify-center gap-0.5 transition-colors",
                  isActive ? "text-white" : "text-white/40 hover:text-white/70",
                )}
              >
                <span className="relative">
                  <Icon
                    className={cn(
                      "size-6",
                      isActive &&
                        "drop-shadow-[0_0_10px_color-mix(in_oklab,var(--accent-primary)_70%,transparent)]",
                    )}
                  />
                  {showFeedDot ? (
                    <span
                      aria-hidden="true"
                      className="absolute -right-1 -top-1 size-2 rounded-full bg-[color:var(--accent-hot)] ring-2 ring-[color:var(--bg-primary)]"
                    />
                  ) : null}
                </span>
                <span className="text-[10px] font-medium tracking-tight">
                  {label}
                </span>
                {isActive ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-[color:var(--accent-primary)]"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
