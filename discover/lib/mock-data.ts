/**
 * Static fixtures used by the Discover homepage.
 * Replace the exports below with Drizzle queries; the function signatures
 * are what the UI consumes.
 */

import type { Product, ProductWithSeller, Seller } from "./types";

export const sellers: Seller[] = [
  {
    id: "s_1",
    handle: "lana.noir",
    displayName: "Lana Noir",
    tier: "gold",
    city: "Berlin",
    rating: 4.9,
    salesCount: 247,
    verified: true,
    avatarUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160&h=160&fit=crop&q=80",
  },
  {
    id: "s_2",
    handle: "mira.silk",
    displayName: "Mira Silk",
    tier: "gold",
    city: "Hamburg",
    rating: 4.8,
    salesCount: 198,
    verified: true,
    avatarUrl:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=160&h=160&fit=crop&q=80",
  },
  {
    id: "s_3",
    handle: "ivy.athletic",
    displayName: "Ivy Athletic",
    tier: "silver",
    city: "München",
    rating: 4.7,
    salesCount: 84,
    verified: true,
    avatarUrl:
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=160&h=160&fit=crop&q=80",
  },
  {
    id: "s_4",
    handle: "rae.linen",
    displayName: "Rae Linen",
    tier: "silver",
    city: "Köln",
    rating: 4.6,
    salesCount: 61,
    verified: false,
    avatarUrl:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=160&h=160&fit=crop&q=80",
  },
  {
    id: "s_5",
    handle: "june.vintage",
    displayName: "June Vintage",
    tier: "gold",
    city: "Leipzig",
    rating: 4.9,
    salesCount: 312,
    verified: true,
    avatarUrl:
      "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=160&h=160&fit=crop&q=80",
  },
  {
    id: "s_6",
    handle: "skye.cotton",
    displayName: "Skye Cotton",
    tier: "starter",
    city: "Berlin",
    rating: 4.5,
    salesCount: 22,
    verified: false,
    avatarUrl:
      "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=160&h=160&fit=crop&q=80",
  },
];

