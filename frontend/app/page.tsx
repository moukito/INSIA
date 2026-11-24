"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Circle,
  Clock,
  Compass,
  FileText,
  Filter,
  GraduationCap,
  Inbox,
  Info,
  LayoutDashboard,
  Mail,
  MapPin,
  Maximize2,
  Menu,
  MoreHorizontal,
  Paperclip,
  Plus,
  RefreshCw,
  Reply,
  Search,
  Send,
  Settings,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { EmailCategory } from "@/lib/email-classifier";
import { EmailCategoryBadge } from "@/components/EmailCategoryBadge";
import { EmailViewerModal, EmailDetailData } from "@/components/EmailViewerModal";
import { FormattedEmailBody } from "@/components/FormattedEmailBody";
import { CalendarView } from "@/components/CalendarView";
import { CalendarEvent, fetchCalendarEvents } from "@/lib/calendar-api";
import { AssociationEvent, REAL_ASSOCIATION_EVENTS } from "@/lib/association-events";
import { CURRENT_USER, getDeptFilterLabel, getDeptShortLabel, getPromoDisplay } from "@/lib/user-profile";

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

export interface TaskItem {
  id: number;
  title: string;
  course: string;
  due: string;
  priority: "Urgent" | "Normal" | "Faible";
  done: boolean;
  instructions?: string; // Consignes / comment faire la tâche
  estimatedTime?: string;
}

// Événements associatifs ajoutés au planning (les cours viennent du calendrier réel)
export interface ScheduleItem {
  id: number;
  eventId?: number;
  title: string;
  type: "cours" | "association" | "personnel";
  organizer: string;
  time: string;
  end: string;
  date: string;
  fullDate: string;
  place: string;
  detail: string;
  badge: string;
  color: string;
  light: string;
  text: string;
}

