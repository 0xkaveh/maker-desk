import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { copy, type Copy } from './lib/copy'
import type { Lang } from './lib/types'

const LANG_KEY = 'maker-desk.lang.v1'

interface LangState {
  lang: Lang
  t: Copy
  toggleLang: () => void
}

const LangContext = createContext<LangState | null>(null)

function readLang(): Lang {
  try {
    const stored = window.localStorage.getItem(LANG_KEY)
    return stored === 'fa' ? 'fa' : 'en'
  } catch {
    return 'en'
  }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(readLang)

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr'
    window.localStorage.setItem(LANG_KEY, lang)
  }, [lang])

  const value = useMemo<LangState>(
    () => ({
      lang,
      t: copy[lang],
      toggleLang: () => setLang((current) => (current === 'en' ? 'fa' : 'en')),
    }),
    [lang],
  )

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useCopy(): LangState {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('LangProvider missing')
  return ctx
}
