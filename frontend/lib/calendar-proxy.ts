const backendUrl = process.env.BACKEND_API_URL ?? "http://localhost:8000";

function ownerId(): string {
    const value = process.env.NEXT_PUBLIC_OWNER_ID;
    if (!value || !/^[1-9]\d*$/.test(value)) {
        throw new Error("NEXT_PUBLIC_OWNER_ID doit être un entier positif.");
    }
    return value;
}

export async function proxyCalendarRequest(
    path: string,
    init: RequestInit = {}
): Promise<Response> {
    try {
        const headers = new Headers(init.headers);
        headers.set("X-Owner-ID", ownerId());
        const response = await fetch(`${backendUrl}${path}`, {
            ...init,
            headers,
            cache: "no-store",
        });
        const responseHeaders = new Headers();
        const contentType = response.headers.get("content-type");
        if (contentType) responseHeaders.set("content-type", contentType);
        return new Response(response.body, {
            status: response.status,
            headers: responseHeaders,
        });
    } catch (error) {
        console.error("Calendar backend error:", error);
        return Response.json(
            {error: "Le service calendrier est indisponible."},
            {status: 502}
        );
    }
}
