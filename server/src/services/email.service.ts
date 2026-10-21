import { AppError } from "../middleware/error.js";

export function assertEmailDeliveryConfigured() {
  // Production registration and resend both require these backend-only Resend settings.
  if (process.env.NODE_ENV !== "test" && (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)) {
    throw new AppError("Email verification is temporarily unavailable", 503);
  }
}

export async function sendVerificationCode(email: string, name: string, code: string) {
  if (process.env.NODE_ENV === "test") return;
  assertEmailDeliveryConfigured();
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new AppError("Email verification is temporarily unavailable", 503);

  const safeName = name.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Your Northpeak verification code",
      text: `Hi ${name}, your Northpeak verification code is ${code}. It expires in 10 minutes.`,
      html: `<p>Hi ${safeName},</p><p>Your Northpeak verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes. If you did not create this account, you can ignore this email.</p>`,
    }),
  });
  if (!response.ok) {
    throw new AppError("Could not send the verification email. Please try again.", 502);
  }
}