const initialTasks: TaskItem[] = [
  {
    id: 1,
    title: "Terminer le compte rendu de TP Réseaux (Socket & TCP)",
    course: "Informatique",
    due: "Aujourd'hui",
    priority: "Urgent",
    done: false,
    instructions:
      "Rédiger l'analyse des traces Wireshark capturées en séance, expliquer le handshake TCP à 3 voies et déposer le PDF sur Moodle avant 23h59.",
    estimatedTime: "2h00",
  },
  {
    id: 2,
    title: "Réviser les exercices d'algèbre linéaire et diagonalisation",
    course: "Mathématiques",
    due: "Demain",
    priority: "Normal",
    done: false,
    instructions:
      "Refaire les exercices 4 et 5 de la feuille de TD n°3 sur les valeurs propres et les matrices symétriques pour préparer le prochain DS.",
    estimatedTime: "1h30",
  },
  {
    id: 3,
    title: "Envoyer le rapport d'avancement du projet P2I",
    course: "Projet P2I",
    due: "23 nov.",
    priority: "Normal",
    done: false,
    instructions:
      "Regrouper les sections rédigées par l'équipe, valider le schéma d'architecture logicielle et soumettre le livrable sur Jumplyn.",
    estimatedTime: "1h00",
  },
  {
    id: 4,
    title: "Lire le chapitre sur l'architecture des réseaux 5G & IoT",
    course: "Télécoms",
    due: "25 nov.",
    priority: "Faible",
    done: true,
    instructions:
      "Prendre des notes sur le network slicing et le protocole MQTT pour les réseaux basse consommation.",
    estimatedTime: "45 min",
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

function senderInitialsOf(name: string) {
  return (
    name
      .split(/[\s.@_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "M"
  );
}

type CategoryFilter = "all" | EmailCategory;

export default function DashboardPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [activeNav, setActiveNav] = useState("Tableau de bord");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [assistantMessage, setAssistantMessage] = useState("");

  // Événements associatifs réels extraits des emails Zmail INSA
  const [associationEvents, setAssociationEvents] = useState<AssociationEvent[]>(
    REAL_ASSOCIATION_EVENTS
  );
  const [assoFilterCategory, setAssoFilterCategory] = useState<string>("all");
  const [assoSearchQuery, setAssoSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Tâches
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [taskFilterStatus, setTaskFilterStatus] = useState<"all" | "pending" | "done" | "urgent">("all");
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskCourse, setNewTaskCourse] = useState("Informatique");
  const [newTaskDue, setNewTaskDue] = useState("Aujourd'hui");
  const [newTaskPriority, setNewTaskPriority] = useState<"Urgent" | "Normal" | "Faible">("Normal");
  const [newTaskInstructions, setNewTaskInstructions] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("1h00");

  // Ajout d'événement associatif
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventAsso, setNewEventAsso] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventTime, setNewEventTime] = useState("");
  const [newEventPlace, setNewEventPlace] = useState("");
  const [newEventCategory, setNewEventCategory] =
    useState<AssociationEvent["category"]>("Soirée");
  const [newEventDesc, setNewEventDesc] = useState("");

  // Emails
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({
    all: 0,
    stage: 0,
    departement: 0,
    association: 0,
    urgence: 0,
    cours: 0,
    autre: 0,
  });
  const [mailLoading, setMailLoading] = useState(true);
  const [mailError, setMailError] = useState("");

  // Filtres d'emails
  const [dashboardCategory, setDashboardCategory] = useState<CategoryFilter>("all");
  const [mailboxCategory, setMailboxCategory] = useState<CategoryFilter>("all");
  const [emailSearchQuery, setEmailSearchQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  // Email sélectionné
  const [selectedModalEmailId, setSelectedModalEmailId] = useState<number | null>(null);
  const [selectedMailboxEmailId, setSelectedMailboxEmailId] = useState<number | null>(null);
  const [activeDetail, setActiveDetail] = useState<EmailDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [showImages, setShowImages] = useState(false);

  // Calendrier réel (aperçu du jour)
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
  const [calendarPreviewError, setCalendarPreviewError] = useState("");

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  }

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

  // Navigation via l'URL : /?view=planning, tasks, emails, orientation, associations, settings
  useEffect(() => {
    const view = new URLSearchParams(window.location.search).get("view");
    const viewLabels: Record<string, string> = {
      planning: "Mon planning",
      tasks: "Mes tâches",
      emails: "Mes emails",
      orientation: "Orientation",
      associations: "Associations",
      settings: "Paramètres",
    };
    if (view && viewLabels[view]) {
      setActiveNav(viewLabels[view]);
    }
  }, []);

  useEffect(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    fetchCalendarEvents(start, end)
      .then(setTodayEvents)
      .catch((error: unknown) =>
        setCalendarPreviewError(
          error instanceof Error ? error.message : "Planning indisponible."
        )
      );
  }, []);

  // Détail de l'email sélectionné dans "Mes emails"
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

  // Présélectionner le premier mail
  useEffect(() => {
    if (activeNav === "Mes emails" && emails.length > 0 && !selectedMailboxEmailId) {
      setSelectedMailboxEmailId(emails[0].id);
    }
  }, [activeNav, emails, selectedMailboxEmailId]);

  const completed = tasks.filter((task) => task.done).length;
  const pending = tasks.filter((task) => !task.done).length;

  function sendMessage() {
    if (!assistantMessage.trim()) return;
    const message = assistantMessage.trim();
    setAssistantMessage("");
    router.push(`/assistant?message=${encodeURIComponent(message)}`);
  }

  function toggleTask(id: number) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task
      )
    );
  }

  function deleteTask(id: number, e?: React.MouseEvent) {
    e?.stopPropagation();
    setTasks((current) => current.filter((task) => task.id !== id));
    showToast("Tâche supprimée avec succès.");
  }

  function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: TaskItem = {
      id: Date.now(),
      title: newTaskTitle.trim(),
      course: newTaskCourse.trim() || "Personnel",
      due: newTaskDue.trim() || "À planifier",
      priority: newTaskPriority,
      done: false,
      instructions: newTaskInstructions.trim() || "Aucune consigne particulière spécifiée.",
      estimatedTime: newTaskTime.trim() || "1h00",
    };

    setTasks((prev) => [newTask, ...prev]);
    setIsAddTaskModalOpen(false);
    setNewTaskTitle("");
    setNewTaskInstructions("");
    showToast(`La tâche "${newTask.title}" a été ajoutée !`);
  }

  function togglePlanningEvent(event: AssociationEvent) {
    const isAlreadyPlanned = scheduleItems.some((item) => item.eventId === event.id);

    if (isAlreadyPlanned) {
      setScheduleItems((prev) => prev.filter((item) => item.eventId !== event.id));
      showToast(`"${event.title}" a été retiré de ton planning.`);
    } else {
      const times = event.time.split(" - ");
      const newPlanningItem: ScheduleItem = {
        id: Date.now(),
        eventId: event.id,
        title: event.title,
        type: "association",
        organizer: event.association,
        time: times[0]?.trim() || event.time,
        end: times[1]?.trim() || "",
        date: event.date,
        fullDate: event.fullDate,
        place: event.place,
        detail: `Événement associatif (${event.category})`,
        badge: event.badge || "Association",
        color: "bg-purple-500",
        light: "bg-purple-50",
        text: "text-purple-700",
      };

      setScheduleItems((prev) => [newPlanningItem, ...prev]);
      showToast(`"${event.title}" a été ajouté à ton planning !`);
    }
  }

  function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!newEventTitle.trim() || !newEventAsso.trim() || !newEventDate.trim()) {
      alert("Veuillez renseigner au moins le titre, l'association et la date.");
      return;
    }

    const d = new Date(newEventDate);
    const dayStr = !isNaN(d.getDate()) ? String(d.getDate()).padStart(2, "0") : "15";
    const monthStr = !isNaN(d.getMonth())
      ? d.toLocaleDateString("fr-FR", { month: "short" }).toUpperCase()
      : "DÉC";

    const newEv: AssociationEvent = {
      id: Date.now(),
      emailId: 0,
      title: newEventTitle.trim(),
      association: newEventAsso.trim(),
      date: newEventDate,
      fullDate: newEventDate,
      day: dayStr,
      month: monthStr,
      time: newEventTime.trim() || "18:00 - 22:00",
      place: newEventPlace.trim() || "Campus INSA Lyon",
      category: newEventCategory,
      badge: "Ajout étudiant",
      sourceSubject: "Ajout manuel",
      description: newEventDesc.trim() || "Événement associatif proposé par les étudiants.",
      color: "bg-indigo-100 text-indigo-700 border-indigo-200",
    };

    setAssociationEvents((prev) => [newEv, ...prev]);
    setIsAddEventModalOpen(false);
    setNewEventTitle("");
    setNewEventAsso("");
    setNewEventDate("");
    setNewEventTime("");
    setNewEventPlace("");
    setNewEventDesc("");
    showToast("L'événement a bien été créé !");
  }

  const handleMarkAsRead = useCallback((id: number) => {
    setEmails((prev) =>
      prev.map((m) => (m.id === id ? { ...m, unread: false } : m))
    );
  }, []);

  const dashboardFilteredEmails = useMemo(() => {
    let list = emails;
    if (dashboardCategory !== "all") {
      list = list.filter((m) => m.category === dashboardCategory);
    }
    return list.slice(0, 6);
  }, [emails, dashboardCategory]);

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

  const filteredAssociationEvents = useMemo(() => {
    return associationEvents.filter((ev) => {
      const matchCategory =
        assoFilterCategory === "all" ? true : ev.category === assoFilterCategory;
      const matchQuery =
        !assoSearchQuery.trim() ||
        `${ev.title} ${ev.association} ${ev.place} ${ev.description}`
          .toLowerCase()
          .includes(assoSearchQuery.toLowerCase());
      return matchCategory && matchQuery;
    });
  }, [associationEvents, assoFilterCategory, assoSearchQuery]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchQuery =
        !query.trim() ||
        `${task.title} ${task.course} ${task.instructions || ""}`
          .toLowerCase()
          .includes(query.toLowerCase());

      if (!matchQuery) return false;

      if (taskFilterStatus === "pending") return !task.done;
      if (taskFilterStatus === "done") return task.done;
      if (taskFilterStatus === "urgent") return task.priority === "Urgent";
      return true;
    });
  }, [tasks, query, taskFilterStatus]);

  const navigationItems = useMemo(
    () => [
      { label: "Tableau de bord", icon: LayoutDashboard, count: undefined as string | undefined },
      { label: "Mon planning", icon: CalendarDays, count: String(todayEvents.length + scheduleItems.length) },
      { label: "Mes tâches", icon: CheckSquare, count: String(pending) },
      { label: "Mes emails", icon: Mail, count: unreadCount > 0 ? String(unreadCount) : undefined },
      { label: "Orientation", icon: Compass, count: undefined as string | undefined },
      { label: "Associations", icon: Users, count: String(associationEvents.length) },
    ],
    [todayEvents.length, scheduleItems.length, pending, unreadCount, associationEvents.length]
  );

  // Onglets de catégories d'emails (partagés dashboard / boîte de réception)
  const categoryTabs: {
    id: EmailCategory;
    label: string;
    icon: React.ReactNode;
    active: string;
    idle: string;
    badge: string;
  }[] = [
    {
      id: "stage" as EmailCategory,
      label: "Offres de stage",
      icon: <Briefcase size={14} />,
      active: "bg-emerald-600 text-white shadow-xs shadow-emerald-200",
      idle: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
      badge: "bg-emerald-100 text-emerald-800",
    },
    {
      id: "departement" as EmailCategory,
      label: getDeptFilterLabel(),
      icon: <Building2 size={14} />,
      active: "bg-blue-600 text-white shadow-xs shadow-blue-200",
      idle: "bg-blue-50 text-blue-700 hover:bg-blue-100",
      badge: "bg-blue-100 text-blue-800",
    },
    {
      id: "association" as EmailCategory,
      label: "Associations",
      icon: <Users size={14} />,
      active: "bg-purple-600 text-white shadow-xs shadow-purple-200",
      idle: "bg-purple-50 text-purple-700 hover:bg-purple-100",
      badge: "bg-purple-100 text-purple-800",
    },
    {
      id: "cours" as EmailCategory,
      label: "Cours & Campus",
      icon: <GraduationCap size={14} />,
      active: "bg-amber-600 text-white shadow-xs shadow-amber-200",
      idle: "bg-amber-50 text-amber-800 hover:bg-amber-100",
      badge: "bg-amber-100 text-amber-900",
    },
  ];

  function renderCategoryTabs(
    current: CategoryFilter,
    setCurrent: (c: CategoryFilter) => void
  ) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setCurrent("all")}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
            current === "all"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <Inbox size={14} />
          <span>Tous</span>
          <span className="ml-1 opacity-75">({categoryCounts.all || emails.length})</span>
        </button>
        {categoryTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCurrent(tab.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              current === tab.id ? tab.active : tab.idle
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            <span className={`ml-1 px-1.5 rounded-full text-[10px] ${tab.badge}`}>
              {categoryCounts[tab.id] || 0}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-800">
      {/* Toast de notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[120] flex items-center gap-2.5 rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modale plein écran de lecture d'email */}
      <EmailViewerModal
        emailId={selectedModalEmailId}
        onClose={() => setSelectedModalEmailId(null)}
        onMarkAsRead={handleMarkAsRead}
        onOpenInMailbox={(id) => {
          setActiveNav("Mes emails");
          setSelectedMailboxEmailId(id);
          setSelectedModalEmailId(null);
        }}
      />

      {/* Modale d'ajout de tâche */}
      {isAddTaskModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="fixed inset-0" onClick={() => setIsAddTaskModalOpen(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <CheckSquare size={19} className="text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  Nouvelle tâche & Instructions
                </h3>
              </div>
              <button
                onClick={() => setIsAddTaskModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Intitulé de la tâche *
                </label>
                <input
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Ex: Rédiger le compte rendu TP Réseaux..."
                  className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-indigo-500 focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Matière / Catégorie
                  </label>
                  <select
                    value={newTaskCourse}
                    onChange={(e) => setNewTaskCourse(e.target.value)}
                    className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-2.5 outline-none focus:border-indigo-500 focus:bg-white transition"
                  >
                    <option value="Informatique">Informatique</option>
                    <option value="Mathématiques">Mathématiques</option>
                    <option value="Télécoms">Télécommunications</option>
                    <option value="Projet P2I">Projet P2I</option>
                    <option value="Anglais">Anglais</option>
                    <option value="Vie Associative">Vie Associative</option>
                    <option value="Personnel">Personnel</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Priorité
                  </label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) =>
                      setNewTaskPriority(e.target.value as "Urgent" | "Normal" | "Faible")
                    }
                    className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-2.5 outline-none focus:border-indigo-500 focus:bg-white transition"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Urgent">Urgent (Important)</option>
                    <option value="Faible">Faible</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Date d'échéance (Due date)
                  </label>
                  <input
                    value={newTaskDue}
                    onChange={(e) => setNewTaskDue(e.target.value)}
                    placeholder="Ex: Aujourd'hui, Demain, 28 nov..."
                    className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-indigo-500 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Temps estimé
                  </label>
                  <input
                    value={newTaskTime}
                    onChange={(e) => setNewTaskTime(e.target.value)}
                    placeholder="Ex: 1h30, 45 min..."
                    className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-indigo-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Comment réaliser cette tâche / Consignes & Méthode
                </label>
                <textarea
                  rows={3}
                  value={newTaskInstructions}
                  onChange={(e) => setNewTaskInstructions(e.target.value)}
                  placeholder="Détaillez les étapes à suivre, les liens vers les documents, les chapitres à relire..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 outline-none focus:border-indigo-500 focus:bg-white transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddTaskModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs"
                >
                  Créer la tâche
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale d'ajout d'événement associatif */}
      {isAddEventModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="fixed inset-0" onClick={() => setIsAddEventModalOpen(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-purple-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  Ajouter un événement associatif
                </h3>
              </div>
              <button
                onClick={() => setIsAddEventModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Titre de l'événement *
                </label>
                <input
                  required
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="Ex: Soirée Barbecue de rentrée, Tournoi Futsal..."
                  className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-purple-500 focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Association organisatrice *
                  </label>
                  <input
                    required
                    value={newEventAsso}
                    onChange={(e) => setNewEventAsso(e.target.value)}
                    placeholder="Ex: BDE, Club Robotique, Karnaval..."
                    className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-purple-500 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Catégorie
                  </label>
                  <select
                    value={newEventCategory}
                    onChange={(e) =>
                      setNewEventCategory(e.target.value as AssociationEvent["category"])
                    }
                    className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-purple-500 focus:bg-white transition"
                  >
                    <option value="Soirée">Soirée & Festif</option>
                    <option value="Sport">Sport</option>
                    <option value="Culture">Culture & Arts</option>
                    <option value="Solidarité">Solidarité & Citoyenneté</option>
                    <option value="Conférence">Conférence & Atelier</option>
                    <option value="Vie étudiante">Vie étudiante</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Date * (ex: 28 nov. 2026)
                  </label>
                  <input
                    required
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    placeholder="Ex: 5 décembre 2026"
                    className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-purple-500 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Heure (ex: 18h30 - 22h00)
                  </label>
                  <input
                    value={newEventTime}
                    onChange={(e) => setNewEventTime(e.target.value)}
                    placeholder="Ex: 19:00 - 23:30"
                    className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-purple-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Place / Lieu (ex: Le Foyer, Pelouse des Humanités...)
                </label>
                <input
                  value={newEventPlace}
                  onChange={(e) => setNewEventPlace(e.target.value)}
                  placeholder="Ex: Foyer des élèves - Campus La Doua"
                  className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-purple-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Description / Infos pratiques
                </label>
                <textarea
                  rows={2}
                  value={newEventDesc}
                  onChange={(e) => setNewEventDesc(e.target.value)}
                  placeholder="Détails du programme, entrée libre ou billetterie..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 outline-none focus:border-purple-500 focus:bg-white transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddEventModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold shadow-xs"
                >
                  Ajouter l'événement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
            <p className="text-lg font-bold tracking-tight text-slate-900">INSIA</p>
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
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = activeNav === item.label;
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
                  {item.count && (
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                        active
                          ? "bg-white text-indigo-700 shadow-2xs"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {item.count}
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
                setMobileOpen(false);
                router.push("/assistant");
              }}
              className="mt-4 flex w-full items-center justify-between rounded-lg bg-white px-3 py-2.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
            >
              Découvrir l'assistant <ArrowUpRight size={15} />
            </button>
          </div>

          <button
            onClick={() => {
              setActiveNav("Paramètres");
              setMobileOpen(false);
            }}
            className={`mt-4 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${
              activeNav === "Paramètres"
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <Settings size={19} /> Paramètres
          </button>

          <div className="mt-3 flex items-center gap-3 border-t border-slate-100 px-2 pt-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-800">
              {CURRENT_USER.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">
                {CURRENT_USER.firstName} {CURRENT_USER.lastName}
              </p>
              <p className="text-xs text-slate-400">{getPromoDisplay()}</p>
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
              <span>INSIA</span>
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
                placeholder="Rechercher tâche, cours..."
                className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400"
              />
            </label>
            <button
              aria-label="Rafraîchir"
              onClick={fetchEmails}
              title="Rafraîchir les emails"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition"
            >
              <RefreshCw
                size={17}
                className={mailLoading ? "animate-spin text-indigo-600" : ""}
              />
            </button>
            <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800 sm:flex">
              {CURRENT_USER.initials}
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] space-y-7 p-4 sm:p-8">
          {/* ============================================================== */}
          {/* VUE 1 : TABLEAU DE BORD                                        */}
          {/* ============================================================== */}
          {activeNav === "Tableau de bord" && (
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
                    Bonjour {CURRENT_USER.firstName} ! <span>👋</span>
                  </h2>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-indigo-100 sm:text-base">
                    Retrouve ici tes cours, tes offres de stage, tes emails du département et la vie associative du campus. Tout au même endroit.
                  </p>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => setActiveNav("Mon planning")}
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
                    >
                      Mon planning <CalendarDays size={17} />
                    </button>
                    <button
                      onClick={() => setActiveNav("Mes tâches")}
                      className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-3 text-sm font-semibold text-white border border-white/25 backdrop-blur-xs transition hover:bg-white/25"
                    >
                      Mes tâches ({pending} à faire) <CheckSquare size={17} />
                    </button>
                  </div>
                </div>
                <div className="absolute bottom-5 right-8 hidden opacity-20 md:block">
                  <GraduationCap size={125} strokeWidth={1} />
                </div>
              </section>

              {/* 4 Cartes de statistiques */}
              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  icon={<CalendarDays size={21} />}
                  label="Cours aujourd'hui"
                  value={String(todayEvents.length)}
                  caption={calendarPreviewError || "Journée bien rythmée"}
                  color="indigo"
                  onClick={() => setActiveNav("Mon planning")}
                />
                <StatCard
                  icon={<CheckSquare size={21} />}
                  label="Tâches à faire"
                  value={String(pending)}
                  caption={`${completed} terminée${completed > 1 ? "s" : ""} · Voir les consignes`}
                  color="emerald"
                  onClick={() => setActiveNav("Mes tâches")}
                />
                <StatCard
                  icon={<Mail size={21} />}
                  label="Emails à lire"
                  value={mailLoading ? "…" : String(unreadCount)}
                  caption="Boîte Zmail INSA triée"
                  color="amber"
                  onClick={() => setActiveNav("Mes emails")}
                />
                <StatCard
                  icon={<Users size={21} />}
                  label="Événements associations"
                  value={String(associationEvents.length)}
                  caption="Extraits réels des emails VA"
                  color="violet"
                  onClick={() => setActiveNav("Associations")}
                />
              </section>

              {/* Emails récents par catégorie */}
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-base">Mes emails récents</h3>
                      <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                        Zmail INSA Lyon
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Triés automatiquement par source : Offres de stage, {getDeptFilterLabel()}, Associations.
                    </p>
                  </div>

                  <button
                    onClick={() => setActiveNav("Mes emails")}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
                  >
                    <span>Voir toute la boîte</span>
                    <ChevronRight size={15} />
                  </button>
                </div>

                <div className="mb-5 border-b border-slate-100 pb-3">
                  {renderCategoryTabs(dashboardCategory, setDashboardCategory)}
                </div>

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

                {!mailLoading && !mailError && dashboardFilteredEmails.length === 0 && (
                  <p className="py-6 text-center text-xs text-slate-400">
                    Aucun email trouvé dans cette catégorie.
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {!mailLoading &&
                    !mailError &&
                    dashboardFilteredEmails.map((mail) => (
                      <button
                        key={mail.id}
                        onClick={() => setSelectedModalEmailId(mail.id)}
                        className="group relative flex items-start gap-3 p-3.5 rounded-xl border border-slate-100 bg-white hover:border-indigo-200 hover:bg-slate-50/70 text-left transition-all shadow-2xs hover:shadow-xs"
                      >
                        <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 font-bold text-xs flex items-center justify-center shrink-0 border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition">
                          {senderInitialsOf(mail.from)}
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
                              mail.unread ? "font-bold text-slate-900" : "text-slate-600"
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
                    ))}
                </div>
              </section>

              {/* Planning du jour & Mes tâches */}
              <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900">Prochains cours</h3>
                      <p className="mt-1 text-xs text-slate-400">
                        Ton aperçu de la journée
                        {scheduleItems.length > 0 &&
                          ` · ${scheduleItems.length} événement${scheduleItems.length > 1 ? "s" : ""} associatif${scheduleItems.length > 1 ? "s" : ""} ajouté${scheduleItems.length > 1 ? "s" : ""}`}
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveNav("Mon planning")}
                      className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      Ouvrir le planning complet <ChevronRight size={15} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {todayEvents.map((course, index) => {
                      const start = new Date(course.start_at);
                      const end = new Date(course.end_at);
                      const colors = ["bg-violet-500", "bg-blue-500", "bg-emerald-500"];
                      return (
                        <div
                          key={course.id}
                          className="group flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-indigo-100 hover:bg-slate-50 sm:gap-4 sm:p-4"
                        >
                          <div className="w-[58px] shrink-0">
                            <p className="text-sm font-bold text-slate-800">
                              {start.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-400">
                              {end.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <div className={`h-11 w-1 shrink-0 rounded-full ${colors[index % colors.length]}`} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-800">
                              {course.title}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">{course.subject}</p>
                            <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
                              <MapPin size={12} /> {course.location || "Salle à confirmer"}
                            </p>
                          </div>
                          <BookOpen
                            size={18}
                            className="hidden text-slate-300 transition group-hover:text-indigo-500 sm:block"
                          />
                        </div>
                      );
                    })}

                    {scheduleItems.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-xl border border-purple-100 bg-purple-50/40 p-3 sm:gap-4 sm:p-4"
                      >
                        <div className="w-[58px] shrink-0">
                          <p className="text-sm font-bold text-slate-800">{item.time}</p>
                          <p className="mt-1 text-[11px] text-slate-400">{item.end || item.date}</p>
                        </div>
                        <div className={`h-11 w-1 shrink-0 rounded-full ${item.color}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">{item.title}</p>
                          <p className="mt-1 text-xs text-slate-400">{item.organizer} · {item.fullDate}</p>
                          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-400 truncate">
                            <MapPin size={12} className="shrink-0" /> {item.place}
                          </p>
                        </div>
                      </div>
                    ))}

                    {todayEvents.length === 0 && scheduleItems.length === 0 && !calendarPreviewError && (
                      <p className="py-5 text-center text-xs text-slate-400">
                        Aucun cours prévu aujourd'hui.
                      </p>
                    )}
                  </div>
                </div>

                {/* Aperçu des tâches */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                  <div className="mb-6 flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900">Mes tâches</h3>
                      <p className="mt-1 text-xs text-slate-400">
                        {pending} à faire · {completed} terminée{completed > 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsAddTaskModalOpen(true)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100"
                        aria-label="Ajouter une tâche"
                        title="Ajouter une tâche avec consignes"
                      >
                        <Plus size={19} />
                      </button>
                      <button
                        onClick={() => setActiveNav("Mes tâches")}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        Voir tout
                      </button>
                    </div>
                  </div>

                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Progression</span>
                    <span className="text-xs font-bold text-indigo-600">
                      {tasks.length ? Math.round((completed / tasks.length) * 100) : 0}%
                    </span>
                  </div>
                  <div className="mb-5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all"
                      style={{
                        width: `${tasks.length ? (completed / tasks.length) * 100 : 0}%`,
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    {filteredTasks.slice(0, 4).map((task) => (
                      <div
                        key={task.id}
                        className="group flex items-start gap-2.5 rounded-xl p-2.5 transition hover:bg-slate-50 border border-transparent hover:border-slate-100"
                      >
                        <button
                          type="button"
                          onClick={() => toggleTask(task.id)}
                          className="mt-0.5 shrink-0"
                          aria-label="Valider la tâche"
                        >
                          {task.done ? (
                            <CheckCircle2 size={18} className="text-emerald-500" />
                          ) : (
                            <Circle size={18} className="text-slate-300 group-hover:text-slate-400" />
                          )}
                        </button>
                        <div
                          className="min-w-0 flex-1 cursor-pointer"
                          onClick={() => {
                            setExpandedTaskId(task.id);
                            setActiveNav("Mes tâches");
                          }}
                        >
                          <p
                            className={`text-xs font-medium leading-5 ${
                              task.done ? "text-slate-400 line-through" : "text-slate-800"
                            }`}
                          >
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                            <span>{task.course}</span>
                            <span>·</span>
                            <span>{task.due}</span>
                            {task.priority === "Urgent" && !task.done && (
                              <span className="rounded bg-rose-50 px-1.5 text-[10px] font-bold text-rose-600">
                                Urgent
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredTasks.length === 0 && (
                      <p className="py-5 text-center text-xs text-slate-400">
                        Aucune tâche trouvée.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* Événements associatifs */}
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Users size={20} className="text-purple-600" />
                      <h3 className="font-bold text-slate-900 text-base">
                        Événements associatifs à venir
                      </h3>
                      <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">
                        {associationEvents.length} événements
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Extraits des emails officiels de la Vie Associative et des Élus étudiants.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsAddEventModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold transition"
                    >
                      <Plus size={14} />
                      <span>Ajouter un événement</span>
                    </button>
                    <button
                      onClick={() => setActiveNav("Associations")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition"
                    >
                      <span>Voir le menu complet</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {associationEvents.slice(0, 6).map((event) => {
                    const isPlanned = scheduleItems.some((item) => item.eventId === event.id);

                    return (
                      <div
                        key={event.id}
                        className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 transition-all hover:border-purple-200 hover:bg-white hover:shadow-sm"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100 truncate max-w-[170px]">
                              <Users size={12} className="shrink-0" />
                              {event.association}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md shrink-0">
                              {event.badge}
                            </span>
                          </div>

                          <h4 className="font-bold text-slate-900 text-sm mb-3 leading-snug">
                            {event.title}
                          </h4>

                          <div className="space-y-1.5 text-xs text-slate-600 bg-white rounded-xl p-3 border border-slate-100 mb-3">
                            <div className="flex items-center gap-2 font-medium text-slate-800">
                              <Calendar size={14} className="text-purple-600 shrink-0" />
                              <span>{event.fullDate}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-600">
                              <Clock size={14} className="text-indigo-600 shrink-0" />
                              <span className="font-semibold text-slate-700">{event.time}</span>
                            </div>
                            <div className="flex items-start gap-2 text-slate-600">
                              <MapPin size={14} className="text-rose-500 shrink-0 mt-0.5" />
                              <span className="leading-snug">{event.place}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                          {event.emailId > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedModalEmailId(event.emailId);
                              }}
                              title="Consulter l'email officiel dans la boîte"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2 py-1 rounded-md transition cursor-pointer"
                            >
                              <Mail size={12} />
                              <span>Voir l'email</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => togglePlanningEvent(event)}
                            className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition ml-auto ${
                              isPlanned
                                ? "bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                                : "bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-100"
                            }`}
                          >
                            {isPlanned ? (
                              <>
                                <CheckCircle2 size={13} className="text-emerald-600" />
                                <span>Au planning ✓</span>
                              </>
                            ) : (
                              <>
                                <Plus size={13} />
                                <span>Au planning</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Assistant étudiant */}
              <section className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-violet-100 sm:p-6">
                <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-violet-100/70 blur-2xl" />
                <div className="relative flex flex-col gap-4 md:flex-row md:items-center">
                  <div className="flex items-center gap-4 md:w-1/2">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                      <Sparkles size={23} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">Ton assistant étudiant</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Une question sur ton stage, tes cours ou la vie étudiante ?
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100">
                    <input
                      value={assistantMessage}
                      onChange={(event) => setAssistantMessage(event.target.value)}
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
              </section>
            </>
          )}

          {/* ============================================================== */}
          {/* VUE 2 : MON PLANNING (calendrier réel + événements associatifs) */}
          {/* ============================================================== */}
          {activeNav === "Mon planning" && (
            <div className="space-y-6">
              <CalendarView />

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      Événements associatifs ajoutés ({scheduleItems.length})
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Ajoute des événements depuis le menu Associations.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveNav("Associations")}
                    className="inline-flex items-center gap-2 rounded-xl bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition"
                  >
                    <Plus size={14} /> Explorer les événements
                  </button>
                </div>

                {scheduleItems.length === 0 && (
                  <p className="py-4 text-center text-xs text-slate-400">
                    Aucun événement associatif au planning pour l'instant.
                  </p>
                )}

                <div className="space-y-3">
                  {scheduleItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-white hover:border-indigo-200 hover:shadow-xs transition"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-20 shrink-0">
                          <p className="text-sm font-bold text-slate-900">{item.time}</p>
                          <p className="text-xs text-slate-400">{item.end ? `à ${item.end}` : ""}</p>
                          <span className="mt-1 inline-block text-[10px] font-semibold text-slate-500">
                            {item.date}
                          </span>
                        </div>

                        <div className={`h-12 w-1.5 rounded-full shrink-0 ${item.color}`} />

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                            <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-purple-100 text-purple-800">
                              Événement Associatif
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">
                            <strong>{item.organizer}</strong> · {item.detail}
                          </p>
                          <p className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                            <MapPin size={13} className="text-rose-500 shrink-0" />
                            <span>{item.place}</span>
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setScheduleItems((prev) => prev.filter((i) => i.id !== item.id));
                          showToast(`"${item.title}" a été retiré du planning.`);
                        }}
                        className="inline-flex items-center gap-1 self-end sm:self-center text-xs text-rose-600 hover:text-rose-800 p-1.5 rounded-lg hover:bg-rose-50 transition"
                        title="Retirer du planning"
                      >
                        <Trash2 size={14} />
                        <span>Retirer</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* VUE 3 : MES TÂCHES                                             */}
          {/* ============================================================== */}
          {activeNav === "Mes tâches" && (
            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 p-6 text-white shadow-xl shadow-emerald-100 sm:p-8">
                <div className="relative max-w-2xl">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-emerald-100">
                    <CheckSquare size={14} /> Gestionnaire de travail étudiant
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    Mes tâches & Instructions
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-emerald-100 sm:text-base">
                    Organise tes devoirs, projets de cours et démarches avec les consignes détaillées pour chaque tâche.
                  </p>
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => setIsAddTaskModalOpen(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50"
                    >
                      <Plus size={16} /> Ajouter une nouvelle tâche
                    </button>
                    <button
                      onClick={() => setActiveNav("Tableau de bord")}
                      className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white border border-white/25 transition hover:bg-white/25"
                    >
                      Retour au tableau de bord
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      Progression globale : {completed} sur {tasks.length} tâche(s) terminée(s)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Clique sur une tâche pour afficher comment la réaliser et ses consignes détaillées.
                    </p>
                  </div>
                  <span className="text-lg font-black text-indigo-600">
                    {tasks.length ? Math.round((completed / tasks.length) * 100) : 0}%
                  </span>
                </div>

                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all"
                    style={{ width: `${tasks.length ? (completed / tasks.length) * 100 : 0}%` }}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { id: "all", label: "Toutes les tâches", count: tasks.length },
                      { id: "pending", label: "À faire", count: pending },
                      { id: "done", label: "Terminées", count: completed },
                      { id: "urgent", label: "Urgentes", count: tasks.filter((t) => t.priority === "Urgent").length },
                    ].map((tab) => {
                      const active = taskFilterStatus === tab.id;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setTaskFilterStatus(tab.id as typeof taskFilterStatus)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                            active
                              ? "bg-slate-900 text-white shadow-xs"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          <span>{tab.label}</span>
                          <span className="opacity-75">({tab.count})</span>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setIsAddTaskModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition"
                  >
                    <Plus size={14} />
                    <span>Nouvelle tâche</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {filteredTasks.map((task) => {
                  const isExpanded = expandedTaskId === task.id;

                  return (
                    <div
                      key={task.id}
                      className={`rounded-2xl border transition-all bg-white shadow-xs ${
                        task.done
                          ? "border-slate-200/60 bg-slate-50/40"
                          : task.priority === "Urgent"
                          ? "border-rose-200 hover:border-rose-300"
                          : "border-slate-200/80 hover:border-indigo-200"
                      }`}
                    >
                      <div className="p-4 sm:p-5">
                        <div className="flex items-start gap-3.5">
                          <button
                            type="button"
                            onClick={() => toggleTask(task.id)}
                            className="mt-0.5 shrink-0 text-slate-400 hover:text-emerald-600 transition"
                            aria-label="Cocher / décocher la tâche"
                          >
                            {task.done ? (
                              <CheckCircle2 size={22} className="text-emerald-500" />
                            ) : (
                              <Circle size={22} className="text-slate-300 hover:text-slate-500" />
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h4
                                onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                                className={`text-sm sm:text-base font-bold cursor-pointer hover:text-indigo-600 transition ${
                                  task.done ? "text-slate-400 line-through" : "text-slate-900"
                                }`}
                              >
                                {task.title}
                              </h4>

                              {task.priority === "Urgent" && (
                                <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 border border-rose-100">
                                  Urgent
                                </span>
                              )}
                              {task.priority === "Faible" && (
                                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                  Faible
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                              <span className="font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                {task.course}
                              </span>
                              <span className="flex items-center gap-1 text-slate-500">
                                <Calendar size={13} /> Échéance : {task.due}
                              </span>
                              {task.estimatedTime && (
                                <span className="flex items-center gap-1 text-slate-400">
                                  <Clock size={13} /> {task.estimatedTime}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                              title="Voir les consignes"
                              className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition"
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            <button
                              onClick={(e) => deleteTask(task.id, e)}
                              title="Supprimer la tâche"
                              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-4 pt-3 border-t border-slate-100 text-xs">
                            <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100 space-y-2">
                              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                <Info size={14} className="text-indigo-600 shrink-0" />
                                <span>Comment réaliser cette tâche / Consignes & Méthode :</span>
                              </div>
                              <p className="text-slate-600 leading-relaxed whitespace-pre-wrap pl-5">
                                {task.instructions ||
                                  "Aucune consigne particulière renseignée pour cette tâche."}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {filteredTasks.length === 0 && (
                  <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                    <CheckSquare size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-700">
                      Aucune tâche ne correspond à ce filtre
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Clique sur « Nouvelle tâche » pour en créer une.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* VUE 4 : ASSOCIATIONS                                           */}
          {/* ============================================================== */}
          {activeNav === "Associations" && (
            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-600 p-6 text-white shadow-xl shadow-purple-100 sm:p-8">
                <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full border-[36px] border-white/5" />
                <div className="relative max-w-2xl">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-purple-100">
                    <Users size={14} /> Vie Associative · INSA Lyon
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    Événements des Associations
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-purple-100 sm:text-base">
                    Tous les événements organisés par les associations étudiantes : dates, horaires, lieux sur le campus et modalités de participation.
                  </p>
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => setIsAddEventModalOpen(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-purple-700 shadow-sm transition hover:bg-purple-50"
                    >
                      <Plus size={16} /> Proposer un événement associatif
                    </button>
                    <button
                      onClick={() => setActiveNav("Mon planning")}
                      className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white border border-white/25 transition hover:bg-white/25"
                    >
                      Voir mon planning ({scheduleItems.length})
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-4 text-xs text-purple-900 flex items-start gap-3 shadow-xs">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white font-bold">
                  <Mail size={16} />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm mb-1">
                    Événements réels extraits directement de vos emails associatifs
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    Tous les événements ci-dessous proviennent des messages officiels reçus sur votre messagerie Zmail INSA Lyon : les <strong>Missives hebdomadaires de la Vie Associative</strong> (envoyées par <em>resp.va@asso-insa-lyon.fr</em>) et les convocations des <strong>Élus étudiants</strong>. Cliquez sur <strong>« Voir l'email source »</strong> pour ouvrir le mail officiel, ou sur <strong>« Au planning »</strong> pour l'ajouter à votre emploi du temps !
                  </p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { id: "all", label: "Tous les événements", icon: Users },
                    { id: "Soirée", label: "Soirées & Festif", icon: Sparkles },
                    { id: "Solidarité", label: "Solidarité & Citoyen", icon: Users },
                    { id: "Sport", label: "Sport & Plein air", icon: CalendarDays },
                    { id: "Culture", label: "Culture & Arts", icon: BookOpen },
                    { id: "Conférence", label: "Conférences & Débats", icon: GraduationCap },
                  ].map((tab) => {
                    const active = assoFilterCategory === tab.id;
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setAssoFilterCategory(tab.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                          active
                            ? "bg-purple-600 text-white shadow-xs shadow-purple-200"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        <Icon size={14} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={assoSearchQuery}
                    onChange={(e) => setAssoSearchQuery(e.target.value)}
                    placeholder="Chercher un lieu, asso ou titre..."
                    className="h-9 w-full md:w-64 rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs outline-none focus:border-purple-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredAssociationEvents.map((event) => {
                  const isPlanned = scheduleItems.some((item) => item.eventId === event.id);

                  return (
                    <div
                      key={event.id}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:border-purple-200 hover:shadow-md transition duration-200"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div
                            className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border ${event.color}`}
                          >
                            <span className="text-xl font-black leading-none">{event.day}</span>
                            <span className="mt-1 text-[10px] font-bold tracking-wider">{event.month}</span>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            <span className="rounded-md bg-purple-50 px-2.5 py-0.5 text-xs font-bold text-purple-700 border border-purple-200">
                              {event.association}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500">{event.badge}</span>
                          </div>
                        </div>

                        <h3 className="text-base font-bold text-slate-900 leading-snug mb-2">
                          {event.title}
                        </h3>

                        <p className="text-xs text-slate-500 mb-4 line-clamp-2 leading-relaxed">
                          {event.description}
                        </p>

                        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-2 mb-4 text-xs">
                          <div className="flex items-center gap-2 text-slate-700 font-semibold">
                            <Calendar size={15} className="text-purple-600 shrink-0" />
                            <span>{event.fullDate}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-700 font-medium">
                            <Clock size={15} className="text-indigo-600 shrink-0" />
                            <span>
                              Horaire : <strong className="text-slate-900 font-bold">{event.time}</strong>
                            </span>
                          </div>
                          <div className="flex items-start gap-2 text-slate-700">
                            <MapPin size={15} className="text-rose-500 shrink-0 mt-0.5" />
                            <span>
                              Lieu : <strong className="text-slate-900 font-semibold">{event.place}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                        {event.emailId > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedModalEmailId(event.emailId);
                            }}
                            title={`Consulter l'email officiel : ${event.sourceSubject}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-xs font-semibold transition cursor-pointer"
                          >
                            <Mail size={13} />
                            <span>Voir l'email source</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => togglePlanningEvent(event)}
                          className={`ml-auto inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl border transition cursor-pointer ${
                            isPlanned
                              ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                              : "bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100"
                          }`}
                        >
                          {isPlanned ? (
                            <>
                              <CheckCircle2 size={13} className="text-emerald-600" />
                              <span>Au planning ✓</span>
                            </>
                          ) : (
                            <>
                              <Plus size={13} />
                              <span>Ajouter au planning</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredAssociationEvents.length === 0 && (
                <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                  <Users size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">
                    Aucun événement associatif ne correspond aux critères
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* VUE 5 : MES EMAILS                                             */}
          {/* ============================================================== */}
          {activeNav === "Mes emails" && (
            <section className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-900">Boîte de réception</h2>
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                      INSA Lyon Zmail
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Emails synchronisés et triés automatiquement par catégorie
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
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
                    <RefreshCw
                      size={14}
                      className={mailLoading ? "animate-spin text-indigo-600" : ""}
                    />
                  </button>
                </div>
              </div>

              {renderCategoryTabs(mailboxCategory, setMailboxCategory)}

              <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 items-start">
                {/* Liste des emails */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs max-h-[750px] overflow-y-auto space-y-1.5">
                  {mailLoading && (
                    <div className="py-12 text-center text-xs text-slate-400">
                      <RefreshCw size={22} className="animate-spin mx-auto text-indigo-500 mb-2" />
                      Synchronisation des emails...
                    </div>
                  )}

                  {mailError && (
                    <div className="p-4 rounded-xl bg-rose-50 text-rose-600 text-xs">{mailError}</div>
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
                              {senderInitialsOf(mail.from)}
                            </div>
                            <span
                              className={`truncate text-xs ${
                                mail.unread ? "font-bold text-slate-900" : "font-semibold text-slate-700"
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
                              mail.unread ? "font-bold text-slate-900" : "text-slate-600"
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

                {/* Aperçu complet du mail */}
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
                    <div className="p-8 text-center text-rose-600 text-xs">{detailError}</div>
                  )}

                  {!detailLoading && !detailError && activeDetail && (
                    <div className="space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-4">
                        <div className="space-y-2 min-w-0">
                          <div className="flex items-center gap-2">
                            <EmailCategoryBadge category={activeDetail.category} size="md" />
                            <span className="text-xs text-slate-400">ID #{activeDetail.id}</span>
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

                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {senderInitialsOf(activeDetail.from.name || activeDetail.from.address)}
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

          {/* Paramètres */}
          {activeNav === "Paramètres" && (
            <div className="rounded-3xl bg-white p-6 border border-slate-200 shadow-sm space-y-2">
              <h2 className="text-xl font-bold text-slate-900">Paramètres</h2>
              <p className="text-xs text-slate-500">
                Les paramètres du compte seront disponibles prochainement.
              </p>
            </div>
          )}

          {/* Orientation */}
          {activeNav === "Orientation" && (
            <div className="rounded-3xl bg-white p-6 border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Orientation & Carrières</h2>
              <p className="text-xs text-slate-500">
                Retrouve ici les offres de stage PFE, les plateformes partenaires (JobTeaser, HelloWork) et les forums entreprises INSA.
              </p>
              <button
                onClick={() => {
                  setMailboxCategory("stage" as EmailCategory);
                  setActiveNav("Mes emails");
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
              >
                <Briefcase size={15} /> Voir les offres de stage reçues par email
              </button>
            </div>
          )}

          {/* Pied de page */}
          <footer className="flex flex-col items-center justify-between gap-2 border-t border-slate-200 py-5 text-xs text-slate-400 sm:flex-row">
            <p>© 2026 INSIA · INSA Lyon</p>
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
    violet: "bg-violet-50 text-purple-600",
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
        <p className="text-3xl font-bold tracking-tight text-slate-900">{value}</p>
        <span className="mb-1 flex items-center gap-1 text-[10px] text-slate-400">
          <Clock size={12} /> Aujourd'hui
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-400">{caption}</p>
    </div>
  );
}
