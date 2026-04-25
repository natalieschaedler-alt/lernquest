"use client";

/**
 * Featured top creator hero.
 * Client component because of the Ken-Burns scale animation that loops
 * subtly behind the foreground content.
 */
import Image from "next/image";
import { motion } from "motion/react";
import { Star, MapPin, BadgeCheck } from "lucide-react";
import type { Seller } from "@/lib/types";
import { cn } from "@/lib/utils";

interface HeroProps {
  seller: Seller;
  coverUrl: string;
  headline: string;
}

export function Hero({ seller, coverUrl, headline }: HeroProps) {
  return (
    <section
      aria-label="Top Creator der Woche"
      className="relative w-full overflow-hidden lg:rounded-b-3xl"
    >
      <div className="relative aspect-[4/5] w-full md:aspect-[16/9]">
        <motion.div
          initial={{ scale: 1 }}
          animate={{ scale: 1.05 }}
          transition={{
            duration: 20,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "mirror",
          }}
          className="absolute inset-0"
        >
          <Image
            src={coverUrl}
            alt={`Cover-Bild von @${seller.handle}`}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </motion.div>

        {/* Gradient overlay */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent"
        />

        {/* Foreground content */}
        <div className="absolute inset-x-0 bottom-0 p-6 md:p-10">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white backdrop-blur">
                <BadgeCheck className="size-3.5 text-[color:var(--accent-primary)]" />
                Verifiziert
              </span>
              <span className="font-medium text-white/80">@{seller.handle}</span>
              <span className="text-white/30">·</span>
              <span className="text-xs uppercase tracking-wider text-white/60">
                Top Creator der Woche
              </span>
            </div>

            <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-white md:text-5xl">
              {headline}
            </h1>

            <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/60">
              <li className="inline-flex items-center gap-1">
                <Star
                  className="size-4 fill-[color:var(--accent-gold)] text-[color:var(--accent-gold)]"
                  aria-hidden="true"
                />
                <span className="tnum text-white">{seller.rating.toFixed(1)}</span>
              </li>
              <li aria-hidden="true" className="text-white/30">·</li>
              <li className="tnum">
                <span className="text-white">{seller.salesCount}</span> Sales
              </li>
              <li aria-hidden="true" className="text-white/30">·</li>
              <li className="inline-flex items-center gap-1">
                <MapPin className="size-4" aria-hidden="true" />
                <span className="uppercase tracking-wider">{seller.city}</span>
              </li>
            </ul>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                aria-label={`Profil von @${seller.handle} ansehen`}
                className={cn(
                  "h-11 rounded-full bg-white px-6 text-sm font-semibold text-black",
                  "transition-transform hover:scale-[1.02] active:scale-[0.98]",
                )}
              >
                Profil ansehen
              </button>
              <button
                type="button"
                aria-label={`@${seller.handle} folgen`}
                className={cn(
                  "h-11 rounded-full px-6 text-sm font-semibold text-white",
                  "bg-white/[0.08] backdrop-blur-xl border border-white/[0.16]",
                  "transition-colors hover:bg-white/[0.14]",
                )}
              >
                Folgen
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
