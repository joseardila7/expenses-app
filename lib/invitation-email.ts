import "server-only";

type GroupInvitationEmailInput = {
  toEmail: string;
  invitePath: string;
  groupName: string;
  invitedByName: string;
};

type GroupInvitationEmailResult =
  | { status: "sent" }
  | { status: "skipped" }
  | { status: "failed"; message: string };

export async function sendGroupInvitationEmail({
  toEmail,
  invitePath,
  groupName,
  invitedByName,
}: GroupInvitationEmailInput): Promise<GroupInvitationEmailResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const inviteFromEmail = process.env.INVITE_FROM_EMAIL;

  if (!resendApiKey || !inviteFromEmail) {
    return { status: "skipped" };
  }

  const inviteUrl = `${getAppBaseUrl()}${invitePath}`;
  const subject = `${invitedByName} te ha invitado a ${groupName}`;
  const text = [
    `${invitedByName} te ha invitado a unirte al grupo "${groupName}" en Gastos App.`,
    "",
    `Acepta la invitación desde este enlace: ${inviteUrl}`,
    "",
    `La invitación está asociada al correo ${toEmail}.`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#1f1f1f">
      <h2 style="margin-bottom:12px">${escapeHtml(invitedByName)} te ha invitado a ${escapeHtml(groupName)}</h2>
      <p>Hemos preparado un acceso privado para que puedas entrar al grupo con tu correo.</p>
      <p>
        <a
          href="${escapeHtml(inviteUrl)}"
          style="display:inline-block;padding:12px 18px;background:#b55d34;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:600"
        >
          Aceptar invitación
        </a>
      </p>
      <p>Si el botón no funciona, copia y pega este enlace en el navegador:</p>
      <p><a href="${escapeHtml(inviteUrl)}">${escapeHtml(inviteUrl)}</a></p>
      <p style="color:#5c5c5c">Esta invitación está asociada al correo ${escapeHtml(toEmail)}.</p>
    </div>
  `.trim();

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: inviteFromEmail,
        to: [toEmail],
        subject,
        html,
        text,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const payload = await response.text();
      return {
        status: "failed",
        message: payload || `HTTP ${response.status}`,
      };
    }

    return { status: "sent" };
  } catch (error) {
    return {
      status: "failed",
      message: error instanceof Error ? error.message : "Error desconocido enviando el correo.",
    };
  }
}

function getAppBaseUrl() {
  const value =
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  return value.replace(/\/$/, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
