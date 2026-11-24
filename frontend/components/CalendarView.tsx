"use client";

import {FormEvent, useCallback, useEffect, useMemo, useState} from "react";
import {ChevronLeft, ChevronRight, FileUp, Plus, RefreshCw, Trash2, X,} from "lucide-react";
import {
    CalendarEvent,
    CourseChoice,
    createCalendarEvent,
    deleteCalendarEvent,
    EventInput,
    fetchCalendarEvents,
    fetchCourseChoices,
    importCalendarFile,
    syncCalendarSource,
    updateCalendarEvent,
    updateCourseChoice,
} from "@/lib/calendar-api";

const DAY_START = 7;
const DAY_END = 20;
const HOUR_HEIGHT = 72;

function startOfWeek(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    const day = result.getDay();
    result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
    return result;
}

function toLocalInput(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
        date.getHours()
    )}:${pad(date.getMinutes())}`;
}

function toDateTime(value: string): string {
    return new Date(value).toISOString();
}

function eventColor(event: CalendarEvent): string {
    const colors = ["bg-indigo-100 border-indigo-300", "bg-emerald-100 border-emerald-300", "bg-amber-100 border-amber-300", "bg-violet-100 border-violet-300"];
    return colors[event.id % colors.length];
}

type EventForm = {
    id?: number;
    title: string;
    course: string;
    subject: string;
    location: string;
    description: string;
    start_at: string;
    end_at: string;
};

function emptyForm(date = new Date()): EventForm {
    const start = new Date(date);
    start.setMinutes(0, 0, 0);
    const end = new Date(start);
    end.setHours(end.getHours() + 1);
    return {
        title: "",
        course: "Personal",
        subject: "unknown",
        location: "",
        description: "",
        start_at: toLocalInput(start),
        end_at: toLocalInput(end),
    };
}

export function CalendarView({
                                 onEventsChange,
                             }: {
    onEventsChange?: (events: CalendarEvent[]) => void;
}) {
    const [week, setWeek] = useState(() => startOfWeek(new Date()));
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [form, setForm] = useState<EventForm | null>(null);
    const [sourceKey, setSourceKey] = useState("calendar");
    const [sourceUrl, setSourceUrl] = useState("");
    const [courseChoices, setCourseChoices] = useState<CourseChoice[]>([]);
    const [choicesLoading, setChoicesLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const weekEnd = useMemo(() => {
        const end = new Date(week);
        end.setDate(end.getDate() + 7);
        return end;
    }, [week]);

    const loadEvents = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const loaded = await fetchCalendarEvents(week, weekEnd);
            setEvents(loaded);
            onEventsChange?.(loaded);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Impossible de charger le planning.");
        } finally {
            setLoading(false);
        }
    }, [onEventsChange, week, weekEnd]);

    const loadCourseChoices = useCallback(async () => {
        if (!sourceKey.trim()) {
            setCourseChoices([]);
            return;
        }
        setChoicesLoading(true);
        try {
            setCourseChoices(await fetchCourseChoices(sourceKey.trim()));
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Impossible de charger les cours.");
        } finally {
            setChoicesLoading(false);
        }
    }, [sourceKey]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadEvents();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [loadEvents]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void loadCourseChoices();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [loadCourseChoices]);

    const days = Array.from({length: 7}, (_, index) => {
        const day = new Date(week);
        day.setDate(day.getDate() + index);
        return day;
    });

    function shiftWeek(amount: number) {
        const next = new Date(week);
        next.setDate(next.getDate() + amount * 7);
        setWeek(next);
    }

    function openEvent(event: CalendarEvent) {
        setForm({
            id: event.id,
            title: event.title,
            course: event.course,
            subject: event.subject,
            location: event.location,
            description: event.description,
            start_at: toLocalInput(new Date(event.start_at)),
            end_at: toLocalInput(new Date(event.end_at)),
        });
    }

    async function submitEvent(event: FormEvent) {
        event.preventDefault();
        if (!form) return;
        setSaving(true);
        setError("");
        try {
            const input: EventInput = {
                title: form.title,
                course: form.course,
                subject: form.subject,
                location: form.location,
                description: form.description,
                start_at: toDateTime(form.start_at),
                end_at: toDateTime(form.end_at),
            };
            if (form.id) await updateCalendarEvent(form.id, input);
            else await createCalendarEvent(input);
            setForm(null);
            await loadEvents();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Impossible d'enregistrer l'événement.");
        } finally {
            setSaving(false);
        }
    }

    async function removeEvent() {
        if (!form?.id || !window.confirm("Supprimer cet événement ?")) return;
        setSaving(true);
        try {
            await deleteCalendarEvent(form.id);
            setForm(null);
            await loadEvents();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Impossible de supprimer l'événement.");
        } finally {
            setSaving(false);
        }
    }

    async function importFile(file: File | undefined) {
        if (!file) return;
        setNotice("");
        setError("");
        try {
            const result = await importCalendarFile(sourceKey, file);
            setNotice(`${result.imported} événement(s) importé(s).`);
            await loadEvents();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Import impossible.");
        }
    }

    async function synchronize() {
        if (!sourceUrl.trim()) return;
        setNotice("");
        setError("");
        try {
            const result = await syncCalendarSource(sourceKey, sourceUrl.trim());
            setNotice(`${result.added} ajouté(s), ${result.changed} modifié(s), ${result.removed} supprimé(s).`);
            await loadCourseChoices();
            await loadEvents();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Synchronisation impossible.");
        }
    }

    return (
        <section className="space-y-5">
            <div
                className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Mon emploi du temps</h2>
                    <p className="mt-1 text-sm text-slate-500">
                        {week.toLocaleDateString("fr-FR", {day: "numeric", month: "long"})} -{" "}
                        {new Date(weekEnd.getTime() - 1).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                        })}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => setWeek(startOfWeek(new Date()))}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                        Aujourd&apos;hui
                    </button>
                    <button onClick={() => shiftWeek(-1)} aria-label="Semaine précédente"
                            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
                        <ChevronLeft size={17}/>
                    </button>
                    <button onClick={() => shiftWeek(1)} aria-label="Semaine suivante"
                            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
                        <ChevronRight size={17}/>
                    </button>
                    <button onClick={() => setForm(emptyForm())}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700">
                        <Plus size={15}/> Ajouter
                    </button>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
                    <label className="flex items-center gap-2 text-xs text-slate-500">
                        Source
                        <input value={sourceKey} onChange={(event) => setSourceKey(event.target.value)}
                               className="w-36 rounded-lg border border-slate-200 px-2.5 py-2 text-xs"/>
                    </label>
                    <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-slate-500">
                        URL ICS
                        <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)}
                               placeholder="https://..."
                               className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs"/>
                    </label>
                    <button onClick={() => void synchronize()} disabled={!sourceUrl.trim()}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                        <RefreshCw size={14}/> Synchroniser
                    </button>
                    <label
                        className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                        <FileUp size={14}/> Importer ICS
                        <input type="file" accept=".ics,.ical,text/calendar" className="hidden"
                               onChange={(event) => void importFile(event.target.files?.[0])}/>
                    </label>
                </div>

                {(error || notice) && (
                    <div
                        className={`mb-4 rounded-lg px-3 py-2 text-xs ${error ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {error || notice}
                    </div>
                )}

                {courseChoices.length > 0 && (
                    <div className="mb-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <p className="mb-2 text-xs font-semibold text-slate-700">Cours suivis</p>
                        {choicesLoading ? (
                            <p className="text-xs text-slate-500">Chargement...</p>
                        ) : (
                            <div className="flex flex-wrap gap-x-4 gap-y-2">
                                {courseChoices.map((choice) => (
                                    <label key={choice.course}
                                           className="flex items-center gap-2 text-xs text-slate-600">
                                        <input
                                            type="checkbox"
                                            checked={choice.enabled}
                                            onChange={async (event) => {
                                                try {
                                                    const updated = await updateCourseChoice(
                                                        sourceKey,
                                                        choice.course,
                                                        event.target.checked
                                                    );
                                                    setCourseChoices((current) =>
                                                        current.map((item) =>
                                                            item.course === updated.course ? updated : item
                                                        )
                                                    );
                                                    await loadEvents();
                                                } catch (caught) {
                                                    setError(caught instanceof Error ? caught.message : "Impossible de modifier le cours.");
                                                }
                                            }}
                                        />
                                        {choice.course}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="overflow-x-auto">
                    <div className="min-w-[900px]">
                        <div className="grid grid-cols-[64px_repeat(7,minmax(110px,1fr))] border-b border-slate-100">
                            <div/>
                            {days.map((day) => (
                                <div key={day.toISOString()}
                                     className="border-l border-slate-100 px-2 pb-3 text-center">
                                    <p className="text-[10px] font-semibold uppercase text-slate-400">{day.toLocaleDateString("fr-FR", {weekday: "short"})}</p>
                                    <p className="mt-1 text-lg font-bold text-slate-800">{day.getDate()}</p>
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-[64px_repeat(7,minmax(110px,1fr))]">
                            <div className="relative" style={{height: (DAY_END - DAY_START) * HOUR_HEIGHT}}>
                                {Array.from({length: DAY_END - DAY_START}, (_, index) => (
                                    <span key={index} className="absolute right-2 text-[10px] text-slate-400"
                                          style={{top: index * HOUR_HEIGHT - 7}}>
                    {String(DAY_START + index).padStart(2, "0")}:00
                  </span>
                                ))}
                            </div>
                            {days.map((day) => {
                                const dayEvents = events.filter((event) => new Date(event.start_at).toDateString() === day.toDateString());
                                return (
                                    <div key={day.toISOString()} className="relative border-l border-slate-100"
                                         style={{height: (DAY_END - DAY_START) * HOUR_HEIGHT}}>
                                        {Array.from({length: DAY_END - DAY_START + 1}, (_, index) => (
                                            <div key={index} className="absolute inset-x-0 border-t border-slate-100"
                                                 style={{top: index * HOUR_HEIGHT}}/>
                                        ))}
                                        {dayEvents.map((event) => {
                                            const start = new Date(event.start_at);
                                            const end = new Date(event.end_at);
                                            const top = ((start.getHours() + start.getMinutes() / 60) - DAY_START) * HOUR_HEIGHT;
                                            const height = Math.max(34, (end.getTime() - start.getTime()) / 3600000 * HOUR_HEIGHT - 4);
                                            return (
                                                <button key={event.id} onClick={() => openEvent(event)}
                                                        className={`absolute inset-x-1 z-10 overflow-hidden rounded-lg border p-2 text-left text-[11px] shadow-sm ${eventColor(event)}`}
                                                        style={{top: Math.max(0, top), height}}>
                                                    <strong
                                                        className="block truncate text-slate-800">{event.title}</strong>
                                                    <span
                                                        className="block truncate text-slate-600">{event.course}{event.location ? ` · ${event.location}` : ""}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                {loading && <p className="pt-4 text-center text-xs text-slate-400">Chargement du planning...</p>}
                {!loading && events.length === 0 &&
                    <p className="pt-4 text-center text-xs text-slate-400">Aucun événement cette semaine.</p>}
            </div>

            {form && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4">
                    <form onSubmit={(event) => void submitEvent(event)}
                          className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-slate-900">{form.id ? "Modifier l'événement" : "Nouvel événement"}</h3>
                            <button type="button" onClick={() => setForm(null)} aria-label="Fermer"><X size={18}/>
                            </button>
                        </div>
                        <input required value={form.title}
                               onChange={(event) => setForm({...form, title: event.target.value})} placeholder="Titre"
                               className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="text-xs text-slate-500">Début<input required type="datetime-local"
                                                                                  value={form.start_at}
                                                                                  onChange={(event) => setForm({
                                                                                      ...form,
                                                                                      start_at: event.target.value
                                                                                  })}
                                                                                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs"/></label>
                            <label className="text-xs text-slate-500">Fin<input required type="datetime-local"
                                                                                value={form.end_at}
                                                                                onChange={(event) => setForm({
                                                                                    ...form,
                                                                                    end_at: event.target.value
                                                                                })}
                                                                                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs"/></label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <input value={form.course}
                                   onChange={(event) => setForm({...form, course: event.target.value})}
                                   placeholder="Cours"
                                   className="rounded-lg border border-slate-200 px-3 py-2 text-sm"/>
                            <input value={form.subject}
                                   onChange={(event) => setForm({...form, subject: event.target.value})}
                                   placeholder="Matière"
                                   className="rounded-lg border border-slate-200 px-3 py-2 text-sm"/>
                            <input value={form.location}
                                   onChange={(event) => setForm({...form, location: event.target.value})}
                                   placeholder="Salle"
                                   className="rounded-lg border border-slate-200 px-3 py-2 text-sm"/>
                            <input value={form.description}
                                   onChange={(event) => setForm({...form, description: event.target.value})}
                                   placeholder="Description"
                                   className="rounded-lg border border-slate-200 px-3 py-2 text-sm"/>
                        </div>
                        <div className="flex justify-between gap-2">
                            {form.id ? <button type="button" onClick={() => void removeEvent()}
                                               className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50">
                                <Trash2 size={14}/> Supprimer</button> : <span/>}
                            <button disabled={saving}
                                    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? "Enregistrement..." : "Enregistrer"}</button>
                        </div>
                    </form>
                </div>
            )}
        </section>
    );
}
