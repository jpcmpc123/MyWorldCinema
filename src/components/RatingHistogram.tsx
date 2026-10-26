import React from 'react';
import type { PlatformRatingItem, RatingPlatformSource } from '../services/unifiedRatings';

interface RatingHistogramProps {
  averageRating: number; // 0 to 10 from TMDB or 0 to 5
  voteCount?: number;
  unifiedStars5?: number | null;
  unifiedSources?: PlatformRatingItem[] | null;
  unifiedLoading?: boolean;
}

const DISPLAY_ORDER: Record<RatingPlatformSource, number> = {
  letterboxd: 1,
  imdb: 2,
  tomatoes: 3,
  metacritic: 4,
  tmdb: 5,
};

const PlatformBadgeIcon: React.FC<{ source: RatingPlatformSource; compact?: boolean }> = ({
  source,
  compact = false,
}) => {
  switch (source) {
    case 'letterboxd':
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 378 140"
          shapeRendering="geometricPrecision"
          className={`${compact ? 'h-[16px] w-[43px]' : 'h-[18px] w-[48px]'} block shrink-0`}
          aria-label="Letterboxd"
        >
          <g fill="none" fillRule="evenodd">
            <ellipse fill="#00E054" cx="189" cy="69.9732824" rx="70.0786517" ry="69.9732824" />
            <ellipse fill="#40BCF4" cx="307.921349" cy="69.9732824" rx="70.0786517" ry="69.9732824" />
            <ellipse fill="#FF8000" cx="70.0786517" cy="69.9732824" rx="70.0786517" ry="69.9732824" />
            <path
              d="M129.539326,107.022244 C122.810493,96.2781677 118.921348,83.5792213 118.921348,69.9732824 C118.921348,56.3673435 122.810493,43.6683972 129.539326,32.9243209 C136.268159,43.6683972 140.157303,56.3673435 140.157303,69.9732824 C140.157303,83.5792213 136.268159,96.2781677 129.539326,107.022244 Z"
              fill="#FFFFFF"
            />
            <path
              d="M248.460674,32.9243209 C255.189507,43.6683972 259.078652,56.3673435 259.078652,69.9732824 C259.078652,83.5792213 255.189507,96.2781677 248.460674,107.022244 C241.731841,96.2781677 237.842697,83.5792213 237.842697,69.9732824 C237.842697,56.3673435 241.731841,43.6683972 248.460674,32.9243209 Z"
              fill="#FFFFFF"
            />
          </g>
        </svg>
      );

    case 'imdb':
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 575 289.83"
          shapeRendering="geometricPrecision"
          className={`${compact ? 'h-[22px] w-[44px]' : 'h-[24px] w-[48px]'} block shrink-0`}
          aria-label="IMDb"
        >
          <path
            fill="#F5C518"
            d="M575 24.91C573.44 12.15 563.97 1.98 551.91 0 499.05 0 76.18 0 23.32 0 10.11 2.17 0 14.16 0 28.61c0 23.23 0 209.03 0 232.25 0 16 12.37 28.97 27.64 28.97h519.95c14.06 0 25.67-11.01 27.41-25.26V24.91z"
          />
          <g transform="translate(287.5 144.915) scale(1.16 1.2) translate(-286.3 -144.7)">
            <path
              fill="#000000"
              stroke="#F5C518"
              strokeWidth="5.5"
              strokeLinejoin="round"
              d="M69.35 58.24h45.63v175.65H69.35V58.24zm131.85 80.91c-3.92-26.77-6.1-41.65-6.53-44.62-1.91-14.33-3.73-26.8-5.47-37.44H130.04v175.65h39.97l.14-115.98 16.82 115.98h28.47l15.95-118.56.15 118.56h39.84V57.09h-59.61l-10.57 82.06zm145.51-45.52c.5 2.24.76 7.32.76 15.26v68.1c0 11.69-.76 18.85-2.27 21.49-1.52 2.64-5.56 3.95-12.11 3.95V87.13c4.97 0 8.36.53 10.16 1.57 1.8 1.05 2.96 2.69 3.46 4.93zm20.61 137.32c5.43-1.19 9.99-3.29 13.69-6.28 3.69-3 6.28-7.15 7.76-12.46 1.49-5.3 2.37-15.83 2.37-31.58v-61.68c0-16.62-.65-27.76-1.66-33.42-1.02-5.67-3.55-10.82-7.6-15.44-4.06-4.62-9.98-7.94-17.76-9.96-7.79-2.02-20.49-3.04-42.58-3.04H287.5v175.65h55.28c12.74-.4 20.92-.99 24.54-1.79zm97.44-26.25c-.84 2.23-4.52 3.36-7.3 3.36-2.72 0-4.53-1.08-5.45-3.25-.92-2.16-1.37-7.09-1.37-14.81v-46.42c0-8 .4-12.99 1.21-14.98.8-1.97 2.56-2.97 5.28-2.97 2.78 0 6.51 1.13 7.47 3.4.95 2.27 1.43 7.12 1.43 14.55v45.01c-.29 9.25-.71 14.62-1.27 16.11zm-58.08 26.51h41.08c1.71-6.71 2.65-10.44 2.84-11.19 3.72 4.5 7.81 7.88 12.3 10.12 4.47 2.25 11.16 3.37 16.34 3.37 7.21 0 13.43-1.89 18.68-5.68 5.24-3.78 8.58-8.26 10-13.41 1.42-5.16 2.13-13 2.13-23.54v-49.28c0-10.6-.24-17.52-.71-20.77-.47-3.25-1.87-6.56-4.2-9.95-2.33-3.39-5.72-6.02-10.16-7.9-4.44-1.88-9.68-2.82-15.72-2.82-5.25 0-11.97 1.05-16.45 3.12-4.47 2.07-8.53 5.21-12.17 9.42V55.56h-43.96v175.65z"
            />
          </g>
        </svg>
      );

    case 'tomatoes':
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="4 0 132 140"
          shapeRendering="geometricPrecision"
          className={`${compact ? 'h-[22px] w-[22px]' : 'h-[24px] w-[24px]'} block shrink-0`}
          aria-label="Rotten Tomatoes"
        >
          <g fill="#f93208">
            <path d="m20.154 40.829c-28.149 27.622-13.657 61.011-5.734 71.931 35.254 41.954 92.792 25.339 111.89-5.9071 4.7608-8.2027 22.554-53.467-23.976-78.009z" />
            <path d="m39.613 39.265 4.7778-8.8607 28.406-5.0384 11.119 9.2082z" />
          </g>
          <path
            fill="#02902e"
            d="m39.436 8.5696 8.9682-5.2826 6.7569 15.479c3.7925-6.3226 13.79-16.316 24.939-4.6684-4.7281 1.2636-7.5161 3.8553-7.7397 8.4768 15.145-4.1697 31.343 3.2127 33.539 9.0911-10.951-4.314-27.695 10.377-41.771 2.334 0.009 15.045-12.617 16.636-19.902 17.076 2.077-4.996 5.591-9.994 1.474-14.987-7.618 8.171-13.874 10.668-33.17 4.668 4.876-1.679 14.843-11.39 24.448-11.425-6.775-2.467-12.29-2.087-17.814-1.475 2.917-3.961 12.149-15.197 28.625-8.476z"
          />
        </svg>
      );

    case 'metacritic':
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 88 88"
          shapeRendering="geometricPrecision"
          className={`${compact ? 'h-[23px] w-[23px]' : 'h-[25px] w-[25px]'} block shrink-0`}
          aria-label="Metacritic"
        >
          <circle fill="#001B36" stroke="#FFCC00" strokeWidth="5.5" cx="44" cy="44" r="41" />
          <path
            transform="translate(-10 -961) matrix(1.2756629,-1.3487733,1.3685717,1.2634987,-267.04706,1066.0743)"
            fill="#FFFFFF"
            d="m126.73438,92.087002 5.05859,0 0,2.832031 c 1.80989-2.200501 3.96483-3.30076 6.46484-3.300781 1.32811,2.1e-5 2.48045,.273458 3.45703,.820312 .97655,.546895 1.77733,1.373717 2.40235,2.480469 .91144-1.106752 1.89451-1.933574 2.94922-2.480469 1.05466-0.546854 2.18096-0.820291 3.3789-0.820312 1.52341,2.1e-5 2.81247,.309265 3.86719,.927734 1.05466,.618509 1.84242,1.526711 2.36328,2.724609 .37757,.885434 .56637,2.317724 .56641,4.296875 l 0,13.26172-5.48828,0 0-11.85547 c-3e-5-2.057277-0.18883-3.385401-0.56641-3.984375-0.50784-0.781233-1.28909-1.171858-2.34375-1.171875-0.76825,1.7e-5-1.49091,.234392-2.16797,.703125-0.6771,.468766-1.16538,1.155614-1.46484,2.060547-0.2995,.904961-0.44924,2.333998-0.44922,4.287108 l 0,9.96094-5.48828,0 0-11.36719 c-2e-5-2.018214-0.0977-3.320296-0.29297-3.906248-0.19533-0.585922-0.49806-1.02212-0.9082-1.308594-0.41017-0.286442-0.96681-0.429671-1.66993-0.429688-0.84636,1.7e-5-1.60808,.227882-2.28515,.683594-0.6771,.455745-1.16212,1.113297-1.45508,1.972656-0.29298,.859389-0.43946,2.28517-0.43945,4.27734 l 0,10.07813-5.48828,0z"
          />
        </svg>
      );

    case 'tmdb':
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 241.52 35.52"
          shapeRendering="geometricPrecision"
          className={`${compact ? 'h-[12.5px] w-[85px]' : 'h-[14px] w-[95px]'} block shrink-0`}
          aria-label="TMDb"
        >
          <defs>
            <linearGradient
              id={compact ? 'tmdb-official-grad-dt' : 'tmdb-official-grad-mb'}
              x1="0"
              y1="17.76"
              x2="241.52"
              y2="17.76"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0" stopColor="#90cea1" />
              <stop offset="0.56" stopColor="#3cbec9" />
              <stop offset="1" stopColor="#00b3e5" />
            </linearGradient>
          </defs>
          <path
            fill={`url(#${compact ? 'tmdb-official-grad-dt' : 'tmdb-official-grad-mb'})`}
            d="M191.85,35.37h32A17.67,17.67,0,0,0,241.52,17.7h0A17.67,17.67,0,0,0,223.85,0h-32A17.67,17.67,0,0,0,174.18,17.7h0A17.67,17.67,0,0,0,191.85,35.37ZM10.1,35.42h7.8V6.92H28V0H0v6.9H10.1Zm28.1,0H46V8.25h.1L55.05,35.4h6L70.3,8.25h.1V35.4h7.8V0H66.45l-8.2,23.1h-.1L50,0H38.2ZM89.14.12h11.7a33.56,33.56,0,0,1,8.08,1,18.52,18.52,0,0,1,6.67,3.08,15.09,15.09,0,0,1,4.53,5.52,18.5,18.5,0,0,1,1.67,8.25,16.91,16.91,0,0,1-1.62,7.58,16.3,16.3,0,0,1-4.38,5.5,19.24,19.24,0,0,1-6.35,3.37,24.53,24.53,0,0,1-7.55,1.15H89.14Zm7.8,28.2h4a21.66,21.66,0,0,0,5-.55A10.58,10.58,0,0,0,110,26a8.73,8.73,0,0,0,2.68-3.35,11.9,11.9,0,0,0,1-5.08,9.87,9.87,0,0,0-1-4.52,9.17,9.17,0,0,0-2.63-3.18A11.61,11.61,0,0,0,106.22,8a17.06,17.06,0,0,0-4.68-.63h-4.6ZM133.09.12h13.2a32.87,32.87,0,0,1,4.63.33,12.66,12.66,0,0,1,4.17,1.3,7.94,7.94,0,0,1,3,2.72,8.34,8.34,0,0,1,1.15,4.65,7.48,7.48,0,0,1-1.67,5,9.13,9.13,0,0,1-4.43,2.82V17a10.28,10.28,0,0,1,3.18,1,8.51,8.51,0,0,1,2.45,1.85,7.79,7.79,0,0,1,1.57,2.62,9.16,9.16,0,0,1,.55,3.2,8.52,8.52,0,0,1-1.2,4.68,9.32,9.32,0,0,1-3.1,3A13.38,13.38,0,0,1,152.32,35a22.5,22.5,0,0,1-4.73.5h-14.5Zm7.8,14.15h5.65a7.65,7.65,0,0,0,1.78-.2,4.78,4.78,0,0,0,1.57-.65,3.43,3.43,0,0,0,1.13-1.2,3.63,3.63,0,0,0,.42-1.8A3.3,3.3,0,0,0,151,8.6a3.42,3.42,0,0,0-1.23-1.13A6.07,6.07,0,0,0,148,6.9a9.9,9.9,0,0,0-1.85-.18h-5.3Zm0,14.65h7a8.27,8.27,0,0,0,1.83-.2,4.67,4.67,0,0,0,1.67-.7,3.93,3.93,0,0,0,1.23-1.3,3.8,3.8,0,0,0,.47-1.95,3.16,3.16,0,0,0-.62-2,4,4,0,0,0-1.58-1.18,8.23,8.23,0,0,0-2-.55,15.12,15.12,0,0,0-2.05-.15h-5.9Z"
          />
        </svg>
      );
  }
};

