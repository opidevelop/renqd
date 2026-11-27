"use client";

import {useState} from "react";

type BrandQueenImageProps = {
  src: string;
  fallbackSrc?: string;
  className: string;
};

export function BrandQueenImage({src, fallbackSrc, className}: BrandQueenImageProps) {
  const [imageSrc, setImageSrc] = useState(src);

  return (
    // This small client boundary owns the image error handler; the homepage remains a Server Component.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={imageSrc}
      alt=""
      referrerPolicy="no-referrer"
      decoding="async"
      onError={() => {
        if (fallbackSrc && imageSrc !== fallbackSrc) {
          setImageSrc(fallbackSrc);
        }
      }}
    />
  );
}
