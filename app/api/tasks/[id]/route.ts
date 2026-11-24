import type { AssistantPriority, AssistantTask } from "@/lib/assistant-types";
import { authenticateRequest } from "@/lib/supabase-server";

interface TaskRow {
  id: number;
  title: string;
  course: string;
  due: string;
  priority: AssistantPriority;
  done: boolean;
  instructions: string | null;
  estimated_time: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toTask(row: TaskRow): AssistantTask {
  return {
    id: row.id,
    title: row.title,
    course: row.course,
    due: row.due,
    priority: row.priority,
    done: row.done,
    instructions: row.instructions ?? undefined,
    estimatedTime: row.estimated_time ?? undefined,
  };
}

function parseId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function databaseError(error: { code?: string }) {
  console.error("Task API database error:", error.code ?? "unknown");
  return Response.json(
    { error: "La tâche n’a pas pu être mise à jour. Vérifie la migration Supabase." },
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
    return Response.json({ error: "Identifiant de tâche invalide." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête JSON invalide." }, { status: 400 });
  }
  if (!isRecord(payload) || !isRecord(payload.patch)) {
    return Response.json({ error: "Modification de tâche invalide." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  const fields: Array<[string, string, (value: unknown) => boolean]> = [
    ["title", "title", (value) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= 200],
    ["course", "course", (value) => typeof value === "string" && value.length <= 120],
    ["due", "due", (value) => typeof value === "string" && value.length <= 120],
    ["priority", "priority", (value) => ["Urgent", "Normal", "Faible"].includes(String(value))],
    ["done", "done", (value) => typeof value === "boolean"],
    ["instructions", "instructions", (value) => value === null || (typeof value === "string" && value.length <= 2000)],
    ["estimatedTime", "estimated_time", (value) => value === null || (typeof value === "string" && value.length <= 100)],
  ];

  for (const [inputField, databaseField, isValid] of fields) {
    if (!Object.prototype.hasOwnProperty.call(payload.patch, inputField)) continue;
    const value = payload.patch[inputField];
    if (!isValid(value)) {
      return Response.json(
        { error: `La valeur du champ « ${inputField} » est invalide.` },
        { status: 400 }
      );
    }
    patch[databaseField] =
      typeof value === "string" && inputField !== "title" ? value.trim() : value;
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Aucun champ modifiable fourni." }, { status: 400 });
  }

  patch.updated_at = new Date().toISOString();
  const { data, error } = await auth.client
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .is("deleted_at", null)
    .select(
      "id, title, course, due, priority, done, instructions, estimated_time"
    )
    .maybeSingle();
  if (error) return databaseError(error);
  if (!data) return Response.json({ error: "Tâche introuvable." }, { status: 404 });
  return Response.json({ task: toTask(data as TaskRow) });
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
    return Response.json({ error: "Identifiant de tâche invalide." }, { status: 400 });
  }

  const { data, error } = await auth.client
    .from("tasks")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) return databaseError(error);
  if (!data) return Response.json({ error: "Tâche introuvable." }, { status: 404 });
  return Response.json({ success: true, id });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) {
    return Response.json({ error: "Identifiant de tâche invalide." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête JSON invalide." }, { status: 400 });
  }
  if (!isRecord(payload) || payload.operation !== "restore") {
    return Response.json({ error: "Opération de restauration invalide." }, { status: 400 });
  }

  const { data, error } = await auth.client
    .from("tasks")
    .update({ deleted_at: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .not("deleted_at", "is", null)
    .select(
      "id, title, course, due, priority, done, instructions, estimated_time"
    )
    .maybeSingle();
  if (error) return databaseError(error);
  if (!data) return Response.json({ error: "Tâche supprimée introuvable." }, { status: 404 });
  return Response.json({ task: toTask(data as TaskRow) });
}
