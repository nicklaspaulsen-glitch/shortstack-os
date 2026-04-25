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

/* ============================================================== */
/*  Messaging / Chat Platforms                                     */
/* ============================================================== */

export function WhatsAppIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#25D366"/>
      <path d="M17.5 14.4c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7 0-.3-.2-1.3-.5-2.5-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.4.5-.5.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.2-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1.1 1-1.1 2.5s1.1 2.9 1.2 3.1c.2.2 2.2 3.4 5.3 4.7.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.4z" fill="#fff"/>
    </svg>
  );
}

export function DiscordIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#5865F2"/>
      <path d="M18.3 6.5c-1.1-.5-2.3-.9-3.5-1.1-.2.3-.4.7-.5 1-1.3-.2-2.6-.2-3.9 0-.1-.3-.3-.7-.5-1-1.2.2-2.4.6-3.5 1.1-2.2 3.3-2.8 6.5-2.5 9.7 1.5 1.1 2.9 1.8 4.3 2.2.3-.5.6-1 .9-1.5-.5-.2-1-.4-1.5-.7.1-.1.2-.2.4-.3 2.9 1.3 6 1.3 8.8 0 .1.1.2.2.4.3-.5.3-1 .5-1.5.7.3.5.6 1 .9 1.5 1.4-.4 2.9-1.1 4.3-2.2.4-3.7-.6-6.9-2.5-9.7zM9.1 14.3c-.8 0-1.5-.8-1.5-1.7 0-.9.7-1.7 1.5-1.7.9 0 1.5.8 1.5 1.7.1.9-.6 1.7-1.5 1.7zm5.7 0c-.8 0-1.5-.8-1.5-1.7 0-.9.7-1.7 1.5-1.7.9 0 1.5.8 1.5 1.7 0 .9-.6 1.7-1.5 1.7z" fill="#fff"/>
    </svg>
  );
}

export function SlackIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#fff"/>
      <path d="M8 13.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm.8 0a1.5 1.5 0 013 0v3.8a1.5 1.5 0 01-3 0v-3.8z" fill="#E01E5A"/>
      <path d="M10.3 7.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 .8a1.5 1.5 0 010 3H6.5a1.5 1.5 0 010-3h3.8z" fill="#36C5F0"/>
      <path d="M16 10.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm-.8 0a1.5 1.5 0 01-3 0V6.7a1.5 1.5 0 013 0v3.8z" fill="#2EB67D"/>
      <path d="M13.7 16.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm0-.8a1.5 1.5 0 010-3h3.8a1.5 1.5 0 010 3h-3.8z" fill="#ECB22E"/>
    </svg>
  );
}

export function TelegramIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#229ED9"/>
      <path d="M18.5 6.5l-2.5 12c-.2.8-.7 1-1.4.6l-3.9-2.9-1.9 1.8c-.2.2-.4.4-.8.4l.3-4 7.3-6.6c.3-.3-.1-.4-.5-.2L6.1 11.3 2.2 10c-.8-.3-.9-.9.2-1.3l15-5.8c.7-.3 1.3.2 1.1 1.3z" fill="#fff"/>
    </svg>
  );
}

export function NotionIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#fff" stroke="#000" strokeWidth="0.5"/>
      <path d="M7 6h3.5l5 7V6H18v12h-3L10 11v7H7V6z" fill="#000"/>
    </svg>
  );
}

/* ============================================================== */
/*  Email / Productivity                                           */
/* ============================================================== */

export function GmailIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#fff"/>
      <path d="M3 7v10a1 1 0 001 1h2V10l6 4 6-4v8h2a1 1 0 001-1V7L12 12 3 7z" fill="#EA4335"/>
      <path d="M3 7l9 5 9-5v-.5a1 1 0 00-1-1H4a1 1 0 00-1 1V7z" fill="#C5221F"/>
      <path d="M6 18V10l6 4 6-4v8h-3v-5l-3 2-3-2v5H6z" fill="#fff"/>
      <path d="M3 7l2 1.4V18H4a1 1 0 01-1-1V7z" fill="#4285F4"/>
      <path d="M21 7l-2 1.4V18h1a1 1 0 001-1V7z" fill="#34A853"/>
      <path d="M18 10l3-2v-1L18 9v1z" fill="#FBBC05"/>
    </svg>
  );
}

