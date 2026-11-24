import type { AssistantScheduleItem } from "@/lib/assistant-types";
import { authenticateRequest } from "@/lib/supabase-server";

interface ScheduleRow {
  id: number;
  event_id: number | null;
  title: string;
  item_type: AssistantScheduleItem["type"];
  organizer: string;
  start_time: string;
  end_time: string;
  event_date: string;
  full_date: string;
  place: string;
  detail: string;
  badge: string;
  color: string;
  light: string;
  text_color: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toScheduleItem(row: ScheduleRow): AssistantScheduleItem {
  return {
    id: row.id,
    eventId: row.event_id ?? undefined,
    title: row.title,
    type: row.item_type,
    organizer: row.organizer,
    time: row.start_time,
    end: row.end_time,
    date: row.event_date,
    fullDate: row.full_date,
    place: row.place,
    detail: row.detail,
    badge: row.badge,
    color: row.color,
    light: row.light,
    text: row.text_color,
  };
}

function parseId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function databaseError(error: { code?: string }) {
  console.error("Schedule API database error:", error.code ?? "unknown");
  return Response.json(
    { error: "Le créneau n’a pas pu être modifié. Vérifie la migration Supabase." },
    { status: 503 }
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) {
    return Response.json({ error: "Identifiant de créneau invalide." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête JSON invalide." }, { status: 400 });
  }
  if (!isRecord(payload) || !isRecord(payload.patch)) {
    return Response.json({ error: "Modification de créneau invalide." }, { status: 400 });
  }

  const input = payload.patch;
  const fields: Array<[string, string, number]> = [
    ["title", "title", 200],
    ["date", "event_date", 120],
    ["fullDate", "full_date", 120],
    ["time", "start_time", 40],
    ["end", "end_time", 40],
    ["place", "place", 300],
    ["detail", "detail", 1000],
  ];
  const patch: Record<string, string> = {};

  for (const [inputField, databaseField, maxLength] of fields) {
    if (!Object.prototype.hasOwnProperty.call(input, inputField)) continue;
    const value = input[inputField];
    if (
      typeof value !== "string" ||
      value.length > maxLength ||
      (inputField === "title" && !value.trim())
    ) {
      return Response.json(
        { error: `La valeur du champ « ${inputField} » est invalide.` },
        { status: 400 }
      );
    }
    patch[databaseField] = value.trim();
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Aucun champ modifiable fourni." }, { status: 400 });
  }

  const { data, error } = await auth.client
    .from("schedule_items")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .eq("item_type", "cours")
    .is("deleted_at", null)
    .select(
      "id, event_id, title, item_type, organizer, start_time, end_time, event_date, full_date, place, detail, badge, color, light, text_color"
    )
    .maybeSingle();
  if (error) return databaseError(error);
  if (!data) return Response.json({ error: "Cours introuvable." }, { status: 404 });
  return Response.json({ item: toScheduleItem(data as ScheduleRow) });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) {
    return Response.json({ error: "Identifiant de créneau invalide." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await auth.client
    .from("schedule_items")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .eq("item_type", "cours")
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) return databaseError(error);
  if (!data) return Response.json({ error: "Cours introuvable." }, { status: 404 });
  return Response.json({ success: true, id });
}
