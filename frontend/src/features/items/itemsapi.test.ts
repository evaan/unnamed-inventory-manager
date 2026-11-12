import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('inventory API routing', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each([
    { apiURL: undefined, expected: '/api/items' },
    { apiURL: '/api/', expected: '/api/items' },
    { apiURL: 'https://inventory.example.com/api/', expected: 'https://inventory.example.com/api/items' },
  ])('requests items from $expected', async ({ apiURL, expected }) => {
    vi.stubEnv('VITE_API_URL', apiURL);
    const { getItems } = await import('./itemsapi');

    expect(await getItems()).toEqual([]);
    expect(fetch).toHaveBeenCalledWith(expected, expect.objectContaining({
      method: 'GET',
      credentials: 'include',
    }));
  });
});
