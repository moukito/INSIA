"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  Bot,
  CheckSquare,
  LoaderCircle,
  Mail,
  MailOpen,
  Paperclip,
  Send,
  Sparkles,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { CATEGORIES } from "@/lib/email-classifier";
import { authenticatedFetch } from "@/lib/supabase-browser";
import type {
  AssistantEmail,
  AssistantEmailAttachment,
  AssistantMessage,
  AssistantPendingAction,
  AssistantPendingScheduleChange,
  AssistantScheduleItem,
  AssistantTask,
  AssistantToolUse,
} from "@/lib/assistant-types";

interface AssistantPanelProps {
  emails: AssistantEmail[];
  tasks: AssistantTask[];
  isOpen: boolean;
  onClose: () => void;
  onTasksCreated: (tasks: AssistantTask[]) => void;
  onTasksUpdated: (tasks: AssistantTask[]) => void;
  onTaskDeleted: (id: number) => void;
  onScheduleCreated: (item: AssistantScheduleItem) => void;
  onScheduleUpdated: (item: AssistantScheduleItem) => void;
  onScheduleCancelled: (id: number) => void;
  onOpenEmail: (id: number) => void;
}

const suggestions = [
  "Quels sont mes emails urgents ?",
  "Résume mes tâches à faire",
  "Cherche le dernier email de mon département",
];

function isAssistantTask(value: unknown): value is AssistantTask {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const task = value as Record<string, unknown>;
  return (
    Number.isInteger(task.id) &&
    typeof task.title === "string" &&
    typeof task.course === "string" &&
    typeof task.due === "string" &&
    ["Urgent", "Normal", "Faible"].includes(String(task.priority)) &&
    typeof task.done === "boolean" &&
    (task.instructions === undefined || typeof task.instructions === "string") &&
    (task.estimatedTime === undefined || typeof task.estimatedTime === "string")
  );
}

function isAssistantToolUse(value: unknown): value is AssistantToolUse {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const toolUse = value as Record<string, unknown>;
  return (
    typeof toolUse.name === "string" &&
    toolUse.name.length > 0 &&
    toolUse.name.length <= 80 &&
    typeof toolUse.success === "boolean"
  );
}

function isAssistantScheduleItem(value: unknown): value is AssistantScheduleItem {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    Number.isSafeInteger(item.id) &&
    (item.eventId === undefined || Number.isSafeInteger(item.eventId)) &&
    typeof item.title === "string" &&
    ["cours", "association", "personnel"].includes(String(item.type)) &&
    typeof item.organizer === "string" &&
    typeof item.time === "string" &&
    typeof item.end === "string" &&
    typeof item.date === "string" &&
    typeof item.fullDate === "string" &&
    typeof item.place === "string" &&
    typeof item.detail === "string" &&
    typeof item.badge === "string" &&
    typeof item.color === "string" &&
    typeof item.light === "string" &&
    typeof item.text === "string"
  );
}

function isAssistantPendingScheduleChange(
  value: unknown
): value is AssistantPendingScheduleChange {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const change = value as Record<string, unknown>;
  const validCommonFields =
    Number.isSafeInteger(change.emailId) &&
    typeof change.emailSubject === "string" &&
    (typeof change.emailDate === "string" || change.emailDate === null) &&
    ["create", "update", "cancel"].includes(String(change.action)) &&
    ["add", "reschedule", "time_change", "room_change", "other", "cancel"].includes(
      String(change.changeType)
    ) &&
    typeof change.summary === "string";
  if (!validCommonFields) return false;
  if (change.action === "create") {
    return (
      change.scheduleItemId === undefined &&
      change.before === undefined &&
      isAssistantScheduleItem(change.after)
    );
  }
  if (!Number.isSafeInteger(change.scheduleItemId) || !isAssistantScheduleItem(change.before)) {
    return false;
  }
  return change.action === "cancel"
    ? change.after === undefined
    : isAssistantScheduleItem(change.after);
}

