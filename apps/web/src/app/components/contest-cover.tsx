'use client';
import Image from 'next/image';
import { useState } from 'react';
export function ContestCover({
  src,
  className = '',
}: {
  src: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <div className={`contest-cover ${className}`}>
      {src && failed !== src ? (
        <Image
          src={src}
          alt=""
          width={1200}
          height={800}
          unoptimized
          onError={() => setFailed(src)}
        />
      ) : (
        <div className="cover-placeholder" aria-hidden="true">
          <svg viewBox="0 0 160 110" fill="none">
            <circle cx="115" cy="30" r="12" />
            <path d="m8 100 45-61 31 39 19-24 49 46H8Z" />
            <path d="m39 58 14-19 13 17-11 9-8-8-8 1Z" />
          </svg>
        </div>
      )}
    </div>
  );
}
