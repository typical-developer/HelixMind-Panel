import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

/**
 * Unit tests cover the parts of the panel that are pure functions: FASTA
 * parsing, sequence statistics, mutation calling, the growth model's
 * environmental coefficients, resistance scoring, and the persisted stores.
 *
 * The React tree is verified by driving the running app rather than by
 * rendering it here — the workbench's behaviour is almost entirely about
 * layout, panel sizing and navigation, which jsdom models badly enough that
 * passing tests would not mean much.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The stores read `localStorage` behind a `typeof window` guard, so the
    // tests install a minimal stub rather than paying for a full DOM.
    setupFiles: ["./tests/setup.ts"],
  },
})