function isAssistantEmail(value: unknown): value is AssistantEmailAttachment {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const email = value as Record<string, unknown>;
  return (
    Number.isInteger(email.id) &&
    typeof email.subject === "string" &&
    typeof email.from === "string" &&
    typeof email.fromAddress === "string" &&
    (email.to === undefined || typeof email.to === "string") &&
    (typeof email.date === "string" || email.date === null) &&
    typeof email.unread === "boolean" &&
    typeof email.category === "string" &&
    Object.prototype.hasOwnProperty.call(CATEGORIES, email.category) &&
    (email.body === undefined || typeof email.body === "string") &&
    (email.attachments === undefined ||
      (Array.isArray(email.attachments) &&
        email.attachments.every(
          (attachment) =>
            typeof attachment === "object" &&
            attachment !== null &&
            typeof attachment.filename === "string" &&
            typeof attachment.contentType === "string" &&
            Number.isSafeInteger(attachment.size)
        )))
  );
}

function renderInlineMarkdown(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g)
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={index}
            className="rounded bg-slate-200/70 px-1 py-0.5 text-[0.9em]"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={index}>{part.slice(1, -1)}</em>;
      }
      return part;
    });
}

function FormattedAssistantText({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    if (!lines[index].trim()) {
      index += 1;
      continue;
    }

    const heading = lines[index].match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      blocks.push(
        <h4 key={`heading-${index}`} className="text-sm font-bold text-slate-900">
          {renderInlineMarkdown(heading[1])}
        </h4>
      );
      index += 1;
      continue;
    }

    const isListItem = (line: string) => /^\s*(?:[-*+]|\d+\.)\s+/.test(line);
    if (isListItem(lines[index])) {
      const ordered = /^\s*\d+\.\s+/.test(lines[index]);
      const items: ReactNode[] = [];
      while (index < lines.length && isListItem(lines[index])) {
        const item = lines[index].replace(/^\s*(?:[-*+]|\d+\.)\s+/, "");
        items.push(<li key={`item-${index}`}>{renderInlineMarkdown(item)}</li>);
        index += 1;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List
          key={`list-${index}`}
          className={`space-y-1.5 pl-5 ${
            ordered ? "list-decimal" : "list-disc"
          }`}
        >
          {items}
        </List>
      );
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^#{1,3}\s+/.test(lines[index]) &&
      !isListItem(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(
      <p key={`paragraph-${index}`} className="leading-6">
        {paragraph.map((line, lineIndex) => (
          <span key={lineIndex}>
            {lineIndex > 0 && <br />}
            {renderInlineMarkdown(line)}
          </span>
        ))}
      </p>
    );
  }

  return <div className="space-y-2.5">{blocks}</div>;
}

function formatEmailDate(date: string | null) {
  if (!date) return "Date inconnue";
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return date;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsedDate);
}

