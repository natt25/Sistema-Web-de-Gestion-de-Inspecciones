import path from "path";
import fs from "fs";
import multer from "multer";
import crypto from "crypto";
import { fileURLToPath } from "url";
import obsRepo from "../repositories/observaciones.repository.js";
import fsp from "fs/promises";
import usuariosRepo from "../repositories/usuarios.repository.js";
import { getPool } from "../config/database.js";
import { validarInspeccionEditable } from "./inspecciones.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Asegurar carpetas (evita ENOENT)
const OBS_DIR = path.join(__dirname, "../storage/observaciones");
const ACC_DIR = path.join(__dirname, "../storage/acciones");
fs.mkdirSync(OBS_DIR, { recursive: true });
fs.mkdirSync(ACC_DIR, { recursive: true });

function sha256File(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function normalizeDni(value) {
  return String(value || "").trim();
}

function normalizeRole(value) {
  return String(value || "").trim().toUpperCase();
}

function isGuest(user) {
  return normalizeRole(user?.rol) === "INVITADO";
}

function canEditAccionByResponsable({ accionResponsable, user }) {
  if (!user || isGuest(user)) return false;
  if (!accionResponsable) return false;

  const responsableDni = normalizeDni(accionResponsable?.responsable_dni);
  const userDni = normalizeDni(user?.dni);
  if (responsableDni) return responsableDni === userDni;
  if (accionResponsable?.externo_responsable_nombre || accionResponsable?.externo_responsable_cargo) {
    return false;
  }
  return false;
}

function crearStorageEvidencia(destDir, prefix) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, destDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
      const stamp = Date.now();
      const rand = crypto.randomBytes(6).toString("hex");
      cb(null, `${prefix}_${stamp}_${rand}${ext}`);
    },
  });
}

const uploadObsMiddleware = multer({ storage: crearStorageEvidencia(OBS_DIR, "obs") }).single("file");
const uploadAccMiddleware = multer({ storage: crearStorageEvidencia(ACC_DIR, "acc") }).single("file");

async function subirEvidenciaObservacion({ id_observacion, file, user }) {
  const id = Number(id_observacion);
  if (!id || Number.isNaN(id)) {
    return { ok: false, status: 400, message: "id_observacion invalido" };
  }

  const id_inspeccion = await obsRepo.obtenerInspeccionIdPorObservacion(id);
  if (!id_inspeccion) return { ok: false, status: 404, message: "Observacion no encontrada" };

  const editable = await validarInspeccionEditable({ id_inspeccion, user });
  if (!editable.ok) return editable;

  if (!file) {
    return { ok: false, status: 400, message: "Archivo no enviado" };
  }

  const hash = sha256File(file.path);

  // anti-duplicado (DENTRO del async)
  const yaExiste = await obsRepo.existeHashEvidenciaObservacion({
    id_observacion: id,
    hash_archivo: hash
  });

  if (yaExiste) {
    try {
      fs.unlinkSync(file.path);
    } catch (_) {}
    return { ok: false, status: 409, message: "Evidencia duplicada (mismo hash)" };
  }

  const payload = {
    id_observacion: id,
    id_estado_sync: 2, // SUBIDO
    archivo_nombre: file.originalname,
    archivo_ruta: `storage/observaciones/${file.filename}`,
    mime_type: file.mimetype,
    tamano_bytes: file.size,
    hash_archivo: hash,
    capturada_en: new Date()
  };

  const creado = await obsRepo.crearEvidenciaObservacion(payload);
  return { ok: true, status: 201, data: creado };
}