export function OutlookIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#0078D4"/>
      <rect x="11" y="7" width="9" height="10" rx="1" fill="#fff"/>
      <path d="M11 9l4.5 3L20 9" stroke="#0078D4" strokeWidth="1" fill="none"/>
      <ellipse cx="7.5" cy="12" rx="3" ry="3.8" fill="#0078D4" stroke="#fff" strokeWidth="1.5"/>
      <text x="5.5" y="14.5" fontFamily="Arial Black, sans-serif" fontSize="5" fontWeight="900" fill="#fff">O</text>
    </svg>
  );
}

/* ============================================================== */
/*  Payments / Commerce                                            */
/* ============================================================== */

export function StripeIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#635BFF"/>
      <path d="M13.5 10c0-.6.5-.8 1.3-.8 1.1 0 2.6.4 3.7 1V6.5c-1.2-.5-2.5-.7-3.7-.7-3 0-5 1.6-5 4.2 0 4.1 5.7 3.5 5.7 5.3 0 .7-.6 1-1.5 1-1.2 0-2.8-.5-4-1.2v3.8c1.4.6 2.8.9 4 .9 3.1 0 5.2-1.5 5.2-4.2-.1-4.5-5.7-3.8-5.7-5.6z" fill="#fff"/>
    </svg>
  );
}

export function PayPalIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#fff"/>
      <path d="M8.5 5h5.2c2.5 0 4.2 1.3 3.8 3.8-.4 2.7-2.5 4.1-5.1 4.1H11l-.6 4H8l.5-11.9z" fill="#003087"/>
      <path d="M9.5 8.5h4.2c2.5 0 4 1.3 3.6 3.8-.4 2.7-2.4 4.1-5 4.1h-1.4l-.6 3.6H7.5l2-11.5z" fill="#009CDE"/>
      <path d="M9.5 8.5h4.2c.5 0 .9 0 1.3.1-.4-1.2-1.5-2-3.3-2H8.5l-2 11.5h1.7l1.3-9.6z" fill="#012169"/>
    </svg>
  );
}

export function ShopifyIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#95BF47"/>
      <path d="M15.5 7.5c0-.1-.1-.2-.2-.2-.1 0-1.8-.1-1.8-.1s-1.2-1.2-1.3-1.3c-.1-.1-.4-.1-.5 0l-.6.2c-.4-1.1-1.1-2.1-2.3-2.1H8.7C8.3 3.4 7.9 3.2 7.5 3.2 4.3 3.2 2.8 7.2 2.3 9.2L.6 9.7c-.5.2-.5.2-.6.7L-.5 20h13L15.5 7.5zM9.5 5.8v.1l-1.7.5c.3-1.3.9-1.9 1.5-2.1.2.4.3 1 .3 1.5h-.1zm-1.1-2.2c.1 0 .3 0 .4.1-.7.3-1.5 1.2-1.8 3l-1.4.4C5.9 5.6 7 3.6 8.4 3.6zm.7 9.1c-.2-.1-.5-.2-.8-.2-.6 0-.7.4-.7.5 0 .5 1.3.7 1.3 1.9 0 .9-.6 1.6-1.4 1.6-1 0-1.5-.6-1.5-.6l.3-.9s.5.4 1 .4c.3 0 .4-.2.4-.4 0-.6-1-.6-1-1.7 0-.9.6-1.7 1.9-1.7.5 0 .8.2.8.2l-.3.9z" fill="#fff"/>
    </svg>
  );
}

export function SquareIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#000"/>
      <rect x="6" y="6" width="12" height="12" rx="1.5" stroke="#fff" strokeWidth="1.5" fill="none"/>
      <rect x="10" y="10" width="4" height="4" fill="#fff"/>
    </svg>
  );
}

