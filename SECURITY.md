# Security Policy & Architecture

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of the NASA Space Mission Design Game seriously. If you believe you have found a security vulnerability, please do NOT create a public issue on GitHub.

Instead, please report it privately via GitHub Security Advisories:
- **Repository**: [https://github.com/divyansBaserra/Space-Mission-Design-Game/security/advisories](https://github.com/divyansBaserra/Space-Mission-Design-Game/security/advisories)
- **RFC 9116 Policy**: [/.well-known/security.txt](/.well-known/security.txt)

Please include:
- Type of issue (e.g., buffer overflow, cross-site scripting, header misconfiguration)
- Full paths of source file(s) related to the manifestation of the issue
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if applicable)

You will receive an acknowledgment within 48 hours and regular updates on our progress toward a fix.

---

## Edge & Application Security Architecture

### 1. Cloudflare WAF & Edge Rules (`public/_headers`)
All traffic proxied or hosted via Cloudflare Workers / Pages is hardened at the Cloudflare Edge network across 300+ global Points of Presence (PoPs):
- **Content-Security-Policy (CSP)**: Strict default-src isolation restricting execution to verified first-party scripts, styles, and WebGL workers.
- **HTTP Strict Transport Security (HSTS)**: 2-year `max-age=63072000`, `includeSubDomains`, and `preload` to enforce encrypted HTTPS and block SSL-stripping.
- **Clickjacking Protection**: `X-Frame-Options: DENY` and `frame-ancestors: 'none'` preventing unauthorized embedding in iframes.
- **MIME Sniffing Prevention**: `X-Content-Type-Options: nosniff`.
- **Hardware Isolation**: `Permissions-Policy` disables camera, microphone, geolocation, usb, and payment APIs.
- **Cross-Origin Isolation**: `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Resource-Policy: same-origin` mitigating side-channel timing and Spectre attacks.

### 2. Information Disclosure Prevention
- Server software disclosure headers disabled (`poweredByHeader: false` in `next.config.ts`), preventing attackers from scanning framework versions via `x-powered-by`.

### 3. Client-Side Data Sanitization
- LocalStorage career progression data undergoes strict defensive runtime schema validation (`typeof === "number" && Number.isFinite() && val >= 0`, array type-guards, and bounds checking) preventing prototype pollution, state tampering, or injection.

### 4. Zero Dangerous DOM APIs
- Zero occurrences of `dangerouslySetInnerHTML`, `innerHTML`, `eval()`, or `new Function()`.
- All external links enforce `rel="noopener noreferrer"`.
