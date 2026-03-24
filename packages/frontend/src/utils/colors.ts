export const EXPANSION_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1'
]

export function getExpansionColor(relationshipId: string): string {
  let hash = 0
  for (let i = 0; i < relationshipId.length; i++) {
    hash = ((hash << 5) - hash) + relationshipId.charCodeAt(i)
    hash = hash & hash
  }
  return EXPANSION_COLORS[Math.abs(hash) % EXPANSION_COLORS.length]
}
