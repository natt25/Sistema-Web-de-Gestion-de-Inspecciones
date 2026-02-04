const sql = require("mssql");
const env = require("./env");

const config = {
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  server: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let pool;

async function getPool() {
  if (pool) return pool;
  pool = await sql.connect(config);
  return pool;
}

module.exports = { sql, getPool };
