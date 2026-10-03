import React, { useState, useEffect } from 'react';
import { MenuItem } from '../types/index.ts';
import { Flame, Clock, Coffee, UtensilsCrossed, Sparkles } from 'lucide-react';

interface ItemCardProps {
  item: MenuItem;
  onClick?: () => void;
  isOutsideServingHours?: boolean;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  item,
  onClick,
  isOutsideServingHours = false,
}) => {
  const [currentSrc, setCurrentSrc] = useState(item.image_url || '');
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setCurrentSrc(item.image_url || '');
    setImageFailed(false);
  }, [item.image_url]);

  const handleImageError = () => {
    if (currentSrc && currentSrc.startsWith('/assets/images/')) {
      const filename = currentSrc.split('/').pop()?.split('?')[0];
      if (filename) {
        // Automatic fallback to API route which serves from PostgreSQL blob store
        setCurrentSrc(`/api/images/${filename}`);
        return;
      }
    }
    setImageFailed(true);
  };

  const hasValidPhoto = Boolean(currentSrc && currentSrc.trim() !== '' && !imageFailed);

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`group relative flex flex-row items-center gap-3.5 p-2.5 sm:p-3 rounded-2xl transition-all duration-200 cursor-pointer border ${
        item.is_available
          ? 'bg-gradient-to-r from-[#F7E6A2] via-[#E8C860] to-[#DAB53E] hover:from-[#FCF0BE] hover:via-[#F0D472] hover:to-[#E2BE48] border-[#080808]/35 hover:border-[#080808] shadow-md hover:shadow-[0_6px_22px_rgba(0,0,0,0.22)] hover:-translate-y-0.5'
          : 'bg-[#D4AF37]/50 border-[#080808]/25 opacity-60 cursor-default'
      }`}
    >
      {/* Image Presentation */}
      <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-xl overflow-hidden bg-[#080808] border border-[#080808]/60 group-hover:border-[#080808] shadow-sm transition-all duration-200">
        {hasValidPhoto ? (
          <img
            src={currentSrc}
            alt={item.name}
            loading="lazy"
            decoding="async"
            width={80}
            height={80}
            referrerPolicy="no-referrer"
            onError={handleImageError}
            className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-110 ${
              !item.is_available ? 'grayscale contrast-75' : 'contrast-[1.05] saturate-[1.08] brightness-[1.02]'
            }`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-1.5 text-center bg-gradient-to-b from-[#F5E196] to-[#D4AF37]">
            {item.category_id === 'cat_ice_cream' ? (
              <Sparkles className="w-5 h-5 text-[#080808]" />
            ) : item.category_id.includes('coffee') || item.category_id.includes('tea') || item.category_id.includes('drink') ? (
              <Coffee className="w-5 h-5 text-[#080808]" />
            ) : (
              <UtensilsCrossed className="w-5 h-5 text-[#080808]" />
            )}
            <span className="text-[8px] text-[#080808] font-extrabold tracking-wider uppercase mt-1 leading-tight">
              Four Season
            </span>
          </div>
        )}

        {/* Popular Indicator */}
        {item.is_popular && item.is_available && (
          <div className="absolute top-1 left-1 bg-[#080808] text-[#FCF6BA] border border-[#D4AF37]/50 text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm leading-tight flex items-center gap-0.5">
            ★ Top
          </div>
        )}

        {/* Spicy Indicator */}
        {item.is_spicy && (
          <div
            className="absolute bottom-1 right-1 bg-[#080808]/90 backdrop-blur-xs text-[#F5D77F] p-0.5 rounded border border-[#D4AF37]/50"
            title="Spiced / Seasoned"
          >
            <Flame className="w-3 h-3 text-amber-400" />
          </div>
        )}
      </div>

      {/* Item Information (No Price Tags) */}
      <div className="flex-1 flex flex-col justify-center min-w-0 py-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-extrabold text-sm sm:text-base text-[#080808] group-hover:text-black transition-colors truncate">
            {item.name}
          </h3>
        </div>

        <p className="text-[11px] sm:text-xs text-[#1A1A1A] font-medium line-clamp-1 leading-normal my-0.5">
          {item.description}
        </p>

        {/* Availability or serving hours */}
        <div className="flex items-center gap-2 text-[10px] text-[#111111]">
          {!item.is_available ? (
            <span className="text-[9px] font-bold text-[#FCF6BA] bg-[#080808] px-1.5 py-0.5 rounded border border-[#080808]">
              Not available
            </span>
          ) : isOutsideServingHours ? (
            <span className="flex items-center gap-1 text-[9px] text-[#080808] font-semibold">
              <Clock className="w-2.5 h-2.5 text-[#080808]" />
              <span>Served {item.available_from}–{item.available_until}</span>
            </span>
          ) : item.is_local_specialty ? (
            <span className="text-[9px] text-[#080808] font-bold">
              Local Specialty
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};
