import { redirect } from "next/navigation";

import { acceptGroupInvitation } from "@/app/actions";
import { ErrorPanel } from "@/components/error-panel";
import { SubmitButton } from "@/components/submit-button";
import { getAuthenticatedProfile } from "@/lib/auth";
import { getInvitationByToken } from "@/lib/supabase-data";

type InvitationPageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitationPage({ params }: InvitationPageProps) {
  const { token } = await params;
  const user = await getAuthenticatedProfile();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/invitations/${token}`)}`);
  }

  const result = await getInvitationByToken(token);

  if (result.error) {
    return (
      <main className="shell">
        <ErrorPanel
          title="No se pudo abrir la invitación"
          description="Hubo un problema leyendo esta invitación desde Supabase."
          detail={result.error}
        />
      </main>
    );
  }

  if (!result.data) {
    return (
      <main className="shell">
        <ErrorPanel
          title="Invitación no disponible"
          description="Esta invitación no existe, no te pertenece o ya no está disponible para tu cuenta."
        />
      </main>
    );
  }

  const invitation = result.data;
  const canAccept =
    invitation.status === "pending" &&
    invitation.invitedEmail.toLowerCase() === user.email.toLowerCase() &&
    invitation.acceptedUserId !== user.id &&
    invitation.invitedByUserId !== user.id;

  return (
    <main className="shell auth-shell">
      <section className="panel panel--form invitation-panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Invitación privada</p>
            <h2>Únete a {invitation.groupName}</h2>
            <p className="panel__subcopy">
              {invitation.invitedByName
                ? `${invitation.invitedByName} te ha invitado a este grupo con el correo ${invitation.invitedEmail}.`
                : `Tienes una invitación pendiente para este grupo con el correo ${invitation.invitedEmail}.`}
            </p>
          </div>
        </div>

        <div className="invite-list">
          <article className="invite-row">
            <div>
              <div className="invite-row__topline">
                <strong>Estado de la invitación</strong>
                <span className={`invite-badge invite-badge--${invitation.status}`}>
                  {toStatusLabel(invitation.status)}
                </span>
              </div>
              <p>
                Estás conectado como <strong>{user.email}</strong>.
              </p>
            </div>
          </article>
        </div>

        {canAccept ? (
          <form action={acceptGroupInvitation} className="stack-form form-card form-card--compact">
            <input type="hidden" name="token" value={token} />
            <label className="field">
              <span>Nombre con el que aparecerás en este grupo</span>
              <input
                name="participantName"
                type="text"
                defaultValue={user.displayName}
                placeholder="María"
                autoComplete="name"
                required
              />
            </label>

            <p className="panel__subcopy">
              Al aceptar, tu cuenta quedará vinculada al grupo y se creará tu participante con este
              nombre.
            </p>

            <SubmitButton
              idleLabel="Aceptar invitación"
              pendingLabel="Aceptando..."
              className="button button--primary"
            />
          </form>
        ) : (
          <p className="empty-state">
            {invitation.invitedByUserId === user.id
              ? "La persona que crea la invitación no puede aceptarla."
              : "Esta invitación ya no está pendiente o no pertenece al usuario con el que has iniciado sesión."}
          </p>
        )}
      </section>
    </main>
  );
}

function toStatusLabel(status: "pending" | "accepted" | "revoked") {
  if (status === "accepted") {
    return "Aceptada";
  }

  if (status === "revoked") {
    return "Revocada";
  }

  return "Pendiente";
}
