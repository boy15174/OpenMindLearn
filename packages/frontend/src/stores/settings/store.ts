import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getBrowserLanguage, resolveLocaleMode } from '../../i18n'
import type { LocaleCode } from '../../i18n/types'
import { clonePromptTemplates } from './defaults'
import { getDefaultUISettings, normalizeLLMSettings, normalizeLocalizedPrompt, normalizeUISettings, resolvePromptLocale } from './normalize'
import type { LocalizedPromptConfig, SettingsStore } from './types'

const DEFAULT_LLM_SETTINGS = normalizeLLMSettings()
const DEFAULT_UI_SETTINGS = getDefaultUISettings()

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      llmSettings: DEFAULT_LLM_SETTINGS,
      uiSettings: DEFAULT_UI_SETTINGS,
      updateLLMSettings: (settings) => set((state) => {
        const mergedLocalizedPrompts: Record<LocaleCode, LocalizedPromptConfig> = {
          'zh-CN': normalizeLocalizedPrompt('zh-CN', {
            ...state.llmSettings.localizedPrompts['zh-CN'],
            ...(settings.localizedPrompts?.['zh-CN'] || {})
          }),
          'en-US': normalizeLocalizedPrompt('en-US', {
            ...state.llmSettings.localizedPrompts['en-US'],
            ...(settings.localizedPrompts?.['en-US'] || {})
          })
        }

        const nextPromptLocale = resolvePromptLocale(settings.promptLocale ?? state.llmSettings.promptLocale)
        const shouldUpdateActivePrompt = (
          settings.systemPrompt !== undefined ||
          settings.promptTemplates !== undefined ||
          settings.answerAnchorKeywords !== undefined
        )

        if (shouldUpdateActivePrompt) {
          const currentActive = mergedLocalizedPrompts[nextPromptLocale]
          mergedLocalizedPrompts[nextPromptLocale] = normalizeLocalizedPrompt(nextPromptLocale, {
            ...currentActive,
            systemPrompt: settings.systemPrompt ?? currentActive.systemPrompt,
            promptTemplates: {
              ...currentActive.promptTemplates,
              ...(settings.promptTemplates || {})
            },
            answerAnchorKeywords: settings.answerAnchorKeywords ?? currentActive.answerAnchorKeywords
          })
        }

        const activePromptConfig = mergedLocalizedPrompts[nextPromptLocale]

        return {
          llmSettings: {
            ...state.llmSettings,
            ...settings,
            promptLocale: nextPromptLocale,
            localizedPrompts: mergedLocalizedPrompts,
            systemPrompt: activePromptConfig.systemPrompt,
            promptTemplates: clonePromptTemplates(activePromptConfig.promptTemplates),
            answerAnchorKeywords: [...activePromptConfig.answerAnchorKeywords]
          }
        }
      }),
      updateUISettings: (settings) => set((state) => {
        const nextTheme = settings.theme ?? state.uiSettings.theme
        const nextLocaleMode = settings.localeMode ?? state.uiSettings.localeMode
        const nextLocaleResolved = settings.localeMode
          ? resolveLocaleMode(settings.localeMode, getBrowserLanguage())
          : settings.localeResolved ?? state.uiSettings.localeResolved

        return {
          uiSettings: {
            theme: nextTheme,
            localeMode: nextLocaleMode,
            localeResolved: nextLocaleResolved
          }
        }
      }),
      setTheme: (theme) => set((state) => ({
        uiSettings: {
          ...state.uiSettings,
          theme
        }
      })),
      setLocaleMode: (mode) => set((state) => ({
        uiSettings: {
          ...state.uiSettings,
          localeMode: mode,
          localeResolved: resolveLocaleMode(mode, getBrowserLanguage())
        }
      })),
      syncLocaleFromNavigator: () => set((state) => {
        if (state.uiSettings.localeMode !== 'auto') return {}
        const resolved = resolveLocaleMode('auto', getBrowserLanguage())
        if (resolved === state.uiSettings.localeResolved) return {}
        return {
          uiSettings: {
            ...state.uiSettings,
            localeResolved: resolved
          }
        }
      })
    }),
    {
      name: 'oml-settings',
      merge: (persisted, current) => {
        const persistedState = (persisted || {}) as Partial<SettingsStore>
        const mergedLLM = normalizeLLMSettings({
          ...current.llmSettings,
          ...(persistedState.llmSettings || {})
        })
        const mergedUI = normalizeUISettings({
          ...current.uiSettings,
          ...(persistedState.uiSettings || {})
        })

        return {
          ...current,
          ...persistedState,
          llmSettings: mergedLLM,
          uiSettings: mergedUI
        } as SettingsStore
      }
    }
  )
)
