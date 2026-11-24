import {proxyCalendarRequest} from "@/lib/calendar-proxy";

export async function POST(
    request: Request,
    {params}: { params: Promise<{ sourceKey: string }> }
) {
    const {sourceKey} = await params;
    const formData = await request.formData();
    const body = new FormData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
        return Response.json({error: "Un fichier ICS est requis."}, {status: 400});
    }
    body.append("file", file, file.name);
    return proxyCalendarRequest(
        `/api/calendar/sources/${encodeURIComponent(sourceKey)}/import`,
        {method: "POST", body}
    );
}
