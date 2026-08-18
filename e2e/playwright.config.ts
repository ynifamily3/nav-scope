import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const workspaceRoot = fileURLToPath(new URL('..', import.meta.url))

export default defineConfig({
  testDir: './tests',

  use: {
    baseURL: 'http://127.0.0.1:4173',

    trace: 'on-first-retry',
  },

  webServer: {
    command: 'pnpm --filter nav-scope build && pnpm --filter nav-scope-e2e dev',

    cwd: workspaceRoot,

    url: 'http://127.0.0.1:4173',

    reuseExistingServer: !process.env.CI,
  },

  projects: [
    {
      name: 'chromium',

      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
})
