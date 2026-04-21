"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { splitAmount } from "@/lib/finance";
import { getGroupData } from "@/lib/supabase-data";
import { createSupabaseWriteClient } from "@/lib/supabaseClient";

export async function createGroup(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return { status: "error", message: "Escribe un nombre para el grupo." };
  }

  const supabase = createSupabaseWriteClient();
  const { data, error } = await supabase
    .from("groups")
    .insert({ name })
    .select("id")
    .single();

  if (error) {
    return { status: "error", message: explainWriteError(error.message, "grupo") };
  }

  revalidatePath("/");
  redirect(`/groups/${data.id}`);
}

export async function createParticipant(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const groupId = String(formData.get("groupId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  if (!groupId || !name) {
    return {
      status: "error",
      message: "Completa el nombre de la persona antes de continuar.",
    };
  }

  const supabase = createSupabaseWriteClient();
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

  const supabase = createSupabaseWriteClient();

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

  const balance = snapshot.data.balances.find(
    (entry) => entry.participantId === participantId,
  );

  if (balance && !balance.canDelete) {
    return {
      status: "error",
      message:
        "No puedes borrar este participante mientras tenga saldo pendiente.",
    };
  }

  const supabase = createSupabaseWriteClient();
  const { error } = await supabase
    .from("participants")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", participantId);

  if (error) {
    if (error.code === "42703") {
      const fallback = await supabase.from("participants").delete().eq("id", participantId);

      if (fallback.error) {
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

  return { status: "success", message: "Participante eliminado correctamente." };
}

export async function deleteGroup(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
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
      message:
        "Solo puedes borrar el grupo cuando no tenga deudas, gastos ni pagos registrados.",
    };
  }

  const supabase = createSupabaseWriteClient();
  const paymentsDelete = await supabase.from("payments").delete().eq("group_id", groupId);
  if (paymentsDelete.error && paymentsDelete.error.code !== "PGRST205") {
    return {
      status: "error",
      message: explainWriteError(paymentsDelete.error.message, "grupo"),
    };
  }

  const expenseIds = snapshot.data.expenses.map((expense) => expense.id);
  if (expenseIds.length) {
    const sharesDelete = await supabase.from("expense_shares").delete().in("expense_id", expenseIds);
    if (sharesDelete.error && sharesDelete.error.code !== "PGRST205") {
      return {
        status: "error",
        message: explainWriteError(sharesDelete.error.message, "grupo"),
      };
    }
  }

  const expensesDelete = await supabase.from("expenses").delete().eq("group_id", groupId);
  if (expensesDelete.error) {
    return {
      status: "error",
      message: explainWriteError(expensesDelete.error.message, "grupo"),
    };
  }

  const participantsDelete = await supabase.from("participants").delete().eq("group_id", groupId);
  if (participantsDelete.error) {
    return {
      status: "error",
      message: explainWriteError(participantsDelete.error.message, "grupo"),
    };
  }

  const { error } = await supabase.from("groups").delete().eq("id", groupId);

  if (error) {
    return { status: "error", message: explainWriteError(error.message, "grupo") };
  }

  revalidatePath("/");

  return { status: "success", message: "Grupo eliminado correctamente." };
}

export async function markSettlementPaid(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const groupId = String(formData.get("groupId") ?? "").trim();
  const fromParticipantId = String(formData.get("fromParticipantId") ?? "").trim();
  const toParticipantId = String(formData.get("toParticipantId") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);

  if (!groupId || !fromParticipantId || !toParticipantId || Number.isNaN(amount) || amount <= 0) {
    return { status: "error", message: "No se pudo registrar el pago de la liquidación." };
  }

  const supabase = createSupabaseWriteClient();
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

function explainWriteError(message: string, entity: string) {
  if (message.includes("row-level security policy")) {
    return `Supabase está bloqueando la escritura del ${entity}. Aplica las políticas del archivo supabase/setup.sql o añade SUPABASE_SERVICE_ROLE_KEY en .env.local.`;
  }

  if (message.includes("fetch failed")) {
    return "No se pudo conectar con Supabase. Revisa la URL del proyecto y vuelve a intentarlo.";
  }

  if (message.includes("expense_shares") || message.includes("payments")) {
    return "Falta una parte del esquema avanzado. Ejecuta las migraciones de Supabase para activar balances, pagos y borrados seguros.";
  }

  if (message.includes("deleted_at")) {
    return "Falta la columna de borrado lógico en participantes. Ejecuta la migración avanzada de Supabase y vuelve a intentarlo.";
  }

  if (message.includes("violates foreign key constraint")) {
    return `No se pudo borrar el ${entity} porque todavía tiene movimientos relacionados. Déjalo a cero o elimina antes los registros asociados.`;
  }

  return message;
}
