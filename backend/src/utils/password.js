import bcrypt from "bcryptjs";
const hashPassword = async (plain) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
};

const verifyPassword = async (plain, hash) => {
  return bcrypt.compare(plain, hash);
};

export { hashPassword, verifyPassword };