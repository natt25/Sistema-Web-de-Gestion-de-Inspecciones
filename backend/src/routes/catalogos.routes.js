const express = require("express");
const auth = require("../middlewares/auth.middleware");
const { getPool } = require("../config/database");
const router = express.Router();
const controller = require("../controllers/catalogos.controller");
const authMiddleware = require("../middlewares/auth.middleware");
/**
 * GET /api/catalogos/clientes
 * (protegido con JWT)
 */
router.get("/clientes", auth, async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        id_cliente,
        raz_social
      FROM SSOMA.V_CLIENTE
    `);

    return res.json({
      ok: true,
      data: result.recordset,
      usuario: req.user
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/clientes", authMiddleware, controller.listarClientes);
router.get("/servicios", authMiddleware, controller.listarServicios);
router.get("/areas", authMiddleware, controller.listarAreas);
router.get("/areas/:id/lugares", authMiddleware, controller.listarLugaresPorArea);
router.get("/niveles-riesgo", authMiddleware, controller.listarNivelesRiesgo);

module.exports = router;