/* ============================================================== */
/*  Marketing / Automation                                         */
/* ============================================================== */

export function ZapierIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#FF4A00"/>
      <path d="M12 4l-2.5 7H13l-2.5 9L18 12h-4l3-8h-5z" fill="#fff"/>
    </svg>
  );
}

export function MailchimpIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#FFE01B"/>
      <path d="M12 5c-3.9 0-7 2.4-7 5.5 0 1.8 1 3.3 2.6 4.3l-.4 2.2c-.1.4.3.7.7.5l2-.9c.7.2 1.4.3 2.1.3 3.9 0 7-2.4 7-5.5S15.9 5 12 5z" fill="#000"/>
      <circle cx="10" cy="10" r="0.8" fill="#fff"/>
      <circle cx="14" cy="10" r="0.8" fill="#fff"/>
      <path d="M9.5 13c1 1 4 1 5 0" stroke="#fff" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

export function HubspotIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#FF7A59"/>
      <path d="M16 10.5V8a2 2 0 10-1.5 0v2.5c-.9.3-1.7.9-2.2 1.8l-3-2.3c.1-.3.2-.6.2-.9a2.5 2.5 0 10-2.5 2.5c.5 0 1-.2 1.4-.5l3 2.3c-.3.6-.4 1.2-.4 1.9a4 4 0 104-4c-.3 0-.6 0-1 .1l-.1-.9zm-1 6.3a2.3 2.3 0 110-4.6 2.3 2.3 0 010 4.6z" fill="#fff"/>
    </svg>
  );
}

export function SalesforceIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#00A1E0"/>
      <path d="M14.5 8.5c.6-.6 1.4-1 2.3-1 1.8 0 3.2 1.5 3.2 3.3 0 .4-.1.8-.2 1.2.4-.2.9-.3 1.4-.3.9 0 1.7.5 2.1 1.3-.5.8-1.3 1.3-2.2 1.3H5.5c-1.7 0-3-1.4-3-3.1 0-1.7 1.3-3.1 3-3.1.3 0 .6 0 .9.1.5-1.4 1.8-2.4 3.3-2.4 1.2 0 2.2.6 2.9 1.5.5-.5 1.2-.8 1.9-.8z" fill="#fff"/>
    </svg>
  );
}

/* ============================================================== */
/*  Design / Creative                                              */
/* ============================================================== */

export function CanvaIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <defs>
        <linearGradient id="canva_grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00C4CC"/>
          <stop offset="100%" stopColor="#7D2AE7"/>
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="5" fill="url(#canva_grad)"/>
      <path d="M16 10c-.5-1.8-2.1-3-4-3-2.5 0-4.5 2.2-4.5 5s2 5 4.5 5c1.9 0 3.5-1.2 4-3h-2c-.4.6-1.1 1-2 1-1.4 0-2.5-1.3-2.5-3s1.1-3 2.5-3c.9 0 1.6.4 2 1h2z" fill="#fff"/>
    </svg>
  );
}

export function FigmaIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#fff"/>
      <path d="M8.5 4h3.5v5H8.5a2.5 2.5 0 010-5z" fill="#F24E1E"/>
      <path d="M12 4h3.5a2.5 2.5 0 010 5H12V4z" fill="#FF7262"/>
      <path d="M12 9h3.5a2.5 2.5 0 010 5H12V9z" fill="#A259FF"/>
      <path d="M8.5 9H12v5H8.5a2.5 2.5 0 010-5z" fill="#1ABCFE"/>
      <path d="M8.5 14H12v2.5a2.5 2.5 0 11-2.5-2.5h-1z" fill="#0ACF83"/>
    </svg>
  );
}

export function ZoomIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#2D8CFF"/>
      <path d="M4 9a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V9zm16 0l-3 2v2l3 2V9z" fill="#fff"/>
    </svg>
  );
}

