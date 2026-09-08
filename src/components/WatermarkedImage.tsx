import React, { useState } from 'react';

interface WatermarkedImageProps {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  watermarkSize?: 'sm' | 'md' | 'lg';
}

export const WATERMARK_TEXT = 'This is made by INSTA ID @thee.juuu';

export const WatermarkedImage: React.FC<WatermarkedImageProps> = ({
  src,
  alt,
  className = '',
  imgClassName = '',
  watermarkSize = 'sm',
}) => {
  const [hasError, setHasError] = useState(false);

  const fallbackSrc =
    'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80';

  const sizeClasses = {
    sm: 'text-[9px] sm:text-[10px] py-1 px-2',
    md: 'text-[11px] sm:text-[12px] py-1.5 px-2.5',
    lg: 'text-[12px] sm:text-[13px] py-2 px-3',
  };

  return (
    <div className={`relative overflow-hidden group select-none ${className}`}>
      <img
        src={hasError ? fallbackSrc : src}
        alt={alt}
        onError={() => setHasError(true)}
        className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${imgClassName}`}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      {/* Subtle overlay gradient to make bottom text readable without obstructing food */}
      <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

      {/* Mandatory Watermark Badge */}
      <div
        className={`absolute bottom-2 right-2 bg-[#0d2317]/85 backdrop-blur-md text-[#dfb64c] border border-[#cba135]/40 rounded-md font-mono tracking-tight font-medium shadow-sm z-10 pointer-events-none flex items-center gap-1.5 ${sizeClasses[watermarkSize]}`}
        title="Protected Media Watermark"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#dfb64c] animate-pulse inline-block" />
        <span className="truncate max-w-[240px]">{WATERMARK_TEXT}</span>
      </div>
    </div>
  );
};
