import { useCallback } from 'react'
import { translate } from '../i18n'
import type { I18nParams } from '../i18n/types'
import { useSettingsStore } from '../stores/settingsStore'

export function useI18n() {
  const locale = useSettingsStore((state) => state.uiSettings.localeResolved)
  const t = useCallback((key: string, params?: I18nParams) => {
    return translate(locale, key, params)
  }, [locale])
  return { locale, t }
}

export function tFromSettings(key: string, params?: I18nParams): string {
  const locale = useSettingsStore.getState().uiSettings.localeResolved
  return translate(locale, key, params)
}

