import { useCallback, useEffect, useRef, useState } from 'react'

export function useSourceLinkHighlight() {
  const [sourceLinkedSourceNodeId, setSourceLinkedSourceNodeId] = useState<string | null>(null)
  const [sourceLinkedNodeIds, setSourceLinkedNodeIds] = useState<string[]>([])
  const timerRef = useRef<number | null>(null)

  const triggerSourceHighlight = useCallback((targetNodeIds: string[], sourceNodeId: string) => {
    const uniqueIds = Array.from(new Set(targetNodeIds)).filter(Boolean)
    setSourceLinkedNodeIds(uniqueIds)
    setSourceLinkedSourceNodeId(sourceNodeId)

    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
    }

    timerRef.current = window.setTimeout(() => {
      setSourceLinkedSourceNodeId(null)
      setSourceLinkedNodeIds([])
      timerRef.current = null
    }, 5000)
  }, [])

  const clearSourceHighlight = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setSourceLinkedSourceNodeId(null)
    setSourceLinkedNodeIds([])
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [])

  return {
    sourceLinkedSourceNodeId,
    sourceLinkedNodeIds,
    triggerSourceHighlight,
    clearSourceHighlight
  }
}
