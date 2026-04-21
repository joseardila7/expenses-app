"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";

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
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction] = useActionState(action, initialActionState);
  const dialogTitleId = useId();
  const canUseDOM = typeof document !== "undefined";
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (state.status === "success") {
      window.dispatchEvent(
        new CustomEvent("app-toast", {
          detail: { type: "success", message: successMessage ?? state.message },
        }),
      );

      window.setTimeout(() => setIsOpen(false), 0);

      if (redirectTo) {
        router.replace(redirectTo);
        router.refresh();
        return;
      }

      window.location.reload();
    }

    if (state.status === "error" && state.message) {
      window.dispatchEvent(
        new CustomEvent("app-toast", {
          detail: { type: "error", message: state.message },
        }),
      );
    }
  }, [redirectTo, router, state.message, state.status, successMessage]);

  const modal =
    canUseDOM && isOpen
      ? createPortal(
          <div
            className="confirm-dialog"
            role="presentation"
            onClick={() => setIsOpen(false)}
          >
            <form
              action={formAction}
              className="confirm-dialog__panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby={dialogTitleId}
              onClick={(event) => event.stopPropagation()}
            >
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
                  onClick={() => setIsOpen(false)}
                >
                  Cancelar
                </button>
                <ConfirmSubmitButton label={confirmLabel} />
              </div>
            </form>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        className={`button button--${triggerVariant} button--small`}
        onClick={() => setIsOpen(true)}
        disabled={disabled}
      >
        {triggerLabel}
      </button>
      {modal}
    </>
  );
}

function ConfirmSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="button button--danger button--small" disabled={pending}>
      {pending ? "Procesando..." : label}
    </button>
  );
}