export function CalendlyIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#006BFF"/>
      <rect x="6" y="7" width="12" height="11" rx="1.5" fill="#fff"/>
      <rect x="6" y="7" width="12" height="2.5" fill="#006BFF"/>
      <circle cx="9" cy="5.5" r="1" fill="#fff"/>
      <circle cx="15" cy="5.5" r="1" fill="#fff"/>
      <rect x="8.5" y="11" width="2" height="2" rx="0.3" fill="#006BFF"/>
      <rect x="11" y="11" width="2" height="2" rx="0.3" fill="#006BFF"/>
      <rect x="13.5" y="11" width="2" height="2" rx="0.3" fill="#006BFF"/>
      <rect x="8.5" y="14" width="2" height="2" rx="0.3" fill="#006BFF"/>
      <rect x="11" y="14" width="2" height="2" rx="0.3" fill="#006BFF"/>
    </svg>
  );
}

/* ============================================================== */
/*  Social / Video Platforms                                       */
/* ============================================================== */

export function YouTubeShortsIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#000"/>
      <rect x="8" y="3" width="8" height="18" rx="2" fill="#FF0000"/>
      <path d="M10.5 9v6l5-3-5-3z" fill="#fff"/>
    </svg>
  );
}

export function PinterestIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#E60023"/>
      <path d="M12 4a8 8 0 00-3 15.4c0-.6-.1-1.6 0-2.3l1-4.2s-.3-.5-.3-1.3c0-1.2.7-2.1 1.6-2.1.8 0 1.1.6 1.1 1.3 0 .8-.5 2-.8 3.1-.2.9.5 1.7 1.4 1.7 1.7 0 3-1.8 3-4.4 0-2.3-1.6-3.9-4-3.9-2.7 0-4.3 2-4.3 4.1 0 .8.3 1.7.7 2.2.1.1.1.1.1.2l-.3 1c0 .2-.1.2-.3.1-1.1-.5-1.8-2-1.8-3.3 0-2.7 2-5.2 5.6-5.2 2.9 0 5.2 2.1 5.2 4.9 0 2.9-1.8 5.3-4.4 5.3-.9 0-1.7-.4-2-1l-.6 2.2c-.2.8-.8 1.8-1.1 2.4A8 8 0 1012 4z" fill="#fff"/>
    </svg>
  );
}

export function SnapchatIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#FFFC00"/>
      <path d="M12 5c-2.5 0-4.5 1.8-4.5 4.5 0 1 .1 1.9.1 2.3-.1.1-.4.2-.7.2-.3 0-.9-.1-1.1.4-.2.5.5.8.8.9.3.1.8.3.7.7-.3.9-1.5 2.1-2.3 2.4-.3.1-.5.3-.3.7.3.7 2.2.6 2.5 1 .1.2.1.5.4.6.4.2 1 0 1.8-.1.8-.1 1.7-.1 2.4.4.4.3.9.7 1.7.7s1.3-.4 1.7-.7c.7-.5 1.6-.5 2.4-.4.8.1 1.3.3 1.8.1.3-.1.3-.4.4-.6.3-.4 2.2-.3 2.5-1 .2-.4 0-.6-.3-.7-.8-.3-2-1.5-2.3-2.4-.1-.4.4-.6.7-.7.3-.1 1-.4.8-.9-.2-.5-.8-.4-1.1-.4-.3 0-.6-.1-.7-.2 0-.4.1-1.3.1-2.3C16.5 6.8 14.5 5 12 5z" fill="#000"/>
    </svg>
  );
}

export function RedditIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#FF4500"/>
      <circle cx="12" cy="13" r="6" fill="#fff"/>
      <circle cx="9.5" cy="12.5" r="1" fill="#FF4500"/>
      <circle cx="14.5" cy="12.5" r="1" fill="#FF4500"/>
      <path d="M9.5 15c1 .8 4 .8 5 0" stroke="#FF4500" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
      <circle cx="18" cy="10" r="1.5" fill="#FF4500"/>
      <circle cx="17" cy="7" r="1" fill="#fff"/>
      <path d="M17 8l1 2" stroke="#fff" strokeWidth="0.6"/>
    </svg>
  );
}

