import Link from "next/link";

import type { PendingInvitationView } from "@/lib/domain";

type PendingInvitationsPanelProps = {
  invitations: PendingInvitationView[];
};

export function PendingInvitationsPanel({ invitations }: PendingInvitationsPanelProps) {
  if (!invitations.length) {
    return null;
  }

  return (
    <section className="panel accent-panel section-space mb-7">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Invitaciones</p>
          <h2>Tienes invitaciones pendientes</h2>
          <p className="panel__subcopy">
            Abre cada invitación y decide si quieres unirte al grupo.
          </p>
        </div>
      </div>

      <div className="invite-list">
        {invitations.map((invitation) => (
          <article key={invitation.id} className="invite-row">
            <div>
              <div className="invite-row__topline">
                <strong>{invitation.groupName}</strong>
                <span className="invite-badge invite-badge--pending">Pendiente</span>
              </div>
              <p>
                {invitation.invitedByName
                  ? `${invitation.invitedByName} te ha invitado al grupo.`
                  : "Tienes una invitación pendiente para este grupo."}
              </p>
            </div>

            <div className="invite-row__actions">
              <Link href={invitation.invitePath} className="button button--primary button--small">
                Revisar invitación
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
