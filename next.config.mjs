/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root to this directory. Without it, Turbopack walks up
  // the tree, finds the parent repo's lockfile, and fails to resolve modules
  // when the app runs inside a git worktree.
  turbopack: {
    root: import.meta.dirname,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Tree-shake heavy barrel packages so a single named import doesn't pull the
  // whole library into the route bundle. `lucide-react` is optimized by Next
  // out of the box; `recharts` is not, and it ships on several routes.
  experimental: {
    optimizePackageImports: ["recharts", "date-fns"],
  },
}

export default nextConfig
