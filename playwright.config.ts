import { defineConfig, devices } from '@playwright/test';

// Smoke test against the live test instance through the dev proxy.
// Not part of CI: it needs a .env with a login token (Plan.md, Konventionen).
export default defineConfig({
    testDir: 'e2e',
    use: { baseURL: 'http://localhost:5173/ccm/infoscreen-designer/' },
    webServer: {
        command: 'npm run dev -- --port 5173 --strictPort',
        url: 'http://localhost:5173/ccm/infoscreen-designer/',
        reuseExistingServer: true,
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    ],
});
