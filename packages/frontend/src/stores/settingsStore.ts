import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface LLMSettings {
  apiKey: string
  baseURL: string
  model: string
}

interface SettingsStore {
  llmSettings: LLMSettings
  updateLLMSettings: (settings: Partial<LLMSettings>) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      llmSettings: {
        apiKey: '',
        baseURL: 'https://mg.aid.pub/v1',
        model: 'Gemini-3.1-Pro'
      },
      updateLLMSettings: (settings) => set((state) => ({
        llmSettings: { ...state.llmSettings, ...settings }
      }))
    }),
    { name: 'oml-settings' }
  )
)
