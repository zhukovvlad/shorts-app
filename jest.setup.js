// Jest setup file - runs before all tests
// Sets up environment variables needed for tests

// Set test database URL if not already set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/shorts_test';
}

if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

// Set other required environment variables for tests
process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test-secret-key-for-testing';
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

// Mock external API keys if not set (tests should mock external calls anyway)
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-key';
process.env.REPLICATE_API_KEY = process.env.REPLICATE_API_KEY || 'r8_test_key';
process.env.ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || 'test_key';
process.env.ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY || 'test_key';

// AWS
process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || 'test_access_key';
process.env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || 'test_secret_key';
process.env.AWS_REGION = process.env.AWS_REGION || 'us-east-1';
process.env.AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'test-bucket';

// Stripe
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_example';
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_example';
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_example';

// Redis (optional for tests)
process.env.TIMEWEB_REDIS_HOST = process.env.TIMEWEB_REDIS_HOST || 'localhost';
process.env.TIMEWEB_REDIS_PORT = process.env.TIMEWEB_REDIS_PORT || '6379';
process.env.TIMEWEB_REDIS_USERNAME = process.env.TIMEWEB_REDIS_USERNAME || 'default';
process.env.TIMEWEB_REDIS_PASSWORD = process.env.TIMEWEB_REDIS_PASSWORD || 'test-password';
