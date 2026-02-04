const bcrypt = require("bcrypt");

async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

module.exports = { comparePassword };
