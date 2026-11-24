export type ChatMessage = {
    role: "user" | "assistant";
    content: string;
};

export type ChatResponse = {
    text: string;
    tool_calls: string[];
};

async function sendChatBody(body: object): Promise<ChatResponse> {
    const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null) as
        | ChatResponse
        | { detail?: { message?: string } | string; error?: string }
        | null;

    if (!response.ok) {
        const detail = data && "detail" in data ? data.detail : undefined;
        const message =
            typeof detail === "object" && detail?.message
                ? detail.message
                : typeof detail === "string"
                    ? detail
                    : data && "error" in data
                        ? data.error
                        : "L'assistant est temporairement indisponible.";
        throw new Error(message);
    }
    return data as ChatResponse;
}

export async function sendAssistantMessage(message: string): Promise<ChatResponse> {
    return sendChatBody({message});
}

export async function sendAssistantHistory(
    history: ChatMessage[]
): Promise<ChatResponse> {
    return sendChatBody({history});
}
