export function validatePassword(pw) {
  if (!pw || pw.length < 10) return "Mínimo 10 caracteres";
  if (!/[A-Z]/.test(pw)) return "Debe incluir una mayúscula";
  if (!/[a-z]/.test(pw)) return "Debe incluir una minúscula";
  if (!/[0-9]/.test(pw)) return "Debe incluir un número";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Debe incluir un símbolo";
  return null;
}

export function buildExpiryDate(days = 90) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
