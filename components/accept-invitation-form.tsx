"use client";

import { useActionState } from "react";

import { acceptGroupInvitation } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { initialActionState } from "@/lib/action-state";

type AcceptInvitationFormProps = {
  token: string;
  defaultParticipantName: string;
};

export function AcceptInvitationForm({
  token,
  defaultParticipantName,
}: AcceptInvitationFormProps) {
  const [state, formAction] = useActionState(acceptGroupInvitation, initialActionState);

  return (
    <form action={formAction} className="stack-form form-card form-card--compact">
      <input type="hidden" name="token" value={token} />
      <label className="field">
        <span>Nombre con el que aparecerás en este grupo</span>
        <input
          name="participantName"
          type="text"
          defaultValue={defaultParticipantName}
          placeholder="María"
          autoComplete="name"
          required
        />
      </label>

      <p className="panel__subcopy">
        Al aceptar, tu cuenta quedará vinculada al grupo y se creará tu participante con este
        nombre.
      </p>

      {state.status !== "idle" && state.message ? (
        <p
          className={
            state.status === "success"
              ? "form-feedback form-feedback--success"
              : "form-feedback form-feedback--error"
          }
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}

      <SubmitButton
        idleLabel="Aceptar invitación"
        pendingLabel="Aceptando..."
        className="button button--primary"
      />
    </form>
  );
}
