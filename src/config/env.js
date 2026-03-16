import dotenv from "dotenv";
dotenv.config();

export const env = {
  PORT: Number(process.env.PORT || 4000),
  NODE_ENV: process.env.NODE_ENV || "development",

  DB_HOST: process.env.DB_HOST || "127.0.0.1",
  DB_PORT: Number(process.env.DB_PORT || 3306),
  DB_USER: process.env.DB_USER || "root",
  DB_PASSWORD: process.env.DB_PASSWORD || "",
  DB_NAME: process.env.DB_NAME || "stockoffice_multibmu",

  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",

  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET || "",
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || "",
  ACCESS_TOKEN_EXPIRES: process.env.ACCESS_TOKEN_EXPIRES || "15m",
  REFRESH_TOKEN_EXPIRES_DAYS: Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 30),

  SYSTEM_OWNER_EMAIL: process.env.SYSTEM_OWNER_EMAIL || "owner@system.com",
  SYSTEM_OWNER_PASSWORD: process.env.SYSTEM_OWNER_PASSWORD || "123456",
  SYSTEM_OWNER_FIRST_NAME: process.env.SYSTEM_OWNER_FIRST_NAME || "System",
  SYSTEM_OWNER_LAST_NAME: process.env.SYSTEM_OWNER_LAST_NAME || "Owner"
};

if (!env.ACCESS_TOKEN_SECRET || !env.REFRESH_TOKEN_SECRET) {
  throw new Error("Missing ACCESS_TOKEN_SECRET or REFRESH_TOKEN_SECRET");
}
