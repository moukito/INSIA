import {proxyCalendarRequest} from "@/lib/calendar-proxy";

export async function GET(
    _request: Request,
    {params}: { params: Promise<{ sourceKey: string }> }
) {
    const {sourceKey} = await params;
    return proxyCalendarRequest(
        `/api/calendar/sources/${encodeURIComponent(sourceKey)}/courses`,
        {method: "GET"}
    );
}