export function TwitchIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#9146FF"/>
      <path d="M6 5l-1 3v10h3v3h3l3-3h3l4-4V5H6zm14 8l-3 3h-3l-3 3v-3H8V7h12v6zm-3-4h-1.5v4H17V9zm-4 0h-1.5v4H13V9z" fill="#fff"/>
    </svg>
  );
}

export function SpotifyIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#1DB954"/>
      <circle cx="12" cy="12" r="7" fill="#1DB954" stroke="#000" strokeWidth="0.5"/>
      <path d="M7.5 10c3-.8 6-.6 9 .5" stroke="#000" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
      <path d="M7.8 12.5c2.6-.7 5.2-.5 7.7.4" stroke="#000" strokeWidth="1" strokeLinecap="round" fill="none"/>
      <path d="M8.2 15c2.2-.6 4.3-.4 6.3.3" stroke="#000" strokeWidth="0.9" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

export function AppleMusicIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <defs>
        <linearGradient id="am_grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FC5C7D"/>
          <stop offset="100%" stopColor="#FA2D48"/>
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="5" fill="url(#am_grad)"/>
      <path d="M15 6l-6 1.3v7.3c-.3-.1-.7-.2-1.1-.2-1.5 0-2.7.9-2.7 2s1.2 2 2.7 2 2.7-.9 2.7-2V9.4l4.4-1v4.8c-.3-.1-.7-.2-1.1-.2-1.5 0-2.7.9-2.7 2s1.2 2 2.7 2 2.7-.9 2.7-2V6h-1.6z" fill="#fff"/>
    </svg>
  );
}

/* ============================================================== */
/*  Commerce / E-commerce                                          */
/* ============================================================== */

export function AmazonIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#000"/>
      <text x="3.5" y="13" fontFamily="Arial, sans-serif" fontSize="7" fontWeight="700" fill="#fff">amazon</text>
      <path d="M5 15c2 2 12 2 14 0" stroke="#FF9900" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M17 14.5l2 .5-.5 2" stroke="#FF9900" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function WooCommerceIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#7F54B3"/>
      <path d="M4 9c0-.5.4-1 1-1h14c.6 0 1 .5 1 1v6c0 .6-.4 1-1 1h-7l-3 2 .5-2H5c-.6 0-1-.4-1-1V9z" fill="#fff"/>
      <text x="6" y="14" fontFamily="Arial, sans-serif" fontSize="4.5" fontWeight="700" fill="#7F54B3">Woo</text>
    </svg>
  );
}

export function WordPressIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#21759B"/>
      <circle cx="12" cy="12" r="7" fill="none" stroke="#fff" strokeWidth="1"/>
      <path d="M6 10l3 8 2-5 2 5 3-8h-1.5l-1.5 4-1.5-4h-1l-1.5 4-1.5-4H6z" fill="#fff"/>
    </svg>
  );
}

/* ============================================================== */
/*  Advertising Platforms                                          */
/* ============================================================== */

export function GoogleAdsIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#fff"/>
      <path d="M10 4l-7 12 4 2 7-12-4-2z" fill="#FBBC05"/>
      <path d="M14 4l7 12-4 2-7-12 4-2z" fill="#4285F4"/>
      <circle cx="8" cy="18" r="3" fill="#34A853"/>
    </svg>
  );
}

export function MetaIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <defs>
        <linearGradient id="meta_grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0062E0"/>
          <stop offset="100%" stopColor="#19AFFF"/>
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="5" fill="url(#meta_grad)"/>
      <path d="M6 14c0-3 1.5-6 4-6 1.5 0 2.5 1 3.5 2.5l1 1.5c1 1.5 2 2.5 3.5 2.5 1.5 0 2-1 2-2s-.5-2-2-2c-.8 0-1.3.3-2 1l-1.3 1.5-1-1.5C12.5 9.5 11 7.5 9 7.5c-3 0-5 3-5 6.5s2 6.5 5 6.5c1.5 0 2.5-.5 3.5-1.5l-1-1.5c-.5.5-1 1-2.5 1-1.7 0-3-1.5-3-2.5z" fill="#fff"/>
    </svg>
  );
}

