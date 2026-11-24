import type { AssistantScheduleItem } from "@/lib/assistant-types";
import type { SupabaseClient } from "@supabase/supabase-js";
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

function parseScheduleItem(value: unknown) {
  if (!isRecord(value)) return null;
  const fields = {
    title: value.title,
    type: value.type,
    organizer: value.organizer,
    time: value.time,
    end: value.end,
    date: value.date,
    fullDate: value.fullDate,
    place: value.place,
    detail: value.detail,
    badge: value.badge,
    color: value.color,
    light: value.light,
    text: value.text,
  };

  if (
    typeof fields.title !== "string" ||
    !fields.title.trim() ||
    fields.title.length > 200 ||
    (fields.type !== "cours" &&
      fields.type !== "association" &&
      fields.type !== "personnel") ||
    typeof fields.organizer !== "string" ||
    fields.organizer.length > 200 ||
    typeof fields.time !== "string" ||
    fields.time.length > 40 ||
    typeof fields.end !== "string" ||
    fields.end.length > 40 ||
    typeof fields.date !== "string" ||
    fields.date.length > 120 ||
    typeof fields.fullDate !== "string" ||
    fields.fullDate.length > 120 ||
    typeof fields.place !== "string" ||
    fields.place.length > 300 ||
    typeof fields.detail !== "string" ||
    fields.detail.length > 1000 ||
    typeof fields.badge !== "string" ||
    fields.badge.length > 80 ||
    typeof fields.color !== "string" ||
    fields.color.length > 80 ||
    typeof fields.light !== "string" ||
    fields.light.length > 80 ||
    typeof fields.text !== "string" ||
    fields.text.length > 80
  ) {
    return null;
  }

  return {
    title: fields.title.trim(),
    item_type: fields.type,
    organizer: fields.organizer.trim(),
    start_time: fields.time.trim(),
    end_time: fields.end.trim(),
    event_date: fields.date.trim(),
    full_date: fields.fullDate.trim(),
    place: fields.place.trim(),
    detail: fields.detail.trim(),
    badge: fields.badge.trim(),
    color: fields.color.trim(),
    light: fields.light.trim(),
    text_color: fields.text.trim(),
    event_id:
      Number.isSafeInteger(value.eventId) && Number(value.eventId) > 0
        ? Number(value.eventId)
        : null,
  };
}

function databaseError(error: { code?: string }) {
  console.error("Schedule API database error:", error.code ?? "unknown");
  return Response.json(
    { error: "Le planning n’est pas disponible. Vérifie la migration Supabase." },
    { status: 503 }
  );
}

async function loadSchedule(
  client: SupabaseClient,
  userId: string
) {
  return client
    .from("schedule_items")
    .select(
      "id, event_id, title, item_type, organizer, start_time, end_time, event_date, full_date, place, detail, badge, color, light, text_color"
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
}

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  const { count, error: countError } = await auth.client
    .from("schedule_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id);
  if (countError) return databaseError(countError);

  const { data, error } = await loadSchedule(auth.client, auth.user.id);
  if (error) return databaseError(error);

  return Response.json({
    items: (data as ScheduleRow[]).map(toScheduleItem),
    seedRequired: count === 0,
  });
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête JSON invalide." }, { status: 400 });
  }
  if (!isRecord(payload)) {
    return Response.json({ error: "Opération de planning invalide." }, { status: 400 });
  }

  if (payload.operation === "create") {
    const item = parseScheduleItem(payload.item);
    if (!item || item.item_type !== "cours") {
      return Response.json({ error: "Nouveau cours invalide." }, { status: 400 });
    }
    const { data, error } = await auth.client
      .from("schedule_items")
      .insert({
        ...item,
        event_id: null,
        seed_key: null,
        user_id: auth.user.id,
      })
      .select(
        "id, event_id, title, item_type, organizer, start_time, end_time, event_date, full_date, place, detail, badge, color, light, text_color"
      )
      .single();
    if (error) return databaseError(error);
    return Response.json({ item: toScheduleItem(data as ScheduleRow) }, { status: 201 });
  }

  if (payload.operation !== "bootstrap") {
    return Response.json({ error: "Opération de planning invalide." }, { status: 400 });
  }
  if (!Array.isArray(payload.items) || payload.items.length > 100) {
    return Response.json({ error: "Liste initiale de créneaux invalide." }, { status: 400 });
  }

  const seed = payload.items.map(parseScheduleItem);
  if (seed.some((item) => item === null)) {
    return Response.json(
      { error: "Un des créneaux initiaux contient des informations invalides." },
      { status: 400 }
    );
  }

  const { count, error: countError } = await auth.client
    .from("schedule_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id);
  if (countError) return databaseError(countError);

  const { count: seededCount, error: seededCountError } = await auth.client
    .from("schedule_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id)
    .not("seed_key", "is", null);
  if (seededCountError) return databaseError(seededCountError);

  if ((count ?? 0) > 0 && (seededCount ?? 0) === 0) {
    const { data, error } = await loadSchedule(auth.client, auth.user.id);
    if (error) return databaseError(error);
    return Response.json({ items: (data as ScheduleRow[]).map(toScheduleItem) });
  }

  if (seed.length === 0) return Response.json({ items: [] });
  const validSeed = seed.filter(
    (item): item is NonNullable<typeof item> => item !== null
  );
  const { error } = await auth.client.from("schedule_items").upsert(
    validSeed.map((item, index) => ({
      ...item,
      user_id: auth.user.id,
      seed_key: `starter-${index + 1}`,
    })),
    { onConflict: "user_id,seed_key", ignoreDuplicates: true }
  );
  if (error) return databaseError(error);

  const { data, error: loadError } = await loadSchedule(auth.client, auth.user.id);
  if (loadError) return databaseError(loadError);
  return Response.json({ items: (data as ScheduleRow[]).map(toScheduleItem) });
}
