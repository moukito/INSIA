import {proxyCalendarRequest} from "@/lib/calendar-proxy";

export async function POST(request: Request) {
    return proxyCalendarRequest("/api/ai/chat", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: await request.text(),
    });
}
