import {proxyCalendarRequest} from "@/lib/calendar-proxy";

export async function PATCH(
    request: Request,
    {params}: { params: Promise<{ sourceKey: string; course: string }> }
) {
    const {sourceKey, course} = await params;
    return proxyCalendarRequest(
        `/api/calendar/sources/${encodeURIComponent(sourceKey)}/courses/${encodeURIComponent(course)}`,
        {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: await request.text(),
        }
    );
}
