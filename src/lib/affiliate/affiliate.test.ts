import { afterEach, describe, expect, it, vi } from 'vitest';
import { bestSellers, fullImage, productDetails } from './canopy';
import { rankProducts } from './rank';
import type { ListedProduct } from './types';

const item = (asin: string, over: Partial<ListedProduct> = {}): ListedProduct => ({
  asin,
  title: `Product ${asin}`,
  imageUrl: 'https://m.media-amazon.com/images/I/x.jpg',
  price: { display: '$10.00', value: 10 },
  rating: 4.6,
  ratingsTotal: 5000,
  bestSellersRank: null,
  isPrime: false,
  sponsored: false,
  coupon: null,
  brand: null,
  images: [],
  featureBullets: [],
  ...over,
});

describe('rankProducts', () => {
  it('ranks best sellers by sales and rating, and skips sponsored and image-less ones', () => {
    const items = [
      item('A', { bestSellersRank: 1, rating: 3.7, ratingsTotal: 25000 }), // sells most, rated low
      item('B', { bestSellersRank: 2, rating: 4.8, ratingsTotal: 6500 }),
      item('C', { bestSellersRank: 3, rating: 4.6, ratingsTotal: 26000, isPrime: true }),
      item('D', { bestSellersRank: 4, sponsored: true }),
      item('E', { bestSellersRank: 5, imageUrl: null }),
    ];
    const ranked = rankProducts(items, 'bestsellers');
    expect(ranked.map((p) => p.asin)).toEqual(['B', 'C', 'A']); // A only fills the list, and last
    expect(ranked[0].reasons).toEqual(['#2 best seller', '4.8★ from 6,500 ratings']);
    expect(ranked[1].reasons).toContain('Prime');
    expect(ranked[2].reasons).toContain('rated under 4★: check reviews first');
  });

  it('keeps the strict quality bar when there are enough products', () => {
    const items = [...Array.from({ length: 12 }, (_, i) => item(`G${i}`, { bestSellersRank: i + 2 })), item('LOW', { bestSellersRank: 1, rating: 3.9 })];
    const ranked = rankProducts(items, 'bestsellers');
    expect(ranked).toHaveLength(10);
    expect(ranked.map((p) => p.asin)).not.toContain('LOW');
  });

  it('ranks a keyword search by rating and reviews', () => {
    const ranked = rankProducts([item('few', { rating: 4.9, ratingsTotal: 120 }), item('many', { rating: 4.7, ratingsTotal: 40000 }), item('dupe'), item('dupe')], 'keyword');
    expect(ranked.map((p) => p.asin)).toEqual(['many', 'dupe', 'few']);
  });
});

describe('canopy', () => {
  afterEach(() => vi.unstubAllGlobals());
  const respond = (body: unknown, status = 200) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(body), { status })),
    );

  it('turns list thumbnails into full images', () => {
    expect(fullImage('https://images-na.ssl-images-amazon.com/images/I/717n+0jibbL._AC_UL300_SR300,200_.jpg')).toBe(
      'https://images-na.ssl-images-amazon.com/images/I/717n+0jibbL.jpg',
    );
    expect(fullImage('https://m.media-amazon.com/images/I/81SwkEB4iQL.jpg')).toBe('https://m.media-amazon.com/images/I/81SwkEB4iQL.jpg');
  });

  it('reads a best-seller list and its sub-categories', async () => {
    process.env.CANOPY_API_KEY = 'test';
    respond({
      data: {
        amazonBestSellers: {
          productResults: {
            results: [
              {
                title: 'Drift Wood Car Air Freshener',
                asin: 'B0C1HJV7BJ',
                brand: 'drift',
                price: { symbol: '$', value: 12.95, display: '$12.95' },
                mainImageUrl: 'https://x/I/a._AC_UL300_.jpg',
                imageUrls: ['https://x/I/a.jpg', 'https://x/I/b.jpg'],
                featureBullets: ['MADE IN THE USA', ''],
                rating: 3.7,
                ratingsTotal: 25226,
                bestSellersRank: 1,
              },
              { title: 'no asin' },
            ],
          },
          categoryInfo: {
            currentCategory: { name: 'Automotive', id: 'automotive' },
            parentCategory: null,
            childCategories: [
              { name: 'Car Care', id: '15718271', url: 'https://www.amazon.com/Best-Sellers-Automotive-Car-Care/zgbs/automotive/15718271/ref=x' },
              { name: 'Bad', id: '1', url: 'https://evil.example/zgbs/' },
            ],
          },
        },
      },
    });
    const r = await bestSellers({ categoryId: 'bestsellers_automotive' }, 'US');
    expect(r.products).toEqual([
      expect.objectContaining({
        asin: 'B0C1HJV7BJ',
        imageUrl: 'https://x/I/a.jpg',
        price: { display: '$12.95', value: 12.95 },
        bestSellersRank: 1,
        // Details come with the list: one request, no product call later.
        brand: 'drift',
        images: ['https://x/I/a.jpg', 'https://x/I/b.jpg'],
        featureBullets: ['MADE IN THE USA'],
      }),
    ]);
    const call = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(call[0]).toBe('https://graphql.canopyapi.co/');
    expect(JSON.parse(String(call[1].body)).variables).toEqual({ input: { domain: 'US', categoryId: 'bestsellers_automotive' } });
    expect(r.category).toEqual({
      current: { id: 'automotive', name: 'Automotive' },
      parent: null,
      children: [
        { id: '15718271', name: 'Car Care', url: 'https://www.amazon.com/Best-Sellers-Automotive-Car-Care/zgbs/automotive/15718271/ref=x' },
        { id: '1', name: 'Bad' }, // a URL that isn't Amazon's is dropped
      ],
    });
  });

  it('reads product details: unique images, bullets and categories', async () => {
    process.env.CANOPY_API_KEY = 'test';
    respond({
      data: {
        amazonProduct: {
          asin: 'B0C1HJV7BJ',
          title: 'Drift Wood Car Air Freshener',
          brand: 'drift',
          mainImageUrl: 'https://m.media-amazon.com/1.jpg',
          imageUrls: ['https://m.media-amazon.com/1.jpg', 'https://m.media-amazon.com/2.jpg', 'http://insecure/3.jpg'],
          featureBullets: ['MADE IN THE USA', ''],
          categories: [{ name: 'Automotive' }, { name: 'Air Fresheners' }],
          rating: 3.7,
          ratingsTotal: 25226,
        },
      },
    });
    const d = await productDetails('B0C1HJV7BJ', 'US');
    expect(d.images).toEqual(['https://m.media-amazon.com/1.jpg', 'https://m.media-amazon.com/2.jpg']);
    expect(d.featureBullets).toEqual(['MADE IN THE USA']);
    expect(d.categories).toEqual(['Automotive', 'Air Fresheners']);
  });

  it('turns a Canopy failure into a message the creator can act on', async () => {
    process.env.CANOPY_API_KEY = 'test';
    respond({ error: 'x' }, 500);
    await expect(productDetails('B0C1HJV7BJ', 'US')).rejects.toThrow(/isn’t available right now/);
  });
});
