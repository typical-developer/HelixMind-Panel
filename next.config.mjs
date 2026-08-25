/**
 * Response headers applied to every route.
 *
 * Deliberately not a Content-Security-Policy: getting one right for this app
 * needs a nonce wired through the Next runtime, and a wrong CSP fails closed —
 * a blank screen in production. These are the headers that are safe to set
 * unconditionally and cover the common classes of attack.
 */
const securityHeaders = [
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
