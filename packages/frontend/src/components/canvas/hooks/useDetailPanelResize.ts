import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'

export function useDetailPanelResize(initialWidth = 520) {
  const [detailPanelWidth, setDetailPanelWidth] = useState(initialWidth)
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const clampDetailPanelWidth = useCallback((nextWidth: number) => {
    if (typeof window === 'undefined') return Math.max(360, nextWidth)
    const max = Math.max(420, Math.floor(window.innerWidth * 0.7))
    return Math.min(max, Math.max(360, nextWidth))
  }, [])

  const handleStartResize = useCallback((event: ReactMouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    resizeRef.current = { startX: event.clientX, startWidth: detailPanelWidth }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [detailPanelWidth])

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const resizeState = resizeRef.current
      if (!resizeState) return
      const deltaX = event.clientX - resizeState.startX
      setDetailPanelWidth(clampDetailPanelWidth(resizeState.startWidth - deltaX))
    }

    const handleMouseUp = () => {
      if (!resizeRef.current) return
      resizeRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [clampDetailPanelWidth])

  useEffect(() => {
    const handleWindowResize = () => {
      setDetailPanelWidth((width) => clampDetailPanelWidth(width))
    }
    window.addEventListener('resize', handleWindowResize)
    return () => window.removeEventListener('resize', handleWindowResize)
  }, [clampDetailPanelWidth])

  useEffect(() => {
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

  return {
    detailPanelWidth,
    setDetailPanelWidth,
    handleStartResize
  }
}
