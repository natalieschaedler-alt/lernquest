/**
 * Single listing card used inside ContentRow.
 * Server component — purely presentational. Hover scale comes from CSS.
 */
import Link from "next/link";
import Image from "next/image";
import { Crown, PlayCircle } from "lucide-react";
import type { ProductWithSeller } from "@/lib/types";
import { cn, formatPrice } from "@/lib/utils";

interface ProductCardProps {
  product: ProductWithSeller;
}

export function ProductCard({ product }: ProductCardProps) {
  const { seller } = product;
  const isPremium = seller.tier === "gold";

  return (
    <Link
      href={`/p/${product.id}`}
      aria-label={`${product.title} von @${seller.handle}, ${formatPrice(product.basePriceCents)}`}
      className={cn(
        "group relative block shrink-0 snap-start",
        "w-[160px] sm:w-[200px]",
      )}
    >
      <div
        className={cn(
          "relative aspect-[3/4] w-full overflow-hidden rounded-2xl",
          "bg-[color:var(--bg-elevated)]",
          "transition-transform duration-300 ease-out group-hover:scale-105",
          "shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
        )}
      >
        <Image
          src={product.coverUrl}
          alt={product.title}
          fill
          sizes="(min-width: 640px) 200px, 160px"
          className="object-cover"
        />

        {/* bottom gradient */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent"
        />

        {/* premium badge */}
        {isPremium ? (
          <span
            aria-label="Premium-Verkäufer"
            className={cn(
              "absolute left-2 top-2 inline-flex items-center gap-1 rounded-full",
              "px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-black",
              "bg-gold-gradient shadow-md",
            )}
          >
            <Crown className="size-3" aria-hidden="true" />
            Premium
          </span>
        ) : null}

        {product.hasVideo ? (
          <span
            aria-label="Mit Video"
            className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/50 text-white backdrop-blur"
          >
            <PlayCircle className="size-4" aria-hidden="true" />
          </span>
        ) : null}

        {/* meta overlay */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-3 text-white">
          <span className="text-[11px] font-medium text-white/70">
            @{seller.handle}
          </span>
          <span className="line-clamp-2 text-sm font-semibold leading-tight">
            {product.title}
          </span>
          <span className="tnum text-sm font-bold text-white">
            {formatPrice(product.basePriceCents)}
          </span>
        </div>
      </div>
    </Link>
  );
}
