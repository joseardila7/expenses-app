"use server";

import { randomUUID } from "crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { requireAuthenticatedProfile, requireAuthenticatedUser } from "@/lib/auth";
import { splitAmount } from "@/lib/finance";
import { getGroupData } from "@/lib/supabase-data";
import { createSupabaseUserClient } from "@/lib/supabaseClient";

type AppSupabaseClient = ReturnType<typeof createSupabaseUserClient>;

export async function createGroup(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAuthenticatedUser();
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return { status: "error", message: "Escribe un nombre para el grupo." };
  }

  const supabase = createSupabaseUserClient(user.accessToken);
  const { data, error } = await supabase
    .from("groups")
    .insert({ name, owner_user_id: user.id })
    .select("id")
    .single();

  if (error) {
    return { status: "error", message: explainWriteError(error.message, "grupo") };
  }

  const membership = await supabase.from("group_members").insert({
    group_id: data.id,
    user_id: user.id,
    role: "owner",
  });

  if (membership.error) {
    return {
      status: "error",
      message: explainWriteError(membership.error.message, "membresía del grupo"),
    };
  }

  revalidatePath("/");
  redirect(`/groups/${data.id}`);
}

export async function createGroupInvitation(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAuthenticatedProfile();
  const groupId = String(formData.get("groupId") ?? "").trim();
  const invitedEmail = String(formData.get("invitedEmail") ?? "").trim().toLowerCase();

  if (!groupId || !invitedEmail) {
    return { status: "error", message: "Escribe un correo válido para invitar." };
  }

  if (invitedEmail === user.email.toLowerCase()) {
    return { status: "error", message: "No puedes invitarte a ti mismo al grupo." };
  }

  const snapshot = await getGroupData(groupId);

  if (snapshot.error || !snapshot.data) {
    return { status: "error", message: "No se pudo preparar la invitación del grupo." };
  }

  const supabase = createSupabaseUserClient(user.accessToken);
  const token = randomUUID();
  const { error } = await supabase.from("group_invitations").insert({
    group_id: groupId,
    group_name_snapshot: snapshot.data.group.name,
    invited_email: invitedEmail,
    invited_by_user_id: user.id,
    invited_by_name_snapshot: user.displayName,
    token,
  });

  if (error) {
    if (error.message.includes("group_invitations_pending_unique_idx")) {
      return {
        status: "error",
        message: "Ya existe una invitación pendiente para ese correo en este grupo.",
      };
    }

    return { status: "error", message: explainWriteError(error.message, "invitación") };
  }

  revalidatePath("/");
  revalidatePath(`/groups/${groupId}`);

  return { status: "success", message: `Invitación creada para ${invitedEmail}.` };
}

export async function revokeGroupInvitation(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAuthenticatedUser();
  const invitationId = String(formData.get("invitationId") ?? "").trim();
  const groupId = String(formData.get("groupId") ?? "").trim();

  if (!invitationId || !groupId) {
    return { status: "error", message: "No se pudo identificar la invitación." };
  }

  const supabase = createSupabaseUserClient(user.accessToken);
  const { error } = await supabase
    .from("group_invitations")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
    })
    .eq("id", invitationId)
    .eq("status", "pending");

  if (error) {
    return { status: "error", message: explainWriteError(error.message, "invitación") };
  }

  revalidatePath("/");
  revalidatePath(`/groups/${groupId}`);

  return { status: "success", message: "Invitación revocada." };
}

export async function acceptGroupInvitation(formData: FormData) {
  const user = await requireAuthenticatedProfile();
  const token = String(formData.get("token") ?? "").trim();
  const participantName = String(formData.get("participantName") ?? "").trim();

  if (!token) {
    redirect("/");
  }

  if (!participantName) {
    redirect(`/invitations/${token}`);
  }

  const supabase = createSupabaseUserClient(user.accessToken);
  const invitationResult = await supabase
    .from("group_invitations")
    .select("id,group_id,invited_email,invited_by_user_id,status")
    .eq("token", token)
    .maybeSingle();

  if (invitationResult.error || !invitationResult.data) {
    redirect("/");
  }

  const invitation = invitationResult.data;

  if (
    invitation.status !== "pending" ||
    invitation.invited_email !== user.email.toLowerCase() ||
    invitation.invited_by_user_id === user.id
  ) {
    redirect(`/invitations/${token}`);
  }

  const membership = await supabase.from("group_members").upsert(
    {
      group_id: invitation.group_id,
      user_id: user.id,
      role: "member",
    },
    { onConflict: "group_id,user_id", ignoreDuplicates: false },
  );

  if (membership.error) {
    redirect(`/invitations/${token}`);
  }

  const participantSynced = await syncAcceptedInvitationParticipant({
    supabase,
    groupId: invitation.group_id,
    userId: user.id,
    email: user.email,
    participantName,
  });

  if (!participantSynced) {
    redirect(`/invitations/${token}`);
  }

  await supabase
    .from("group_invitations")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_user_id: user.id,
      accepted_name_snapshot: participantName,
    })
    .eq("id", invitation.id);

  revalidatePath("/");
  revalidatePath(`/groups/${invitation.group_id}`);
  redirect(`/groups/${invitation.group_id}`);
}

