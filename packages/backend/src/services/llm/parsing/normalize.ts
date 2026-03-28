export function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
