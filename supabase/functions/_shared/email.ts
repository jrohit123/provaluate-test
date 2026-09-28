// Sends a GoTrue-style templated email via Brevo's HTTP API instead of SMTP.
// Railway blocks outbound SMTP (confirmed: nc to smtp-relay.brevo.com:587/465
// both hang and time out at the network level, unrelated to GoTrue's config),
// so GoTrue's built-in mailer can never work here. This bypasses it entirely:
// the caller generates a link via client.auth.admin.generateLink() (which
// does NOT attempt SMTP), then this fetches the same branded HTML template
// GoTrue itself would have used and sends it over plain HTTPS via Brevo.
export async function sendTemplatedEmail(opts: {
  templateUrl: string;
  toEmail: string;
  toName?: string;
  subject: string;
  confirmationUrl: string;
  siteUrl: string;
}): Promise<void> {
  const brevoApiKey = Deno.env.get("BREVO_API_KEY");
  if (!brevoApiKey) throw new Error("Missing BREVO_API_KEY");

  const senderEmail = Deno.env.get("SMTP_ADMIN_EMAIL") || "sales@aitamate.com";
  const senderName = Deno.env.get("SMTP_SENDER_NAME") || "ProValuate";

  const templateRes = await fetch(opts.templateUrl);
  if (!templateRes.ok) {
    throw new Error(`Failed to fetch email template (${opts.templateUrl}): ${templateRes.status}`);
  }
  let html = await templateRes.text();

  // Same placeholder syntax GoTrue's own mailer uses in these templates.
  const replacements: Record<string, string> = {
    "{{ .ConfirmationURL }}": opts.confirmationUrl,
    "{{.ConfirmationURL}}": opts.confirmationUrl,
    "{{ .SiteURL }}": opts.siteUrl,
    "{{.SiteURL}}": opts.siteUrl,
    "{{ .Email }}": opts.toEmail,
    "{{.Email}}": opts.toEmail,
  };
  for (const [placeholder, value] of Object.entries(replacements)) {
    html = html.split(placeholder).join(value);
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": brevoApiKey,
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: opts.toEmail, name: opts.toName || opts.toEmail }],
      subject: opts.subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Brevo send failed: ${res.status} ${body}`);
  }
}
