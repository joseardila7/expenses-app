"use server";

import { redirect } from "next/navigation";

import { clearSession, persistSession } from "@/lib/auth";
import { createSupabaseAuthClient } from "@/lib/supabaseClient";
import { initialActionState, type ActionState } from "@/lib/action-state";

export async function login(
  previousState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void previousState;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { status: "error", message: "Introduce tu correo y tu contraseña." };
  }

  const supabase = createSupabaseAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    return {
      status: "error",
      message: error?.message || "No se pudo iniciar sesión con esas credenciales.",
    };
  }

  await persistSession(data.session);
  redirect("/");
}

export async function signup(
  previousState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void previousState;
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!displayName || !email || !password) {
    return { status: "error", message: "Completa nombre, correo y contraseña." };
  }

  if (password.length < 8) {
    return { status: "error", message: "La contraseña debe tener al menos 8 caracteres." };
  }

  const supabase = createSupabaseAuthClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
    },
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  if (data.session) {
    await persistSession(data.session);
    redirect("/");
  }

  return {
    status: "success",
    message:
      "Cuenta creada. Revisa tu correo para confirmar la cuenta si Supabase tiene la verificación activada.",
  };
}

export async function logout() {
  await clearSession();
  redirect("/login");
}
