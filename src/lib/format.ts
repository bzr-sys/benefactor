export function formatPrice(cents: number) {
  const amount = cents / 100
  return `$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`
}

export function formatDate(value: string | Date | undefined) {
  if (value == null) return ''
  const date = new Date(value)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export const ACCENTS = ['#2B4BFF', '#E5484D', '#0F7B6C', '#16161A']
