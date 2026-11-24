"use client";

import {FormEvent, Suspense, useEffect, useRef, useState} from "react";
import {useRouter, useSearchParams} from "next/navigation";
import {
    Bot,
    CalendarDays,
    CalendarPlus,
    CheckSquare,
    Circle,
    Compass,
    GraduationCap,
    LayoutDashboard,
    LoaderCircle,
    Mail,
    Menu,
    Send,
    Settings,
    Sparkles,
    Users,
    Wrench,
    X,
} from "lucide-react";
import {ChatMessage, sendAssistantHistory} from "@/lib/assistant-api";

type DisplayMessage = ChatMessage & {
    toolCalls?: string[];
};

const navigation = [
    {label: "Tableau de bord", icon: LayoutDashboard, href: "/"},
    {label: "Mon planning", icon: CalendarDays, href: "/?view=planning"},
    {label: "Mes tâches", icon: CheckSquare, href: "/?view=tasks"},
    {label: "Mes emails", icon: Mail, href: "/?view=emails"},
    {label: "Orientation", icon: Compass, href: "/?view=orientation"},
    {label: "Associations", icon: Users, href: "/?view=associations"},
    {label: "Assistant IA", icon: Sparkles, href: "/assistant"},
];

function AssistantContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [messages, setMessages] = useState<DisplayMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [mobileOpen, setMobileOpen] = useState(false);
    const processedMessage = useRef("");
    const loadingRef = useRef(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({behavior: "smooth"});
    }, [messages, loading]);

    useEffect(() => {
        const initial = searchParams.get("message")?.trim();
        if (!initial || processedMessage.current === initial) return;
        processedMessage.current = initial;
        void submitMessage(initial, []);
    }, [searchParams]);

    async function submitMessage(
        content: string,
        currentMessages: DisplayMessage[]
    ) {
        const trimmed = content.trim();
        if (!trimmed || loadingRef.current) return;

        const nextMessages: DisplayMessage[] = [
            ...currentMessages,
            {role: "user", content: trimmed},
        ];
        setMessages(nextMessages);
        setInput("");
        setError("");
        loadingRef.current = true;
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
            loadingRef.current = false;
            setLoading(false);
        }
    }

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        void submitMessage(input, messages);
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            {mobileOpen && (
                <button
                    aria-label="Fermer le menu"
                    onClick={() => setMobileOpen(false)}
                    className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden"
                />
            )}

            <aside
                className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ${
                    mobileOpen ? "translate-x-0" : "-translate-x-full"
                } lg:translate-x-0`}
            >
                <div className="flex h-[84px] items-center gap-3 px-6">
                    <div
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                        <GraduationCap size={24}/>
                    </div>
                    <div>
                        <p className="text-lg font-bold tracking-tight text-slate-900">CampusFlow</p>
                        <p className="text-xs text-slate-400">Ton campus, simplement.</p>
                    </div>
                    <button
                        onClick={() => setMobileOpen(false)}
                        className="ml-auto rounded-lg p-2 text-slate-500 lg:hidden"
                        aria-label="Fermer"
                    >
                        <X size={20}/>
                    </button>
                </div>

                <div className="px-4 pt-5">
                    <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Espace étudiant
                    </p>
                    <nav className="space-y-1">
                        {navigation.map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.label}
                                    onClick={() => {
                                        setMobileOpen(false);
                                        router.push(item.href);
                                    }}
                                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                                        item.label === "Assistant IA"
                                            ? "bg-indigo-50 text-indigo-700"
                                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                    }`}
                                >
                                    <Icon size={19}/>
                                    <span className="flex-1">{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </div>

                <div className="mt-auto p-4">
                    <button
                        onClick={() => router.push("/?view=settings")}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-500 hover:bg-slate-50"
                    >
                        <Settings size={19}/> Paramètres
                    </button>
                </div>
            </aside>

            <main className="min-h-screen lg:ml-64">
                <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-5 sm:px-7 sm:py-7">
                    <header className="mb-5 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => setMobileOpen(true)}
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 lg:hidden"
                            aria-label="Ouvrir le menu"
                        >
                            <Menu size={20}/>
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
        </div>
    );
}

export default function AssistantPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-50"/>}>
            <AssistantContent/>
        </Suspense>
    );
}
