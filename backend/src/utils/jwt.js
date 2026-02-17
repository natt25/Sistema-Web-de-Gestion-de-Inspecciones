import jwt from "jsonwebtoken";
const signToken = (payload) => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET no configurado");
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  });
};

const verifyToken = (token) => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET no configurado");
  return jwt.verify(token, process.env.JWT_SECRET);
};

export { signToken, verifyToken };