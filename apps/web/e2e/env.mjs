// Shared by the Playwright config, the test server and the tests.
export const E2E_PORT = 3200;
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:54329/goldie_e2e_test";
export const e2eEnv = {
  ...process.env,
  DATABASE_URL: E2E_DATABASE_URL,
  DATABASE_URL_UNPOOLED: E2E_DATABASE_URL,
  APP_URL: `http://localhost:${E2E_PORT}`,
  DISABLE_MESSAGE_TIMER: "1", // messages are delivered right after each request; no background timer
  // Stripe: fake keys are enough to verify webhook signatures (no network). No STRIPE_PRICE_ID,
  // so checkout shows "payments not set up", which the tests check.
  STRIPE_SECRET_KEY: "sk_test_e2e_dummy",
  STRIPE_WEBHOOK_SECRET: "whsec_e2e_dummy_secret",
};
