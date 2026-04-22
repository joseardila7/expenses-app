"use client";

import { useActionState, useEffect, useRef } from "react";

import { createGroupInvitation, revokeGroupInvitation } from "@/app/actions";
import { ConfirmAction } from "@/components/confirm-action";
import { SubmitButton } from "@/components/submit-button";
import { initialActionState } from "@/lib/action-state";
import type { GroupInvitationView } from "@/lib/domain";

type GroupInvitationsPanelProps = {
  groupId: string;
  groupName: string;
  invitations: GroupInvitationView[];
};

export function GroupInvitationsPanel({
  groupId,
  groupName,
  invitations,
}: GroupInvitationsPanelProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(createGroupInvitation, initialActionState);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  const copyInviteLink = async (invitePath: string) => {
    const inviteUrl = `${window.location.origin}${invitePath}`;
    await navigator.clipboard.writeText(inviteUrl);
    window.dispatchEvent(
      new CustomEvent("app-toast", {
        detail: { type: "success", message: "Enlace de invitación copiado." },
      }),
    );
  };

  return (
    <section className="panel accent-panel panel--compact">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Invitaciones</p>
          <h2>Invitar por email</h2>
          <p className="panel__subcopy">
            Prepara un acceso privado para otra persona y comparte su enlace seguro manualmente.
          </p>
        </div>
      </div>

      <form ref={formRef} action={formAction} className="stack-form form-card form-card--compact">
        <input type="hidden" name="groupId" value={groupId} />
        <label className="field">
          <span>Correo de la persona invitada</span>
          <input name="invitedEmail" type="email" placeholder="ana@correo.com" required />
        </label>

        {state.status !== "idle" && state.message ? (
          <p
            className={
              state.status === "success"
                ? "form-feedback form-feedback--success"
                : "form-feedback form-feedback--error"
            }
          >
            {state.message}
          </p>
        ) : null}

        <SubmitButton
          idleLabel="Crear invitación"
          pendingLabel="Creando..."
          className="button button--primary"
        />
      </form>

      {invitations.length ? (
        <div className="invite-list">
          {invitations.map((invitation) => (
            <article key={invitation.id} className="invite-row">
              <div>
                <div className="invite-row__topline">
                  <strong>{invitation.invitedEmail}</strong>
                  <span className={`invite-badge invite-badge--${invitation.status}`}>
                    {toStatusLabel(invitation.status)}
                  </span>
                </div>
                <p>
                  Invitación para <strong>{groupName}</strong>
                </p>
              </div>

              <div className="invite-row__actions">
                <button
                  type="button"
                  className="button button--ghost button--small"
                  onClick={() => copyInviteLink(invitation.invitePath)}
                >
                  Copiar enlace
                </button>
                <a href={invitation.invitePath} className="button button--ghost button--small">
                  Abrir
                </a>
                {invitation.status === "pending" ? (
                  <ConfirmAction
                    action={revokeGroupInvitation}
                    title={`Revocar invitación a ${invitation.invitedEmail}`}
                    description="La persona ya no podrá usar este enlace para entrar al grupo."
                    confirmLabel="Revocar invitación"
                    triggerLabel="Revocar"
                    triggerVariant="ghost"
                    hiddenFields={{
                      invitationId: invitation.id,
                      groupId,
                    }}
                    successMessage="Invitación revocada."
                  />
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">Aún no hay invitaciones para este grupo.</p>
      )}
    </section>
  );
}

function toStatusLabel(status: GroupInvitationView["status"]) {
  if (status === "accepted") {
    return "Aceptada";
  }

  if (status === "revoked") {
    return "Revocada";
  }

  return "Pendiente";
}
