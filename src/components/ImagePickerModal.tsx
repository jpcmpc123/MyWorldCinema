import React, { useEffect, useState } from 'react';
import { X, ShieldAlert, Sparkles } from 'lucide-react';
import { tmdb, type TMDBImage } from '../services/tmdb';
import { isAiGeneratedDimension, isAiServiceUrl } from '../services/tmdb/posterFilter';
import { useLanguage } from '../i18n/LanguageContext';

interface ImagePickerModalProps {
  mode: 'poster' | 'backdrop';
  movieId: number;
  mediaType?: 'movie' | 'tv';
  currentUrl: string | null;
  onSelect: (url: string) => void;
  onClose: () => void;
}

export const ImagePickerModal: React.FC<ImagePickerModalProps> = ({
  mode,
  movieId,
  mediaType = 'movie',
  currentUrl,
  onSelect,
  onClose,
}) => {
  const { language } = useLanguage();
  const isPt = language === 'pt-BR';
  const [images, setImages] = useState<TMDBImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [validatingUrl, setValidatingUrl] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    tmdb
      .getMovieImages(movieId, mediaType)
      .then((res) => {
        if (cancelled) return;
        // getMovieImages já retorna a lista filtrada (anti-IA) e ordenada pelo score Bayesiano oficial
        const list = (mode === 'poster' ? res.posters : res.backdrops) || [];
        setImages(list.slice(0, 15));
      })
      .catch(() => {
        if (!cancelled) setImages([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [movieId, mediaType, mode]);

  // Lock body scroll + close on Escape
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const label = mode === 'poster' ? 'Poster' : 'Backdrop';
  const previewSize = mode === 'poster' ? 'w342' : 'w780';
  const fullSize = 'original';

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = urlInput.trim();
    if (!url || validatingUrl) return;
    setUrlError(null);

    if (isAiServiceUrl(url)) {
      setUrlError(
        isPt
          ? 'Imagens geradas por IA não são permitidas como capa.'
          : 'AI-generated images are not allowed as cover art.',
      );
      return;
    }

    setValidatingUrl(true);
    const probe = new Image();
    probe.onload = () => {
      setValidatingUrl(false);
      const w = probe.naturalWidth || 0;
      const h = probe.naturalHeight || 0;
      if (isAiGeneratedDimension(w, h)) {
        setUrlError(
          isPt
            ? 'Esta imagem possui dimensões típicas de geradores de IA e foi bloqueada.'
            : 'This image matches AI-generator dimensions and was blocked.',
        );
        return;
      }
      if (mode === 'poster' && w > 0 && h > 0) {
        const ratio = w / h;
        if (ratio < 0.58 || ratio > 0.75) {
          setUrlError(
            isPt
              ? 'Proporção inválida: o pôster deve seguir o formato vertical (2:3).'
              : 'Invalid aspect ratio: poster must follow the 2:3 vertical format.',
          );
          return;
        }
      }
      onSelect(url);
      onClose();
    };
    probe.onerror = () => {
      setValidatingUrl(false);
      setUrlError(
        isPt
          ? 'Não foi possível carregar a imagem informada.'
          : 'Could not load the provided image URL.',
      );
    };
    probe.src = url;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm mw-overlay-fade">
      <div className="bg-[#1c2228] border border-[#303840] w-full max-w-3xl rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] mw-pop-in">
        {/* Header */}
        <div className="px-4 py-3 bg-[#14181c] border-b border-[#303840] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white">
              {isPt ? `Escolher ${label} Oficial` : `Select Official ${label}`}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-lb-green/15 text-lb-green font-semibold">
              {isPt ? 'Filtro Anti-IA Ativo' : 'Anti-AI Filter Active'}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-lb-muted hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* URL input */}
        <form onSubmit={handleUrlSubmit} className="px-4 pt-3 pb-2 flex-shrink-0">
          <input
            type="url"
            placeholder={`${label} Image URL`}
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              if (urlError) setUrlError(null);
            }}
            className="w-full bg-[#14181c] border border-[#303840] focus:border-lb-green rounded px-3 py-2 text-xs text-white placeholder-lb-muted outline-none transition-colors"
          />
          {urlError && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-red-400">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>{urlError}</span>
            </div>
          )}
        </form>

        {/* Image grid */}
        <div className="p-4 pt-2 overflow-y-auto">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-3 border-lb-green border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-lb-muted">
                {isPt
                  ? `Filtrando melhores opções de ${label.toLowerCase()}...`
                  : `Filtering best ${label.toLowerCase()} options...`}
              </p>
            </div>
          ) : images.length === 0 ? (
            <p className="py-16 text-center text-xs text-lb-muted">
              No {label.toLowerCase()} images found. Paste a custom URL above instead.
            </p>
          ) : (
            <div
              className={
                mode === 'poster'
                  ? 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3'
                  : 'grid grid-cols-2 md:grid-cols-3 gap-3'
              }
            >
              {images.map((img, idx) => {
                const fullUrl = tmdb.getImageUrl(img.file_path, fullSize);
                const previewUrl = tmdb.getImageUrl(img.file_path, previewSize);
                const isSelected =
                  currentUrl === fullUrl ||
                  currentUrl === previewUrl ||
                  Boolean(currentUrl && currentUrl.endsWith(img.file_path));
                return (
                  <button
                    key={img.file_path}
                    type="button"
                    onClick={() => {
                      onSelect(fullUrl);
                      onClose();
                    }}
                    className={`relative rounded overflow-hidden border-2 transition-all cursor-pointer group ${
                      isSelected
                        ? 'border-lb-green shadow-[0_0_10px_rgba(0,224,84,0.4)]'
                        : 'border-transparent hover:border-lb-green/60'
                    }`}
                  >
                    <img
                      src={previewUrl}
                      alt=""
                      loading="lazy"
                      className={`w-full object-cover bg-[#14181c] ${
                        mode === 'poster' ? 'aspect-[2/3]' : 'aspect-video'
                      }`}
                    />
                    {idx === 0 && (
                      <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/80 text-lb-green text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shadow">
                        <Sparkles className="w-2.5 h-2.5" />
                        {isPt ? 'Melhor Capa' : 'Best Cover'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
