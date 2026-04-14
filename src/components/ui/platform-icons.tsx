/**
 * Real brand SVG icons for platforms used across lead finder, social manager, etc.
 * Each icon is a simple, recognizable representation of the brand.
 */

interface IconProps {
  size?: number;
  className?: string;
}

export function GoogleMapsIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335"/>
      <circle cx="12" cy="9" r="2.5" fill="#fff"/>
    </svg>
  );
}

export function FacebookIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#1877F2"/>
      <path d="M16.5 12.5h-2.5v8h-3v-8H9v-2.5h2v-1.7c0-2.1 1-3.3 3.3-3.3h2.2v2.5h-1.4c-1 0-1.1.4-1.1 1.1V10h2.5l-.5 2.5z" fill="#fff"/>
    </svg>
  );
}

export function InstagramIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <defs>
        <linearGradient id="ig_grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFDC80"/>
          <stop offset="25%" stopColor="#F77737"/>
          <stop offset="50%" stopColor="#E1306C"/>
          <stop offset="75%" stopColor="#C13584"/>
          <stop offset="100%" stopColor="#833AB4"/>
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#ig_grad)"/>
      <circle cx="12" cy="12" r="4" stroke="#fff" strokeWidth="2" fill="none"/>
      <circle cx="17.5" cy="6.5" r="1.2" fill="#fff"/>
    </svg>
  );
}

export function TikTokIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#010101"/>
      <path d="M16.5 5.5c-.7-.5-1.2-1.3-1.3-2.2h-2.4v11c0 1.3-1 2.4-2.3 2.4-1.3 0-2.3-1.1-2.3-2.4s1-2.4 2.3-2.4c.2 0 .5 0 .7.1V9.5c-.2 0-.5-.1-.7-.1-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5V9.5c1 .7 2.1 1.1 3.3 1.1V8.2c-1.2 0-2.3-.5-3.3-1.3v-.4z" fill="#25F4EE"/>
      <path d="M16.5 5.5c.8.7 1.8 1.1 2.8 1.1V8.2c-1.2 0-2.3-.4-3.3-1.1V14c0 2.8-2.2 5-5 5-1.1 0-2-.3-2.8-.9.9.8 2 1.3 3.3 1.3 2.8 0 5-2.2 5-5V5.5z" fill="#FE2C55"/>
    </svg>
  );
}

export function LinkedInIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="4" fill="#0A66C2"/>
      <path d="M8 10v7H5.5v-7H8zm-1.25-1.5c-.7 0-1.25-.56-1.25-1.25S6.05 6 6.75 6 8 6.56 8 7.25 7.44 8.5 6.75 8.5zM18.5 17H16v-3.5c0-1-.4-1.7-1.3-1.7-.7 0-1.1.5-1.3.9-.1.2-.1.4-.1.6V17h-2.5V10h2.4v1c.3-.5 1-1.2 2.2-1.2 1.6 0 2.8 1.1 2.8 3.3V17z" fill="#fff"/>
    </svg>
  );
}

export function YelpIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#D32323"/>
      <path d="M12 5c-1.5 0-2.5 1-2.5 2.5v4c0 .8.5 1.3 1.2 1.5l3 1c.6.2 1.3-.3 1.3-1v-1c0-.3-.2-.6-.5-.7l-1.5-.5V7.5C13 6 12.5 5 12 5z" fill="#fff"/>
    </svg>
  );
}

export function TripAdvisorIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#00AF87"/>
      <circle cx="8" cy="13" r="2.5" stroke="#fff" strokeWidth="1.5" fill="none"/>
      <circle cx="16" cy="13" r="2.5" stroke="#fff" strokeWidth="1.5" fill="none"/>
      <path d="M6 10.5C7.5 8.5 9.5 7.5 12 7.5s4.5 1 6 3" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <circle cx="8" cy="13" r="0.8" fill="#fff"/>
      <circle cx="16" cy="13" r="0.8" fill="#fff"/>
    </svg>
  );
}

export function TrustpilotIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#00B67A"/>
      <path d="M12 5l2.2 6.8H21l-5.5 4 2.1 6.5L12 18.2l-5.6 4.1 2.1-6.5-5.5-4h6.8L12 5z" fill="#fff"/>
      <path d="M14.8 15.5L12 18.2l1.1-3.4 1.7.7z" fill="#005128"/>
    </svg>
  );
}

export function YellowPagesIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#FFD700"/>
      <text x="4" y="17" fontFamily="Arial Black, sans-serif" fontSize="11" fontWeight="900" fill="#000">YP</text>
    </svg>
  );
}

export function IndeedIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#2164F3"/>
      <circle cx="13" cy="7" r="2" fill="#fff"/>
      <rect x="11.5" y="10" width="3" height="8" rx="1.5" fill="#fff"/>
    </svg>
  );
}

export function GoogleIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5c-.2 1.3-1 2.4-2.1 3.1v2.6h3.4c2-1.8 3-4.5 3-7.5z" fill="#4285F4"/>
      <path d="M12 22c2.9 0 5.3-1 7-2.6l-3.4-2.6c-.9.6-2.1 1-3.6 1-2.8 0-5.1-1.9-5.9-4.4H2.6v2.7C4.3 19.8 7.9 22 12 22z" fill="#34A853"/>
      <path d="M6.1 13.4c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V6.7H2.6C1.9 8.1 1.5 9.5 1.5 11s.4 2.9 1.1 4.3l3.5-1.9z" fill="#FBBC05"/>
      <path d="M12 5.4c1.6 0 3 .5 4.1 1.6l3.1-3.1C17.3 2.1 14.9 1 12 1 7.9 1 4.3 3.2 2.6 6.7l3.5 2.7C6.9 7.3 9.2 5.4 12 5.4z" fill="#EA4335"/>
    </svg>
  );
}

export function YouTubeIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#FF0000"/>
      <path d="M9.5 8v8l7-4-7-4z" fill="#fff"/>
    </svg>
  );
}

export function XTwitterIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#000"/>
      <path d="M13.7 10.6L18.2 5h-1.1l-3.9 4.9L9.9 5H5.5l4.7 7.1L5.5 18h1.1l4.1-5.2 3.4 5.2h4.4l-4.8-7.4zm-1.5 1.8l-.5-.7L7.3 6h1.6l3 4.4.5.7 4 5.9h-1.6l-3.4-4.7z" fill="#fff"/>
    </svg>
  );
}

/** Utility: get platform icon by string ID */
export function getPlatformIcon(platform: string, size = 18): React.ReactNode {
  const map: Record<string, React.ReactNode> = {
    google_maps: <GoogleMapsIcon size={size} />,
    google: <GoogleIcon size={size} />,
    facebook: <FacebookIcon size={size} />,
    instagram: <InstagramIcon size={size} />,
    tiktok: <TikTokIcon size={size} />,
    linkedin: <LinkedInIcon size={size} />,
    youtube: <YouTubeIcon size={size} />,
    yelp: <YelpIcon size={size} />,
    tripadvisor: <TripAdvisorIcon size={size} />,
    trustpilot: <TrustpilotIcon size={size} />,
    yellow_pages: <YellowPagesIcon size={size} />,
    indeed: <IndeedIcon size={size} />,
    x_twitter: <XTwitterIcon size={size} />,
    meta_ads: <FacebookIcon size={size} />,
    tiktok_ads: <TikTokIcon size={size} />,
    google_ads: <GoogleIcon size={size} />,
  };
  return map[platform.toLowerCase()] || <GoogleIcon size={size} />;
}
