process.env.AUTH_JWT_SECRET = "test-only-auth-secret-with-more-than-32-characters";
process.env.DATA_ENCRYPTION_KEY = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:5432/linkconnect_test?schema=public";
process.env.APP_URL = "http://localhost:3000";
delete process.env.STRIPE_SECRET_KEY;
delete process.env.STRIPE_WEBHOOK_SECRET;
