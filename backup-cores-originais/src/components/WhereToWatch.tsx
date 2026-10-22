import React from 'react';
import { tmdb } from '../services/tmdb';
import { useLanguage } from '../i18n/LanguageContext';

interface WhereToWatchProps {
  providers?: {
    results?: {
      [countryCode: string]: {
        link: string;
        flatrate?: { provider_id: number; provider_name: string; logo_path: string }[];
        rent?: { provider_id: number; provider_name: string; logo_path: string }[];
        buy?: { provider_id: number; provider_name: string; logo_path: string }[];
      };
    };
  };
}

export const WhereToWatch: React.FC<WhereToWatchProps> = ({ providers }) => {
  const { t } = useLanguage();
  const countryData =
    providers?.results?.US ||
    providers?.results?.BR ||
    (providers?.results ? Object.values(providers.results)[0] : null);

  const flatrate = countryData?.flatrate || [];
  const rent = countryData?.rent || [];
  const allProviders = [...flatrate, ...rent].filter(
    (item, index, self) => index === self.findIndex((p) => p.provider_id === item.provider_id)
  ).slice(0, 5);

  if (allProviders.length === 0) {
    return (
      <div className="bg-lb-surface border border-lb-elevated rounded p-2.5 text-[11px] text-lb-muted flex items-center justify-between">
        <span>{t('where_not_streaming')}</span>
        <a
          href="https://www.justwatch.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-lb-muted hover:text-white transition-colors"
        >
          JustWatch
        </a>
      </div>
    );
  }

  return (
    <div className="bg-lb-surface border border-lb-elevated rounded p-2.5 space-y-2">
      <div className="flex flex-wrap gap-1.5 items-center">
        {allProviders.map((p) => (
          <div key={p.provider_id} title={p.provider_name}>
            <img
              src={tmdb.getImageUrl(p.logo_path, 'w92')}
              alt={p.provider_name}
              className="w-7 h-7 rounded object-cover border border-lb-elevated hover:scale-105 transition-transform"
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end pt-1 border-t border-lb-elevated/60 text-[10px] text-lb-muted">
        <a
          href={countryData?.link || 'https://www.justwatch.com'}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-white transition-colors"
        >
          via JustWatch
        </a>
      </div>
    </div>
  );
};
