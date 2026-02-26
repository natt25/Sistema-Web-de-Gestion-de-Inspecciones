import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getTemplatePath(nombreArchivo) {
  const templatePath = path.resolve(__dirname, "..", "templates", nombreArchivo);
  if (!fs.existsSync(templatePath)) {
    const error = new Error(`Plantilla no encontrada: ${nombreArchivo}`);
    error.code = "TEMPLATE_NOT_FOUND";
    error.templatePath = templatePath;
    throw error;
  }
  return templatePath;
}
