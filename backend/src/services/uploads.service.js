import path from "path";
import fs from "fs";
import multer from "multer";
import crypto from "crypto";
import { fileURLToPath } from "url";
import obsRepo from "../repositories/observaciones.repository.js";
import fsp from "fs/promises";
import usuariosRepo from "../repositories/usuarios.repository.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Asegurar carpetas (evita ENOENT)
const OBS_DIR = path.join(__dirname, "../storage/observaciones");
const ACC_DIR = path.join(__dirname, "../storage/acciones");
fs.mkdirSync(OBS_DIR, { recursive: true });
fs.mkdirSync(ACC_DIR, { recursive: true });

function safeFileName(originalname) {
  return originalname
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, ""); // limpia caracteres raros
}

function sha256File(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function crearStorage(destDir) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, destDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
      const id = req.user?.id_usuario || "user";
      cb(null, `firma_${id}${ext}`);
    }
  });
}

const uploadObsMiddleware = multer({ storage: crearStorage(OBS_DIR) }).single("file");
const uploadAccMiddleware = multer({ storage: crearStorage(ACC_DIR) }).single("file");

async function subirEvidenciaObservacion({ id_observacion, file }) {
  const id = Number(id_observacion);
  if (!id || Number.isNaN(id)) {
    return { ok: false, status: 400, message: "id_observacion inválido" };
  }

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

async function subirEvidenciaAccion({ id_accion, file }) {
  const id = Number(id_accion);
  if (!id || Number.isNaN(id)) {
    return { ok: false, status: 400, message: "id_accion inválido" };
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
    return cb(new Error("Formato inválido. Solo PNG o JPG."), false);
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

export default {
  uploadObsMiddleware,
  uploadAccMiddleware,
  subirEvidenciaObservacion,
  subirEvidenciaAccion,
  uploadFirmaMiddleware,
  subirFirmaUsuario
};
