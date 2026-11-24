import {proxyCalendarRequest} from "@/lib/calendar-proxy";

function eventPath(id: string): string | null {
    if (!/^[1-9]\d*$/.test(id)) return null;
    return `/api/calendar/events/${id}`;
}

export async function PATCH(
    request: Request,
    {params}: { params: Promise<{ id: string }> }
) {
    const path = eventPath((await params).id);
    if (!path) return Response.json({error: "Identifiant invalide."}, {status: 400});
    return proxyCalendarRequest(path, {
        method: "PATCH",
        headers: {"Content-Type": "application/json"},
        body: await request.text(),
    });
}

export async function DELETE(
    _request: Request,
    {params}: { params: Promise<{ id: string }> }
) {
    const path = eventPath((await params).id);
    if (!path) return Response.json({error: "Identifiant invalide."}, {status: 400});
    return proxyCalendarRequest(path, {method: "DELETE"});
}
