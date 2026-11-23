"use client";

import { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  CheckSquare,
  Mail,
  Compass,
  Users,
  Settings,
  Search,
  Bell,
  ChevronRight,
  ChevronLeft,
  Clock,
  MapPin,
  ArrowUpRight,
  Circle,
  CheckCircle2,
  Sparkles,
  GraduationCap,
  Plus,
  Menu,
  X,
  Send,
  BookOpen,
  MoreHorizontal,
  Briefcase,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Reply,
  Paperclip,
  Maximize2,
  Calendar,
  FileText,
  Inbox,
  Filter,
} from "lucide-react";
import { EmailCategory, CATEGORIES } from "@/lib/email-classifier";
import { EmailCategoryBadge } from "@/components/EmailCategoryBadge";
import { EmailViewerModal, EmailDetailData } from "@/components/EmailViewerModal";
import { FormattedEmailBody } from "@/components/FormattedEmailBody";

export type EmailItem = {
  id: number;
  subject: string;
  from: string;
  fromAddress: string;
  to: string;
  date: string | null;
  unread: boolean;
  category: EmailCategory;
};

const navigation = [
  { label: "Tableau de bord", icon: LayoutDashboard },
  { label: "Mon planning", icon: CalendarDays },
  { label: "Mes tâches", icon: CheckSquare, count: "4" },
  { label: "Mes emails", icon: Mail },
  { label: "Orientation", icon: Compass },
  { label: "Associations", icon: Users },
];

const initialTasks = [
  {
    id: 1,
    title: "Terminer le compte rendu de TP",
    course: "Informatique",
    due: "Aujourd'hui",
    priority: "Urgent",
    done: false,
  },
  {
    id: 2,
    title: "Réviser les exercices d'algèbre",
    course: "Mathématiques",
    due: "Demain",
    priority: "Normal",
    done: false,
  },
  {
    id: 3,
    title: "Envoyer le travail de groupe",
    course: "Projet P2I",
    due: "23 oct.",
    priority: "Normal",
    done: false,
  },
  {
    id: 4,
    title: "Lire le chapitre sur les réseaux",
    course: "Informatique",
    due: "25 oct.",
    priority: "Normal",
    done: true,
  },
];

const courses = [
  {
    time: "10:00",
    end: "12:00",
    name: "Mathématiques",
    detail: "Cours magistral",
    room: "Amphi à confirmer",
    color: "bg-violet-500",
    light: "bg-violet-50",
    text: "text-violet-700",
  },
  {
    time: "13:30",
    end: "15:00",
    name: "Informatique",
    detail: "Travaux pratiques",
    room: "Salle à confirmer",
    color: "bg-blue-500",
    light: "bg-blue-50",
    text: "text-blue-700",
  },
  {
    time: "15:15",
    end: "17:00",
    name: "Anglais",
    detail: "Cours de langue",
    room: "Salle à confirmer",
    color: "bg-emerald-500",
    light: "bg-emerald-50",
    text: "text-emerald-700",
  },
];

const events = [
  {
    day: "24",
    month: "OCT",
    title: "Forum des associations",
    place: "Vie étudiante",
    color: "bg-orange-100 text-orange-700",
  },
  {
    day: "27",
    month: "OCT",
    title: "Conférence innovation",
    place: "Événement campus",
    color: "bg-indigo-100 text-indigo-700",
  },
];

function formatMailDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  if (isYesterday) {
    return "Hier " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState(initialTasks);
  const [activeNav, setActiveNav] = useState("Tableau de bord");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [assistantMessage, setAssistantMessage] = useState("");

  // État des emails
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({
    all: 0,
    stage: 0,
    urgence: 0,
    association: 0,
    cours: 0,
    autre: 0,
  });
  const [mailLoading, setMailLoading] = useState(true);
  const [mailError, setMailError] = useState("");

  // Filtres
  const [dashboardCategory, setDashboardCategory] = useState<"all" | EmailCategory>("all");
  const [mailboxCategory, setMailboxCategory] = useState<"all" | EmailCategory>("all");
  const [emailSearchQuery, setEmailSearchQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  // Email sélectionné (pour modal ou panneau droit)
  const [selectedModalEmailId, setSelectedModalEmailId] = useState<number | null>(null);
  const [selectedMailboxEmailId, setSelectedMailboxEmailId] = useState<number | null>(null);
  const [activeDetail, setActiveDetail] = useState<EmailDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [showImages, setShowImages] = useState(false);

  // Récupération de la liste des emails
  function fetchEmails() {
    setMailLoading(true);
    setMailError("");
    fetch("/api/emails")
      .then((res) => {
        if (!res.ok) throw new Error("Erreur de connexion au serveur IMAP");
        return res.json();
      })
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setEmails(data.emails || []);
        setUnreadCount(data.unreadCount || 0);
        if (data.categoryCounts) {
          setCategoryCounts(data.categoryCounts);
        }
      })
      .catch((e) => setMailError(e.message))
      .finally(() => setMailLoading(false));
  }

  useEffect(() => {
    fetchEmails();
  }, []);

  // Charger le détail de l'email sélectionné dans le panneau de droite de "Mes emails"
  useEffect(() => {
    if (!selectedMailboxEmailId) {
      setActiveDetail(null);
      return;
    }

    setDetailLoading(true);
    setDetailError("");
    setShowImages(false);

    fetch(`/api/emails/${selectedMailboxEmailId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setActiveDetail(data);
      })
      .catch((e) => setDetailError(e.message))
      .finally(() => setDetailLoading(false));
  }, [selectedMailboxEmailId]);

  // Si on est dans "Mes emails" et qu'aucun email n'est sélectionné, présélectionner le premier
  useEffect(() => {
    if (activeNav === "Mes emails" && emails.length > 0 && !selectedMailboxEmailId) {
      setSelectedMailboxEmailId(emails[0].id);
    }
  }, [activeNav, emails, selectedMailboxEmailId]);

  const completed = tasks.filter((task) => task.done).length;
  const pending = tasks.filter((task) => !task.done).length;

  function toggleTask(id: number) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task
      )
    );
  }

  function addTask() {
    const title = window.prompt("Quelle tâche souhaites-tu ajouter ?");
    if (!title?.trim()) return;

    setTasks((current) => [
      {
        id: Date.now(),
        title: title.trim(),
        course: "Personnel",
        due: "À planifier",
        priority: "Normal",
        done: false,
      },
      ...current,
    ]);
  }

  function sendMessage() {
    if (!assistantMessage.trim()) return;
    window.alert(
      "L'assistant IA sera connecté au backend dans une prochaine étape. Ton message : " +
        assistantMessage
    );
    setAssistantMessage("");
  }

  // Marquer comme lu localement
  function handleMarkAsRead(id: number) {
    setEmails((prev) =>
      prev.map((m) => (m.id === id ? { ...m, unread: false } : m))
    );
  }

  // Filtrage des emails pour le Dashboard
  const dashboardFilteredEmails = useMemo(() => {
    let list = emails;
    if (dashboardCategory !== "all") {
      list = list.filter((m) => m.category === dashboardCategory);
    }
    return list.slice(0, 6); // 6 emails sur le dashboard
  }, [emails, dashboardCategory]);

  // Filtrage des emails pour la page "Mes emails"
  const mailboxFilteredEmails = useMemo(() => {
    return emails.filter((m) => {
      const matchCat =
        mailboxCategory === "all" ? true : m.category === mailboxCategory;
      const matchUnread = unreadOnly ? m.unread : true;
      const matchQuery =
        !emailSearchQuery.trim() ||
        `${m.subject} ${m.from} ${m.fromAddress}`
          .toLowerCase()
          .includes(emailSearchQuery.toLowerCase());
      return matchCat && matchUnread && matchQuery;
    });
  }, [emails, mailboxCategory, unreadOnly, emailSearchQuery]);

  const filteredTasks = tasks.filter((task) =>
    `${task.title} ${task.course}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-800">
      {/* Modale plein écran de lecture d'email (accessible partout) */}
      <EmailViewerModal
        emailId={selectedModalEmailId}
        onClose={() => setSelectedModalEmailId(null)}
        onMarkAsRead={handleMarkAsRead}
      />

      {mobileOpen && (
        <button
          aria-label="Fermer le menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden"
        />
      )}

      {/* Barre latérale */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex h-[84px] items-center gap-3 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
            <GraduationCap size={24} />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight text-slate-900">
              CampusFlow
            </p>
            <p className="text-xs text-slate-400">Ton campus, simplement.</p>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto rounded-lg p-2 text-slate-500 lg:hidden"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-4 pt-5">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Espace étudiant
          </p>
          <nav className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = activeNav === item.label;
              const count =
                item.label === "Mes emails"
                  ? unreadCount > 0
                    ? String(unreadCount)
                    : undefined
                  : item.count;
              return (
                <button
                  key={item.label}
                  onClick={() => {
                    setActiveNav(item.label);
                    setMobileOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                    active
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon size={19} />
                  <span className="flex-1">{item.label}</span>
                  {count && (
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs ${
                        active
                          ? "bg-white text-indigo-700 font-semibold"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-4">
          <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-4 text-white">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <Sparkles size={20} />
            </div>
            <p className="text-sm font-semibold">Besoin d'un coup de main ?</p>
            <p className="mt-1 text-xs leading-5 text-indigo-100">
              Ton assistant étudiant t'aide à t'organiser.
            </p>
            <button
              onClick={() => {
                setActiveNav("Assistant IA");
                setMobileOpen(false);
              }}
              className="mt-4 flex w-full items-center justify-between rounded-lg bg-white px-3 py-2.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
            >
              Découvrir l'assistant <ArrowUpRight size={15} />
            </button>
          </div>

          <button
            onClick={() => setActiveNav("Paramètres")}
            className="mt-4 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-500 hover:bg-slate-50"
          >
            <Settings size={19} /> Paramètres
          </button>

          <div className="mt-3 flex items-center gap-3 border-t border-slate-100 px-2 pt-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-800">
              OK
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">
                Omeima Kotti
              </p>
              <p className="text-xs text-slate-400">5TC · INSA Lyon</p>
            </div>
            <MoreHorizontal size={19} className="text-slate-400" />
          </div>
        </div>
      </aside>

      <main className="min-h-screen lg:pl-64">
        {/* Barre du haut */}
        <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu size={22} />
            </button>
            <div className="hidden items-center gap-2 text-sm text-slate-400 sm:flex">
              <span>CampusFlow</span>
              <ChevronRight size={15} />
            </div>
            <h1 className="truncate text-sm font-semibold text-slate-800 sm:text-base">
              {activeNav}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <label className="hidden h-10 w-56 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 md:flex">
              <Search size={17} className="text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher une tâche..."
                className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400"
              />
              <span className="text-[10px] text-slate-400">⌘ K</span>
            </label>
            <button
              aria-label="Rafraîchir"
              onClick={fetchEmails}
              title="Rafraîchir les emails"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition"
            >
              <RefreshCw size={17} className={mailLoading ? "animate-spin text-indigo-600" : ""} />
            </button>
            <button
              aria-label="Notifications"
              onClick={() => window.alert("Pas de nouvelle notification.")}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            >
              <Bell size={19} />
              {unreadCount > 0 && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-rose-500" />
              )}
            </button>
            <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800 sm:flex">
              OK
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] space-y-7 p-4 sm:p-8">
          {/* ============================================================== */}
          {/* VUE TABLEAU DE BORD (AVEC SECTION EMAILS SÉPARÉS PAR CATÉGORIE) */}
          {/* ============================================================== */}
          {activeNav !== "Mes emails" && (
            <>
              {/* Bannière de bienvenue */}
              <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-600 p-6 text-white shadow-xl shadow-indigo-100 sm:p-9">
                <div className="pointer-events-none absolute -right-8 -top-24 h-72 w-72 rounded-full border-[42px] border-white/5" />
                <div className="pointer-events-none absolute -bottom-28 right-48 h-56 w-56 rounded-full bg-violet-400/20 blur-3xl" />
                <div className="relative max-w-2xl">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-indigo-50">
                    <Sparkles size={14} /> Ton espace étudiant INSA Lyon
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    Bonjour Omeima ! <span>👋</span>
                  </h2>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-indigo-100 sm:text-base">
                    Retrouve ici tes cours, tes stages, tes emails universitaires et
                    la vie associative du campus. Tout au même endroit.
                  </p>
                  <button
                    onClick={() => setActiveNav("Mes emails")}
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
                  >
                    Ouvrir mes emails <ArrowUpRight size={17} />
                  </button>
                </div>
                <div className="absolute bottom-5 right-8 hidden opacity-20 md:block">
                  <GraduationCap size={125} strokeWidth={1} />
                </div>
              </section>

              {/* 4 Cartes de statistiques (Emails à lire est cliquable !) */}
              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  icon={<CalendarDays size={21} />}
                  label="Cours aujourd'hui"
                  value="3"
                  caption="Journée 5TC bien rythmée"
                  color="indigo"
                  onClick={() => setActiveNav("Mon planning")}
                />
                <StatCard
                  icon={<CheckSquare size={21} />}
                  label="Tâches à faire"
                  value={String(pending)}
                  caption={`${completed} tâche${completed > 1 ? "s" : ""} terminée${completed > 1 ? "s" : ""}`}
                  color="emerald"
                  onClick={() => setActiveNav("Mes tâches")}
                />
                <StatCard
                  icon={<Mail size={21} />}
                  label="Emails à lire"
                  value={mailLoading ? "…" : String(unreadCount)}
                  caption="Clique pour ouvrir ta boîte"
                  color="amber"
                  onClick={() => setActiveNav("Mes emails")}
                />
                <StatCard
                  icon={<Users size={21} />}
                  label="Événements à venir"
                  value={String(events.length)}
                  caption="La vie du campus"
                  color="violet"
                  onClick={() => setActiveNav("Associations")}
                />
              </section>

              {/* ============================================================== */}
              {/* NOUVELLE SECTION DÉDIÉE : MES EMAILS RÉCENTS DANS LE DASHBOARD  */}
              {/* SÉPARÉS PAR : TOUS, STAGES, URGENCES, ASSOCIATIONS, COURS       */}
              {/* ============================================================== */}
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-base">
                        Mes emails récents
                      </h3>
                      <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                        Zmail INSA
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Clique sur un email pour l'afficher en format complet et propre.
                    </p>
                  </div>

                  <button
                    onClick={() => setActiveNav("Mes emails")}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
                  >
                    <span>Voir tous les emails</span>
                    <ChevronRight size={15} />
                  </button>
                </div>

                {/* Filtres par catégories demandées : Stage, Urgence, Association, Cours */}
                <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
                  <button
                    onClick={() => setDashboardCategory("all")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      dashboardCategory === "all"
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <Inbox size={14} />
                    <span>Tous</span>
                    <span className="ml-1 opacity-75">({categoryCounts.all || emails.length})</span>
                  </button>

                  <button
                    onClick={() => setDashboardCategory("stage")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      dashboardCategory === "stage"
                        ? "bg-emerald-600 text-white shadow-xs shadow-emerald-200"
                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    <Briefcase size={14} />
                    <span>Emails de stage</span>
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">
                      {categoryCounts.stage || 0}
                    </span>
                  </button>

                  <button
                    onClick={() => setDashboardCategory("urgence")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      dashboardCategory === "urgence"
                        ? "bg-rose-600 text-white shadow-xs shadow-rose-200"
                        : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                    }`}
                  >
                    <AlertTriangle size={14} />
                    <span>Emails d'urgence</span>
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 text-[10px]">
                      {categoryCounts.urgence || 0}
                    </span>
                  </button>

                  <button
                    onClick={() => setDashboardCategory("association")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      dashboardCategory === "association"
                        ? "bg-purple-600 text-white shadow-xs shadow-purple-200"
                        : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                    }`}
                  >
                    <Users size={14} />
                    <span>Emails associations</span>
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 text-[10px]">
                      {categoryCounts.association || 0}
                    </span>
                  </button>

                  <button
                    onClick={() => setDashboardCategory("cours")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      dashboardCategory === "cours"
                        ? "bg-blue-600 text-white shadow-xs shadow-blue-200"
                        : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                    }`}
                  >
                    <GraduationCap size={14} />
                    <span>Cours & Campus</span>
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px]">
                      {categoryCounts.cours || 0}
                    </span>
                  </button>
                </div>

                {/* État de chargement / erreur */}
                {mailLoading && (
                  <div className="py-8 text-center text-xs text-slate-400">
                    <RefreshCw size={20} className="animate-spin mx-auto text-indigo-500 mb-2" />
                    Chargement de tes emails...
                  </div>
                )}

                {mailError && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs">
                    {mailError}
                  </div>
                )}

                {/* Liste des emails dans le tableau de bord */}
                {!mailLoading && !mailError && dashboardFilteredEmails.length === 0 && (
                  <p className="py-6 text-center text-xs text-slate-400">
                    Aucun email trouvé dans cette catégorie.
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {!mailLoading &&
                    !mailError &&
                    dashboardFilteredEmails.map((mail) => {
                      const senderInitials = mail.from
                        .split(/[\s.@_-]+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((w) => w[0]?.toUpperCase())
                        .join("") || "M";

                      return (
                        <button
                          key={mail.id}
                          onClick={() => setSelectedModalEmailId(mail.id)}
                          className="group relative flex items-start gap-3 p-3.5 rounded-xl border border-slate-100 bg-white hover:border-indigo-200 hover:bg-slate-50/70 text-left transition-all shadow-2xs hover:shadow-xs"
                        >
                          {/* Avatar expéditeur */}
                          <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 font-bold text-xs flex items-center justify-center shrink-0 border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition">
                            {senderInitials}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="truncate text-xs font-semibold text-slate-700">
                                {mail.from}
                              </span>
                              <span className="text-[10px] text-slate-400 shrink-0">
                                {formatMailDate(mail.date)}
                              </span>
                            </div>

                            <p
                              className={`text-xs truncate ${
                                mail.unread
                                  ? "font-bold text-slate-900"
                                  : "text-slate-600"
                              }`}
                            >
                              {mail.subject}
                            </p>

                            <div className="mt-2 flex items-center gap-2">
                              <EmailCategoryBadge category={mail.category} size="sm" />
                              {mail.unread && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600">
                                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                                  Non lu
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </section>

              {/* Section Prochains cours et Mes tâches */}
              <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900">Prochains cours</h3>
                      <p className="mt-1 text-xs text-slate-400">
                        Ton aperçu de la journée
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveNav("Mon planning")}
                      className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      Tout voir <ChevronRight size={15} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {courses.map((course) => (
                      <div
                        key={course.time}
                        className="group flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-indigo-100 hover:bg-slate-50 sm:gap-4 sm:p-4"
                      >
                        <div className="w-[58px] shrink-0">
                          <p className="text-sm font-bold text-slate-800">
                            {course.time}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            {course.end}
                          </p>
                        </div>
                        <div className={`h-11 w-1 shrink-0 rounded-full ${course.color}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {course.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {course.detail}
                          </p>
                          <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
                            <MapPin size={12} /> {course.room}
                          </p>
                        </div>
                        <BookOpen
                          size={18}
                          className="hidden text-slate-300 transition group-hover:text-indigo-500 sm:block"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                  <div className="mb-6 flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900">Mes tâches</h3>
                      <p className="mt-1 text-xs text-slate-400">
                        Garde le cap sur tes objectifs
                      </p>
                    </div>
                    <button
                      onClick={addTask}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100"
                      aria-label="Ajouter une tâche"
                      title="Ajouter une tâche"
                    >
                      <Plus size={19} />
                    </button>
                  </div>

                  <div className="mb-5 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">
                      Progression
                    </span>
                    <span className="text-xs font-bold text-indigo-600">
                      {tasks.length
                        ? Math.round((completed / tasks.length) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="mb-5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all"
                      style={{
                        width: `${
                          tasks.length ? (completed / tasks.length) * 100 : 0
                        }%`,
                      }}
                    />
                  </div>

                  <div className="space-y-1">
                    {filteredTasks.slice(0, 5).map((task) => (
                      <button
                        key={task.id}
                        onClick={() => toggleTask(task.id)}
                        className="flex w-full items-start gap-3 rounded-xl p-3 text-left transition hover:bg-slate-50"
                      >
                        <span className="mt-0.5 shrink-0">
                          {task.done ? (
                            <CheckCircle2
                              size={19}
                              className="text-emerald-500"
                            />
                          ) : (
                            <Circle size={19} className="text-slate-300" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-xs font-medium leading-5 ${
                              task.done
                                ? "text-slate-400 line-through"
                                : "text-slate-700"
                            }`}
                          >
                            {task.title}
                          </span>
                          <span className="mt-1 block text-[11px] text-slate-400">
                            {task.course} · {task.due}
                          </span>
                        </span>
                        {!task.done && task.priority === "Urgent" && (
                          <span className="rounded-md bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-600">
                            Urgent
                          </span>
                        )}
                      </button>
                    ))}
                    {filteredTasks.length === 0 && (
                      <p className="py-5 text-center text-xs text-slate-400">
                        Aucune tâche trouvée.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* Section Vie du campus et Assistant IA */}
              <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900">
                        Vie du campus & Associations
                      </h3>
                      <p className="mt-1 text-xs text-slate-400">
                        Les prochains rendez-vous associatifs
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveNav("Associations")}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      Explorer
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {events.map((event) => (
                      <div
                        key={event.title}
                        className="flex gap-4 rounded-xl border border-slate-100 p-4"
                      >
                        <div
                          className={`flex h-[62px] w-[58px] shrink-0 flex-col items-center justify-center rounded-xl ${event.color}`}
                        >
                          <span className="text-xl font-bold leading-6">
                            {event.day}
                          </span>
                          <span className="mt-1 text-[10px] font-bold tracking-wider">
                            {event.month}
                          </span>
                        </div>
                        <div className="min-w-0 self-center">
                          <p className="text-sm font-semibold leading-5 text-slate-800">
                            {event.title}
                          </p>
                          <p className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                            <MapPin size={12} /> {event.place}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-violet-100 sm:p-6">
                  <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-violet-100/70 blur-2xl" />
                  <div className="relative">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                      <Sparkles size={23} />
                    </div>
                    <h3 className="font-bold text-slate-900">
                      Ton assistant étudiant
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Une question sur ton stage, tes cours ou la vie étudiante ?
                    </p>
                    <div className="mt-5 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100">
                      <input
                        value={assistantMessage}
                        onChange={(event) =>
                          setAssistantMessage(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") sendMessage();
                        }}
                        placeholder="Pose ta question..."
                        className="min-w-0 flex-1 bg-transparent px-2 py-2 text-xs outline-none placeholder:text-slate-400"
                      />
                      <button
                        onClick={sendMessage}
                        aria-label="Envoyer"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white transition hover:bg-violet-700"
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ============================================================== */}
          {/* VUE COMPLÈTE : MES EMAILS (BOÎTE DE RÉCEPTION FORMAT NORMAL)   */}
          {/* ============================================================== */}
          {activeNav === "Mes emails" && (
            <section className="space-y-4">
              {/* En-tête de la boîte email */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-900">
                      Boîte de réception
                    </h2>
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                      INSA Lyon Zmail
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Emails synchronisés depuis ta messagerie étudiante
                  </p>
                </div>

                {/* Recherche & Filtre Non lus */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative">
                    <Search
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      value={emailSearchQuery}
                      onChange={(e) => setEmailSearchQuery(e.target.value)}
                      placeholder="Filtrer par sujet ou nom..."
                      className="h-9 w-52 sm:w-64 rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs outline-none focus:border-indigo-500 focus:bg-white transition"
                    />
                  </div>

                  <button
                    onClick={() => setUnreadOnly(!unreadOnly)}
                    className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium border transition ${
                      unreadOnly
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Filter size={13} />
                    <span>Non lus</span>
                  </button>

                  <button
                    onClick={fetchEmails}
                    title="Actualiser les messages"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition"
                  >
                    <RefreshCw size={14} className={mailLoading ? "animate-spin text-indigo-600" : ""} />
                  </button>
                </div>
              </div>

              {/* Onglets de catégories : Tous, Stages, Urgences, Associations, Cours */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setMailboxCategory("all")}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                    mailboxCategory === "all"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Inbox size={14} />
                  <span>Tous</span>
                  <span className="opacity-75">({categoryCounts.all || emails.length})</span>
                </button>

                <button
                  onClick={() => setMailboxCategory("stage")}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                    mailboxCategory === "stage"
                      ? "bg-emerald-600 text-white shadow-xs shadow-emerald-200"
                      : "bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  }`}
                >
                  <Briefcase size={14} />
                  <span>Emails de stage</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">
                    {categoryCounts.stage || 0}
                  </span>
                </button>

                <button
                  onClick={() => setMailboxCategory("urgence")}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                    mailboxCategory === "urgence"
                      ? "bg-rose-600 text-white shadow-xs shadow-rose-200"
                      : "bg-white border border-rose-200 text-rose-700 hover:bg-rose-50"
                  }`}
                >
                  <AlertTriangle size={14} />
                  <span>Emails d'urgence</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px]">
                    {categoryCounts.urgence || 0}
                  </span>
                </button>

                <button
                  onClick={() => setMailboxCategory("association")}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                    mailboxCategory === "association"
                      ? "bg-purple-600 text-white shadow-xs shadow-purple-200"
                      : "bg-white border border-purple-200 text-purple-700 hover:bg-purple-50"
                  }`}
                >
                  <Users size={14} />
                  <span>Emails associations</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px]">
                    {categoryCounts.association || 0}
                  </span>
                </button>

                <button
                  onClick={() => setMailboxCategory("cours")}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                    mailboxCategory === "cours"
                      ? "bg-blue-600 text-white shadow-xs shadow-blue-200"
                      : "bg-white border border-blue-200 text-blue-700 hover:bg-blue-50"
                  }`}
                >
                  <GraduationCap size={14} />
                  <span>Cours & Campus</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px]">
                    {categoryCounts.cours || 0}
                  </span>
                </button>
              </div>

              {/* Disposition 2 colonnes (Format client mail professionnel) */}
              <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 items-start">
                {/* Colonne de gauche : Liste des emails */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs max-h-[750px] overflow-y-auto space-y-1.5">
                  {mailLoading && (
                    <div className="py-12 text-center text-xs text-slate-400">
                      <RefreshCw size={22} className="animate-spin mx-auto text-indigo-500 mb-2" />
                      Synchronisation des emails...
                    </div>
                  )}

                  {mailError && (
                    <div className="p-4 rounded-xl bg-rose-50 text-rose-600 text-xs">
                      {mailError}
                    </div>
                  )}

                  {!mailLoading && !mailError && mailboxFilteredEmails.length === 0 && (
                    <div className="py-12 text-center text-xs text-slate-400">
                      Aucun email ne correspond à cette recherche.
                    </div>
                  )}

                  {!mailLoading &&
                    !mailError &&
                    mailboxFilteredEmails.map((mail) => {
                      const isSelected = selectedMailboxEmailId === mail.id;
                      const senderInitials = mail.from
                        .split(/[\s.@_-]+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((w) => w[0]?.toUpperCase())
                        .join("") || "M";

                      return (
                        <div
                          key={mail.id}
                          onClick={() => {
                            setSelectedMailboxEmailId(mail.id);
                            handleMarkAsRead(mail.id);
                          }}
                          className={`group cursor-pointer rounded-xl p-3 text-left transition-all border ${
                            isSelected
                              ? "bg-indigo-50/60 border-indigo-200 shadow-2xs"
                              : "border-transparent hover:bg-slate-50 hover:border-slate-100"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${
                                mail.unread ? "bg-indigo-600" : "bg-transparent"
                              }`}
                            />
                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                              {senderInitials}
                            </div>
                            <span
                              className={`truncate text-xs ${
                                mail.unread
                                  ? "font-bold text-slate-900"
                                  : "font-semibold text-slate-700"
                              }`}
                            >
                              {mail.from}
                            </span>
                            <span className="ml-auto text-[10px] text-slate-400 shrink-0">
                              {formatMailDate(mail.date)}
                            </span>
                          </div>

                          <p
                            className={`text-xs truncate pl-4 ${
                              mail.unread
                                ? "font-bold text-slate-900"
                                : "text-slate-600"
                            }`}
                          >
                            {mail.subject}
                          </p>

                          <div className="mt-2 pl-4 flex items-center justify-between gap-2">
                            <EmailCategoryBadge category={mail.category} size="sm" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedModalEmailId(mail.id);
                              }}
                              title="Agrandir en plein écran"
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 transition"
                            >
                              <Maximize2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Colonne de droite : Aperçu complet du mail (Forme de mail normal) */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs min-h-[600px]">
                  {detailLoading && (
                    <div className="space-y-6 py-8 animate-pulse">
                      <div className="h-7 w-3/4 bg-slate-200 rounded-lg" />
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-slate-200" />
                        <div className="space-y-2 flex-1">
                          <div className="h-4 w-48 bg-slate-200 rounded" />
                          <div className="h-3 w-64 bg-slate-100 rounded" />
                        </div>
                      </div>
                      <div className="space-y-3 pt-4 border-t border-slate-100">
                        <div className="h-4 w-full bg-slate-100 rounded" />
                        <div className="h-4 w-5/6 bg-slate-100 rounded" />
                      </div>
                    </div>
                  )}

                  {detailError && (
                    <div className="p-8 text-center text-rose-600 text-xs">
                      {detailError}
                    </div>
                  )}

                  {!detailLoading && !detailError && activeDetail && (
                    <div className="space-y-5">
                      {/* En-tête du message */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-4">
                        <div className="space-y-2 min-w-0">
                          <div className="flex items-center gap-2">
                            <EmailCategoryBadge category={activeDetail.category} size="md" />
                            <span className="text-xs text-slate-400">
                              ID #{activeDetail.id}
                            </span>
                          </div>
                          <h3 className="text-xl font-bold tracking-tight text-slate-900 leading-snug">
                            {activeDetail.subject || "(Sans objet)"}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {activeDetail.from.address && (
                            <a
                              href={`mailto:${activeDetail.from.address}?subject=Re: ${encodeURIComponent(
                                activeDetail.subject
                              )}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-2xs transition"
                            >
                              <Reply size={14} />
                              <span>Répondre</span>
                            </a>
                          )}
                          <button
                            onClick={() => setSelectedModalEmailId(activeDetail.id)}
                            title="Ouvrir dans une grande fenêtre"
                            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                          >
                            <Maximize2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Carte expéditeur et métadonnées */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {(activeDetail.from.name || activeDetail.from.address)
                              .split(/[\s.@_-]+/)
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((w) => w[0]?.toUpperCase())
                              .join("") || "M"}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">
                              {activeDetail.from.name || activeDetail.from.address}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              &lt;{activeDetail.from.address}&gt;
                            </p>
                            {activeDetail.to && activeDetail.to.length > 0 && (
                              <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                À : {activeDetail.to.map((t) => t.name || t.address).join(", ")}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-xs text-slate-500 flex items-center gap-1 shrink-0">
                          <Clock size={13} className="text-slate-400" />
                          <span>
                            {activeDetail.date
                              ? new Date(activeDetail.date).toLocaleDateString("fr-FR", {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </span>
                        </div>
                      </div>

                      {/* Pièces jointes */}
                      {activeDetail.attachments && activeDetail.attachments.length > 0 && (
                        <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
                            <Paperclip size={13} className="text-slate-500" />
                            <span>Pièces jointes ({activeDetail.attachments.length})</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {activeDetail.attachments.map((att, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs shadow-2xs"
                              >
                                {att.isCalendar ? (
                                  <Calendar size={14} className="text-indigo-600" />
                                ) : (
                                  <FileText size={14} className="text-indigo-600" />
                                )}
                                <span className="font-medium text-slate-800 truncate max-w-[150px]">
                                  {att.filename}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Corps formaté du mail */}
                      <FormattedEmailBody
                        html={activeDetail.html}
                        text={activeDetail.text}
                        showImages={showImages}
                        onToggleImages={() => setShowImages(!showImages)}
                      />
                    </div>
                  )}

                  {!detailLoading && !detailError && !activeDetail && (
                    <div className="py-24 text-center text-slate-400 space-y-2">
                      <Mail size={32} className="mx-auto text-slate-300" />
                      <p className="text-sm font-medium text-slate-600">
                        Sélectionne un email pour le lire
                      </p>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Clique sur n'importe quel message à gauche pour afficher sa mise en page complète et lisible.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Pied de page */}
          <footer className="flex flex-col items-center justify-between gap-2 border-t border-slate-200 py-5 text-xs text-slate-400 sm:flex-row">
            <p>© 2026 CampusFlow · INSA Lyon 5TC</p>
            <p className="flex items-center gap-1.5">
              Conçu pour la vie étudiante <Sparkles size={13} />
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  caption,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  caption: string;
  color: "indigo" | "emerald" | "amber" | "violet";
  onClick?: () => void;
}) {
  const styles = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
  };

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick();
            }
          : undefined
      }
      className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition ${
        onClick
          ? "cursor-pointer hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md active:scale-[0.99]"
          : "hover:-translate-y-0.5 hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${styles[color]}`}>
          {icon}
        </div>
        <MoreHorizontal size={19} className="text-slate-300" />
      </div>
      <p className="mt-5 text-sm text-slate-500">{label}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-3xl font-bold tracking-tight text-slate-900">
          {value}
        </p>
        <span className="mb-1 flex items-center gap-1 text-[10px] text-slate-400">
          <Clock size={12} /> Aujourd'hui
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-400">{caption}</p>
    </div>
  );
}
