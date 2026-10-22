import { describe, expect, it } from 'vitest';
import { formatAgo } from './format';

describe('formatAgo', () => {
  it('picks the largest whole unit', () => {
    expect([0, 1, 2, 6, 7, 13, 29, 30, 59, 364, 365, 1111].map(formatAgo)).toEqual([
      'today',
      '1 day ago',
      '2 days ago',
      '6 days ago',
      '1 week ago',
      '1 week ago',
      '4 weeks ago',
      '1 month ago',
      '1 month ago',
      '12 months ago',
      '1 year ago',
      '3 years ago',
    ]);
  });
});
