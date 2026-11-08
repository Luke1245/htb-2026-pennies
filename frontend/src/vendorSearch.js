import { apiUrl, authHeaders } from './api.js'

const RESULT_LIMIT = 8

export function vendorNames(transactions) {
  const names = new Set()
  for (const transaction of transactions) {
    if (transaction.kind !== 'ordinary') continue
    const vendor = transaction.vendor?.trim()
    if (!vendor || vendor === 'Adjustment') continue
    names.add(vendor)
  }
  return [...names].sort((left, right) => left.localeCompare(right, 'en-GB'))
}

export async function fetchVendorNames(getAccessTokenSilently) {
  const headers = await authHeaders(getAccessTokenSilently)
  const transactions = []
  const seenOffsets = new Set()
  let offset = 0
  while (!seenOffsets.has(offset)) {
    seenOffsets.add(offset)
    const response = await fetch(
      `${apiUrl}/transactions?limit=100&offset=${offset}`,
      { headers },
    )
    if (!response.ok) throw new Error('Pennies could not load your vendors')
    const page = await response.json()
    transactions.push(...page.transactions)
    if (page.next_offset == null) break
    offset = page.next_offset
  }
  return vendorNames(transactions)
}

export function matchingVendors(vendors, query) {
  const needle = query.trim().toLowerCase()
  const ranked = vendors.map((vendor) => ({
    vendor,
    score: needle ? matchScore(vendor.toLowerCase(), needle) : 1,
  }))
  return ranked
    .filter((item) => item.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || left.vendor.localeCompare(right.vendor, 'en-GB'),
    )
    .slice(0, RESULT_LIMIT)
    .map((item) => item.vendor)
}

function matchScore(hay, needle) {
  if (hay === needle) return 1000
  if (hay.startsWith(needle)) return 800
  if (hay.includes(needle)) return 600
  if (isSubsequence(needle, hay)) return 400
  const distance = closestDistance(hay, needle)
  const limit = needle.length <= 4 ? 1 : 2
  if (distance <= limit) return 200 - distance
  return 0
}

function isSubsequence(needle, hay) {
  let index = 0
  for (const character of hay) {
    if (character === needle[index]) index += 1
    if (index === needle.length) return true
  }
  return false
}

function closestDistance(hay, needle) {
  let best = Infinity
  for (const candidate of [hay, ...hay.split(/\s+/)]) {
    if (Math.abs(candidate.length - needle.length) > 2) continue
    best = Math.min(best, editDistance(needle, candidate))
  }
  return best
}

function editDistance(left, right) {
  const rows = left.length + 1
  const columns = right.length + 1
  const costs = Array.from({ length: rows }, () => new Array(columns).fill(0))
  for (let row = 0; row < rows; row += 1) costs[row][0] = row
  for (let column = 0; column < columns; column += 1) costs[0][column] = column
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const substitution = left[row - 1] === right[column - 1] ? 0 : 1
      costs[row][column] = Math.min(
        costs[row - 1][column] + 1,
        costs[row][column - 1] + 1,
        costs[row - 1][column - 1] + substitution,
      )
      if (
        row > 1 &&
        column > 1 &&
        left[row - 1] === right[column - 2] &&
        left[row - 2] === right[column - 1]
      ) {
        costs[row][column] = Math.min(costs[row][column], costs[row - 2][column - 2] + 1)
      }
    }
  }
  return costs[left.length][right.length]
}