export const UnifiedPlatformBadges: React.FC<{
  sources?: PlatformRatingItem[] | null;
  loading?: boolean;
  compact?: boolean;
}> = ({ sources, loading = false, compact = false }) => {
  if (loading && (!sources || sources.length === 0)) {
    return (
      <div
        className={`grid grid-cols-6 ${
          compact
            ? 'gap-1.5 pt-3 mt-2.5 border-t border-lb-elevated/60'
            : 'gap-2 pt-3 mt-2.5 border-t border-[#2c3440]'
        }`}
        aria-busy="true"
      >
        {Array.from({ length: 5 }, (_, idx) => {
          const spanClass = idx < 3 ? 'col-span-2' : 'col-span-3';
          return (
            <div
              key={idx}
              className={`${spanClass} flex flex-col items-center justify-center rounded-md bg-[#181f26] border border-[#2c3440]/80 ${
                compact ? 'h-[54px]' : 'h-[58px]'
              } animate-pulse`}
            >
              <div className="h-4 w-8 rounded bg-[#2c3440] mb-1.5" />
              <div className="h-3 w-7 rounded bg-[#36404e]" />
            </div>
          );
        })}
      </div>
    );
  }

  if (!sources || sources.length === 0) return null;

  const sortedSources = [...sources].sort(
    (a, b) => (DISPLAY_ORDER[a.source] ?? 99) - (DISPLAY_ORDER[b.source] ?? 99),
  );

  const isFive = sortedSources.length === 5;
  const isFour = sortedSources.length === 4;

  const gridColsClass = isFive
    ? 'grid-cols-6'
    : isFour
      ? 'grid-cols-2'
      : sortedSources.length === 3
        ? 'grid-cols-3'
        : 'grid-cols-2';

  return (
    <div
      className={`grid ${gridColsClass} ${
        compact
          ? 'gap-1.5 pt-3 mt-2.5 border-t border-lb-elevated/60'
          : 'gap-2 pt-3 mt-2.5 border-t border-[#2c3440]'
      }`}
    >
      {sortedSources.map((item, idx) => {
        const spanClass = isFive ? (idx < 3 ? 'col-span-2' : 'col-span-3') : '';
        return (
          <div
            key={item.source}
            title={`${item.label}: ${item.displayValue}`}
            className={`${spanClass} flex flex-col items-center justify-center rounded-md bg-[#181f26] border border-[#2c3440] ${
              compact ? 'h-[54px] px-1' : 'h-[58px] px-1.5'
            } select-none`}
          >
            <div className="flex items-center justify-center h-[25px] w-full shrink-0">
              <PlatformBadgeIcon source={item.source} compact={compact} />
            </div>
            <div className="flex items-center justify-center h-[16px] w-full mt-1 shrink-0">
              <span
                className={`${
                  compact ? 'text-[12.5px]' : 'text-[13.5px]'
                } font-bold text-white tabular-nums leading-none text-center antialiased`}
              >
                {item.displayValue}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const RatingHistogram: React.FC<RatingHistogramProps> = ({
  averageRating,
  voteCount = 1420,
  unifiedStars5,
  unifiedSources,
  unifiedLoading = false,
}) => {
  // Prioriza a Nota Unificada (0 a 5 estrelas) quando disponível
  const baseRatingOutOf5 = averageRating > 5 ? averageRating / 2 : averageRating;
  const ratingOutOf5 =
    typeof unifiedStars5 === 'number' && unifiedStars5 > 0 ? unifiedStars5 : baseRatingOutOf5;

  // Generate realistic bell-curve / skewed distribution centered around the rating
  const ratings = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
  const peak = ratingOutOf5;

  const distribution = ratings.map((r) => {
    const diff = Math.abs(r - peak);
    const weight = Math.exp(-(diff * diff) / 0.75);
    return Math.max(0.03, weight);
  });

  const maxVal = Math.max(...distribution);
  const fullStars = Math.round(ratingOutOf5);

  const fansCount = voteCount >= 10000 ? voteCount : Math.max(1000, Math.round(voteCount * 25));
  const formattedFans =
    fansCount >= 1000
      ? `${(fansCount / 1000).toFixed(fansCount >= 10000 ? 0 : 1).replace(/\.0$/, '')}K`
      : `${fansCount}`;

  return (
    <div className="w-full text-xs">
      {/* Header — estilo limpo Letterboxd PC (Imagem 1) */}
      <div className="flex items-baseline justify-between pb-1.5 border-b border-[#445566]/60">
        <span className="text-[11px] uppercase tracking-[0.08em] text-[#99aabb]">
          Ratings
        </span>
        <span className="text-[10px] uppercase tracking-[0.06em] text-[#667788] hover:text-[#99aabb] transition-colors cursor-pointer tabular-nums">
          {formattedFans} FANS
        </span>
      </div>

      {/* Histograma + Nota Unificada à direita (igual à Imagem 1) */}
      <div className="flex items-end gap-2.5 mt-3.5 pb-1">
        {/* Estrela verde na base esquerda */}
        <span className="text-[#00e054] text-[13px] leading-none pb-[1px] select-none shrink-0">
          ★
        </span>

        {/* 10 barras verticais cinza-azuladas */}
        <div className="flex-1 flex items-end gap-[2px] h-[52px]">
          {distribution.map((val, idx) => {
            const heightPercent = Math.max(3, Math.round((val / maxVal) * 100));
            const ratingLabel = ratings[idx];

            return (
              <div
                key={idx}
                className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
              >
                {/* Tooltip on hover */}
                <div className="absolute -top-7 hidden group-hover:flex flex-col items-center bg-[#14181c] border border-[#2c3440] text-white text-[10px] py-0.5 px-1.5 rounded pointer-events-none z-20 shadow-lg whitespace-nowrap">
                  <span>{ratingLabel.toFixed(1)} ★</span>
                </div>

                {/* Barra no tom slate-grey da Imagem 1 */}
                <div
                  className="w-full bg-[#445566] group-hover:bg-[#667788] transition-colors rounded-t-[2px]"
                  style={{
                    height: `${heightPercent}%`,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Nota média em destaque + 5 estrelas verdes à direita */}
        <div className="flex flex-col items-center justify-end pl-1.5 pb-[1px] tabular-nums shrink-0">
          <span className="text-[25px] font-light text-[#8899aa] leading-none tracking-tight">
            {ratingOutOf5.toFixed(1)}
          </span>
          <div className="flex items-center gap-[1px] text-[12px] leading-none mt-2 select-none">
            {Array.from({ length: 5 }, (_, i) => (
              <span
                key={i}
                className={i < fullStars ? 'text-[#00e054]' : 'text-[#3a4550]'}
              >
                ★
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Individual Platform Ratings (Letterboxd, IMDb, Rotten Tomatoes, Metacritic, TMDb) */}
      <UnifiedPlatformBadges
        sources={unifiedSources}
        loading={unifiedLoading}
        compact
      />
    </div>
  );
};
