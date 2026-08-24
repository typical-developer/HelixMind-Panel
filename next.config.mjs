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
}

export default nextConfig
