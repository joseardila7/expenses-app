"use client";

import { useActionState, useEffect, useRef, type RefObject } from "react";
import { useFormStatus } from "react-dom";

import { createExpense, createGroup, createParticipant } from "@/app/actions";
import { initialActionState, type ActionState } from "@/lib/action-state";
import type { ParticipantRecord, SchemaMode } from "@/lib/domain";

type GroupFormProps = {
  groupId?: string;
};

type ExpenseFormProps = {
  groupId: string;
  participants: ParticipantRecord[];
  schemaMode: SchemaMode;
};

export function CreateGroupForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(createGroup, initialActionState);

  useResetOnSuccess(formRef, state);

  return (
    <form action={formAction} className="stack-form form-card" ref={formRef}>
      <p className="form-card__title">Crear un nuevo grupo</p>
      <label className="field">
        <span>Nombre del grupo</span>
        <input name="name" type="text" placeholder="Viaje a Valencia" required />
      </label>
      <FormFeedback state={state} />
      <SubmitButton idleLabel="Crear grupo" pendingLabel="Creando grupo..." />
    </form>
  );
}

export function CreateParticipantForm({ groupId }: Required<GroupFormProps>) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(createParticipant, initialActionState);

  useResetOnSuccess(formRef, state);

  return (
    <form action={formAction} className="stack-form form-card form-card--compact" ref={formRef}>
      <input type="hidden" name="groupId" value={groupId} />
      <p className="form-card__title">Añadir participante</p>
      <label className="field">
        <span>Nueva persona</span>
        <input name="name" type="text" placeholder="María" required />
      </label>
      <FormFeedback state={state} />
      <SubmitButton idleLabel="Añadir participante" pendingLabel="Guardando..." />
    </form>
  );
}

export function CreateExpenseForm({ groupId, participants, schemaMode }: ExpenseFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(createExpense, initialActionState);
  const isAdvanced = schemaMode === "advanced" && participants.length > 0;

  useResetOnSuccess(formRef, state);

  return (
    <form action={formAction} className="stack-form form-card form-card--compact" ref={formRef}>
      <input type="hidden" name="groupId" value={groupId} />
      <p className="form-card__title">
        {isAdvanced ? "Registrar gasto con reparto" : "Registrar gasto"}
      </p>

      <label className="field">
        <span>Concepto</span>
        <input name="description" type="text" placeholder="Cena del viernes" required />
      </label>

      <label className="field">
        <span>Importe</span>
        <input name="amount" type="number" min="0.01" step="0.01" placeholder="24.90" required />
      </label>

      {isAdvanced ? (
        <>
          <label className="field">
            <span>¿Quién pagó?</span>
            <select
              name="paidByParticipantId"
              className="field__control"
              defaultValue={participants[0]?.id}
            >
              {participants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participant.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="field checkbox-group">
            <legend>¿Entre quién se reparte?</legend>
            <div className="checkbox-grid">
              {participants.map((participant) => (
                <label key={participant.id} className="checkbox-pill">
                  <input
                    type="checkbox"
                    name="splitWithParticipantIds"
                    value={participant.id}
                    defaultChecked
                  />
                  <span>{participant.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </>
      ) : null}

      {schemaMode === "advanced" && participants.length === 0 ? (
        <p className="notice-inline">
          Añade al menos un participante para poder asignar quién paga y cómo se reparte.
        </p>
      ) : null}

      <FormFeedback state={state} />
      <SubmitButton idleLabel="Guardar gasto" pendingLabel="Guardando..." />
    </form>
  );
}

function SubmitButton({
  idleLabel,
  pendingLabel,
}: {
  idleLabel: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="button button--primary" disabled={pending}>
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

function FormFeedback({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) {
    return null;
  }

  return (
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
  );
}

function useResetOnSuccess(formRef: RefObject<HTMLFormElement | null>, state: ActionState) {
  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status, formRef]);
}
