const path = require("path");
const fs = require("fs");
const multer = require("multer");
const crypto = require("crypto");
const obsRepo = require("../repositories/observaciones.repository");

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
      const safe = safeFileName(file.originalname);
      cb(null, `${Date.now()}_${safe}`);
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

  // ✅ anti-duplicado (DENTRO del async)
  const yaExiste = await obsRepo.existeHashEvidenciaObservacion({
    id_observacion: id,
    hash_archivo: hash
  });

  if (yaExiste) {
    try { fs.unlinkSync(file.path); } catch (_) {}
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

  // ✅ anti-duplicado (DENTRO del async)
  const yaExiste = await obsRepo.existeHashEvidenciaAccion({
    id_accion: id,
    hash_archivo: hash
  });

  if (yaExiste) {
    try { fs.unlinkSync(file.path); } catch (_) {}
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


async function subirEvidenciaAccion({ id_accion, file }) {
  const id = Number(id_accion);
  if (!id || Number.isNaN(id)) {
    return { ok: false, status: 400, message: "id_accion inválido" };
  }

  if (!file) {
    return { ok: false, status: 400, message: "Archivo no enviado" };
  }

  // IMPORTANTE: primero validar file, luego hash
  const hash = sha256File(file.path);

  const yaExiste = await obsRepo.existeHashEvidenciaAccion({ id_accion: id, hash_archivo: hash });
  if (yaExiste) {
    try { fs.unlinkSync(file.path); } catch (_) {}
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

  try {
    const creado = await obsRepo.crearEvidenciaAccion(payload);
    return { ok: true, status: 201, data: creado };
  } catch (err) {
    try { fs.unlinkSync(file.path); } catch (_) {}
    throw err;
  }
}


module.exports = {
  uploadObsMiddleware,
  uploadAccMiddleware,
  subirEvidenciaObservacion,
  subirEvidenciaAccion
};