export function ThreadsIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#000"/>
      <path d="M16.5 11.2c-.1 0-.2-.1-.3-.1-.1-2.4-1.4-3.8-3.6-3.9h-.1c-1.3 0-2.4.6-3.1 1.6l1.2.8c.5-.8 1.3-.9 1.9-.9 1.5 0 2.1.8 2.1 2.2-.5-.1-1-.2-1.5-.2-1.4.1-3 .9-3.1 2.5 0 1.6 1.3 2.5 2.7 2.5 1.8 0 2.9-1.1 3.3-2.6.6.3 1 .7 1.2 1.2.4.9.4 2.3-.7 3.4-1 1-2.1 1.4-3.7 1.4-1.7 0-3-.5-3.9-1.6-.9-1-1.3-2.5-1.3-4.4s.4-3.4 1.3-4.4c.9-1 2.3-1.6 3.9-1.6 1.7 0 3 .6 3.9 1.7.5.6.9 1.3 1.1 2.2l1.5-.4c-.3-1.1-.8-2-1.5-2.7-1.2-1.3-2.9-2-5-2-2.1 0-3.8.7-5 2-1.1 1.3-1.7 3.1-1.7 5.2s.6 3.9 1.7 5.2c1.2 1.3 2.9 2 5 2 1.9 0 3.3-.5 4.5-1.4l.1-.1c1.5-1.5 1.5-3.6.9-5-.4-.8-1-1.4-1.8-1.9zm-3.7 3.4c-.8 0-1.5-.4-1.5-1.1 0-.7.9-1.2 1.9-1.2.5 0 .9.1 1.4.2-.2 1.3-.9 2.1-1.8 2.1z" fill="#fff"/>
    </svg>
  );
}

/* ============================================================== */
/*  Hosting & Domain Platforms                                     */
/* ============================================================== */

export function VercelIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#000"/>
      <path d="M12 6L20 18H4L12 6z" fill="#fff"/>
    </svg>
  );
}

export function GoDaddyIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#1BDBDB"/>
      <path d="M7 15c.5-3 2-5.5 5-5.5s4.5 2.5 5 5.5c.2 1.2-.4 1.8-1.2 1.8-1 0-1.4-.6-1.6-1.4-.3-1.6-1-3-2.2-3-1.3 0-1.9 1.4-2.2 3-.2.8-.6 1.4-1.6 1.4-.8 0-1.4-.6-1.2-1.8z" fill="#000"/>
    </svg>
  );
}

/* ============================================================== */
/*  AI / Compute Providers                                         */
/* ============================================================== */

export function AnthropicIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#CC785C"/>
      <path d="M9.2 6h2.4l3.2 12h-2.3l-.7-2.6h-3l-.7 2.6H6L9.2 6zm.5 7.5h2.2l-1.1-4.3-1.1 4.3z" fill="#fff"/>
    </svg>
  );
}

export function OpenAIIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#000"/>
      <path d="M18.5 11.4c.3-.9.2-1.9-.3-2.7a3.3 3.3 0 00-3.6-1.6 3.4 3.4 0 00-2.6-1.1c-1.5 0-2.8 1-3.2 2.4-1 .2-1.8.8-2.3 1.7-.8 1.3-.6 3 .4 4.1-.3.9-.2 1.9.3 2.7a3.3 3.3 0 003.6 1.6c.7.7 1.6 1.1 2.6 1.1 1.5 0 2.8-1 3.2-2.4 1-.2 1.8-.8 2.3-1.7.8-1.3.6-3-.4-4.1zm-5 6.8c-.6 0-1.2-.2-1.7-.6l.1-.1 2.8-1.6c.2-.1.2-.3.2-.4v-3.9l1.2.7v3.3c0 1.4-1.1 2.6-2.6 2.6zm-5.4-2.3a2.5 2.5 0 01-.3-1.7l.1.1 2.8 1.6c.2.1.4.1.5 0l3.4-2v1.4l-2.9 1.6c-1.2.7-2.7.3-3.6-1zm-.7-6c.3-.5.7-.9 1.3-1.1V12c0 .2.1.4.2.4l3.4 1.9-1.2.7-2.8-1.6c-1.2-.7-1.7-2.2-.9-3.5zm9.5 2.2L13.5 10l1.2-.7 2.8 1.6c1.2.7 1.7 2.2.9 3.5-.3.5-.7.9-1.3 1.1V12c0-.2-.1-.4-.2-.4z" fill="#fff"/>
    </svg>
  );
}

