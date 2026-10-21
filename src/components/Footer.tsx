import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';

export const Footer: React.FC = () => {
  const { t } = useLanguage();
  return (
    <footer className="hidden md:block mt-20 border-t border-lb-elevated bg-lb-bg text-lb-muted text-xs py-10">
      <div className="max-w-[950px] mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-2 font-semibold">
          <Link to="/films" className="hover:text-white transition-colors whitespace-nowrap">{t('nav_films')}</Link>
          <Link to="/series" className="hover:text-white transition-colors whitespace-nowrap">{t('nav_series')}</Link>
          <Link to="/lists" className="hover:text-white transition-colors whitespace-nowrap">{t('nav_lists')}</Link>
          <Link to="/diary" className="hover:text-white transition-colors whitespace-nowrap">{t('hdr_diary')}</Link>
          <Link to="/watchlist" className="hover:text-white transition-colors whitespace-nowrap">{t('hdr_watchlist')}</Link>
        </div>

        <div className="flex flex-col md:items-end text-center md:text-right gap-1 text-[11px]">
          <p>© MyWorld — My World Cinema. {t('footer_made')}</p>
          <p className="flex items-center justify-center md:justify-end gap-1.5">
            <a
              href="https://github.com/jpcmpc123/My-World-Cinema"
              target="_blank"
              rel="noreferrer"
              title={t('footer_github')}
              className="flex items-center gap-1.5 text-lb-text hover:text-lb-green font-semibold transition-colors"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.58.23 2.75.11 3.04.73.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.25 5.66.41.36.78 1.05.78 2.12 0 1.54-.01 2.77-.01 3.15 0 .3.2.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/>
              </svg>
              GitHub
            </a>
            <span className="text-lb-muted/50">•</span>
            <span>{t('footer_film_data')}</span>
            <a
              href="https://www.themoviedb.org/"
              target="_blank"
              rel="noreferrer"
              className="text-lb-text hover:text-lb-green font-semibold transition-colors"
            >
              TMDb
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};
