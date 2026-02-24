import sql from "mssql/msnodesqlv8.js";
import env from "./env.js";
let pool;
let queryLoggingPatched = false;
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
  console.log("[DB CONNECT]");
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

  if (!queryLoggingPatched && sql?.Request?.prototype?.query) {
    const originalQuery = sql.Request.prototype.query;
    sql.Request.prototype.query = async function patchedQuery(command, ...rest) {
      const started = Date.now();
      const text = typeof command === "string" ? command.replace(/\s+/g, " ").trim() : "<non-string query>";
      const preview = text.length > 140 ? `${text.slice(0, 140)}...` : text;
      console.log("[db] query:start", { preview });
      try {
        const result = await withTimeout(
          originalQuery.call(this, command, ...rest),
          REQUEST_TIMEOUT_MS + 500,
          "DB query"
        );
        const rows = result?.recordset?.length ?? null;
        console.log("[db] query:end", { durationMs: Date.now() - started, rows });
        return result;
      } catch (error) {
        console.error("[db] query:error", { durationMs: Date.now() - started, message: error?.message });
        throw error;
      }
    };
    queryLoggingPatched = true;
  }

  return pool;
}

export { sql, getPool };
