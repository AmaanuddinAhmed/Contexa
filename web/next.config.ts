import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content Security Policy: which sources the browser may load from.
 *
 * - Scripts allow 'unsafe-inline' because Next.js injects inline scripts to
 *   start the page; removing it needs per-request nonces (middleware plus
 *   dynamic rendering of every page), which is out of scope. The rest of the
 *   policy still blocks scripts from other sites, plugins, framing and form
 *   posts elsewhere. Development also needs 'unsafe-eval' for hot reload.
 * - Styles allow 'unsafe-inline' because Leaflet positions the map with
 *   inline styles.
 * - Images: map tiles come from tile.openstreetmap.org; data:/blob: are used
 *   by Leaflet.
 * - Fonts: Geist and Bricolage Grotesque are self-hosted via @fontsource-variable
 *   site, so no Google Fonts domain is needed.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"])
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Older browsers' version of frame-ancestors 'none' (blocks clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Sends only the origin to other sites. OpenStreetMap's tile policy
  // needs a referrer, so do not use no-referrer here.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Location is used by the map page on this site only; the rest are unused.
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=()"
  },
  // HTTPS only for two years (browsers ignore this on http://localhost).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }
];

const nextConfig: NextConfig = {
  // Do not advertise the framework in an X-Powered-By header.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  }
};

export default nextConfig;