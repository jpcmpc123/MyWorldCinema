import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  formatDatePt,
  formatMoneyUSD,
  languageNames,
  regionNames,
  translate,
  type Language,
  type TranslationKey,
} from './translations';
import { setTmdbLanguage } from '../services/tmdb';

// Re-export explícito para os consumidores (o bundler remove tipos em runtime)
export { formatDatePt, formatMoneyUSD, languageNames, regionNames };
export type { Language, TranslationKey };

const STORAGE_KEY = 'myworld_lang';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  /** Traduz usando o dicionário manual estático */
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function initialLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'pt-BR' || stored === 'en-US') return stored;
  } catch {
    /* storage indisponível */
  }
  // Detecta pt-BR pelo navegador como primeiro contato
  return navigator.language?.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en-US';
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  // Sincroniza o idioma da API TMDB com o idioma da interface no boot
  setTmdbLanguage(language);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang;
    setTmdbLanguage(lang);
    // Recarrega para que todas as chamadas em cache (chave inclui idioma)
    // e textos vindos da API (títulos, sinopses, gêneros) reflitam o idioma
    window.location.reload();
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'pt-BR' ? 'en-US' : 'pt-BR');
  }, [language, setLanguage]);

  const t = useCallback((key: TranslationKey) => translate(language, key), [language]);

  const value = useMemo(
    () => ({ language, setLanguage, toggleLanguage, t }),
    [language, setLanguage, toggleLanguage, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextType {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
