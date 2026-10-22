import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number; // 0 to 5 in increments of 0.5
  onChange?: (val: number) => void;
  size?: 'sm' | 'md' | 'lg';
  readonly?: boolean;
}

export const StarRating: React.FC<StarRatingProps> = ({
  value,
  onChange,
  size = 'md',
  readonly = false,
}) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  // Pop/pulse (scale 1->1.25->1, 250ms) ao confirmar uma nota
  const [bumpKey, setBumpKey] = useState(0);

  const displayValue = hoverValue !== null ? hoverValue : value;

  const sizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-6 h-6',
    lg: 'w-7 h-7',
  };

  const handleMouseMove = (index: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (readonly || !onChange) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isHalf = x < rect.width / 2;
    setHoverValue(index + (isHalf ? 0.5 : 1));
  };

  const handleClick = (index: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (readonly || !onChange) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isHalf = x < rect.width / 2;
    const selected = index + (isHalf ? 0.5 : 1);
    // If clicking exact same value, toggle off/clear
    setBumpKey((k) => k + 1);
    onChange(selected === value ? 0 : selected);
  };

  return (
    <div
      className="inline-flex items-center gap-0.5"
      onMouseLeave={() => !readonly && setHoverValue(null)}
    >
      {[0, 1, 2, 3, 4].map((starIndex) => {
        const fillAmount = Math.max(0, Math.min(1, displayValue - starIndex));
        const isFull = fillAmount >= 1;
        const isHalf = fillAmount >= 0.5 && fillAmount < 1;

        return (
          <div
            key={`${starIndex}-${bumpKey}`}
            className={`relative ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition-transform'} ${
              !readonly && bumpKey > 0 && starIndex === Math.ceil(displayValue) - 1 ? 'mw-icon-pop' : ''
            }`}
            onMouseMove={(e) => handleMouseMove(starIndex, e)}
            onClick={(e) => handleClick(starIndex, e)}
            title={readonly ? `${value} stars` : `Rate ${(starIndex + 1).toFixed(1)}`}
          >
            {/* Background Empty Star */}
            <Star
              className={`${sizeClasses[size]} text-lb-border stroke-[1.5] transition-colors`}
            />

            {/* Filled Star overlay */}
            {(isFull || isHalf) && (
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: isFull ? '100%' : '50%' }}
              >
                <Star
                  className={`${sizeClasses[size]} text-lb-green fill-lb-green stroke-lb-green`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