async function subirEvidenciaAccion({ id_accion, file, user }) {
  const id = Number(id_accion);
  if (!id || Number.isNaN(id)) {
    return { ok: false, status: 400, message: "id_accion inválido" };
  }

  const id_inspeccion = await obsRepo.obtenerInspeccionIdPorAccion(id);
  if (!id_inspeccion) return { ok: false, status: 404, message: "Acción no encontrada" };

  const editable = await validarInspeccionEditable({ id_inspeccion, user });
  if (!editable.ok) return editable;

  const accionResponsable = await obsRepo.obtenerResponsableAccion(id);
  if (!canEditAccionByResponsable({ accionResponsable, user })) {
    return { ok: false, status: 403, message: "Solo el responsable de la acción puede subir evidencias." };
  }

  if (!file) {
    return { ok: false, status: 400, message: "Archivo no enviado" };
  }

  const hash = sha256File(file.path);

  // anti-duplicado (DENTRO del async)
  const yaExiste = await obsRepo.existeHashEvidenciaAccion({
    id_accion: id,
    hash_archivo: hash
  });

  if (yaExiste) {
    try {
      fs.unlinkSync(file.path);
    } catch (_) {}
    return { ok: false, status: 409, message: "Evidencia duplicada (mismo hash)" };
  }

  const payload = {
    id_accion: id,
    id_estado_sync: 2, // SUBIDO
    archivo_nombre: file.originalname,
    archivo_ruta: `storage/acciones/${file.filename}`,
    mime_type: file.mimetype,
    tamano_bytes: file.size,
    hash_archivo: hash,
    capturada_en: new Date()
  };

  const creado = await obsRepo.crearEvidenciaAccion(payload);
  return { ok: true, status: 201, data: creado };
}

const FIRMAS_DIR = path.resolve("src/storage/firmas");
const FIRMAS_EXTS = [".png", ".jpg", ".jpeg"];

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const firmaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDirSync(FIRMAS_DIR);
    cb(null, FIRMAS_DIR);
  },
  filename: (req, file, cb) => {
    const id = req.user?.id_usuario;
    if (!id) return cb(new Error("No autenticado"));

    const ext = file.mimetype === "image/png" ? ".png" : ".jpg";

    for (const candidateExt of FIRMAS_EXTS) {
      if (candidateExt === ext) continue;
      const oldPath = path.join(FIRMAS_DIR, `firma_${id}${candidateExt}`);
      try {
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      } catch {}
    }

    cb(null, `firma_${id}${ext}`);
  }
});

function firmaFileFilter(req, file, cb) {
  const allowed = ["image/png", "image/jpeg", "image/jpg"];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Formato invalido. Solo PNG o JPG."), false);
  }
  cb(null, true);
}

const uploadFirma = multer({
  storage: firmaStorage,
  fileFilter: firmaFileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});

const uploadFirmaMiddleware = uploadFirma.single("firma");

async function subirFirmaUsuario({ id_usuario, file }) {
  if (!id_usuario) return { ok: false, status: 401, message: "No autenticado" };
  if (!file) return { ok: false, status: 400, message: "Archivo 'firma' requerido" };

  const currentExt = path.extname(file.filename || "").toLowerCase();
  for (const ext of FIRMAS_EXTS) {
    if (ext === currentExt) continue;
    const oldPath = path.join(FIRMAS_DIR, `firma_${id_usuario}${ext}`);
    try {
      await fsp.unlink(oldPath);
    } catch {}
  }

  const relPath = `/storage/firmas/${file.filename}`;

  const nasDir = process.env.NAS_FIRMAS_DIR;
  if (nasDir) {
    try {
      await fsp.mkdir(nasDir, { recursive: true });
      await fsp.copyFile(
        path.join(FIRMAS_DIR, file.filename),
        path.join(nasDir, file.filename)
      );
    } catch (e) {
      console.warn("[firma] No se pudo copiar al NAS:", e.message);
    }
  }

  await usuariosRepo.updateFirma(id_usuario, {
    firma_path: relPath,
    firma_mime: file.mimetype,
    firma_size: file.size
  });

  return {
    ok: true,
    status: 200,
    data: {
      firma_path: relPath,
      firma_mime: file.mimetype,
      firma_size: file.size
    }
  };
}

