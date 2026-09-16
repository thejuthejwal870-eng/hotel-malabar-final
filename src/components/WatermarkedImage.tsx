import React, { useState, memo } from 'react';

interface WatermarkedImageProps {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  watermarkSize?: 'sm' | 'md' | 'lg';
}

export const WATERMARK_TEXT = 'This is made by INSTA ID @thee.juuu';

const DEFAULT_FOOD_IMAGE =
  'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80';

export const WatermarkedImage: React.FC<WatermarkedImageProps> = memo(({
  src,
  alt,
  className = '',
  imgClassName = '',
  watermarkSize = 'sm',
}) => {
  const [hasError, setHasError] = useState(false);

  const cleanSrc = (src || '').trim();

  // Do not use the old shared/default food photo anymore.
  // Only a real image URL saved for that specific menu item is allowed to render.
  const isOldDefaultImage =
    cleanSrc === DEFAULT_FOOD_IMAGE ||
    cleanSrc.startsWith('https://images.unsplash.com/photo-1546833999-b9f581a1996d');
  const effectiveSrc = cleanSrc && !isOldDefaultImage && !hasError ? cleanSrc : '';

  const sizeClasses = {
    sm: 'text-[9px] sm:text-[10px] py-1 px-2',
    md: 'text-[11px] sm:text-[12px] py-1.5 px-2.5',
    lg: 'text-[12px] sm:text-[13px] py-2 px-3',
  };

  return (
    <div className={`relative overflow-hidden group select-none ${className}`}>
      {effectiveSrc ? (
        <img
          src={effectiveSrc}
          alt={alt}
          onError={() => setHasError(true)}
          className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${imgClassName}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div
          className="w-full h-full min-h-[120px] flex flex-col items-center justify-center bg-[#edf1eb] border border-dashed border-[#c8c8b9] text-[#657066]"
          role="img"
          aria-label={`${alt} — no image added`}
        >
          <div className="w-11 h-11 rounded-full border-2 border-[#aeb8ae] flex items-center justify-center mb-2">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.7">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="8.5" cy="9" r="1.5" />
              <path d="m21 15-4.5-4.5L9 18l-3-3-3 3" />
            </svg>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wide">No image</span>
        </div>
      )}

      {effectiveSrc && (
        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
      )}

      {/* Mandatory Watermark Badge — shown only on real uploaded/saved images */}
      {effectiveSrc && (
        <div
          className={`absolute bottom-2 right-2 bg-[#0d2317]/85 backdrop-blur-md text-[#dfb64c] border border-[#cba135]/40 rounded-md font-mono tracking-tight font-medium shadow-sm z-10 pointer-events-none flex items-center gap-1.5 ${sizeClasses[watermarkSize]}`}
          title="Protected Media Watermark"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#dfb64c] animate-pulse inline-block" />
          <span className="truncate max-w-[240px]">{WATERMARK_TEXT}</span>
        </div>
      )}
    </div>
  );
});
