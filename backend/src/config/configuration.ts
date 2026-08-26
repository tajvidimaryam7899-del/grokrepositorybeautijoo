export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-in-prod-32',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-prod-32',
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL || '7d',
  },
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3001').split(',').map((s) => s.trim()),
  smsProvider: process.env.SMS_PROVIDER || 'mock',
  paymentProvider: process.env.PAYMENT_PROVIDER || 'mock',
  storageProvider: process.env.STORAGE_PROVIDER || 'local',
  storageLocalPath: process.env.STORAGE_LOCAL_PATH || './uploads',
  otpTtlSeconds: parseInt(process.env.OTP_TTL_SECONDS || '300', 10),
  otpMaxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10),
});
