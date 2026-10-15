import dotenv from "dotenv";
dotenv.config();

export interface AppConfig {
  NODE_ENV: "development" | "test" | "production";
  PORT: number;
  MONGODB_URI: string;
  JWT_SECRET: string;
  CORS_ORIGINS: string[];
  TRUST_PROXY: boolean;
}

const VALID_ENVS = ["development", "test", "production"] as const;

export function loadAndValidateConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV;

  if (!nodeEnv || !VALID_ENVS.includes(nodeEnv as any)) {
    throw new Error(
      `[ConfigError] NODE_ENV must be defined and set to one of: ${VALID_ENVS.join(", ")}. Received: "${nodeEnv}"`,
    );
  }

  const isDev = nodeEnv === "development";
  const isTest = nodeEnv === "test";

  let jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    if (isDev || isTest) {
      jwtSecret = "northpeak_super_secret_jwt_key_2026_dev_fallback";
    } else {
      throw new Error(
        "[ConfigError] JWT_SECRET must be explicitly defined and at least 32 characters in production.",
      );
    }
  } else if (!isDev && !isTest && jwtSecret.length < 32) {
    throw new Error(
      "[ConfigError] JWT_SECRET must be at least 32 characters in production.",
    );
  }

  let mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    if (isDev) {
      mongoUri = "mongodb://localhost:27017/northpeak";
    } else if (isTest) {
      mongoUri = "mongodb://localhost:27017/northpeak_test";
    } else {
      throw new Error(
        "[ConfigError] MONGODB_URI environment variable is required in production.",
      );
    }
  }

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
  if (isNaN(port) || port <= 0 || port > 65535) {
    throw new Error(`[ConfigError] Invalid PORT: "${process.env.PORT}"`);
  }

  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)
    : ["http://localhost:3000", "http://localhost:5173", "http://localhost:8080"];

  const trustProxy =
    process.env.TRUST_PROXY === "true" || process.env.TRUST_PROXY === "1";

  return {
    NODE_ENV: nodeEnv as "development" | "test" | "production",
    PORT: port,
    MONGODB_URI: mongoUri,
    JWT_SECRET: jwtSecret,
    CORS_ORIGINS: corsOrigins,
    TRUST_PROXY: trustProxy,
  };
}

export const config: AppConfig = loadAndValidateConfig();