function buildEvidencePathCandidates(archivoRuta) {
  const raw = String(archivoRuta || "").trim();
  if (!raw) return [];
  if (path.isAbsolute(raw)) return [raw];

  const clean = raw.replace(/^\/+/, "");
  const candidates = new Set([
    path.resolve(process.cwd(), clean),
    path.resolve(process.cwd(), "src", clean),
  ]);

  const nasBase = process.env.NAS_BASE_PATH;
  if (nasBase) {
    candidates.add(path.resolve(nasBase, clean));
    if (clean.toLowerCase().startsWith("storage/")) {
      candidates.add(path.resolve(nasBase, clean.replace(/^storage\//i, "")));
    }
  }

  return Array.from(candidates);
}

async function unlinkEvidenceFile(archivoRuta) {
  const candidates = buildEvidencePathCandidates(archivoRuta);
  if (!candidates.length) return { ok: true, deleted: false };

  for (const absPath of candidates) {
    try {
      await fsp.unlink(absPath);
      return { ok: true, deleted: true };
    } catch (err) {
      if (err?.code === "ENOENT") continue;
      return { ok: false, message: `No se pudo eliminar archivo (${absPath}): ${err.message}` };
    }
  }

  return { ok: true, deleted: false };
}

// Borra evidencia de ACCION (id_acc_evidencia)
async function eliminarEvidenciaAccion({ id_acc_evidencia, user }) {
  const id = Number(id_acc_evidencia);
  if (!id) return { ok: false, status: 400, message: "id_acc_evidencia invalido" };

  const id_inspeccion = await obsRepo.obtenerInspeccionIdPorAccEvidencia(id);
  if (!id_inspeccion) return { ok: false, status: 404, message: "Evidencia no encontrada" };

  const editable = await validarInspeccionEditable({ id_inspeccion, user });
  if (!editable.ok) return editable;

  const accionResponsable = await obsRepo.obtenerResponsableAccionPorEvidencia(id);
  if (!canEditAccionByResponsable({ accionResponsable, user })) {
    return { ok: false, status: 403, message: "Solo el responsable de la acción puede eliminar evidencias." };
  }

  const pool = await getPool();

  // 1) buscar ruta
  const q1 = `
    SELECT TOP 1 archivo_ruta
    FROM SSOMA.INS_ACCION_EVIDENCIA
    WHERE id_acc_evidencia = @id;
  `;
  const r1 = await pool.request().input("id", id).query(q1);
  const row = r1.recordset?.[0];
  if (!row) return { ok: false, status: 404, message: "Evidencia no encontrada" };

  const unlinkResult = await unlinkEvidenceFile(row.archivo_ruta);
  if (!unlinkResult.ok) {
    return { ok: false, status: 500, message: unlinkResult.message };
  }

  // 2) borrar registro en DB
  const q2 = `
    DELETE FROM SSOMA.INS_ACCION_EVIDENCIA
    WHERE id_acc_evidencia = @id;
  `;
  await pool.request().input("id", id).query(q2);

  return { ok: true, status: 200, data: { ok: true } };
}

// (OPCIONAL) Borra evidencia de OBS (id_obs_evidencia)
async function eliminarEvidenciaObservacion({ id_obs_evidencia, user }) {
  const id = Number(id_obs_evidencia);
  if (!id) return { ok: false, status: 400, message: "id_obs_evidencia invalido" };

  const id_inspeccion = await obsRepo.obtenerInspeccionIdPorObsEvidencia(id);
  if (!id_inspeccion) return { ok: false, status: 404, message: "Evidencia no encontrada" };

  const editable = await validarInspeccionEditable({ id_inspeccion, user });
  if (!editable.ok) return editable;

  const pool = await getPool();

  const q1 = `
    SELECT TOP 1 archivo_ruta
    FROM SSOMA.INS_OBS_EVIDENCIA
    WHERE id_obs_evidencia = @id;
  `;
  const r1 = await pool.request().input("id", id).query(q1);
  const row = r1.recordset?.[0];
  if (!row) return { ok: false, status: 404, message: "Evidencia no encontrada" };

  const q2 = `
    DELETE FROM SSOMA.INS_OBS_EVIDENCIA
    WHERE id_obs_evidencia = @id;
  `;
  await pool.request().input("id", id).query(q2);

  await unlinkEvidenceFile(row.archivo_ruta);

  return { ok: true, status: 200, data: { ok: true } };
}


export default {
  uploadObsMiddleware,
  uploadAccMiddleware,
  subirEvidenciaObservacion,
  subirEvidenciaAccion,
  uploadFirmaMiddleware,
  subirFirmaUsuario,
  eliminarEvidenciaAccion,
  eliminarEvidenciaObservacion
};
