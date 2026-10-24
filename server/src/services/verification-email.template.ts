function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
}

export function createVerificationEmail(name: string, code: string) {
  const safeName = escapeHtml(name);

  return {
    subject: `${code} is your Northpeak verification code`,
    text: [
      `Hi ${name},`,
      "",
      `Your Northpeak verification code is ${code}.`,
      "It expires in 2 minutes.",
      "",
      "If you did not create this account, you can ignore this email.",
    ].join("\n"),
    html: `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta name="color-scheme" content="light" />
          <title>Verify your Northpeak email</title>
        </head>
        <body style="margin:0;padding:0;background-color:#f3f6fc;font-family:Arial,Helvetica,sans-serif;color:#1c2537;">
          <div style="display:none;font-size:1px;color:#f3f6fc;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
            Your Northpeak verification code expires in 2 minutes.
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background-color:#f3f6fc;">
            <tr>
              <td align="center" style="padding:36px 12px;">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e3e9f4;border-radius:16px;">
                  <tr>
                    <td align="center" style="padding:36px 24px 24px;">
                      <div style="font-size:26px;font-weight:800;letter-spacing:-1px;color:#172b4d;">
                        <span style="color:#4388ee;">▲</span> Northpeak
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:8px 28px;">
                      <h1 style="margin:0;font-size:28px;line-height:1.35;font-weight:700;color:#1c2537;">
                        Verify your email address
                      </h1>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:18px 32px 8px;">
                      <p style="margin:0;font-size:16px;line-height:26px;color:#4a5876;">
                        Hi ${safeName},
                      </p>
                      <p style="margin:12px 0 0;font-size:16px;line-height:26px;color:#4a5876;">
                        Use the verification code below to confirm your email address and finish creating your Northpeak account.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:28px 24px 16px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:#edf3ff;border:1px solid #dce7ff;border-radius:12px;">
                        <tr>
                          <td align="center" style="padding:20px 30px;font-size:38px;line-height:1.4;font-weight:700;letter-spacing:12px;color:#172b4d;font-family:Arial,Helvetica,sans-serif;">
                            ${code}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:8px 24px 24px;">
                      <p style="margin:0;font-size:14px;line-height:24px;color:#4a5876;">
                        This code expires in <strong style="color:#172b4d;">2 minutes.</strong>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 32px 32px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f8fc;border-radius:10px;">
                        <tr>
                          <td style="padding:16px 18px;font-size:13px;line-height:22px;color:#64718a;">
                            <strong style="color:#34415a;">Security reminder</strong><br />
                            Never share this code with anyone. If you did not create a Northpeak account, you can safely ignore this email.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:22px 24px;background-color:#f8faff;border-top:1px solid #e8edf6;border-radius:0 0 16px 16px;">
                      <p style="margin:0;font-size:14px;font-weight:700;color:#172b4d;">Northpeak</p>
                      <p style="margin:8px 0 0;font-size:12px;line-height:20px;color:#8490a7;">Build. Collaborate. Achieve.</p>
                      <p style="margin:12px 0 0;font-size:11px;line-height:18px;color:#98a2b3;">This is an automated message. Please do not reply.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  };
}
