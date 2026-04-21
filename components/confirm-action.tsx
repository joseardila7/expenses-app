"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";

import { initialActionState, type ActionState } from "@/lib/action-state";

type ConfirmActionProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  title: string;
  description: string;
  confirmLabel: string;
  triggerLabel: string;
  triggerVariant?: "ghost" | "danger" | "primary";
  hiddenFields: Record<string, string>;
  successMessage?: string;
  disabled?: boolean;
  redirectTo?: string;
};

export function ConfirmAction({
  action,
  title,
  description,
  confirmLabel,
  triggerLabel,
  triggerVariant = "ghost",
  hiddenFields,
  successMessage,
  disabled = false,
  redirectTo,
}: ConfirmActionProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(action, initialActionState);
  const dialogTitleId = useId();

  useEffect(() => {
    if (state.status === "success") {
      window.dispatchEvent(
        new CustomEvent("app-toast", {
          detail: { type: "success", message: successMessage ?? state.message },
        }),
      );
      dialogRef.current?.close();
      formRef.current?.reset();

      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
      }
    }

    if (state.status === "error" && state.message) {
      window.dispatchEvent(
        new CustomEvent("app-toast", {
          detail: { type: "error", message: state.message },
        }),
      );
    }
  }, [redirectTo, router, state.message, state.status, successMessage]);

  return (
    <>
      <button
        type="button"
        className={`button button--${triggerVariant} button--small`}
        onClick={() => dialogRef.current?.showModal()}
        disabled={disabled}
      >
        {triggerLabel}
      </button>

      <dialog ref={dialogRef} className="confirm-dialog" aria-labelledby={dialogTitleId}>
        <form method="dialog" className="confirm-dialog__backdrop">
          <button type="submit" className="confirm-dialog__scrim" aria-label="Cerrar" />
        </form>

        <form action={formAction} ref={formRef} className="confirm-dialog__panel">
          <div className="confirm-dialog__copy">
            <p className="eyebrow">Confirmación</p>
            <h3 id={dialogTitleId}>{title}</h3>
            <p>{description}</p>
          </div>

          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}

          {state.status !== "idle" && state.message ? (
            <p
              className={
                state.status === "success"
                  ? "form-feedback form-feedback--success form-feedback--prominent"
                  : "form-feedback form-feedback--error"
              }
            >
              {state.message}
            </p>
          ) : null}

          <div className="confirm-dialog__actions">
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={() => dialogRef.current?.close()}
            >
              Cancelar
            </button>
            <button type="submit" className="button button--danger button--small">
              {confirmLabel}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