export async function createParticipant(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAuthenticatedUser();
  const groupId = String(formData.get("groupId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  if (!groupId || !name) {
    return {
      status: "error",
      message: "Completa el nombre de la persona antes de continuar.",
    };
  }

  const supabase = createSupabaseUserClient(user.accessToken);
  const { error } = await supabase.from("participants").insert({
    group_id: groupId,
    name,
  });

  if (error) {
    return { status: "error", message: explainWriteError(error.message, "participante") };
  }

  revalidatePath("/");
  revalidatePath(`/groups/${groupId}`);

  return { status: "success", message: "Participante añadido correctamente." };
}

export async function createExpense(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAuthenticatedUser();
  const groupId = String(formData.get("groupId") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const paidByParticipantId = String(formData.get("paidByParticipantId") ?? "").trim();
  const splitWithParticipantIds = formData
    .getAll("splitWithParticipantIds")
    .map((value) => String(value))
    .filter(Boolean);

  if (!groupId || !description || Number.isNaN(amount) || amount <= 0) {
    return { status: "error", message: "Introduce un concepto y un importe válido." };
  }

  const supabase = createSupabaseUserClient(user.accessToken);

  if (!paidByParticipantId || splitWithParticipantIds.length === 0) {
    const { error } = await supabase.from("expenses").insert({
      group_id: groupId,
      description,
      amount,
    });

    if (error) {
      return { status: "error", message: explainWriteError(error.message, "gasto") };
    }

    revalidatePath("/");
    revalidatePath(`/groups/${groupId}`);

    return {
      status: "success",
      message:
        "Gasto guardado en modo básico. Aplica la migración de balances para indicar quién paga y cómo se reparte.",
    };
  }

  const { data: expense, error: expenseError } = await supabase
    .from("expenses")
    .insert({
      group_id: groupId,
      description,
      amount,
      paid_by_participant_id: paidByParticipantId,
    })
    .select("id")
    .single();

  if (expenseError) {
    if (expenseError.code === "42703") {
      const fallback = await supabase.from("expenses").insert({
        group_id: groupId,
        description,
        amount,
      });

      if (fallback.error) {
        return { status: "error", message: explainWriteError(fallback.error.message, "gasto") };
      }

      revalidatePath("/");
      revalidatePath(`/groups/${groupId}`);

      return {
        status: "success",
        message:
          "Gasto guardado en modo básico. Ejecuta la migración nueva para activar balances y repartos.",
      };
    }

    return { status: "error", message: explainWriteError(expenseError.message, "gasto") };
  }

  const shares = splitAmount(amount, splitWithParticipantIds).map((share) => ({
    expense_id: expense.id,
    participant_id: share.participantId,
    amount: share.amount,
  }));

  const { error: sharesError } = await supabase.from("expense_shares").insert(shares);

  if (sharesError) {
    return {
      status: "error",
      message: explainWriteError(sharesError.message, "reparto del gasto"),
    };
  }

  revalidatePath("/");
  revalidatePath(`/groups/${groupId}`);

  return { status: "success", message: "Gasto guardado y repartido correctamente." };
}

export async function deleteParticipant(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAuthenticatedUser();
  const groupId = String(formData.get("groupId") ?? "").trim();
  const participantId = String(formData.get("participantId") ?? "").trim();

  if (!groupId || !participantId) {
    return { status: "error", message: "No se pudo identificar al participante." };
  }

  const snapshot = await getGroupData(groupId);

  if (snapshot.error || !snapshot.data) {
    return {
      status: "error",
      message: "No se pudo validar el estado del participante.",
    };
  }

  const balance = snapshot.data.balances.find((entry) => entry.participantId === participantId);

  if (balance && !balance.canDelete) {
    return {
      status: "error",
      message: "No puedes borrar este participante mientras tenga saldo pendiente.",
    };
  }

  const supabase = createSupabaseUserClient(user.accessToken);
  const { error } = await supabase
    .from("participants")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", participantId);

  if (error) {
    if (error.code === "42703") {
      const fallback = await supabase.from("participants").delete().eq("id", participantId);

      if (fallback.error) {
        if (fallback.error.message.includes("violates foreign key constraint")) {
          return {
            status: "error",
            message:
              "Este participante tiene historial asociado. Para ocultarlo sin perder movimientos, ejecuta la migración avanzada completa de Supabase.",
          };
        }

        return {
          status: "error",
          message: explainWriteError(fallback.error.message, "participante"),
        };
      }

      revalidatePath("/");
      revalidatePath(`/groups/${groupId}`);

      return { status: "success", message: "Participante eliminado correctamente." };
    }

    return { status: "error", message: explainWriteError(error.message, "participante") };
  }

  revalidatePath("/");
  revalidatePath(`/groups/${groupId}`);

  return { status: "success", message: "Participante ocultado correctamente." };
}

export async function deleteGroup(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAuthenticatedUser();
  const groupId = String(formData.get("groupId") ?? "").trim();

  if (!groupId) {
    return { status: "error", message: "No se pudo identificar el grupo." };
  }

  const snapshot = await getGroupData(groupId);

  if (snapshot.error || !snapshot.data) {
    return {
      status: "error",
      message: "No se pudo validar si el grupo tiene deudas pendientes.",
    };
  }

  if (!snapshot.data.canDeleteGroup) {
    return {
      status: "error",
      message: "Solo puedes borrar el grupo cuando no tenga deudas pendientes.",
    };
  }

  const supabase = createSupabaseUserClient(user.accessToken);
  const { error } = await supabase
    .from("groups")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", groupId);

  if (error) {
    if (error.code === "42703") {
      const fallback = await supabase.from("groups").delete().eq("id", groupId);

      if (fallback.error) {
        return { status: "error", message: explainWriteError(fallback.error.message, "grupo") };
      }

      revalidatePath("/");
      redirect("/");
    }

    return { status: "error", message: explainWriteError(error.message, "grupo") };
  }

  revalidatePath("/");
  redirect("/");
}

export async function markSettlementPaid(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAuthenticatedUser();
  const groupId = String(formData.get("groupId") ?? "").trim();
  const fromParticipantId = String(formData.get("fromParticipantId") ?? "").trim();
  const toParticipantId = String(formData.get("toParticipantId") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);

  if (!groupId || !fromParticipantId || !toParticipantId || Number.isNaN(amount) || amount <= 0) {
    return { status: "error", message: "No se pudo registrar el pago de la liquidación." };
  }

  const supabase = createSupabaseUserClient(user.accessToken);
  const { error } = await supabase.from("payments").insert({
    group_id: groupId,
    from_participant_id: fromParticipantId,
    to_participant_id: toParticipantId,
    amount,
  });

  if (error) {
    return {
      status: "error",
      message: explainWriteError(error.message, "pago de liquidación"),
    };
  }

  revalidatePath("/");
  revalidatePath(`/groups/${groupId}`);

  return { status: "success", message: "Liquidación marcada como pagada." };
}

async function syncAcceptedInvitationParticipant({
  supabase,
  groupId,
  userId,
  email,
  participantName,
}: {
  supabase: AppSupabaseClient;
  groupId: string;
  userId: string;
  email: string;
  participantName: string;
}) {
  const linkedParticipant = await supabase
    .from("participants")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (linkedParticipant.error) {
    return false;
  }

  if (linkedParticipant.data) {
    const updateResult = await supabase
      .from("participants")
      .update({
        name: participantName,
        contact_email: email.toLowerCase(),
      })
      .eq("id", linkedParticipant.data.id);

    return !updateResult.error;
  }

  const matchingNamedParticipant = await supabase
    .from("participants")
    .select("id")
    .eq("group_id", groupId)
    .is("user_id", null)
    .eq("name", participantName)
    .maybeSingle();

  if (matchingNamedParticipant.error) {
    return false;
  }

  if (matchingNamedParticipant.data) {
    const claimResult = await supabase
      .from("participants")
      .update({
        user_id: userId,
        contact_email: email.toLowerCase(),
      })
      .eq("id", matchingNamedParticipant.data.id);

    return !claimResult.error;
  }

  const insertResult = await supabase.from("participants").insert({
    group_id: groupId,
    name: participantName,
    user_id: userId,
    contact_email: email.toLowerCase(),
  });

  return !insertResult.error;
}

function explainWriteError(message: string, entity: string) {
  if (message.includes("row-level security policy")) {
    return `Supabase está bloqueando la escritura del ${entity}. Aplica las políticas del archivo supabase/setup.sql o añade la autenticación correctamente antes de volver a intentarlo.`;
  }

  if (message.includes("fetch failed")) {
    return "No se pudo conectar con Supabase. Revisa la URL del proyecto y vuelve a intentarlo.";
  }

  if (message.includes("expense_shares") || message.includes("payments")) {
    return "Falta una parte del esquema avanzado. Ejecuta las migraciones de Supabase para activar balances, pagos y borrados seguros.";
  }

  if (message.includes("deleted_at")) {
    return "Falta la columna de borrado lógico. Ejecuta la migración avanzada de Supabase y vuelve a intentarlo.";
  }

  if (message.includes("violates foreign key constraint")) {
    return `No se pudo borrar el ${entity} porque todavía tiene movimientos relacionados. Déjalo a cero o elimina antes los registros asociados.`;
  }

  return message;
}