export function ElevenLabsIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#000"/>
      <rect x="8" y="6" width="2.5" height="12" fill="#fff"/>
      <rect x="13.5" y="6" width="2.5" height="12" fill="#fff"/>
    </svg>
  );
}

/* ============================================================== */
/*  Backend / Infrastructure                                       */
/* ============================================================== */

export function SupabaseIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#1F1F1F"/>
      <path d="M12.5 4l-7 10h5.5v6l7-10H12.5V4z" fill="#3ECF8E"/>
    </svg>
  );
}

export function RunPodIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#673AB7"/>
      <path d="M13 4l-7 11h5l-2 5 8-12h-5l1-4z" fill="#fff"/>
    </svg>
  );
}

/* ============================================================== */
/*  CRM / SaaS Marketing Platforms                                 */
/* ============================================================== */

export function GoHighLevelIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#FF7426"/>
      <text x="12" y="15.6" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="8.5" fontWeight="900" fill="#fff">GHL</text>
    </svg>
  );
}

export function AyrshareIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#3B82F6"/>
      <path d="M7 18l5-12 5 12h-2.2l-1-2.5h-3.6L9.2 18H7zm3.7-4h2.6L12 10.6 10.7 14z" fill="#fff"/>
    </svg>
  );
}

/* ============================================================== */
/*  Voice / SMS / Email Providers                                  */
/* ============================================================== */

export function ResendIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#000"/>
      <path d="M7 8h5.5c2 0 3.5 1.1 3.5 2.8 0 1.3-.8 2.2-2.1 2.6L17 17h-2.5l-2-3.4H9V17H7V8zm2 1.8v2.3h3.5c.9 0 1.5-.4 1.5-1.1 0-.7-.6-1.2-1.5-1.2H9z" fill="#fff"/>
    </svg>
  );
}

export function TwilioIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill="#F22F46"/>
      <circle cx="9" cy="9" r="1.7" fill="#fff"/>
      <circle cx="15" cy="9" r="1.7" fill="#fff"/>
      <circle cx="9" cy="15" r="1.7" fill="#fff"/>
      <circle cx="15" cy="15" r="1.7" fill="#fff"/>
    </svg>
  );
}

/* ============================================================== */
/*  Smart fallback for unknown platforms                           */
/* ============================================================== */

/**
 * Generic platform icon — colored square with the platform name's
 * first letter. Used by getPlatformIcon() when no brand icon matches,
 * so an unknown platform doesn't render as a misleading Google logo.
 *
 * The hue is derived deterministically from the name so the same
 * platform always gets the same color across reloads.
 */
export function GenericPlatformIcon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  const trimmed = (name || "").trim();
  const letter = (trimmed.charAt(0) || "?").toUpperCase();
  let h = 0;
  for (let i = 0; i < trimmed.length; i++) {
    h = ((h << 5) - h) + trimmed.charCodeAt(i);
    h |= 0;
  }
  const hue = Math.abs(h) % 360;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      <rect width="24" height="24" rx="5" fill={`hsl(${hue}, 55%, 38%)`}/>
      <text x="12" y="16" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="11" fontWeight="700" fill="#fff">{letter}</text>
    </svg>
  );
}

/**
 * Utility: get platform icon by string ID.
 *
 * Accepts loose input like "Claude (Anthropic)", "GoHighLevel",
 * "ElevenLabs", etc. — normalizes by lowercasing, stripping the parens
 * group, and collapsing non-alphanumerics to underscores. Falls back to
 * <GenericPlatformIcon name=...> for unknown platforms (no longer
 * misleads users with a Google logo).
 */
