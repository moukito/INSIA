import {proxyCalendarRequest} from "@/lib/calendar-proxy";

export async function POST(
    request: Request,
    {params}: { params: Promise<{ sourceKey: string }> }
) {
    const {sourceKey} = await params;
    return proxyCalendarRequest(
        `/api/calendar/sources/${encodeURIComponent(sourceKey)}/sync`,
        {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: await request.text(),
        }
    );
}
