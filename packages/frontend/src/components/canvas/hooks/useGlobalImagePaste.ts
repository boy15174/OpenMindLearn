import { useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { NodeImage } from '../../../types'
import { readClipboardImages } from '../../../utils/image'

interface UseGlobalImagePasteOptions {
  enabled: boolean
  nodes: Array<{ id: string; selected?: boolean; data?: Record<string, unknown> }>
  handleImagesChange: (nodeId: string, images: NodeImage[]) => void
  setInitialImages: Dispatch<SetStateAction<NodeImage[]>>
  showToast: (message: string, type: 'success' | 'error') => void
  t: (key: string, params?: Record<string, string | number>) => string
}

export function useGlobalImagePaste({
  enabled,
  nodes,
  handleImagesChange,
  setInitialImages,
  showToast,
  t
}: UseGlobalImagePasteOptions) {
  useEffect(() => {
    if (!enabled) return

    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return
      const hasImage = Array.from(e.clipboardData.items).some((item) => item.type.startsWith('image/'))
      if (!hasImage) return

      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      if (target.closest('[data-nodeid]') || target.closest('.react-flow__node')) return

      e.preventDefault()
      readClipboardImages(e.clipboardData.items).then((newImages) => {
        if (newImages.length === 0) return

        if (nodes.length === 0) {
          setInitialImages((prev) => [...prev, ...newImages])
          showToast(t('canvas.toast.pastedImages', { count: newImages.length }), 'success')
          return
        }

        const selected = nodes.filter((n) => n.selected)
        if (selected.length === 1) {
          const existing = (selected[0].data?.images as NodeImage[]) || []
          handleImagesChange(selected[0].id, [...existing, ...newImages])
          showToast(t('canvas.toast.pastedImagesToSelected', { count: newImages.length }), 'success')
          return
        }

        showToast(t('canvas.toast.selectNodeFirst'), 'error')
      })
    }

    document.addEventListener('paste', handleGlobalPaste)
    return () => document.removeEventListener('paste', handleGlobalPaste)
  }, [enabled, nodes, handleImagesChange, setInitialImages, showToast, t])
}
