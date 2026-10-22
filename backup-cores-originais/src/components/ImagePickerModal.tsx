import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { tmdb, type TMDBImage } from '../services/tmdb';

interface ImagePickerModalProps {
  mode: 'poster' | 'backdrop';
  movieId: number;
  currentUrl: string | null;
  onSelect: (url: string) => void;
  onClose: () => void;
}

export const ImagePickerModal: React.FC<ImagePickerModalProps> = ({
  mode,
  movieId,
  currentUrl,
  onSelect,
  onClose,
}) => {
  const [images, setImages] = useState<TMDBImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [urlInput, setUrlInput] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    tmdb
      .getMovieImages(movieId)
      .then((res) => {
        if (cancelled) return;
        const list = (mode === 'poster' ? res.posters : res.backdrops) || [];
        const sorted = [...list].sort((a, b) => b.vote_count - a.vote_count).slice(0, 9);
        setImages(sorted);
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
  }, [movieId, mode]);

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
    if (!url) return;
    onSelect(url);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm mw-overlay-fade">
      <div className="bg-[#1c2228] border border-[#303840] w-full max-w-3xl rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] mw-pop-in">
        {/* Header */}
        <div className="px-4 py-3 bg-[#14181c] border-b border-[#303840] flex items-center justify-between flex-shrink-0">
          <span className="text-xs font-bold text-white">
            Enter {label} Image URL:
          </span>
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
            onChange={(e) => setUrlInput(e.target.value)}
            className="w-full bg-[#14181c] border border-[#303840] focus:border-lb-green rounded px-3 py-2 text-xs text-white placeholder-lb-muted outline-none transition-colors"
          />
        </form>

        {/* Image grid */}
        <div className="p-4 pt-2 overflow-y-auto">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-3 border-lb-green border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-lb-muted">Loading {label.toLowerCase()} options...</p>
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
              {images.map((img) => {
                const fullUrl = tmdb.getImageUrl(img.file_path, fullSize);
                const previewUrl = tmdb.getImageUrl(img.file_path, previewSize);
                const isSelected = currentUrl === fullUrl || currentUrl === previewUrl;
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