function EmailResultCard({
  email,
  onOpen,
}: {
  email: AssistantEmailAttachment;
  onOpen: (id: number) => void;
}) {
  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-xs">
      <header className="flex items-start gap-2.5 border-b border-slate-100 bg-slate-50/80 p-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
          {email.body ? <MailOpen size={16} /> : <Mail size={16} />}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="break-words text-xs font-bold leading-5 text-slate-900">
            {email.subject}
          </h4>
          <p className="mt-0.5 break-words text-[11px] leading-4 text-slate-500">
            {email.from}
            {email.fromAddress && email.fromAddress !== email.from
              ? ` · ${email.fromAddress}`
              : ""}
          </p>
          <p className="mt-1 text-[10px] text-slate-400">
            {formatEmailDate(email.date)}
          </p>
        </div>
      </header>
      {email.to && (
        <p className="px-3 pt-2 text-[10px] text-slate-500">
          À : <span className="break-words">{email.to}</span>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2.5">
        <span className="rounded-md bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700">
          {CATEGORIES[email.category].shortLabel}
        </span>
        {email.unread && (
          <span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
            Non lu
          </span>
        )}
      </div>
      {email.body ? (
        <div className="max-h-64 overflow-y-auto px-3 pb-3 pt-2.5">
          <p className="whitespace-pre-wrap break-words text-xs leading-5 text-slate-700">
            {email.body}
          </p>
        </div>
      ) : (
        <p className="px-3 pb-3 pt-2 text-[11px] text-slate-400">
          Demande-moi de le lire pour afficher son contenu.
        </p>
      )}
      {email.attachments?.length ? (
        <ul className="space-y-1 border-t border-slate-100 px-3 py-2">
          {email.attachments.map((attachment, index) => (
            <li
              key={`${attachment.filename}-${index}`}
              className="flex min-w-0 items-center gap-1.5 text-[10px] text-slate-500"
            >
              <Paperclip size={11} className="shrink-0" />
              <span className="truncate">{attachment.filename}</span>
              <span className="shrink-0">
                {Math.max(1, Math.round(attachment.size / 1024))} Ko
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        onClick={() => onOpen(email.id)}
        className="w-full border-t border-slate-100 px-3 py-2 text-left text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50"
      >
        Ouvrir l’e-mail complet
      </button>
    </article>
  );
}

function TaskResultCard({ task }: { task: AssistantTask }) {
  const priorityStyle =
    task.priority === "Urgent"
      ? "bg-rose-50 text-rose-700"
      : task.priority === "Faible"
        ? "bg-slate-100 text-slate-600"
        : "bg-indigo-50 text-indigo-700";

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 text-left">
      <h4 className="break-words text-xs font-bold leading-5 text-slate-900">
        {task.title}
      </h4>
      <p className="mt-1 text-[11px] text-slate-500">
        {task.course} · {task.due}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${priorityStyle}`}>
          {task.priority}
        </span>
        <span
          className={`rounded-md px-2 py-1 text-[10px] font-semibold ${
            task.done
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700"
          }`}
        >
          {task.done ? "Terminée" : "En attente"}
        </span>
      </div>
      {task.instructions && (
        <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">
          {task.instructions}
        </p>
      )}
    </article>
  );
}

function TaskDeletionConfirmation({
  action,
  onDeleted,
}: {
  action: AssistantPendingAction;
  onDeleted: (id: number) => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function confirmDeletion() {
    if (loading || confirmed) return;
    setLoading(true);
    setError("");
    try {
      const response = await authenticatedFetch(`/api/tasks/${action.id}`, {
        method: "DELETE",
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "La tâche n’a pas pu être déplacée dans la corbeille.";
        throw new Error(message);
      }
      setConfirmed(true);
      onDeleted(action.id);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "La tâche n’a pas pu être supprimée."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-xs font-semibold text-slate-800">
        {confirmed
          ? `« ${action.title} » a été déplacée dans la corbeille.`
          : `Confirmer la mise à la corbeille de « ${action.title} » ?`}
      </p>
      {!confirmed && (
        <button
          type="button"
          onClick={confirmDeletion}
          disabled={loading}
          className="mt-2 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
        >
          {loading ? "Suppression…" : "Confirmer la suppression"}
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-700">
          {error}
        </p>
      )}
    </section>
  );
}

function formatScheduleItem(item: AssistantScheduleItem) {
  const date = item.fullDate || item.date;
  const time = [item.time, item.end].filter(Boolean).join("–");
  return [date, time, item.place].filter(Boolean).join(" · ");
}

function ScheduleChangeConfirmation({
  change,
  onCreated,
  onUpdated,
  onCancelled,
  onOpenEmail,
}: {
  change: AssistantPendingScheduleChange;
  onCreated: (item: AssistantScheduleItem) => void;
  onUpdated: (item: AssistantScheduleItem) => void;
  onCancelled: (id: number) => void;
  onOpenEmail: (id: number) => void;
}) {
  const [status, setStatus] = useState<"pending" | "confirmed" | "ignored">("pending");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function confirmChange() {
    if (loading || status !== "pending") return;
    if (change.action !== "create" && change.scheduleItemId === undefined) {
      setError("Le créneau concerné n’est pas valide.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const response =
        change.action === "cancel"
          ? await authenticatedFetch(`/api/schedule/${change.scheduleItemId}`, {
              method: "DELETE",
            })
          : change.action === "create"
            ? await authenticatedFetch("/api/schedule", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  operation: "create",
                  item: change.after,
                }),
              })
            : await authenticatedFetch(`/api/schedule/${change.scheduleItemId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  patch: {
                    title: change.after?.title,
                    date: change.after?.date,
                    fullDate: change.after?.fullDate,
                    time: change.after?.time,
                    end: change.after?.end,
                    place: change.after?.place,
                    detail: change.after?.detail,
                  },
                }),
              });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Le changement de cours n’a pas pu être appliqué.";
        throw new Error(message);
      }

      if (change.action === "cancel") {
        const scheduleItemId = change.scheduleItemId;
        if (scheduleItemId === undefined) {
          throw new Error("Le créneau concerné n’est pas valide.");
        }
        setStatus("confirmed");
        onCancelled(scheduleItemId);
      } else {
        const updatedItem =
          typeof result === "object" &&
          result !== null &&
          "item" in result &&
          isAssistantScheduleItem(result.item)
            ? result.item
            : null;
        if (!updatedItem) {
          throw new Error("Le planning renvoyé par le serveur est invalide.");
        }
        setStatus("confirmed");
        if (change.action === "create") {
          onCreated(updatedItem);
        } else {
          onUpdated(updatedItem);
        }
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Le changement de cours n’a pas pu être appliqué."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-3">
      <h4 className="text-xs font-bold text-slate-800">
        {status === "confirmed"
          ? change.action === "cancel"
            ? "Annulation enregistrée"
            : change.action === "create"
              ? "Cours ajouté au planning"
              : "Modification enregistrée"
          : status === "ignored"
            ? "Proposition ignorée"
            : change.action === "cancel"
              ? "Annulation de cours proposée"
              : change.action === "create"
                ? "Ajout de cours proposé"
                : "Changement de cours proposé"}
      </h4>
      <p className="mt-1 text-xs leading-5 text-slate-700">{change.summary}</p>
      <div className="mt-2 space-y-1 rounded-lg bg-white/80 p-2 text-[10px] leading-4 text-slate-600">
        <p>
          <strong>Cours :</strong> {change.after?.title ?? change.before?.title}
        </p>
        {change.before && (
          <p>
            <strong>Actuel :</strong> {formatScheduleItem(change.before)}
          </p>
        )}
        {change.after && (
          <p>
            <strong>Proposé :</strong> {formatScheduleItem(change.after)}
          </p>
        )}
        <p className="break-words text-slate-400">
          Source : « {change.emailSubject} »
          {change.emailDate ? ` · ${formatEmailDate(change.emailDate)}` : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onOpenEmail(change.emailId)}
        className="mt-2 text-[10px] font-semibold text-indigo-700 hover:text-indigo-900"
      >
        Ouvrir l’email source
      </button>
      {status === "pending" && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={confirmChange}
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading
              ? "Application…"
              : change.action === "cancel"
                ? "Confirmer l’annulation"
                : change.action === "create"
                  ? "Confirmer l’ajout au planning"
                  : "Confirmer la modification"}
          </button>
          <button
            type="button"
            onClick={() => setStatus("ignored")}
            disabled={loading}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Ignorer
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[10px] text-rose-700">
          {error}
        </p>
      )}
    </section>
  );
}

