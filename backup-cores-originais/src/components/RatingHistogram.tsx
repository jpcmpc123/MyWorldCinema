import React from 'react';
import { Star } from 'lucide-react';

interface RatingHistogramProps {
  averageRating: number; // 0 to 10 from TMDB or 0 to 5
  voteCount?: number;
}

export const RatingHistogram: React.FC<RatingHistogramProps> = ({
  averageRating,
  voteCount = 1420,
}) => {
  // Convert 0-10 scale to 0-5
  const ratingOutOf5 = averageRating > 5 ? averageRating / 2 : averageRating;

  // Generate realistic MyWorld bell-curve / skewed distribution centered around the rating
  const ratings = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
  const peak = ratingOutOf5;

  const distribution = ratings.map((r) => {
    const diff = Math.abs(r - peak);
    const weight = Math.exp(-(diff * diff) / 0.75);
    return Math.max(0.06, weight);
  });

  const maxVal = Math.max(...distribution);

  const fansCount = voteCount >= 10000 ? voteCount : Math.max(1000, Math.round(voteCount * 25));

  return (
    <div className="bg-[#202830] border border-lb-elevated rounded-md p-3.5 text-xs shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-lb-elevated">
        <span className="text-[11px] uppercase tracking-wider font-bold text-lb-muted">
          Ratings
        </span>
        <span className="text-[11px] text-lb-muted hover:text-lb-text transition-colors cursor-pointer">
          {fansCount >= 1000 ? `${(fansCount / 1000).toFixed(0)}K` : fansCount} fans
        </span>
      </div>

      {/* Average Rating Display */}
      <div className="flex items-baseline gap-2 my-2.5">
        <span className="text-xl font-bold text-white tracking-tight">
          {ratingOutOf5.toFixed(2)}
        </span>
        <div className="flex items-center gap-1">
          <Star className="w-3.5 h-3.5 fill-lb-green text-lb-green" />
          <span className="text-[11px] text-lb-muted">average out of 5</span>
        </div>
      </div>

      {/* 10-bar MyWorld Signature Green Histogram */}
      <div className="flex items-end justify-between gap-1 h-14 pt-2 pb-1 border-b border-lb-elevated/60">
        {distribution.map((val, idx) => {
          const heightPercent = Math.max(8, Math.round((val / maxVal) * 100));
          const ratingLabel = ratings[idx];

          return (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
            >
              {/* Tooltip on hover */}
              <div className="absolute -top-7 hidden group-hover:flex flex-col items-center bg-lb-bg border border-lb-elevated text-white text-[10px] py-0.5 px-1.5 rounded pointer-events-none z-20 shadow-lg whitespace-nowrap">
                <span>{ratingLabel.toFixed(1)} ★</span>
              </div>

              {/* Green Bar */}
              <div
                className="w-full bg-lb-green opacity-80 group-hover:opacity-100 group-hover:bg-[#34e875] transition-all rounded-t-[1px]"
                style={{
                  height: `${heightPercent}%`,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Star scale footer */}
      <div className="flex justify-between items-center text-[10px] text-lb-muted mt-1.5 px-0.5 font-medium">
        <span>★</span>
        <span>★★★★★</span>
      </div>
    </div>
  );
};
