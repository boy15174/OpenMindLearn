import { useState, useEffect, useMemo, useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { Viewport } from '@xyflow/react'
import type { SearchResult } from '../types/canvas'
import { getNodeWidth, getNodeHeight } from '../utils/nodeDimension'
import { escapeRegExp } from '../utils/search'

export function useCanvasSearch(nodes: any[], viewport: Viewport) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1)
  const { setCenter } = useReactFlow()

  const searchResults = useMemo<SearchResult[]>(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return []

    const results: SearchResult[] = []
    nodes.forEach((node) => {
      const content = String(node.data.content || '').toLowerCase()
      const note = String(node.data.note || '').toLowerCase()
      const tags = (node.data.tags || []).join(' ').toLowerCase()

      const indexes = [content.indexOf(query), note.indexOf(query), tags.indexOf(query)].filter((idx) => idx >= 0)
      if (indexes.length > 0) {
        results.push({ nodeId: node.id, score: Math.min(...indexes) })
      }
    })

    return results.sort((a, b) => a.score - b.score)
  }, [nodes, searchQuery])

  useEffect(() => {
    if (searchResults.length === 0) {
      setActiveSearchIndex(-1)
      return
    }

    setActiveSearchIndex((prev) => {
      if (prev >= 0 && prev < searchResults.length) return prev
      return 0
    })
  }, [searchResults.length])

  const activeSearchNodeId = activeSearchIndex >= 0 ? searchResults[activeSearchIndex]?.nodeId : undefined

  const highlightedNodeSet = useMemo(() => {
    return new Set(searchResults.map((item) => item.nodeId))
  }, [searchResults])

  const matchedPreview = useMemo(() => {
    const query = searchQuery.trim()
    if (!query || !activeSearchNodeId) return null

    const node = nodes.find((item: any) => item.id === activeSearchNodeId)
    if (!node) return null

    const escaped = escapeRegExp(query)
    const regex = new RegExp(`(${escaped})`, 'ig')
    return {
      nodeId: node.id,
      highlighted: String(node.data.content || '').replace(regex, '[$1]')
    }
  }, [activeSearchNodeId, nodes, searchQuery])

  const focusSearchResult = useCallback((nextIndex: number) => {
    if (searchResults.length === 0) return
    const normalized = ((nextIndex % searchResults.length) + searchResults.length) % searchResults.length
    setActiveSearchIndex(normalized)

    const targetNodeId = searchResults[normalized].nodeId
    const targetNode = nodes.find((node: any) => node.id === targetNodeId)
    if (!targetNode) return

    setCenter(targetNode.position.x + getNodeWidth(targetNode) / 2, targetNode.position.y + getNodeHeight(targetNode) / 2, {
      zoom: Math.max(viewport.zoom, 0.9),
      duration: 280
    })
  }, [nodes, searchResults, setCenter, viewport.zoom])

  const resetSearch = useCallback(() => {
    setSearchQuery('')
    setActiveSearchIndex(-1)
  }, [])

  return {
    searchQuery,
    setSearchQuery,
    activeSearchIndex,
    searchResults,
    highlightedNodeSet,
    activeSearchNodeId,
    matchedPreview,
    focusSearchResult,
    resetSearch
  }
}
