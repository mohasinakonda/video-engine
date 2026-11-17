/** Amazon products as Canopy returns them, normalised, and the niches the page offers. */
export const DOMAINS = ['US'] as const;
export type Domain = (typeof DOMAINS)[number];

export interface Price {
  display: string;
  value: number;
}

/** A product from a best-seller list or a search. */
export interface ListedProduct {
  asin: string;
  title: string;
  imageUrl: string | null;
  price: Price | null;
  rating: number | null;
  ratingsTotal: number | null;
  /** Position on Amazon's best-seller list (best-seller searches only). */
  bestSellersRank: number | null;
  isPrime: boolean;
  sponsored: boolean;
  coupon: string | null;
  /** From the same GraphQL call as the list, so opening a product needs no second call. */
  brand: string | null;
  images: string[];
  featureBullets: string[];
}

export interface RankedProduct extends ListedProduct {
  /** 1–10 on our list. */
  rank: number;
  score: number;
  reasons: string[];
}

export interface ProductDetails {
  asin: string;
  title: string;
  brand: string | null;
  images: string[];
  featureBullets: string[];
  rating: number | null;
  ratingsTotal: number | null;
  price: Price | null;
  categories: string[];
  isPrime: boolean;
}

export interface Category {
  id: string;
  name: string;
  /** Amazon's best-seller page: sub-categories are fetched by it (their ids alone return nothing). */
  url?: string;
}

export interface SearchResult {
  mode: 'bestsellers' | 'keyword';
  /** What was searched: the category name or the keyword. */
  label: string;
  domain: Domain;
  products: RankedProduct[];
  /** For best sellers: the category and its sub-categories, to narrow down. */
  category: { current: Category; parent: Category | null; children: Category[] } | null;
  searchedAt: string;
}

/** Niches shown as chips (Amazon best-seller categories, US ids). */
export const NICHES: Category[] = [
  { id: 'bestsellers_automotive', name: 'Car Care' },
  { id: 'bestsellers_kitchen', name: 'Kitchen & Dining' },
  { id: 'bestsellers_home_garden', name: 'Home & Kitchen' },
  { id: 'bestsellers_pet_supplies', name: 'Pet Supplies' },
  { id: 'bestsellers_beauty', name: 'Beauty' },
  { id: 'bestsellers_hpc', name: 'Health & Household' },
  { id: 'bestsellers_sporting_goods', name: 'Fitness & Outdoors' },
  { id: 'bestsellers_hi', name: 'Tools' },
  { id: 'bestsellers_electronics', name: 'Electronics' },
  { id: 'bestsellers_wireless', name: 'Phone Accessories' },
  { id: 'bestsellers_pc', name: 'Computer Accessories' },
  { id: 'bestsellers_office_products', name: 'Home Office' },
  { id: 'bestsellers_baby_products', name: 'Baby' },
  { id: 'bestsellers_toys_and_games', name: 'Toys & Games' },
  { id: 'bestsellers_lawn_garden', name: 'Garden' },
  { id: 'bestsellers_arts_crafts', name: 'Arts & Crafts' },
];
