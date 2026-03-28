export async function parseResponseJson(response: Response): Promise<any> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export function extractErrorMessage(data: any, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback
  const nested = data.error?.message || data.error || data.detail || data.message
  const text = typeof nested === 'string' ? nested : ''
  return text || fallback
}
