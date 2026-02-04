const express = require("express");
const cors = require("cors");
require("./config/env"); // valida env al inicio

const { getPool } = require("./config/database");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT 1 AS ok");
    res.json({ ok: true, db: result.recordset[0].ok });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = app;
