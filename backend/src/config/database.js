import sql from "mssql/msnodesqlv8.js";
import env from "./env.js";
let pool;
const CONNECT_TIMEOUT_MS = 8000;
const REQUEST_TIMEOUT_MS = 8000;

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timeout after ${ms}ms`));
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function getPool() {
  if (pool && pool.connected) return pool;

  // Forzamos Windows Auth con msnodesqlv8
  const config = {
    server: env.DB_SERVER,      // DESKTOP-DS8OTRU\\SQLEXPRESS
    database: env.DB_NAME,
    driver: "msnodesqlv8",
    options: {
      trustedConnection: true,
      trustServerCertificate: true
    },
    connectionTimeout: CONNECT_TIMEOUT_MS,
    requestTimeout: REQUEST_TIMEOUT_MS,
    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 10000
    }
  };

  console.log("[db] using driver:", config.driver);
  console.log("[db] server:", config.server);
  console.log("[db] database:", config.database);

  pool = await withTimeout(
    sql.connect(config),
    CONNECT_TIMEOUT_MS,
    "DB connect"
  );
  return pool;
}

export { sql, getPool };
