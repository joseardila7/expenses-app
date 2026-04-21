"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { login, signup } from "@/app/auth/actions";
import { initialActionState, type ActionState } from "@/lib/action-state";

export function AuthForms() {
  const [loginState, loginAction] = useActionState(login, initialActionState);
  const [signupState, signupAction] = useActionState(signup, initialActionState);

  return (
    <div className="auth-grid">
      <form action={loginAction} className="stack-form form-card auth-card">
        <div>
          <p className="eyebrow">Acceso</p>
          <h2>Entrar en tus grupos</h2>
          <p className="panel__subcopy">
            Inicia sesión para ver solo los grupos asociados a tu cuenta.
          </p>
        </div>

        <label className="field">
          <span>Correo electrónico</span>
          <input name="email" type="email" placeholder="tu@correo.com" required />
        </label>

        <label className="field">
          <span>Contraseña</span>
          <input name="password" type="password" placeholder="Tu contraseña" required />
        </label>

        <FormFeedback state={loginState} />
        <AuthSubmitButton idleLabel="Entrar" pendingLabel="Entrando..." />
      </form>

      <form
        action={signupAction}
        className="stack-form form-card form-card--compact auth-card auth-card--accent"
      >
        <div>
          <p className="eyebrow">Registro</p>
          <h2>Crear cuenta</h2>
          <p className="panel__subcopy">
            Cada persona tendrá sus propios grupos y acceso aislado.
          </p>
        </div>

        <label className="field">
          <span>Nombre visible</span>
          <input name="displayName" type="text" placeholder="María" required />
        </label>

        <label className="field">
          <span>Correo electrónico</span>
          <input name="email" type="email" placeholder="tu@correo.com" required />
        </label>

        <label className="field">
          <span>Contraseña</span>
          <input name="password" type="password" placeholder="Mínimo 8 caracteres" required />
        </label>

        <FormFeedback state={signupState} />
        <AuthSubmitButton idleLabel="Crear cuenta" pendingLabel="Creando cuenta..." />
      </form>
    </div>
  );
}

function AuthSubmitButton({
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
