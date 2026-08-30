export const ADMIN_COOKIE = "admin_session";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 12;

function getAdminPassword(): string | null {
  const p = process.env.ADMIN_PASSWORD;
  return p && p.trim().length > 0 ? p : null;
}

export function isAdminConfigured(): boolean {
  return getAdminPassword() !== null;
}

async function hmac(hex: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(hex),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyAdminPassword(password: unknown): Promise<boolean> {
  const expected = getAdminPassword();
  if (!expected || typeof password !== "string" || password.length === 0) return false;
  const a = await hmac("pwd", password);
  const b = await hmac("pwd", expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createAdminSessionToken(): Promise<string> {
  const p = getAdminPassword();
  if (!p) throw new Error("ADMIN_PASSWORD no está configurada");
  return hmac("pwd", `session:${p}`);
}

export async function verifyAdminSessionToken(token: string | undefined | null): Promise<boolean> {
  const p = getAdminPassword();
  if (!p || !token) return false;
  const expected = await hmac("pwd", `session:${p}`);
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}