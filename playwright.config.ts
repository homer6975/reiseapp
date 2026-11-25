import { defineConfig, devices } from "@playwright/test";

const port = 3100;

// Env für Global-Setup (Service-Role-Key) aus .env.local laden, falls vorhanden.
try {
  process.loadEnvFile(".env.local");
} catch {
  // in CI kommen die Variablen aus der Umgebung
}

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`,
    trace: "off",
  },
  projects: [
    {
      // iPhone-Breite (SPEC §7), aber mit Chromium, damit kein WebKit nötig ist.
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        launchOptions: process.env.PW_CHROMIUM_PATH
          ? { executablePath: process.env.PW_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : [
        {
          // Fake-kDrive für die Dokumente-Tests (M4)
          command: "node e2e/fake-kdrive.mjs",
          port: 3199,
          reuseExistingServer: !process.env.CI,
        },
        {
          command: `pnpm start --port ${port}`,
          port,
          reuseExistingServer: !process.env.CI,
          env: {
            KDRIVE_API_URL: "http://127.0.0.1:3199",
            KDRIVE_TOKEN: "test-token",
          },
        },
      ],
});
