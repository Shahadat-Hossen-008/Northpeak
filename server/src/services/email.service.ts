import nodemailer from "nodemailer";
import { AppError } from "../middleware/error.js";
import { createVerificationEmail } from "./verification-email.template.js";

export function assertEmailDeliveryConfigured() {
  // Tests skip real delivery, but every deployed environment needs SMTP credentials
  // and a sender address. SMTP_PASS should be a provider app password, not a login password.
  if (
    process.env.NODE_ENV !== "test" &&
    (!process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.EMAIL_FROM)
  ) {
    throw new AppError("Email verification is temporarily unavailable", 503);
  }
}

export async function sendVerificationCode(email: string, name: string, code: string) {
  if (process.env.NODE_ENV === "test") return;
  assertEmailDeliveryConfigured();

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM;
  if (!smtpUser || !smtpPass || !from) {
    throw new AppError("Email verification is temporarily unavailable", 503);
  }

  // Gmail uses implicit TLS on port 465. Set SMTP_SECURE=false when using
  // a provider that expects STARTTLS on a different port, such as 587.
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
  const message = createVerificationEmail(name, code);

  try {
    await transporter.sendMail({
      from,
      to: email,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  } catch (error) {
    // Keep provider details in server logs while returning a safe client error.
    console.error(
      JSON.stringify({
        level: "error",
        message: "Verification email delivery failed",
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }),
    );
    throw new AppError("Could not send the verification email. Please try again.", 502);
  }
}
