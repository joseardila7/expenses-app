import { logout } from "@/app/auth/actions";

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
        <button type="submit" className="button button--ghost button--small">
          Salir
        </button>
      </form>
    </div>
  );
}
