import { expect, test } from 'vitest'
import {
  amountMessage,
  londonDateTimeLocal,
  signedAmount,
  transactionBody,
  validationMessage,
} from './transactionForm.js'

const now = new Date('2026-11-07T12:00:00Z')

test('london wall time follows Europe/London through British Summer Time', () => {
  expect(londonDateTimeLocal(new Date('2026-11-07T00:30:00Z'))).toBe('2026-11-07T00:30')
  expect(londonDateTimeLocal(new Date('2026-06-30T23:30:00Z'))).toBe('2026-07-01T00:30')
})

test('amounts accept pounds and one or two decimal places', () => {
  expect(amountMessage('3.4')).toBe('')
  expect(amountMessage('3.40')).toBe('')
  expect(amountMessage('1850')).toBe('')
  expect(amountMessage('0')).toBe('Enter an amount greater than zero.')
  expect(amountMessage('0.00')).toBe('Enter an amount greater than zero.')
  expect(amountMessage('')).toBe('Enter an amount in pounds and pence.')
  expect(amountMessage('£3.40')).toBe('Enter an amount in pounds and pence.')
  expect(amountMessage('-3.40')).toBe('Enter an amount in pounds and pence.')
  expect(amountMessage('3.456')).toBe('Enter an amount in pounds and pence.')
})

test('a future UK date is refused and today is accepted', () => {
  const fields = {
    accountId: 'acc-1',
    direction: 'outflow',
    amount: '3.40',
    vendor: 'Pret',
    note: '',
    when: '2026-11-07',
  }
  expect(validationMessage(fields, now)).toBe('')
  expect(validationMessage({ ...fields, when: '2026-11-08' }, now)).toBe(
    'Choose a date that is today or in the past.',
  )
})

test('the create body uses a signed amount and a London moment', () => {
  expect(
    transactionBody({
      accountId: 'acc-1',
      direction: 'outflow',
      amount: '3.4',
      vendor: '  Pret ',
      note: '   ',
      when: '2026-10-15',
    }),
  ).toEqual({
    account_id: 'acc-1',
    amount: '-3.40',
    vendor: 'Pret',
    note: null,
    occurred_at: '2026-10-15T00:00:00',
  })
  expect(signedAmount('1850', 'inflow')).toBe('1850.00')
})

test('vendor and note limits are explained before sending', () => {
  const fields = {
    accountId: 'acc-1',
    direction: 'inflow',
    amount: '1',
    vendor: 'A'.repeat(121),
    note: '',
    when: '2026-11-07',
  }
  expect(validationMessage(fields, now)).toBe('A Vendor must be 120 characters or fewer.')
  expect(validationMessage({ ...fields, vendor: 'Employer', note: 'n'.repeat(501) }, now)).toBe(
    'A note must be 500 characters or fewer.',
  )
})
