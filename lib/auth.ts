import "server-only";

import type { Session, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseAuthClient, createSupabaseUserClient } from "@/lib/supabaseClient";

const ACCESS_TOKEN_COOKIE = "gastos-access-token";
const REFRESH_TOKEN_COOKIE = "gastos-refresh-token";

const cookieOptions = {
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string;
  accessToken: string;
};

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    return null;
  }

  const supabase = createSupabaseAuthClient();
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user?.email) {
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email,
    displayName: toDisplayName(data.user),
    accessToken,
  };
}

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function getAuthenticatedProfile() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return null;
  }

  const supabase = createSupabaseUserClient(user.accessToken);
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    ...user,
    displayName: data?.display_name || user.displayName,
  };
}

export async function requireAuthenticatedProfile() {
  const profile = await getAuthenticatedProfile();

  if (!profile) {
    redirect("/login");
  }

  return profile;
}

export async function persistSession(session: Session) {
  const cookieStore = await cookies();
  const maxAge = session.expires_in ?? 60 * 60;

  cookieStore.set(ACCESS_TOKEN_COOKIE, session.access_token, {
    ...cookieOptions,
    maxAge,
  });
  cookieStore.set(REFRESH_TOKEN_COOKIE, session.refresh_token, {
    ...cookieOptions,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();

  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
}

function toDisplayName(user: User) {
  const metadataName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : "";

  if (metadataName) {
    return metadataName;
  }

  return user.email?.split("@")[0] ?? "Usuario";
}
