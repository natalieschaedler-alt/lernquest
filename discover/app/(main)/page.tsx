/**
 * Discover homepage.
 * Server component composing the Hero, four Netflix-style ContentRows,
 * and the Category pills. Mock data is sourced from lib/mock-data and
 * is structured so swapping in Drizzle queries later is a 1:1 swap.
 */
import { Hero } from "@/components/discover/Hero";
import { ContentRow } from "@/components/discover/ContentRow";
import { CategoryPills } from "@/components/discover/CategoryPills";
import {
  getLatestProducts,
  getNearbyProducts,
  getPremiumProducts,
  getTopCreatorCover,
  getTopCreatorOfTheWeek,
  getTrendingProducts,
} from "@/lib/mock-data";

export default function DiscoverPage() {
  const topCreator = getTopCreatorOfTheWeek();
  const heroCover = getTopCreatorCover();

  const latest = getLatestProducts(8);
  const premium = getPremiumProducts(8);
  const nearby = getNearbyProducts("Berlin", 8);
  const trending = getTrendingProducts(8);

  return (
    <div className="flex flex-col gap-8 pb-12 md:gap-12 md:pb-16">
      <Hero
        seller={topCreator}
        coverUrl={heroCover}
        headline="Lana Noir — Cotton Capsule Drop"
      />

      <ContentRow
        title="Frisch reingestellt"
        emoji="🆕"
        href="/discover/latest"
        items={latest}
        ariaLabel="Frisch reingestellte Listings"
      />

      <ContentRow
        title="Premium-Verkäufer"
        emoji="👑"
        href="/discover/premium"
        items={premium}
        ariaLabel="Premium-Verkäufer"
      />

      <ContentRow
        title="In deiner Nähe"
        emoji="📍"
        href="/discover/nearby"
        items={nearby}
        ariaLabel="Listings in deiner Nähe"
      />

      <ContentRow
        title="Trending Now"
        emoji="🔥"
        href="/discover/trending"
        items={trending}
        ariaLabel="Trending-Listings"
      />

      <CategoryPills />
    </div>
  );
}
