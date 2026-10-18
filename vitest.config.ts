import { defineConfig } from 'vitest/config'

// Test settings (the game's build settings are in vite.config.ts)
export default defineConfig({
  test: {
    // The random-board and full-game tests play thousands of turns; allow them more than the 5s default
    testTimeout: 30_000,
  },
})
