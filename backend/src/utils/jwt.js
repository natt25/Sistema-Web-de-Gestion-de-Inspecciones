const jwt = require("jsonwebtoken");
const env = require("../config/env");

function signToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

module.exports = { signToken };
