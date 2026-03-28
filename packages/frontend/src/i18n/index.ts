import { enUS } from './locales/en-US'
import { zhCN } from './locales/zh-CN'
import type { I18nParams, LocaleCode, LocaleMode } from './types'

type TranslationTable = Record<string, string>

const tables: Record<LocaleCode, TranslationTable> = {
  'zh-CN': zhCN,
  'en-US': enUS
}

const ZH_LOCALE: LocaleCode = 'zh-CN'

function interpolate(template: string, params?: I18nParams): string {
  if (!params) return template
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    const value = params[key]
    return value === undefined ? '' : String(value)
  })
}

export function resolveLocaleMode(mode: LocaleMode, browserLanguage?: string): LocaleCode {
  if (mode === 'zh-CN' || mode === 'en-US') return mode
  const lang = (browserLanguage || '').toLowerCase()
  return lang.startsWith('zh') ? 'zh-CN' : 'en-US'
}

export function getBrowserLanguage(): string {
  if (typeof navigator === 'undefined') return 'zh-CN'
  return navigator.language || 'zh-CN'
}

export function translate(locale: LocaleCode, key: string, params?: I18nParams): string {
  const primary = tables[locale]?.[key]
  if (primary) return interpolate(primary, params)

  const fallback = tables[ZH_LOCALE]?.[key]
  if (fallback) return interpolate(fallback, params)

  return key
}

