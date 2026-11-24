import {proxyCalendarRequest} from "@/lib/calendar-proxy";

export async function GET(request: Request) {
    const url = new URL(request.url);
    return proxyCalendarRequest(`/api/calendar/events${url.search}`);
}

export async function POST(request: Request) {
    return proxyCalendarRequest("/api/calendar/events", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: await request.text(),
    });
}
