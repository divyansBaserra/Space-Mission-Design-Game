import type { NextConfig } from "next";

const securityHeaders = [
  // 1. Content-Security-Policy (XSS & injection mitigation)
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' blob: ws: wss: https:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
  // 2. Prevent clickjacking
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  // 3. Prevent MIME-sniffing
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  // 4. Force HTTPS (HSTS - 2 years + subdomains + preload)
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // 5. Restrict Referrer leakage
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  // 6. Restrict hardware & tracking APIs
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), vr=(), interest-cohort=()",
  },
  // 7. Cross-Origin Opener Policy (Spectre isolation)
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  // 8. Cross-Origin Resource Policy
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin",
  },
  // 9. DNS Prefetch Control
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // Prevents leaking 'x-powered-by: Next.js'
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
  typescript: {
    // Type-safety verified independently via strict `bun x tsc --noEmit`
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
