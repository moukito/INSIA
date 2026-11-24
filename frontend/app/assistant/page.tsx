"use client";

import {FormEvent, useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowLeft, Bot, CalendarPlus, Circle, LoaderCircle, Send, Sparkles, Wrench,} from "lucide-react";
import {ChatMessage, sendAssistantHistory} from "@/lib/assistant-api";

type DisplayMessage = ChatMessage & {
    toolCalls?: string[];
};

export default function AssistantPage() {
    const router = useRouter();
    const [messages, setMessages] = useState<DisplayMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const started = useRef(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({behavior: "smooth"});
    }, [messages, loading]);

    useEffect(() => {
        if (started.current) return;
        started.current = true;
        const initial = new URLSearchParams(window.location.search).get("message");
        if (initial?.trim()) {
            void submitMessage(initial.trim(), []);
        }
    }, []);

    async function submitMessage(
        content: string,
        currentMessages: DisplayMessage[]
    ) {
        const trimmed = content.trim();
        if (!trimmed || loading) return;

        const nextMessages: DisplayMessage[] = [
            ...currentMessages,
            {role: "user", content: trimmed},
        ];
        setMessages(nextMessages);
        setInput("");
        setError("");
        setLoading(true);

        try {
            const history = nextMessages.map(({role, content: text}) => ({
                role,
                content: text,
            }));
            const response = await sendAssistantHistory(history);
            setMessages([
                ...nextMessages,
                {
                    role: "assistant",
                    content: response.text,
                    toolCalls: response.tool_calls,
                },
            ]);
        } catch (requestError) {
            setError(
                requestError instanceof Error
                    ? requestError.message
                    : "L'assistant est temporairement indisponible."
            );
        } finally {
            setLoading(false);
        }
    }

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        void submitMessage(input, messages);
    }

    return (
        <main className="min-h-screen bg-slate-50 text-slate-900">
            <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-5 sm:px-7 sm:py-7">
                <header className="mb-5 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => router.push("/")}
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900"
                    >
                        <ArrowLeft size={18}/>
                        Tableau de bord
                    </button>
                    <div
                        className="hidden items-center gap-2 rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 sm:flex">
                        <Circle size={7} fill="currentColor"/>
                        Assistant en ligne
                    </div>
                </header>

                <section
                    className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
                    <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-7">
                        <div
                            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                            <Sparkles size={22}/>
                        </div>
                        <div>
                            <h1 className="font-bold text-slate-900">Assistant étudiant</h1>
                            <p className="mt-0.5 text-xs text-slate-500">
                                Planning, cours et vie étudiante
                            </p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-7">
                        {messages.length === 0 && !loading && (
                            <div className="mx-auto flex max-w-md flex-col items-center py-14 text-center">
                                <div
                                    className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-100 text-violet-700">
                                    <Bot size={30}/>
                                </div>
                                <h2 className="text-lg font-bold">Comment puis-je t'aider ?</h2>
                                <p className="mt-2 text-sm leading-6 text-slate-500">
                                    Consulte ton planning ou demande-moi d'ajouter un événement.
                                </p>
                            </div>
                        )}

                        <div className="space-y-5">
                            {messages.map((message, index) => (
                                <div
                                    key={`${message.role}-${index}`}
                                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                                >
                                    <div className="max-w-[85%] sm:max-w-[72%]">
                                        {message.role === "assistant" && (
                                            <div
                                                className="mb-2 flex items-center gap-2 text-xs font-semibold text-violet-700">
                                                <Sparkles size={13}/>
                                                Assistant
                                            </div>
                                        )}
                                        <div
                                            className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                                                message.role === "user"
                                                    ? "bg-violet-600 text-white"
                                                    : "bg-slate-100 text-slate-800"
                                            }`}
                                        >
                                            {message.content}
                                        </div>
                                        {(message.toolCalls?.length ?? 0) > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {(message.toolCalls ?? []).map((tool, toolIndex) => (
                                                    <span
                                                        key={`${tool}-${toolIndex}`}
                                                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
                                                    >
                                                        {tool.includes("create")
                                                            ? <CalendarPlus size={12}/>
                                                            : <Wrench size={12}/>}
                                                        {tool}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {loading && (
                                <div className="flex justify-start">
                                    <div
                                        className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500">
                                        <LoaderCircle size={16} className="animate-spin"/>
                                        Je réfléchis...
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div
                                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                    {error}
                                </div>
                            )}
                            <div ref={bottomRef}/>
                        </div>
                    </div>

                    <form
                        onSubmit={handleSubmit}
                        className="border-t border-slate-100 p-4 sm:px-7 sm:py-5"
                    >
                        <div
                            className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100">
                            <textarea
                                value={input}
                                onChange={(event) => setInput(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" && !event.shiftKey) {
                                        event.preventDefault();
                                        void submitMessage(input, messages);
                                    }
                                }}
                                rows={1}
                                placeholder="Pose ta question..."
                                className="min-h-10 max-h-32 min-w-0 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-slate-400"
                            />
                            <button
                                type="submit"
                                disabled={loading || !input.trim()}
                                aria-label="Envoyer"
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <Send size={17}/>
                            </button>
                        </div>
                    </form>
                </section>
            </div>
        </main>
    );
}
