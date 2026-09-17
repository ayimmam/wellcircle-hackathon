import { describe, it, expect } from 'vitest';
import { partitionByImage, postHasImage, eventHasImage } from '../utils/feedOrdering';

describe('partitionByImage', () => {
  it('moves items with an image to the front, each group keeping its order', () => {
    const items = [
      { id: 1, post: { photo_url: null } },
      { id: 2, post: { photo_url: 'x.jpg' } },
      { id: 3, post: { photo_url: null } },
      { id: 4, post: { photo_url: 'y.jpg' } },
    ];
    expect(partitionByImage(items, postHasImage).map(i => i.id)).toEqual([2, 4, 1, 3]);
  });

  it('handles an empty pool', () => {
    expect(partitionByImage([], postHasImage)).toEqual([]);
  });

  it('handles all-text input unchanged', () => {
    const items = [
      { id: 1, post: { photo_url: null } },
      { id: 2, post: { photo_url: undefined } },
    ];
    expect(partitionByImage(items, postHasImage).map(i => i.id)).toEqual([1, 2]);
  });

  it('handles all-media input unchanged', () => {
    const items = [
      { id: 1, post: { photo_url: 'a.jpg' } },
      { id: 2, post: { photo_url: 'b.jpg' } },
    ];
    expect(partitionByImage(items, postHasImage).map(i => i.id)).toEqual([1, 2]);
  });

  it('eventHasImage reads the provider cover photo', () => {
    const items = [
      { id: 1, provider: { cover_photo_url: null } },
      { id: 2, provider: { cover_photo_url: 'cover.jpg' } },
    ];
    expect(partitionByImage(items, eventHasImage).map(i => i.id)).toEqual([2, 1]);
  });
});
