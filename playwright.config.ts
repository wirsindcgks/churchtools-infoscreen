import { defineConfig, devices } from '@playwright/test';

// Smoke test against the live test instance through the dev proxy.
// Not part of CI: it needs a .env with a login token (Plan.md, Konventionen).
export default defineConfig({
    testDir: 'e2e',
    // One shared, real instance: parallel runs would race each other (uploads, counts).
    workers: 1,
    use: {
        baseURL: 'http://localhost:5173/ccm/infoscreen-designer/',
        // The card that offers the introduction (Plan.md 81) would stand in every test and picture; e2e/intro.spec.ts empties this.
        storageState: {
            cookies: [],
            origins: [{ origin: 'http://localhost:5173', localStorage: [{ name: 'infoscreen-designer:intro-seen', value: '1' }] }],
        },
    },
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
