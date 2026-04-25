/**
 * Sticky top bar.
 * Mobile: just logo + bell + avatar. Desktop adds the centered search input.
 * Server component — no interactivity beyond CSS hover/focus.
 */
import Link from "next/link";
import Image from "next/image";
import { Bell, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  isPremium?: boolean;
  avatarUrl?: string;
}

export function Header({
  isPremium = true,
  avatarUrl = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop&q=80",
}: HeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 h-16 w-full",
        "border-b border-white/[0.06]",
        "bg-[color:var(--bg-primary)]/70 backdrop-blur-xl",
      )}
    >
      <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        <Link
          href="/"
          aria-label="Discover — Startseite"
          className="text-xl font-bold tracking-tight text-gradient-brand"
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
        >
          discover
        </Link>

        {/* Search — desktop only */}
        <div className="hidden flex-1 max-w-xl lg:block">
          <label className="relative block">
            <span className="sr-only">Suche</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40"
            />
            <input
              type="search"
              placeholder="Suche nach Creators, Items, Kategorien…"
              className={cn(
                "h-10 w-full rounded-full pl-10 pr-16 text-sm",
                "bg-white/[0.04] backdrop-blur-xl border border-white/[0.08]",
                "text-white placeholder:text-white/40",
                "focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-primary)]/40",
              )}
            />
            <kbd
              aria-hidden="true"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-white/50"
            >
              ⌘K
            </kbd>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Benachrichtigungen"
            className="grid size-9 place-items-center rounded-full text-white/70 hover:bg-white/[0.06] hover:text-white"
          >
            <Bell className="size-5" />
          </button>

          <Link
            href="/profile"
            aria-label="Profil"
            className={cn(
              "relative grid size-9 place-items-center rounded-full",
              isPremium && "ring-verified",
            )}
          >
            <Image
              src={avatarUrl}
              alt=""
              width={32}
              height={32}
              sizes="32px"
              className="size-8 rounded-full object-cover"
            />
          </Link>
        </div>
      </div>
    </header>
  );
}
