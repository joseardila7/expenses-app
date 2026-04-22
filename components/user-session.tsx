import { logout } from "@/app/auth/actions";
import { SubmitButton } from "@/components/submit-button";

type UserSessionProps = {
  displayName: string;
  email: string;
};

export function UserSession({ displayName, email }: UserSessionProps) {
  return (
    <div className="user-session">
      <div className="user-session__copy">
        <strong>{displayName}</strong>
        <span>{email}</span>
      </div>

      <form action={logout}>
        <SubmitButton
          idleLabel="Salir"
          pendingLabel="Saliendo..."
          className="button button--ghost button--small"
        />
      </form>
    </div>
  );
}
