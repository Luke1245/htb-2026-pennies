const LONDON = 'Europe/London'
const AMOUNT = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/

export function londonDateTimeLocal(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const value = (type) => parts.find((part) => part.type === type).value
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`
}

export function londonDate(date) {
  return londonDateTimeLocal(date).slice(0, 10)
}

export function amountMessage(raw) {
  const text = raw.trim()
  if (!text) return 'Enter an amount in pounds and pence.'
  if (!AMOUNT.test(text)) return 'Enter an amount in pounds and pence.'
  if (Number(text) === 0) return 'Enter an amount greater than zero.'
  return ''
}

export function validationMessage(fields, now) {
  if (!fields.accountId) return 'Choose an Account.'
  if (fields.direction !== 'inflow' && fields.direction !== 'outflow') {
    return 'Choose Inflow or Outflow.'
  }
  const amount = amountMessage(fields.amount)
  if (amount) return amount
  const vendor = fields.vendor.trim()
  if (!vendor) return 'Enter a Vendor.'
  if (vendor.length > 120) return 'A Vendor must be 120 characters or fewer.'
  if (!fields.when) return 'Choose a date.'
  if (fields.when > londonDate(now)) {
    return 'Choose a date that is today or in the past.'
  }
  if (fields.note.trim().length > 500) return 'A note must be 500 characters or fewer.'
  return ''
}

export function signedAmount(raw, direction) {
  const [whole, fraction = ''] = raw.trim().split('.')
  const positive = `${whole}.${(fraction + '00').slice(0, 2)}`
  return direction === 'outflow' ? `-${positive}` : positive
}

export function transactionBody(fields) {
  const note = fields.note.trim()
  return {
    account_id: fields.accountId,
    amount: signedAmount(fields.amount, fields.direction),
    vendor: fields.vendor.trim(),
    note: note || null,
    occurred_at: `${fields.when}T00:00:00`,
  }
}
