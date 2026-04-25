/**
 * Static category filter pills.
 * Server component. Each pill is a link to the corresponding listing page.
 */
import Link from "next/link";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Pill {
  slug: Category;
  label: string;
  emoji: string;
}

const PILLS: Pill[] = [
  { slug: "slips", label: "Slips", emoji: "🩲" },
  { slug: "tangas", label: "Tangas", emoji: "✨" },
  { slug: "stockings", label: "Strümpfe", emoji: "🧦" },
  { slug: "sportswear", label: "Sportswear", emoji: "🏃" },
  { slug: "shoes", label: "Schuhe", emoji: "👟" },
  { slug: "vintage", label: "Vintage", emoji: "🕰️" },
  { slug: "custom", label: "Custom Requests", emoji: "✏️" },
];

export function CategoryPills() {
  return (
    <section
      role="region"
      aria-label="Kategorien"
      className="mx-auto w-full max-w-7xl px-4 md:px-6"
    >
      <h2 className="sr-only">Kategorien</h2>
      <ul className="flex flex-wrap gap-2">
        {PILLS.map((pill) => (
          <li key={pill.slug}>
            <Link
              href={`/c/${pill.slug}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium",
                "bg-white/[0.06] text-white/80",
                "border border-white/[0.08]",
                "transition-colors hover:bg-white/[0.12] hover:text-white",
              )}
            >
              <span aria-hidden="true">{pill.emoji}</span>
              {pill.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
