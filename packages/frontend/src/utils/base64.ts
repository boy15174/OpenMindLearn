function normalizeBase64(input: string): string {
  return input.trim().replace(/\s+/g, '')
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const commaIndex = result.indexOf(',')
      resolve(normalizeBase64(commaIndex >= 0 ? result.slice(commaIndex + 1) : result))
    }
    reader.onerror = () => reject(reader.error || new Error('Failed to convert file to base64'))
    reader.readAsDataURL(file)
  })
}

export function base64ToBlob(base64Data: string, mimeType = 'application/octet-stream'): Blob {
  const normalized = normalizeBase64(base64Data)
  const binary = atob(normalized)
  const chunkSize = 8192
  const chunks: ArrayBuffer[] = []

  for (let offset = 0; offset < binary.length; offset += chunkSize) {
    const slice = binary.slice(offset, offset + chunkSize)
    const bytes = new Uint8Array(slice.length)
    for (let i = 0; i < slice.length; i += 1) {
      bytes[i] = slice.charCodeAt(i)
    }
    chunks.push(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
  }

  return new Blob(chunks, { type: mimeType })
}
