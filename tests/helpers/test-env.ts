import "dotenv/config";

const TEST_URL_MARKER = "test";

export function requireTestDatabaseUrl() {
  const value = process.env.DATABASE_URL_TEST;

  if (!value) {
    throw new Error("DATABASE_URL_TEST is required for integration and E2E tests.");
  }

  if (!value.toLowerCase().includes(TEST_URL_MARKER)) {
    throw new Error("DATABASE_URL_TEST must include 'test' to protect non-test databases.");
  }

  if (value === process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL_TEST must not equal DATABASE_URL.");
  }

  return value;
}
