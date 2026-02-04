require("dotenv").config();

const required = (key, value) => {
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
};

module.exports = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || 3000,

  DB_AUTH: process.env.DB_AUTH || "windows", // windows | sql
  DB_SERVER: required("DB_SERVER", process.env.DB_SERVER),
  DB_NAME: required("DB_NAME", process.env.DB_NAME),

  JWT_SECRET: required("JWT_SECRET", process.env.JWT_SECRET),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "8h",

  STORAGE_DRIVER: process.env.STORAGE_DRIVER || "local",
  LOCAL_STORAGE_PATH: process.env.LOCAL_STORAGE_PATH || "./uploads",
  NAS_BASE_PATH: process.env.NAS_BASE_PATH || ""
};
