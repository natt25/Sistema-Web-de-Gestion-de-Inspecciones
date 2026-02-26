import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_FILE_NAME = "1. AQP-SSOMA-FOR-013 Inspección General.xlsx";

function listTemplateFiles(templatesDir) {
  try {
    return fs
      .readdirSync(templatesDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

export function resolveCorporateTemplatePath() {
  const templatesDir = path.resolve(__dirname, "..", "templates");
  const resolvedExactPath = path.resolve(templatesDir, TEMPLATE_FILE_NAME);
  const files = listTemplateFiles(templatesDir);

  if (fs.existsSync(resolvedExactPath)) {
    return {
      templatePath: resolvedExactPath,
      templatesDir,
      files,
    };
  }

  const fallbackName = files.find(
    (name) => /aqp-ssoma-for-013/i.test(name) && /\.xlsx$/i.test(name)
  );
  if (fallbackName) {
    return {
      templatePath: path.resolve(templatesDir, fallbackName),
      templatesDir,
      files,
    };
  }

  const error = new Error("Plantilla corporativa no encontrada");
  error.code = "TEMPLATE_NOT_FOUND";
  error.templatesDir = templatesDir;
  error.resolvedPath = resolvedExactPath;
  error.files = files;
  throw error;
}
