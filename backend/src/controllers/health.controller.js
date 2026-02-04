const { getPool } = require("../config/database");

async function health(req, res) {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT 1 AS db_ok");

    return res.json({ ok: true, db: result.recordset[0].db_ok });
  } catch (err) {
    // No cuelga: siempre responde
    return res.status(200).json({ ok: true, db: false, db_error: err.message });
  }
}

module.exports = { health };
