
import nodemailer from "nodemailer";
import type { Sender } from "@prisma/client";

let etherealTransporterPromise:
  | ReturnType<typeof createEtherealTransporter>
  | null = null;

async function createEtherealTransporter() {
  const account = await nodemailer.createTestAccount();

  console.log("Ethereal test account created:");
  console.log("Username:", account.user);
  console.log("Password:", account.pass);

  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: account.user,
      pass: account.pass,
    },
  });
}

export async function getTransporter(sender: Sender) {
  // Use sender-specific SMTP credentials if configured.
  if (
    sender.smtpHost &&
    sender.smtpPort &&
    sender.smtpUser &&
    sender.smtpPassword
  ) {
    return nodemailer.createTransport({
      host: sender.smtpHost,
      port: sender.smtpPort,
      secure: sender.smtpPort === 465,
      auth: {
        user: sender.smtpUser,
        pass: sender.smtpPassword,
      },
    });
  }

  // Otherwise, use a shared Ethereal test account.
  if (!etherealTransporterPromise) {
    etherealTransporterPromise = createEtherealTransporter();
  }

  return etherealTransporterPromise;
}
