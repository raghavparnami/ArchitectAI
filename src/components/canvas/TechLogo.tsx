'use client';
import { useState } from 'react';
import { TechItem } from '@/lib/types';

interface TechLogoProps {
  tech: TechItem;
  size?: number;
  /** show the colored brand logo (true) or a monochrome version on accent bg (false) */
  brand?: boolean;
}

/**
 * Renders the real Simple Icons logo for a tech, with the 2-letter abbr
 * fallback if the CDN 404s or there is no slug.
 */
export function TechLogo({ tech, size = 14, brand = true }: TechLogoProps) {
  const [errored, setErrored] = useState(false);

  if (!tech.iconSlug || errored) {
    return (
      <span
        className="inline-flex items-center justify-center font-mono font-bold"
        style={{
          width: size + 2,
          height: size + 2,
          fontSize: Math.max(8, size - 4),
          color: tech.color,
        }}
      >
        {tech.abbr}
      </span>
    );
  }

  const colorParam = brand ? tech.color.replace('#', '') : 'C7521B';
  const src = `https://cdn.simpleicons.org/${tech.iconSlug}/${colorParam}`;

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={tech.label}
      width={size}
      height={size}
      onError={() => setErrored(true)}
      style={{ display: 'block', objectFit: 'contain' }}
    />
  );
}
