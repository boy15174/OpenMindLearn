const API_BASE = '/api'

export async function generateNode(prompt: string) {
  const res = await fetch(`${API_BASE}/nodes/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  })
  return res.json()
}

export async function expandNode(text: string, parentId: string) {
  const res = await fetch(`${API_BASE}/nodes/expand`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, parentId })
  })
  return res.json()
}
