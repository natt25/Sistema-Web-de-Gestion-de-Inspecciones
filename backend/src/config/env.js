require("dotenv").config();

const required = (key) => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
};

module.exports = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || 3000,

  DB_HOST: required("DB_HOST"),
  DB_PORT: Number(process.env.DB_PORT || 1433),
  DB_NAME: required("DB_NAME"),
  DB_USER: required("DB_USER"),
  DB_PASSWORD: required("DB_PASSWORD"),

  JWT_SECRET: required("JWT_SECRET"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "8h",

  STORAGE_DRIVER: process.env.STORAGE_DRIVER || "local",
  LOCAL_STORAGE_PATH: process.env.LOCAL_STORAGE_PATH || "./uploads",
  NAS_BASE_PATH: process.env.NAS_BASE_PATH || ""
};
