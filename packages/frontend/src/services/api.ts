import { Node } from '../types'

const API_BASE = '/api'

export async function generateNode(prompt: string) {
  const res = await fetch(`${API_BASE}/nodes/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  })
  return res.json()
}

export async function expandNode(
  text: string,
  parentId: string,
  allNodes?: Node[],
  selectedNodeIds?: string[]
) {
  const res = await fetch(`${API_BASE}/nodes/expand`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, parentId, allNodes, selectedNodeIds })
  })
  return res.json()
}

export async function saveFile(nodes: Node[], edges: any[], name: string) {
  const res = await fetch(`${API_BASE}/files/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nodes, edges, name })
  })
  return res.json()
}

export async function loadFile(base64Data: string) {
  const res = await fetch(`${API_BASE}/files/load`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: base64Data })
  })
  return res.json()
}
