process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://reviewer:reviewer@localhost:5432/reviewer';
process.env.N8N_API_TOKEN = 'test-n8n-token';
process.env.GITHUB_APP_ID = '1';
process.env.GITHUB_APP_PRIVATE_KEY =
  '-----BEGIN RSA PRIVATE KEY-----\\ntest\\n-----END RSA PRIVATE KEY-----';
process.env.GITHUB_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.LOG_LEVEL = 'silent';
process.env.MAX_PATCH_BYTES = '1000';
process.env.MAX_MANIFEST_FILES = '2';
process.env.GITHUB_API_MAX_RETRIES = '2';
process.env.CURSOR_API_KEY = 'cursor_test_key';
process.env.CURSOR_MODEL_ID = 'composer-2.5';
process.env.AI_REVIEW_MAX_FILES = '10';
process.env.AI_REVIEW_MAX_PROMPT_CHARS = '5000';
