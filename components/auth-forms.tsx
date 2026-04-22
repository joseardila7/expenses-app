"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { login, signup } from "@/app/auth/actions";
import { initialActionState, type ActionState } from "@/lib/action-state";

type AuthFormsProps = {
  nextPath?: string;
};

export function AuthForms({ nextPath = "/" }: AuthFormsProps) {
  const [loginState, loginAction] = useActionState(login, initialActionState);
  const [signupState, signupAction] = useActionState(signup, initialActionState);

  return (
    <div className="auth-grid">
      <section className="auth-card auth-card--signin">
        <div className="auth-card__header">
          <p className="eyebrow">Acceso</p>
          <h2>Entrar en tus grupos</h2>
          <p className="panel__subcopy">
            Inicia sesión para ver solo los grupos asociados a tu cuenta y continuar donde lo dejaste.
          </p>
        </div>

        <form action={loginAction} className="stack-form auth-form">
          <input type="hidden" name="nextPath" value={nextPath} />

          <label className="field">
            <span>Correo electrónico</span>
            <input name="email" type="email" placeholder="tu@correo.com" autoComplete="email" required />
          </label>

          <PasswordField
            name="password"
            label="Contraseña"
            placeholder="Tu contraseña"
            autoComplete="current-password"
          />

          <FormFeedback state={loginState} />
          <AuthSubmitButton idleLabel="Entrar" pendingLabel="Entrando..." />
        </form>
      </section>

      <section className="auth-card auth-card--signup">
        <div className="auth-card__header">
          <p className="eyebrow">Registro</p>
          <h2>Crear cuenta</h2>
          <p className="panel__subcopy">
            Crea un espacio propio para que cada persona vea únicamente sus grupos.
          </p>
        </div>

        <form action={signupAction} className="stack-form auth-form">
          <input type="hidden" name="nextPath" value={nextPath} />

          <label className="field">
            <span>Nombre visible</span>
            <input name="displayName" type="text" placeholder="María" autoComplete="name" required />
          </label>

          <label className="field">
            <span>Correo electrónico</span>
            <input name="email" type="email" placeholder="tu@correo.com" autoComplete="email" required />
          </label>

          <PasswordField
            name="password"
            label="Contraseña"
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
          />

          <FormFeedback state={signupState} />
          <AuthSubmitButton idleLabel="Crear cuenta" pendingLabel="Creando cuenta..." />
        </form>
      </section>
    </div>
  );
}

function PasswordField({
  name,
  label,
  placeholder,
  autoComplete,
}: {
  name: string;
  label: string;
  placeholder: string;
  autoComplete: string;
}) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <label className="field">
      <span>{label}</span>
      <div className="password-field">
        <input
          name={name}
          type={isVisible ? "text" : "password"}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          className="password-field__toggle"
          onClick={() => setIsVisible((current) => !current)}
          aria-label={isVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={isVisible}
        >
          {isVisible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </label>
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
    <button type="submit" className="button button--primary auth-submit" disabled={pending}>
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

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 3l18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M10.6 6.2A10.7 10.7 0 0 1 12 6c6.4 0 10 6 10 6a18.1 18.1 0 0 1-4 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.7 6.8C4 8.4 2 12 2 12a18.7 18.7 0 0 0 5.3 5.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.9 9.9A3 3 0 0 0 14.1 14.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
