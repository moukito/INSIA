export type CalendarEvent = {
    id: number;
    owner_id: number;
    uid: string;
    source_key: string;
    course: string;
    subject: string;
    title: string;
    start_at: string;
    end_at: string;
    location: string;
    description: string;
};

export type EventInput = {
    title: string;
    start_at: string;
    end_at: string;
    course?: string;
    subject?: string;
    location?: string;
    description?: string;
};

export type EventUpdate = Partial<EventInput>;

export type ImportResult = {
    imported: number;
    courses: string[];
};

export type SyncResult = {
    source: string;
    added: number;
    changed: number;
    removed: number;
    unknown_courses: string[];
};

export type CourseChoice = {
    course: string;
    enabled: boolean;
};

async function parseResponse<T>(response: Response): Promise<T> {
    const data = (await response.json().catch(() => null)) as
        | T
        | { detail?: string; error?: string }
        | null;
    if (!response.ok) {
        const message =
            data && typeof data === "object" && ("detail" in data || "error" in data)
                ? String(data.detail ?? data.error)
                : "Une erreur est survenue avec le calendrier.";
        throw new Error(message);
    }
    return data as T;
}

export async function fetchCalendarEvents(
    start: Date,
    end: Date
): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({
        start: start.toISOString(),
        end: end.toISOString(),
    });
    return parseResponse(await fetch(`/api/calendar/events?${params}`));
}

export async function createCalendarEvent(
    input: EventInput
): Promise<CalendarEvent> {
    return parseResponse(
        await fetch("/api/calendar/events", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(input),
        })
    );
}

export async function updateCalendarEvent(
    id: number,
    input: EventUpdate
): Promise<CalendarEvent> {
    return parseResponse(
        await fetch(`/api/calendar/events/${id}`, {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(input),
        })
    );
}

export async function deleteCalendarEvent(id: number): Promise<void> {
    const response = await fetch(`/api/calendar/events/${id}`, {
        method: "DELETE",
    });
    if (!response.ok) {
        await parseResponse(response);
    }
}

export async function importCalendarFile(
    sourceKey: string,
    file: File
): Promise<ImportResult> {
    const body = new FormData();
    body.append("file", file);
    return parseResponse(
        await fetch(`/api/calendar/sources/${encodeURIComponent(sourceKey)}/import`, {
            method: "POST",
            body,
        })
    );
}

export async function syncCalendarSource(
    sourceKey: string,
    url: string
): Promise<SyncResult> {
    return parseResponse(
        await fetch(`/api/calendar/sources/${encodeURIComponent(sourceKey)}/sync`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({url}),
        })
    );
}

export async function fetchCourseChoices(sourceKey: string): Promise<CourseChoice[]> {
    return parseResponse(
        await fetch(`/api/calendar/sources/${encodeURIComponent(sourceKey)}/courses`)
    );
}

export async function updateCourseChoice(
    sourceKey: string,
    course: string,
    enabled: boolean
): Promise<CourseChoice> {
    return parseResponse(
        await fetch(
            `/api/calendar/sources/${encodeURIComponent(sourceKey)}/courses/${encodeURIComponent(course)}`,
            {
                method: "PATCH",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({enabled}),
            }
        )
    );
}
