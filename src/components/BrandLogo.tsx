import React, { useState, useEffect } from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  customLogoUrl?: string;
  className?: string;
  showSubtitle?: boolean;
}

const DEFAULT_FOUR_SEASON_LOGO = '/assets/images/four_season_logo_1790686712803.jpg';

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  customLogoUrl,
  className = '',
  showSubtitle = true,
}) => {
  const effectiveUrl =
    customLogoUrl && customLogoUrl.trim() !== ''
      ? customLogoUrl
      : DEFAULT_FOUR_SEASON_LOGO;

  const [imgSrc, setImgSrc] = useState(effectiveUrl);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgSrc(
      customLogoUrl && customLogoUrl.trim() !== ''
        ? customLogoUrl
        : DEFAULT_FOUR_SEASON_LOGO
    );
    setImgFailed(false);
  }, [customLogoUrl]);

  const handleError = () => {
    if (imgSrc.startsWith('/assets/images/')) {
      const filename = imgSrc.split('/').pop()?.split('?')[0];
      if (filename) {
        setImgSrc(`/api/images/${filename}`);
        return;
      }
    }
    setImgFailed(true);
  };

  const dimensionMap = {
    sm: { box: 'w-10 h-10', title: 'text-[8px]', sub: 'text-[6px]' },
    md: { box: 'w-13 h-13', title: 'text-[10px]', sub: 'text-[7px]' },
    lg: { box: 'w-18 h-18', title: 'text-xs font-black', sub: 'text-[9px]' },
    xl: { box: 'w-24 h-24', title: 'text-sm font-black', sub: 'text-[11px]' },
  };

  const dim = dimensionMap[size];

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div
        className={`relative ${dim.box} flex items-center justify-center shrink-0 select-none overflow-hidden`}
      >
        {!imgFailed ? (
          <img
            src={imgSrc}
            alt="Four Season Cafe and Restaurant"
            referrerPolicy="no-referrer"
            onError={handleError}
            className="w-full h-full object-contain"
          />
        ) : (
          <img
            src="/assets/images/four_season_logo_exact.svg"
            alt="Four Season Cafe and Restaurant"
            className="w-full h-full object-contain"
          />
        )}
      </div>

      {showSubtitle && (
        <div className="flex flex-col text-left">
          <span className="font-extrabold text-[#080808] tracking-tight uppercase text-sm sm:text-base leading-tight">
            Four Season
          </span>
          <span className="text-[10px] sm:text-[11px] text-[#1A1A1A] tracking-widest uppercase font-bold">
            Cafe &amp; Restaurant
          </span>
        </div>
      )}
    </div>
  );
};