export function getPlatformIcon(platform: string, size = 18): React.ReactNode {
  const normalized = (platform || "")
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const map: Record<string, React.ReactNode> = {
    // Search / Maps / Local
    google_maps: <GoogleMapsIcon size={size} />,
    google: <GoogleIcon size={size} />,
    yelp: <YelpIcon size={size} />,
    tripadvisor: <TripAdvisorIcon size={size} />,
    trustpilot: <TrustpilotIcon size={size} />,
    yellow_pages: <YellowPagesIcon size={size} />,
    indeed: <IndeedIcon size={size} />,
    // Social
    facebook: <FacebookIcon size={size} />,
    instagram: <InstagramIcon size={size} />,
    tiktok: <TikTokIcon size={size} />,
    linkedin: <LinkedInIcon size={size} />,
    youtube: <YouTubeIcon size={size} />,
    youtube_shorts: <YouTubeShortsIcon size={size} />,
    pinterest: <PinterestIcon size={size} />,
    snapchat: <SnapchatIcon size={size} />,
    reddit: <RedditIcon size={size} />,
    twitch: <TwitchIcon size={size} />,
    spotify: <SpotifyIcon size={size} />,
    apple_music: <AppleMusicIcon size={size} />,
    x_twitter: <XTwitterIcon size={size} />,
    threads: <ThreadsIcon size={size} />,
    // Messaging / Chat
    whatsapp: <WhatsAppIcon size={size} />,
    discord: <DiscordIcon size={size} />,
    slack: <SlackIcon size={size} />,
    telegram: <TelegramIcon size={size} />,
    notion: <NotionIcon size={size} />,
    // Email / Productivity
    gmail: <GmailIcon size={size} />,
    outlook: <OutlookIcon size={size} />,
    resend: <ResendIcon size={size} />,
    // Voice / SMS
    twilio: <TwilioIcon size={size} />,
    // Payments / Commerce
    stripe: <StripeIcon size={size} />,
    paypal: <PayPalIcon size={size} />,
    shopify: <ShopifyIcon size={size} />,
    square: <SquareIcon size={size} />,
    amazon: <AmazonIcon size={size} />,
    woocommerce: <WooCommerceIcon size={size} />,
    wordpress: <WordPressIcon size={size} />,
    // Marketing / Automation
    zapier: <ZapierIcon size={size} />,
    mailchimp: <MailchimpIcon size={size} />,
    hubspot: <HubspotIcon size={size} />,
    salesforce: <SalesforceIcon size={size} />,
    ayrshare: <AyrshareIcon size={size} />,
    // CRM
    gohighlevel: <GoHighLevelIcon size={size} />,
    ghl: <GoHighLevelIcon size={size} />,
    // Design / Creative
    canva: <CanvaIcon size={size} />,
    figma: <FigmaIcon size={size} />,
    zoom: <ZoomIcon size={size} />,
    calendly: <CalendlyIcon size={size} />,
    // Advertising Platforms
    google_ads: <GoogleAdsIcon size={size} />,
    meta: <MetaIcon size={size} />,
    meta_ads: <MetaIcon size={size} />,
    tiktok_ads: <TikTokIcon size={size} />,
    // AI providers
    anthropic: <AnthropicIcon size={size} />,
    claude: <AnthropicIcon size={size} />,
    openai: <OpenAIIcon size={size} />,
    elevenlabs: <ElevenLabsIcon size={size} />,
    eleven_labs: <ElevenLabsIcon size={size} />,
    elevenagents: <ElevenLabsIcon size={size} />,
    // Infra
    supabase: <SupabaseIcon size={size} />,
    runpod: <RunPodIcon size={size} />,
    vercel: <VercelIcon size={size} />,
    // Hosting / Domains
    godaddy: <GoDaddyIcon size={size} />,
  };
  return map[normalized] || <GenericPlatformIcon name={platform} size={size} />;
}
