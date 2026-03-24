const FNV_OFFSET_BASIS = 0x811c9dc5
const FNV_PRIME = 0x01000193

function toBase64Utf8(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  const chunkSize = 0x8000

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

export function fingerprintBase64(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let hash = FNV_OFFSET_BASIS

  for (const byte of bytes) {
    hash ^= byte
    hash = Math.imul(hash, FNV_PRIME) >>> 0
  }

  const payload = `${bytes.length}:${hash.toString(16).padStart(8, '0')}`
  return toBase64Utf8(payload)
}
