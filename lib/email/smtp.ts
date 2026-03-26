import crypto from "crypto";
import nodemailer from "nodemailer";

const ALGORITHM = "aes-256-cbc";
const KEY = Buffer.from(process.env.SMTP_ENCRYPTION_KEY as string, "utf8").subarray(0, 32);

export function encryptPassword(plain: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decryptPassword(stored: string): string {
  const [ivHex, encHex] = stored.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export async function testSmtpConnection(email: string, password: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: email, pass: password },
  });
  await transporter.verify();
}

export function createGmailTransporter(email: string, decryptedPassword: string) {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: email, pass: decryptedPassword },
  });
}