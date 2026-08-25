const isDev = process.env.NODE_ENV !== "production"

/**
 * Content-Security-Policy, in **report-only** mode.
 *
 * The previous note here said a CSP was deliberately absent, because getting
 * one wrong fails closed and a blank production screen is worse than no policy.
 * That reasoning holds for an *enforced* policy. It does not hold for a
 * report-only one, which never blocks anything: the browser evaluates the
 * policy, reports what would have been refused, and renders the page exactly as
 * it does today. That is the only way to find out what a real policy would
 * break without breaking it, and shipping nothing meant that work never started.
 *
 * Promoting this to `Content-Security-Policy` is a one-word change, and should
 * be made once the report is clean on every route. Two things have to be
 * settled first:
 *
 *  - `'unsafe-inline'` in `script-src`. Next inlines its bootstrap and flight
 *    payload as inline scripts, so lifting this needs a nonce threaded through
 *    the runtime — the work the old note was describing. The policy is worth
 *    having even with it: `object-src 'none'`, `base-uri 'self'` and
 *    `form-action 'self'` all close real classes of attack on their own.
 *  - `'unsafe-eval'`, which is dev-only. Turbopack's HMR runtime needs it; the
 *    production bundle does not, and it is omitted there.
 *
 * `connect-src` covers the one host the browser talks to besides this origin.
 * Auth normally goes through the `/api/backend` rewrite (same-origin, see
 * below), but `NEXT_PUBLIC_API_URL` can point the client straight at a
 * backend, and a policy that forgot that would report every sign-in as a
 * violation.
 */
function contentSecurityPolicy() {
  const directBackend = process.env.NEXT_PUBLIC_API_URL?.trim()
  const connect = ["'self'", "https://va.vercel-scripts.com"]
  if (directBackend && directBackend.startsWith("http")) {
    try {
      connect.push(new URL(directBackend).origin)
    } catch {
      /* A malformed value is the env's problem, not the policy's. */
    }
  }
  if (isDev) connect.push("ws:", "wss:")

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    // Belt and braces with X-Frame-Options below, which older browsers use.
    "frame-ancestors 'none'",
    "form-action 'self'",
    // Blob URLs are how `lib/download.ts` hands over an export, and the growth
    // lab's PNG export draws a serialised SVG through one.
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // Tailwind and next/font both inject style elements at runtime.
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com`,
    `connect-src ${connect.join(" ")}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ")
}

/**
 * Response headers applied to every route.
 */
const securityHeaders = [
  {
    key: "Content-Security-Policy-Report-Only",
    value: contentSecurityPolicy(),
  },
  // Never let a browser second-guess a declared content type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No framing: this is an authenticated panel, so clickjacking is the risk.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app asks for none of these; deny them rather than leave them open.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Only meaningful over HTTPS, ignored on localhost.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // The panel keeps analyses, results and sequence previews on the device. None
  // of it should follow the operator into a cross-origin page.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
]

/**
 * Where the auth API actually lives.
 *
 * Server-side only — deliberately *not* `NEXT_PUBLIC_`. The browser never needs
 * this host, and that is the whole point of the rewrite below.
 */
const API_UPSTREAM =
  process.env.API_UPSTREAM ?? "https://helix-core-backend.onrender.com/api/v1"

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 16 writes its own `AGENTS.md` and `CLAUDE.md` into the project root on
  // `next dev` and `next build`. This repository does not carry agent rule
  // files, and having the framework recreate them after every removal is worse
  // than not having them at all.
  agentRules: false,
  // Pin the workspace root to this directory. Without it, Turbopack walks up
  // the tree, finds the parent repo's lockfile, and fails to resolve modules
  // when the app runs inside a git worktree.
  turbopack: {
    root: import.meta.dirname,
  },
  // Type errors fail the build. This was previously disabled because the
  // unimported `New Helix/` reference material does not typecheck; that folder
  // is now excluded in tsconfig instead, so the app's own types are enforced.
  images: {
    unoptimized: true,
  },
  // Tree-shake heavy barrel packages so a single named import doesn't pull the
  // whole library into the route bundle. `lucide-react` is optimized by Next
  // out of the box; `recharts` is not, and it ships on several routes.
  experimental: {
    optimizePackageImports: ["recharts", "date-fns"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
  /**
   * Reach the auth API through our own origin instead of calling it directly.
   *
   * The backend's CORS allowlist contains `http://localhost:3000` and nothing
   * else: every other origin — the deployed panel included — gets a 500 with no
   * `Access-Control-Allow-Origin` on the preflight, so the browser blocks the
   * request before it is sent and `fetch` rejects with a bare `TypeError`. That
   * is the "Could not reach the server" the deployed panel reports, and no
   * amount of frontend work makes a blocked preflight succeed.
   *
   * A rewrite sidesteps it entirely: the browser makes a same-origin request,
   * Next forwards it from the server, and CORS never enters into a
   * server-to-server call. It also survives Vercel's per-deployment preview
   * URLs, which no static allowlist ever could.
   *
   * The real fix belongs in the backend's CORS config. This keeps the panel
   * working without it.
   */
  async rewrites() {
    return [{ source: "/api/backend/:path*", destination: `${API_UPSTREAM}/:path*` }]
  },
}

export default nextConfig
