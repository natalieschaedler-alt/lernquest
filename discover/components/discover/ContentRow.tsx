/**
 * Horizontal Netflix-style row of ProductCards.
 * Renders a section header and a snap-scrolling track. Server component.
 */
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ProductCard } from "./ProductCard";
import type { ProductWithSeller } from "@/lib/types";

interface ContentRowProps {
  title: string;
  emoji?: string;
  href?: string;
  items: ProductWithSeller[];
  /** Used for aria-label on the scrolling region. */
  ariaLabel?: string;
}

export function ContentRow({
  title,
  emoji,
  href,
  items,
  ariaLabel,
}: ContentRowProps) {
  if (items.length === 0) return null;

  return (
    <section
      role="region"
      aria-label={ariaLabel ?? title}
      className="w-full"
    >
      <div className="mx-auto flex w-full max-w-7xl items-baseline justify-between gap-4 px-4 md:px-6">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-white md:text-xl">
          {emoji ? <span aria-hidden="true">{emoji}</span> : null}
          {title}
        </h2>
        {href ? (
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-0.5 text-sm font-medium text-white/60 hover:text-white"
          >
            Alle
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      <div
        className="scrollbar-hide mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pl-4 pr-4 md:pl-6 md:pr-6"
        style={{ scrollPaddingLeft: "1rem" }}
      >
        {items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
        {/* trailing spacer so the last card snaps cleanly */}
        <div aria-hidden="true" className="w-2 shrink-0" />
      </div>
    </section>
  );
}
