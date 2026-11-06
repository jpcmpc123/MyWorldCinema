import React from 'react';
import { Link } from 'react-router-dom';
import { Film, Home } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export const NotFoundPage: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="max-w-[600px] mx-auto px-4 py-20 text-center space-y-5">
      <div className="w-16 h-16 rounded-full bg-lb-surface border border-lb-elevated flex items-center justify-center mx-auto">
        <Film className="w-8 h-8 text-lb-green" />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-mono font-bold uppercase tracking-widest text-lb-green">
          404
        </p>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
          {t('not_found_title')}
        </h1>
        <p className="text-xs md:text-sm text-lb-text max-w-md mx-auto leading-relaxed">
          {t('not_found_desc')}
        </p>
      </div>
      <div className="pt-2">
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-lb-green hover:bg-lb-green-hover text-lb-bg font-black text-xs uppercase tracking-wider px-5 py-2.5 rounded-sm transition-colors"
        >
          <Home className="w-4 h-4" />
          <span>{t('not_found_btn')}</span>
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