export const products: Product[] = [
  {
    id: "p_01",
    title: "Cotton Brief — White",
    basePriceCents: 2900,
    sellerId: "s_1",
    coverUrl:
      "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=900&h=1200&fit=crop&q=80",
    category: "slips",
    hasVideo: true,
    createdAt: "2026-04-23T10:14:00Z",
  },
  {
    id: "p_02",
    title: "Athletic Mesh Tanga",
    basePriceCents: 3400,
    sellerId: "s_3",
    coverUrl:
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=900&h=1200&fit=crop&q=80",
    category: "tangas",
    hasVideo: false,
    createdAt: "2026-04-22T18:02:00Z",
  },
  {
    id: "p_03",
    title: "Wool Knee-High Socks",
    basePriceCents: 2200,
    sellerId: "s_4",
    coverUrl:
      "https://images.unsplash.com/photo-1582738411706-bfc8e691d1c2?w=900&h=1200&fit=crop&q=80",
    category: "stockings",
    hasVideo: false,
    createdAt: "2026-04-21T08:30:00Z",
  },
  {
    id: "p_04",
    title: "Silk Lace Set",
    basePriceCents: 6900,
    sellerId: "s_2",
    coverUrl:
      "https://images.unsplash.com/photo-1485518882345-15568b007407?w=900&h=1200&fit=crop&q=80",
    category: "slips",
    hasVideo: true,
    createdAt: "2026-04-24T12:55:00Z",
  },
  {
    id: "p_05",
    title: "Cotton Boyshort 3-Day",
    basePriceCents: 4500,
    sellerId: "s_1",
    coverUrl:
      "https://images.unsplash.com/photo-1583846783214-7229a91b20ed?w=900&h=1200&fit=crop&q=80",
    category: "slips",
    hasVideo: true,
    createdAt: "2026-04-24T09:21:00Z",
  },
  {
    id: "p_06",
    title: "Vintage Lace Slip — Ivory",
    basePriceCents: 5200,
    sellerId: "s_5",
    coverUrl:
      "https://images.unsplash.com/photo-1561702856-71d2d8c2495f?w=900&h=1200&fit=crop&q=80",
    category: "vintage",
    hasVideo: false,
    createdAt: "2026-04-20T14:00:00Z",
  },
  {
    id: "p_07",
    title: "Sheer Stockings — Smoke",
    basePriceCents: 3800,
    sellerId: "s_2",
    coverUrl:
      "https://images.unsplash.com/photo-1583744946564-b52ac1c389c8?w=900&h=1200&fit=crop&q=80",
    category: "stockings",
    hasVideo: false,
    createdAt: "2026-04-19T17:45:00Z",
  },
  {
    id: "p_08",
    title: "Sport Compression Top",
    basePriceCents: 4100,
    sellerId: "s_3",
    coverUrl:
      "https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?w=900&h=1200&fit=crop&q=80",
    category: "sportswear",
    hasVideo: true,
    createdAt: "2026-04-23T20:11:00Z",
  },
  {
    id: "p_09",
    title: "Leather Loafers — Worn-In",
    basePriceCents: 8900,
    sellerId: "s_5",
    coverUrl:
      "https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=900&h=1200&fit=crop&q=80",
    category: "shoes",
    hasVideo: false,
    createdAt: "2026-04-18T09:08:00Z",
  },
  {
    id: "p_10",
    title: "Cotton Tanga — Black",
    basePriceCents: 2700,
    sellerId: "s_6",
    coverUrl:
      "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=900&h=1200&fit=crop&q=80",
    category: "tangas",
    hasVideo: false,
    createdAt: "2026-04-24T07:00:00Z",
  },
  {
    id: "p_11",
    title: "Custom Wool Socks — 7 Days",
    basePriceCents: 5900,
    sellerId: "s_4",
    coverUrl:
      "https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?w=900&h=1200&fit=crop&q=80",
    category: "custom",
    hasVideo: true,
    createdAt: "2026-04-22T11:30:00Z",
  },
  {
    id: "p_12",
    title: "Vintage Silk Camisole",
    basePriceCents: 7400,
    sellerId: "s_5",
    coverUrl:
      "https://images.unsplash.com/photo-1566207474742-de921626ad0c?w=900&h=1200&fit=crop&q=80",
    category: "vintage",
    hasVideo: false,
    createdAt: "2026-04-17T16:20:00Z",
  },
];

const sellersById: Map<string, Seller> = new Map(
  sellers.map((s) => [s.id, s] as const),
);

function attach(product: Product): ProductWithSeller {
  const seller = sellersById.get(product.sellerId);
  if (!seller) {
    throw new Error(`Mock data: missing seller ${product.sellerId}`);
  }
  return { ...product, seller };
}

export function getProductsWithSellers(): ProductWithSeller[] {
  return products.map(attach);
}

export function getLatestProducts(limit = 8): ProductWithSeller[] {
  return [...getProductsWithSellers()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function getPremiumProducts(limit = 8): ProductWithSeller[] {
  return getProductsWithSellers()
    .filter((p) => p.seller.tier === "gold")
    .slice(0, limit);
}

export function getNearbyProducts(
  city = "Berlin",
  limit = 8,
): ProductWithSeller[] {
  const all = getProductsWithSellers();
  const local = all.filter((p) => p.seller.city === city);
  const rest = all.filter((p) => p.seller.city !== city);
  return [...local, ...rest].slice(0, limit);
}

export function getTrendingProducts(limit = 8): ProductWithSeller[] {
  return [...getProductsWithSellers()]
    .sort((a, b) => b.seller.salesCount - a.seller.salesCount)
    .slice(0, limit);
}

/**
 * The seller currently featured at the top of the page (Hero).
 * In production this is a curated weekly slot.
 */
export function getTopCreatorOfTheWeek(): Seller {
  const seller = sellers.find((s) => s.id === "s_1");
  if (!seller) throw new Error("Mock data: top creator missing");
  return seller;
}

export function getTopCreatorCover(): string {
  return "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1800&h=1100&fit=crop&q=85";
}
