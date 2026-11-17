import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addProduct, createStore, productInputSchema, StoreError, updateProduct, updateStoreSchema } from './repo';
import { amazonProductUrl, asinFrom, handleProblem, isAmazonTag, normalizeCategory, normalizeTags, slugTag } from './validation';

// A tiny fake of the store database: records each query and answers from `fake.next`.
type Call = { table: string; op: string; filters: [string, unknown][]; values?: unknown; rpc?: string; args?: unknown };
const fake = vi.hoisted(() => ({ calls: [] as Call[], answers: [] as { data: unknown; error: unknown }[] }));
vi.mock('./db', () => {
  const builder = (table: string) => {
    const call: Call = { table, op: 'select', filters: [] };
    fake.calls.push(call);
    const b: Record<string, unknown> = {};
    const chain =
      (name: string) =>
      (...args: unknown[]) => {
        if (['eq', 'contains', 'not', 'textSearch'].includes(name)) call.filters.push([`${name}:${String(args[0])}`, args[1]]);
        if (['insert', 'update', 'upsert', 'delete'].includes(name)) {
          call.op = name;
          call.values = args[0];
        }
        return b;
      };
    for (const m of ['select', 'eq', 'contains', 'not', 'textSearch', 'order', 'limit', 'insert', 'update', 'upsert', 'delete']) b[m] = chain(m);
    const answer = () => Promise.resolve(fake.answers.shift() ?? { data: null, error: null });
    b.maybeSingle = answer;
    b.single = answer;
    b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => answer().then(res, rej);
    return b;
  };
  return {
    getStoreClient: () => ({
      from: builder,
      rpc: (rpc: string, args: unknown) => {
        fake.calls.push({ table: '', op: 'rpc', filters: [], rpc, args });
        return Promise.resolve(fake.answers.shift() ?? { data: null, error: null });
      },
    }),
  };
});

describe('validation', () => {
  it('checks handles', () => {
    expect(handleProblem('@DetailDose')).toBeNull();
    expect(handleProblem('ab')).toMatch(/at least 3/);
    expect(handleProblem('my handle')).toMatch(/letters, numbers/);
    expect(handleProblem('.dots')).toMatch(/letters, numbers/);
    expect(handleProblem('a..b')).toMatch(/two dots/);
    expect(handleProblem('admin')).toMatch(/reserved/);
  });

  it('reads an ASIN from a link or as typed', () => {
    expect(asinFrom('b0abcdef12')).toBe('B0ABCDEF12');
    expect(asinFrom('https://www.amazon.com/Some-Product/dp/B0ABCDEF12/ref=sr_1_1?keywords=x')).toBe('B0ABCDEF12');
    expect(asinFrom('https://www.amazon.com/gp/product/B0ABCDEF12')).toBe('B0ABCDEF12');
    expect(asinFrom('not an asin')).toBeNull();
  });

  it('slugs tags, drops repeats and caps them', () => {
    expect(slugTag('  Car Gadgets!! 11/13 ')).toBe('car-gadgets-1113');
    expect(normalizeTags(['Car Gadgets', 'car-gadgets', '', '—', 'Must Have'])).toEqual(['car-gadgets', 'must-have']);
    expect(normalizeTags(Array.from({ length: 30 }, (_, i) => `t${i}`))).toHaveLength(20);
  });

  it('keeps categories free text, or none', () => {
    expect(normalizeCategory('  Interior   Care ')).toBe('Interior Care');
    expect(normalizeCategory('   ')).toBeNull();
    expect(normalizeCategory(null)).toBeNull();
  });

  it('builds the Amazon link with the store ID and marketplace', () => {
    expect(isAmazonTag('detaildose-20')).toBe(true);
    expect(isAmazonTag('detaildose')).toBe(false);
    expect(amazonProductUrl('b0abcdef12', 'detaildose-20')).toBe('https://www.amazon.com/dp/B0ABCDEF12?tag=detaildose-20');
    expect(amazonProductUrl('B0ABCDEF12', null, 'UK')).toBe('https://www.amazon.co.uk/dp/B0ABCDEF12');
  });
});

