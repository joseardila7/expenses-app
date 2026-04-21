import { deleteParticipant } from "@/app/actions";
import { ConfirmAction } from "@/components/confirm-action";
import type { ParticipantBalance, ParticipantRecord } from "@/lib/domain";

type ParticipantsPanelProps = {
  participants: ParticipantRecord[];
  balances?: ParticipantBalance[];
  groupId: string;
  compact?: boolean;
};

export function ParticipantsPanel({
  participants,
  balances = [],
  groupId,
  compact = false,
}: ParticipantsPanelProps) {
  const balancesById = new Map(balances.map((balance) => [balance.participantId, balance]));

  return (
    <section className={`panel accent-panel ${compact ? "panel--compact" : ""}`}>
      <div className="panel__header">
        <div>
          <p className="eyebrow">Personas</p>
          <h2>Participantes</h2>
          <p className="panel__subcopy">
            Todas las personas del grupo visibles y ordenadas para no perder contexto.
          </p>
        </div>
      </div>

      {participants.length ? (
        <div className="participant-list">
          {participants.map((participant) => {
            const balance = balancesById.get(participant.id);
            const canDelete = balance ? balance.canDelete : true;

            return (
              <article key={participant.id} className="participant-row">
                <div>
                  <strong>{participant.name}</strong>
                  <p>
                    {balance
                      ? canDelete
                        ? "Sin deudas pendientes."
                        : "Tiene saldo o movimientos pendientes."
                      : "Participante del grupo."}
                  </p>
                </div>

                <ConfirmAction
                  action={deleteParticipant}
                  title={`Eliminar a ${participant.name}`}
                  description="Esta acción ocultará al participante si ya no tiene saldo pendiente."
                  confirmLabel="Eliminar participante"
                  triggerLabel="Borrar"
                  triggerVariant="ghost"
                  hiddenFields={{
                    groupId,
                    participantId: participant.id,
                  }}
                  disabled={!canDelete}
                  successMessage={`${participant.name} ya no aparece en el grupo.`}
                />
              </article>
            );
          })}
        </div>
      ) : (
        <p className="empty-state">Este grupo todavía no tiene participantes.</p>
      )}
    </section>
  );
}
