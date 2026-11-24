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

function parseTask(value: unknown) {
  if (!isRecord(value)) return null;
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const course = typeof value.course === "string" ? value.course.trim() : "Personnel";
  const due = typeof value.due === "string" ? value.due.trim() : "À planifier";
  const priority = value.priority;
  const instructions =
    typeof value.instructions === "string" ? value.instructions.trim() : null;
  const estimatedTime =
    typeof value.estimatedTime === "string" ? value.estimatedTime.trim() : null;

  if (
    !title ||
    title.length > 200 ||
    course.length > 120 ||
    due.length > 120 ||
    !["Urgent", "Normal", "Faible"].includes(String(priority)) ||
    (instructions !== null && instructions.length > 2000) ||
    (estimatedTime !== null && estimatedTime.length > 100)
  ) {
    return null;
  }

  return {
    title,
    course: course || "Personnel",
    due: due || "À planifier",
    priority: priority as AssistantPriority,
    done: false,
    instructions,
    estimated_time: estimatedTime,
  };
}

function schemaUnavailable(error: { code?: string }) {
  console.error("Task API database error:", error.code ?? "unknown");
  return Response.json(
    { error: "Le stockage des tâches est indisponible. Vérifie la migration Supabase." },
    { status: 503 }
  );
}

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  const { count, error: countError } = await auth.client
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id);
  if (countError) return schemaUnavailable(countError);

  const { data, error } = await auth.client
    .from("tasks")
    .select(
      "id, title, course, due, priority, done, instructions, estimated_time"
    )
    .eq("user_id", auth.user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) return schemaUnavailable(error);

  return Response.json({
    tasks: (data as TaskRow[]).map(toTask),
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
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  if (payload.operation === "bootstrap") {
    if (!Array.isArray(payload.tasks) || payload.tasks.length > 50) {
      return Response.json({ error: "Liste initiale de tâches invalide." }, { status: 400 });
    }

    const seed = payload.tasks.map(parseTask);
    if (seed.some((task) => task === null)) {
      return Response.json(
        { error: "Une des tâches initiales contient des informations invalides." },
        { status: 400 }
      );
    }

    const { count, error: countError } = await auth.client
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.user.id);
    if (countError) return schemaUnavailable(countError);
    const { count: seededCount, error: seededCountError } = await auth.client
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.user.id)
      .not("seed_key", "is", null);
    if (seededCountError) return schemaUnavailable(seededCountError);
    if ((count ?? 0) > 0 && (seededCount ?? 0) === 0) {
      const { data, error } = await auth.client
        .from("tasks")
        .select(
          "id, title, course, due, priority, done, instructions, estimated_time"
        )
        .eq("user_id", auth.user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) return schemaUnavailable(error);
      return Response.json({
        tasks: (data as TaskRow[]).map(toTask),
        seedRequired: false,
      });
    }

    if (seed.length === 0) return Response.json({ tasks: [] });
    const validSeed = seed.filter(
      (task): task is NonNullable<typeof task> => task !== null
    );
    const { error } = await auth.client
      .from("tasks")
      .upsert(
        validSeed.map((task, index) => ({
          ...task,
          user_id: auth.user.id,
          seed_key: `starter-${index + 1}`,
        })),
        { onConflict: "user_id,seed_key", ignoreDuplicates: true }
      );
    if (error) return schemaUnavailable(error);
    const { data, error: loadError } = await auth.client
      .from("tasks")
      .select(
        "id, title, course, due, priority, done, instructions, estimated_time"
      )
      .eq("user_id", auth.user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (loadError) return schemaUnavailable(loadError);
    return Response.json({ tasks: (data as TaskRow[]).map(toTask) });
  }

  const task = parseTask(payload.task);
  if (!task) {
    return Response.json({ error: "Informations de tâche invalides." }, { status: 400 });
  }

  const { data, error } = await auth.client
    .from("tasks")
    .insert({ ...task, user_id: auth.user.id })
    .select(
      "id, title, course, due, priority, done, instructions, estimated_time"
    )
    .single();
  if (error) return schemaUnavailable(error);
  return Response.json({ task: toTask(data as TaskRow) }, { status: 201 });
}
