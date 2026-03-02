import fs from "fs";
import path from "path";
import { getPool } from "../config/database.js";

function safeUnlink(absPath) {
  try { fs.unlinkSync(absPath); } catch {}
}

export async function deleteEvidenciaAcc(req, res) {
  const { id } = req.params; // id_acc_evidencia

  const pool = await getPool();

  // 1) obtén ruta para borrar archivo físico
  const q1 = `
    SELECT TOP 1 archivo_ruta
    FROM SSOMA.INS_ACC_EVIDENCIA
    WHERE id_acc_evidencia = @id;
  `;
  const r1 = await pool.request().input("id", Number(id)).query(q1);
  const row = r1.recordset?.[0];

  if (!row) return res.status(404).json({ message: "Evidencia no encontrada." });

  // 2) borra registro
  const q2 = `
    DELETE FROM SSOMA.INS_ACC_EVIDENCIA
    WHERE id_acc_evidencia = @id;
  `;
  await pool.request().input("id", Number(id)).query(q2);

  // 3) borra archivo físico (si existe)
  const archivoRuta = String(row.archivo_ruta || "");
  // tu API sirve archivos con `${API_BASE}/${archivo_ruta}`
  // normalmente archivo_ruta es como: "uploads/acc/xxx.png"
  const abs = path.join(process.cwd(), archivoRuta);
  safeUnlink(abs);

  return res.json({ ok: true });
}