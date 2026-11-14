process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'synthetic-test-jwt-secret-minimum-32-characters-vitest-runner';

// Guarantee that tests never target the development or shared database
if (!process.env.TEST_DATABASE_URL && process.env.DATABASE_URL) {
  process.env.TEST_DATABASE_URL = process.env.DATABASE_URL.replace(
    /\/career_compass(\?|$)/,
    '/career_compass_test$1'
  );
}

