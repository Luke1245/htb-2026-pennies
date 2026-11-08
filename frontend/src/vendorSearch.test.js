import { expect, test, vi } from 'vitest'
import { fetchVendorNames, matchingVendors } from './vendorSearch.js'

test('fuzzy vendor search ranks prefixes, missing letters, and swapped letters', () => {
  const vendors = ['Pret', 'Tesco', 'Pret A Manger']
  expect(matchingVendors(vendors, 'Prt')).toEqual(['Pret', 'Pret A Manger'])
  expect(matchingVendors(vendors, 'Pert')).toEqual(['Pret', 'Pret A Manger'])
  expect(matchingVendors(vendors, 'tes')).toEqual(['Tesco'])
  expect(matchingVendors(vendors, 'zzzz')).toEqual([])
  expect(matchingVendors(vendors, '')).toEqual(['Pret', 'Pret A Manger', 'Tesco'])
})

test('vendor names come from every ordinary page and skip adjustments', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const offset = new URL(url).searchParams.get('offset')
      const transactions =
        offset === '0'
          ? [
              { vendor: 'Tesco', kind: 'ordinary' },
              { vendor: 'Adjustment', kind: 'adjustment' },
            ]
          : [
              { vendor: 'Pret', kind: 'ordinary' },
              { vendor: null, kind: 'transfer' },
            ]
      return {
        ok: true,
        json: async () => ({
          transactions,
          next_offset: offset === '0' ? 100 : null,
        }),
      }
    }),
  )

  await expect(fetchVendorNames(async () => 'token')).resolves.toEqual(['Pret', 'Tesco'])
})
