export default () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';

  const databaseUrl = process.env.DATABASE_URL;
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (isProd) {
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required in production');
    }
    if (!accessSecret || accessSecret.length < 32) {
      throw new Error('JWT_ACCESS_SECRET is required in production (min 32 chars)');
    }
    if (!refreshSecret || refreshSecret.length < 32) {
      throw new Error('JWT_REFRESH_SECRET is required in production (min 32 chars)');
    }
  }

  return {
    nodeEnv,
    port: parseInt(process.env.PORT || '3000', 10),
    databaseUrl,
    jwt: {
      accessSecret: accessSecret || 'dev-access-secret-change-in-prod-32',
      refreshSecret: refreshSecret || 'dev-refresh-secret-change-in-prod-32',
      accessTtl: process.env.JWT_ACCESS_TTL || '15m',
      refreshTtl: process.env.JWT_REFRESH_TTL || '7d',
    },
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3001')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    smsProvider: process.env.SMS_PROVIDER || 'mock',
    paymentProvider: process.env.PAYMENT_PROVIDER || 'mock',
    storageProvider: process.env.STORAGE_PROVIDER || 'local',
    storageLocalPath: process.env.STORAGE_LOCAL_PATH || './uploads',
    otpTtlSeconds: parseInt(process.env.OTP_TTL_SECONDS || '300', 10),
    otpMaxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10),
  };
};