describe('input schemas', () => {
  it('normalises a product before it is saved', () => {
    const p = productInputSchema.parse({
      asin: ' b0abcdef12 ',
      name: ' Mini Extractor ',
      imageUrl: 'https://m.media-amazon.com/a.jpg',
      source: 'canopy',
      category: '  Interior ',
      tags: ['Car Gadgets'],
    });
    expect(p).toMatchObject({ asin: 'B0ABCDEF12', name: 'Mini Extractor', category: 'Interior', tags: ['car-gadgets'], blurb: null, images: [] });
  });

  it('refuses a bad ASIN, an http image and a bad Amazon store ID', () => {
    expect(productInputSchema.safeParse({ asin: 'short', name: 'n', imageUrl: null, source: 'manual' }).success).toBe(false);
    expect(productInputSchema.safeParse({ asin: 'B0ABCDEF12', name: 'n', imageUrl: 'http://x.com/a.jpg', source: 'manual' }).success).toBe(false);
    expect(updateStoreSchema.safeParse({ amazonTag: 'nope' }).success).toBe(false);
    expect(updateStoreSchema.parse({ amazonTag: '', imagekitUrlEndpoint: 'https://ik.imagekit.io/abc/' })).toEqual({
      amazonTag: null,
      imagekitUrlEndpoint: 'https://ik.imagekit.io/abc',
    });
  });
});

describe('repo', () => {
  beforeEach(() => {
    fake.calls = [];
    fake.answers = [];
  });

  it('creates a store with a normalised handle', async () => {
    fake.answers = [
      { data: null, error: null }, // no store yet
      { data: { id: 's1', handle: 'detaildose', display_name: 'Detail Dose', links: [], marketplace: 'US' }, error: null },
    ];
    const store = await createStore('u1', { handle: '@DetailDose', displayName: 'Detail Dose' });
    expect(store.handle).toBe('detaildose');
    expect(fake.calls[1]).toMatchObject({ table: 'stores', op: 'insert', values: { owner_user_id: 'u1', handle: 'detaildose' } });
  });

  it('says the handle was taken when the insert hits the unique handle', async () => {
    fake.answers = [
      { data: null, error: null },
      { data: null, error: { code: '23505' } },
      { data: null, error: null }, // still no store for this user, so it was the handle
    ];
    await expect(createStore('u1', { handle: 'taken', displayName: 'X' })).rejects.toMatchObject({ code: 'handle_taken' });
  });

  it('refuses a second store', async () => {
    fake.answers = [
      { data: { id: 's1', handle: 'mine', display_name: 'Me', links: [] }, error: null },
      { data: null, error: null },
    ];
    await expect(createStore('u1', { handle: 'another', displayName: 'X' })).rejects.toBeInstanceOf(StoreError);
  });

  it('adds through the merge function and reports an existing ASIN', async () => {
    fake.answers = [
      { data: [{ id: 'p1', existed: true }], error: null },
      { data: { id: 'p1', asin: 'B0ABCDEF12', name: 'Mini', tags: ['a', 'b'], show: true, sort_order: 0 }, error: null },
    ];
    const r = await addProduct('s1', { asin: 'B0ABCDEF12', name: 'Mini', imageUrl: null, source: 'canopy', tags: ['b'] });
    expect(r.existed).toBe(true);
    expect(r.product.tags).toEqual(['a', 'b']);
    expect(fake.calls[0]).toMatchObject({ op: 'rpc', rpc: 'add_store_product', args: { p_store_id: 's1', p_asin: 'B0ABCDEF12', p_tags: ['b'] } });
  });

  it('only edits a product inside the given store', async () => {
    fake.answers = [{ data: null, error: null }];
    await expect(updateProduct('s1', 'p-of-someone-else', { show: false })).rejects.toMatchObject({ code: 'not_found' });
    expect(fake.calls[0].filters).toEqual([
      ['eq:id', 'p-of-someone-else'],
      ['eq:store_id', 's1'],
    ]);
  });
});
