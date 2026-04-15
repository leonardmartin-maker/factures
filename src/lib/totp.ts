import { generateSecret } from "otplib";
import QRCode from "qrcode";
import crypto from "node:crypto";

export function generateTotpSecret(): string {
  return generateSecret();
}

export function buildOtpAuthUrl(email: string, secret: string, issuer = "Factures Pro"): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const issuerEnc = encodeURIComponent(issuer);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuerEnc}&period=30&digits=6&algorithm=SHA1`;
}

export async function buildOtpAuthQrDataUrl(email: string, secret: string): Promise<string> {
  const url = buildOtpAuthUrl(email, secret);
  return QRCode.toDataURL(url, { margin: 1, width: 240 });
}

export function verifyTotp(secret: string, token: string): boolean {
  try { return verifyTotpManual(secret, token); } catch { return false; }
}

function verifyTotpManual(secret: string, token: string): boolean {
  const step = 30;
  const now = Math.floor(Date.now() / 1000 / step);
  for (let w = -1; w <= 1; w++) {
    if (generateTotpAt(secret, now + w) === token) return true;
  }
  return false;
}

function generateTotpAt(secret: string, counter: number): string {
  // Base32 decode
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const c of clean) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  const key = Buffer.from(bytes);

  // Counter as 8 bytes big-endian
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac("sha1", key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const bin = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(bin % 1000000).padStart(6, "0");
}

export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const buf = crypto.randomBytes(5);
    codes.push(buf.toString("hex").toUpperCase().match(/.{1,4}/g)!.join("-"));
  }
  return codes;
}

export function hashBackupCodes(codes: string[]): string {
  return JSON.stringify(codes.map((c) => crypto.createHash("sha256").update(c).digest("hex")));
}

export function verifyBackupCode(storedHashes: string, code: string): { valid: boolean; remainingHashes?: string } {
  try {
    const hashes: string[] = JSON.parse(storedHashes);
    const h = crypto.createHash("sha256").update(code.toUpperCase().trim()).digest("hex");
    const idx = hashes.indexOf(h);
    if (idx === -1) return { valid: false };
    hashes.splice(idx, 1);
    return { valid: true, remainingHashes: JSON.stringify(hashes) };
  } catch { return { valid: false }; }
}