export function AssistantPanel({
  emails,
  tasks,
  isOpen,
  onClose,
  onTasksCreated,
  onTasksUpdated,
  onTaskDeleted,
  onScheduleCreated,
  onScheduleUpdated,
  onScheduleCancelled,
  onOpenEmail,
}: AssistantPanelProps) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || loading) return;

    const nextMessages: AssistantMessage[] = [
      ...messages,
      { role: "user", content },
    ];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const response = await authenticatedFetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages
            .slice(-20)
            .map(({ role, content: messageContent }) => ({
              role,
              content: messageContent,
            })),
        }),
      });
      const data: unknown = await response.json();
      const rawToolUses =
        typeof data === "object" && data !== null && "toolUses" in data
          ? data.toolUses
          : undefined;
      if (
        rawToolUses !== undefined &&
        (!Array.isArray(rawToolUses) ||
          !rawToolUses.every(isAssistantToolUse))
      ) {
        throw new Error("Les outils utilisés reçus de l’assistant sont invalides.");
      }
      const toolUses = rawToolUses ?? [];
      const rawPendingScheduleChanges =
        typeof data === "object" &&
        data !== null &&
        "pendingScheduleChanges" in data
          ? data.pendingScheduleChanges
          : undefined;
      if (
        rawPendingScheduleChanges !== undefined &&
        (!Array.isArray(rawPendingScheduleChanges) ||
          !rawPendingScheduleChanges.every(isAssistantPendingScheduleChange))
      ) {
        throw new Error("Les propositions de changement de cours sont invalides.");
      }
      const pendingScheduleChanges = rawPendingScheduleChanges ?? [];

      if (!response.ok) {
        const message =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "L’assistant n’a pas pu répondre.";
        if (toolUses.length > 0 || pendingScheduleChanges.length > 0) {
          setMessages((current) => [
            ...current,
            {
              role: "assistant",
              content: "La demande s’est interrompue après un appel d’outil.",
              toolUses,
              pendingScheduleChanges,
            },
          ]);
        }
        throw new Error(message);
      }

      if (
        typeof data !== "object" ||
        data === null ||
        !("message" in data) ||
        typeof data.message !== "string"
      ) {
        throw new Error("La réponse de l’assistant est invalide.");
      }

      const answer = data.message;
      const rawCreatedTasks =
        "createdTasks" in data ? data.createdTasks : undefined;
      if (
        rawCreatedTasks !== undefined &&
        (!Array.isArray(rawCreatedTasks) ||
          !rawCreatedTasks.every(isAssistantTask))
      ) {
        throw new Error("Les tâches renvoyées par l’assistant sont invalides.");
      }
      const createdTasks = rawCreatedTasks ?? [];

      const rawUpdatedTasks =
        "updatedTasks" in data ? data.updatedTasks : undefined;
      if (
        rawUpdatedTasks !== undefined &&
        (!Array.isArray(rawUpdatedTasks) ||
          !rawUpdatedTasks.every(isAssistantTask))
      ) {
        throw new Error("Les tâches modifiées reçues de l’assistant sont invalides.");
      }
      const updatedTasks = rawUpdatedTasks ?? [];

      const rawTaskResults = "tasks" in data ? data.tasks : undefined;
      if (
        rawTaskResults !== undefined &&
        (!Array.isArray(rawTaskResults) ||
          !rawTaskResults.every(isAssistantTask))
      ) {
        throw new Error("Les tâches affichées par l’assistant sont invalides.");
      }
      const taskResults = rawTaskResults ?? [];

      const rawPendingActions =
        "pendingActions" in data ? data.pendingActions : undefined;
      if (
        rawPendingActions !== undefined &&
        (!Array.isArray(rawPendingActions) ||
          !rawPendingActions.every(
            (action) =>
              typeof action === "object" &&
              action !== null &&
              !Array.isArray(action) &&
              (action as Record<string, unknown>).type === "delete_task" &&
              Number.isSafeInteger((action as Record<string, unknown>).id) &&
              typeof (action as Record<string, unknown>).title === "string"
          ))
      ) {
        throw new Error("Une action de confirmation reçue est invalide.");
      }
      const pendingActions = (rawPendingActions ?? []) as AssistantPendingAction[];

      const rawEmails = "emails" in data ? data.emails : undefined;
      if (
        rawEmails !== undefined &&
        (!Array.isArray(rawEmails) || !rawEmails.every(isAssistantEmail))
      ) {
        throw new Error("Les emails renvoyés par l’assistant sont invalides.");
      }
      const emailResults = rawEmails ?? [];

      if (createdTasks.length > 0) onTasksCreated(createdTasks);
      if (updatedTasks.length > 0) onTasksUpdated(updatedTasks);

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: answer,
          emails: emailResults,
          tasks: taskResults,
          pendingActions,
          pendingScheduleChanges,
          toolUses,
        },
      ]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Une erreur inattendue est survenue."
      );
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Fermer le chat"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px] sm:hidden"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Assistant Campus"
        className="fixed z-50 flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
        style={{
          right: 24,
          bottom: 24,
          zIndex: 100,
          width: "min(420px, calc(100vw - 32px))",
          height: "min(680px, calc(100dvh - 32px))",
        }}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Sparkles size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-slate-900">Assistant Campus</h2>
            <p className="text-[11px] text-slate-500">
              {emails.length} emails · {tasks.length} tâches
            </p>
          </div>
          <button
            type="button"
            aria-label="Fermer le chat"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-slate-900"
          >
            <X size={18} />
          </button>
        </header>

        <div
          aria-live="polite"
          className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3.5"
        >
          {messages.length === 0 ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center px-2 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Bot size={28} />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Comment puis-je t’aider ?
              </h3>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Pose une question, cherche un email ou demande-moi d’ajouter une
                tâche.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setInput(suggestion)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) => {
              const isAssistant = message.role === "assistant";
              return (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex min-w-0 items-start gap-2 ${
                    isAssistant ? "" : "flex-row-reverse"
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      isAssistant
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {isAssistant ? <Bot size={15} /> : <UserRound size={14} />}
                  </div>
                  <div
                    className={`min-w-0 max-w-[90%] rounded-2xl px-3 py-2.5 text-xs ${
                      isAssistant
                        ? "rounded-tl-sm bg-slate-50 text-slate-700"
                        : "rounded-tr-sm bg-indigo-600 text-white"
                    }`}
                  >
                    {isAssistant ? (
                      <FormattedAssistantText content={message.content} />
                    ) : (
                      <p className="whitespace-pre-wrap leading-5">
                        {message.content}
                      </p>
                    )}
                    {isAssistant && message.toolUses?.length ? (
                      <div
                        aria-label="Outils utilisés"
                        className="mt-2 flex flex-wrap items-center gap-1"
                      >
                        <span className="inline-flex items-center gap-1 text-[9px] font-medium text-slate-400">
                          <Wrench size={10} />
                          Outils
                        </span>
                        {message.toolUses.map((toolUse, toolIndex) => (
                          <span
                            key={`${toolUse.name}-${toolIndex}`}
                            title={`${toolUse.name} — ${
                              toolUse.success ? "réussi" : "échec"
                            }`}
                            aria-label={`${toolUse.name}, ${
                              toolUse.success ? "réussi" : "échec"
                            }`}
                            className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[9px] ${
                              toolUse.success
                                ? "border-slate-200 bg-white text-slate-500"
                                : "border-rose-200 bg-rose-50 text-rose-700"
                            }`}
                          >
                            {toolUse.name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {isAssistant && message.emails?.length ? (
                      <div className="mt-3 space-y-2">
                        {message.emails.map((email) => (
                          <EmailResultCard
                            key={email.id}
                            email={email}
                            onOpen={onOpenEmail}
                          />
                        ))}
                      </div>
                    ) : null}
                    {isAssistant && message.tasks?.length ? (
                      <div className="mt-3 space-y-2">
                        {message.tasks.map((task) => (
                          <TaskResultCard key={task.id} task={task} />
                        ))}
                      </div>
                    ) : null}
                    {isAssistant && message.pendingActions?.length ? (
                      <div className="mt-3 space-y-2">
                        {message.pendingActions.map((action) => (
                          <TaskDeletionConfirmation
                            key={`${action.type}-${action.id}`}
                            action={action}
                            onDeleted={onTaskDeleted}
                          />
                        ))}
                      </div>
                    ) : null}
                    {isAssistant && message.pendingScheduleChanges?.length ? (
                      <div className="mt-3 space-y-2">
                        {message.pendingScheduleChanges.map((change) => (
                          <ScheduleChangeConfirmation
                            key={`${change.emailId}-${change.scheduleItemId ?? change.after?.title}`}
                            change={change}
                            onCreated={onScheduleCreated}
                            onUpdated={onScheduleUpdated}
                            onCancelled={onScheduleCancelled}
                            onOpenEmail={onOpenEmail}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}

          {loading && (
            <div className="flex items-center gap-2.5 text-xs text-slate-500">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                <Bot size={15} />
              </div>
              <span className="inline-flex items-center gap-2">
                Je regarde ça
                <LoaderCircle size={14} className="animate-spin" />
              </span>
            </div>
          )}
          {error && (
            <p role="alert" className="ml-9 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </p>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={sendMessage}
          className="shrink-0 border-t border-slate-100 bg-white p-3"
        >
          <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              disabled={loading}
              maxLength={3000}
              rows={1}
              aria-label="Message à l’assistant"
              placeholder="Écris ton message..."
              className="max-h-28 min-h-9 flex-1 resize-y bg-transparent px-2.5 py-2 text-xs text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Envoyer le message"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={15} />
            </button>
          </div>
          <p className="mt-1.5 flex items-center justify-center gap-1 text-[9px] text-slate-400">
            <CheckSquare size={10} />
            Maj+Entrée pour aller à la ligne
          </p>
        </form>
      </section>
    </>
  );
}
