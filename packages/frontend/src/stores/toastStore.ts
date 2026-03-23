import { create } from 'zustand'

interface ToastState {
  message: string
  type: 'success' | 'error'
  visible: boolean
  showToast: (message: string, type: 'success' | 'error') => void
  hideToast: () => void
}

export const useToastStore = create<ToastState>((set) => ({
  message: '',
  type: 'success',
  visible: false,
  showToast: (message, type) => {
    set({ message, type, visible: true })
    setTimeout(() => set({ visible: false }), 3000)
  },
  hideToast: () => set({ visible: false })
}))
