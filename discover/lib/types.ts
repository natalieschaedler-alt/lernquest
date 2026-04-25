/**
 * Domain types for the Discover surface.
 * These mirror the future Drizzle schema closely enough that swapping mock
 * data for real queries should be a near drop-in change.
 */

export type Tier = "starter" | "silver" | "gold";

export type Category =
  | "slips"
  | "tangas"
  | "stockings"
  | "sportswear"
  | "shoes"
  | "vintage"
  | "custom";

export interface Seller {
  id: string;
  handle: string;
  displayName: string;
  tier: Tier;
  city: string;
  rating: number;
  salesCount: number;
  verified: boolean;
  avatarUrl: string;
}

export interface Product {
  id: string;
  title: string;
  basePriceCents: number;
  sellerId: string;
  coverUrl: string;
  category: Category;
  hasVideo: boolean;
  createdAt: string;
}

export interface ProductWithSeller extends Product {
  seller: Seller;
}
