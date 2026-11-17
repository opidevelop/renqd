type ApprovedEmailInput = {
  to: string;
  username: string;
};

export type EmailDeliveryResult =
  | { sent: true }
  | { sent: false; reason: "not_configured" | "invalid_recipient" | "provider_error" };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function approvedEmailHtml(username: string): string {
  const safeUsername = escapeHtml(username);
  return `<!doctype html>
<html lang="it">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>Account approvato</title></head>
  <body style="margin:0;padding:0;background:#f7f5f2;font-family:Arial,Helvetica,sans-serif;color:#25231f;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Il tuo account Renqd è stato approvato. Puoi iniziare a usarlo.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7f5f2;">
      <tr><td align="center" style="padding:42px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:580px;">
          <tr><td align="center" style="padding:0 0 25px;">
            <a href="https://renqd.app" style="font-size:32px;line-height:1;font-weight:800;letter-spacing:-2px;text-decoration:none;color:#25231f;">renqd<span style="color:#ff7900;">.</span></a>
          </td></tr>
          <tr><td style="padding:42px 42px 38px;background:#fff;border:1px solid #eee7df;border-radius:20px;">
            <div style="margin:0 0 15px;color:#d66b12;font-size:10px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">ACCESSO CONFERMATO</div>
            <h1 style="margin:0 0 16px;color:#25231f;font-size:29px;line-height:1.16;letter-spacing:-1px;font-weight:750;">Il tuo account è approvato.</h1>
            <p style="margin:0 0 13px;color:#706960;font-size:15px;line-height:1.75;">Ciao ${safeUsername},</p>
            <p style="margin:0 0 25px;color:#706960;font-size:15px;line-height:1.75;">abbiamo verificato la tua richiesta: ora puoi accedere a Renqd e iniziare a creare, confrontare e condividere le tue classifiche.</p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="border-radius:999px;background:#ff7900;">
              <a href="https://renqd.app/login" style="display:inline-block;padding:15px 25px;color:#fff;font-size:14px;font-weight:700;text-decoration:none;border-radius:999px;">Accedi a Renqd</a>
            </td></tr></table>
            <div style="height:1px;margin:30px 0 20px;background:#f0ebe5;"></div>
            <p style="margin:0;color:#928a81;font-size:12px;line-height:1.7;">Se non ti aspettavi questa comunicazione, puoi ignorarla o contattarci tramite il sito ufficiale.</p>
          </td></tr>
          <tr><td align="center" style="padding:22px 18px 0;color:#a29a91;font-size:11px;line-height:1.8;">
            <strong style="color:#706960;font-weight:700;">Renqd</strong><br>
            Le tue idee, in ordine.<br>
            <a href="https://renqd.app" style="color:#a36a3c;text-decoration:none;">renqd.app</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export async function sendAccountApprovedEmail(
  input: ApprovedEmailInput,
): Promise<EmailDeliveryResult> {
  const recipient = input.to.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return { sent: false, reason: "invalid_recipient" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RENQD_EMAIL_FROM;
  if (!apiKey || !from) {
    return { sent: false, reason: "not_configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: "Il tuo account Renqd è stato approvato",
        html: approvedEmailHtml(input.username),
      }),
      cache: "no-store",
    });

    if (!response.ok) return { sent: false, reason: "provider_error" };
    return { sent: true };
  } catch {
    return { sent: false, reason: "provider_error" };
  }
}
