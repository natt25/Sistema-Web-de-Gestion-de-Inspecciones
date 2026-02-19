import auditoriaRepo from "../repositories/auditoria.repository.js";

async function log(evt) {
  // nunca romper flujo por auditoría
  try {
    await auditoriaRepo.insert(evt);
  } catch (_) {}
}

async function getLogs(filters) {
  return auditoriaRepo.list(filters);
}

export default { log, getLogs };
