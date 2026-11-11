import { ref } from 'vue'
import {
  LOCALE_CONFIG_KEY,
  LOCALES,
  resolveLocale,
  translate,
  type Locale,
  type MessageKey
} from '../electron/i18n.js'

/**
 * One reactive locale for the whole UI. Every component renders through `t()`,
 * so switching the language re-renders the open tabs immediately instead of
 * waiting for a restart.
 */
export const locale = ref<Locale>('en')

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  return translate(locale.value, key, params)
}

function apply(next: Locale): Locale {
  locale.value = next
  document.documentElement.setAttribute('lang', next)
  return next
}

/**
 * First launch follows the OS language; a stored choice always wins. The value
 * is validated again on read so a hand-edited config row cannot leave the UI
 * with a language that has no catalogue.
 */
export async function initLocale(): Promise<Locale> {
  let stored = ''
  try {
    stored = (await window.electronAPI.getConfig(LOCALE_CONFIG_KEY)) ?? ''
  } catch (error) {
    console.warn('Could not read the saved language:', error)
  }
  return apply(resolveLocale(stored.trim() || navigator.language))
}

export async function setLocale(next: Locale): Promise<void> {
  if (!LOCALES.includes(next)) return
  apply(next)
  const saved = await window.electronAPI.setConfig(LOCALE_CONFIG_KEY, next)
  if (!saved) {
    console.warn(`Language "${next}" was not saved; it will revert on next launch`)
  }
}
