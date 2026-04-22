import { redirect } from "next/navigation";

import { AuthForms } from "@/components/auth-forms";
import { getAuthenticatedUser } from "@/lib/auth";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getAuthenticatedUser();
  const { next } = await searchParams;

  if (user) {
    redirect("/");
  }

  return (
    <main className="shell auth-shell">
      <section className="hero auth-hero">
        <div className="hero__copy">
          <p className="eyebrow">Gastos App</p>
          <h1>Tus grupos, solo para ti.</h1>
          <p className="hero__lede">
            Inicia sesión o crea tu cuenta para trabajar con grupos privados y mantener cada
            espacio separado por usuario.
          </p>

          <div className="hero__chips">
            <span>Acceso privado</span>
            <span>Grupos por cuenta</span>
            <span>Supabase Auth</span>
          </div>
        </div>

        <div className="hero__spotlight auth-spotlight">
          <div className="spotlight-card">
            <span className="spotlight-card__label">Nuevo acceso</span>
            <strong>Privado</strong>
            <p>Cada persona ve únicamente los grupos donde tiene acceso.</p>
          </div>

          <div className="spotlight-note">
            <p>
              Si vienes de la versión anterior, los grupos existentes tendrán que asignarse a una
              cuenta para que vuelvan a aparecer.
            </p>
          </div>
        </div>
      </section>

      <section className="panel panel--form section-space">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Autenticación</p>
            <h2>Accede a tu espacio</h2>
            <p className="panel__subcopy">
              El registro crea tu perfil y el inicio de sesión recupera únicamente tus grupos.
            </p>
          </div>
        </div>

        <AuthForms nextPath={next} />
      </section>
    </main>
  );
}
