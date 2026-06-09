import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;

export async function hashPassword(password: string) {
  return bcrypt.hash(normalizePassword(password), BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;
  if (!storedHash.startsWith("$2")) return false;
  return bcrypt.compare(normalizePassword(password), storedHash);
}

function normalizePassword(password: string) {
  return password.normalize("NFKC");
}
