"use client";

import { useEffect, useState } from "react";
import {
  X,
  Reply,
  Calendar,
  FileText,
  Paperclip,
  Clock,
  User,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  Share2,
} from "lucide-react";
import { EmailCategoryBadge } from "./EmailCategoryBadge";
import { FormattedEmailBody } from "./FormattedEmailBody";
import { EmailCategory } from "@/lib/email-classifier";

export interface EmailDetailData {
  id: number;
  subject: string;
  from: {
    name: string;
    address: string;
  };
  to: Array<{ name: string; address: string }>;
  date: string | null;
  category: EmailCategory;
  html: string;
  text: string;
  attachments: Array<{
    filename: string;
    contentType: string;
    size: number;
    isCalendar?: boolean;
    isImage?: boolean;
    isPdf?: boolean;
  }>;
}

interface EmailViewerModalProps {
  emailId: number | null;
  onClose: () => void;
  onMarkAsRead?: (id: number) => void;
}

export function EmailViewerModal({
  emailId,
  onClose,
  onMarkAsRead,
}: EmailViewerModalProps) {
  const [data, setData] = useState<EmailDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showImages, setShowImages] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!emailId) {
      setData(null);
      return;
    }

    setLoading(true);
    setError("");
    setData(null);
    setShowImages(false);

    fetch(`/api/emails/${emailId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Erreur de récupération de l'email.");
        return res.json();
      })
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
        if (onMarkAsRead) onMarkAsRead(emailId);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [emailId, onMarkAsRead]);

  // Fermer avec la touche Échap
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!emailId) return null;

  // Calcul initiales expéditeur
  const senderName = data?.from?.name || data?.from?.address || "Inconnu";
  const initials = senderName
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "M";

  // Formatage de la date en français
  const formattedDate = data?.date
    ? new Date(data.date).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  function copySubjectAndLink() {
    if (!data) return;
    navigator.clipboard?.writeText?.(
      `Objet : ${data.subject}\nDe : ${senderName} <${data.from.address}>\nDate : ${formattedDate}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-label="Fermer la modal"
      />

      <div className="relative z-10 flex flex-col w-full max-w-4xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* En-tête de la modale */}
        <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-3.5 bg-slate-50/70">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Lecture du message
            </span>
            {data?.category && (
              <EmailCategoryBadge category={data.category} size="sm" />
            )}
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <>
                <button
                  onClick={copySubjectAndLink}
                  title="Copier les références du message"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200/70 transition"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      <span className="text-emerald-700">Copié</span>
                    </>
                  ) : (
                    <>
                      <Share2 size={14} />
                      <span className="hidden sm:inline">Partager</span>
                    </>
                  )}
                </button>
                {data.from.address && (
                  <a
                    href={`mailto:${data.from.address}?subject=Re: ${encodeURIComponent(
                      data.subject
                    )}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
                  >
                    <Reply size={14} />
                    <span>Répondre</span>
                  </a>
                )}
              </>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition"
              aria-label="Fermer"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        {/* Corps principal défilable */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7">
          {loading && (
            <div className="space-y-6 py-6 animate-pulse">
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
                <div className="h-4 w-4/6 bg-slate-100 rounded" />
              </div>
            </div>
          )}

          {error && (
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <AlertCircle size={24} />
              </div>
              <h4 className="text-sm font-bold text-slate-800">
                Impossible d'afficher cet email
              </h4>
              <p className="text-xs text-rose-600 max-w-md mx-auto">{error}</p>
              <button
                onClick={() => {
                  setLoading(true);
                  setError("");
                  fetch(`/api/emails/${emailId}`)
                    .then((res) => res.json())
                    .then((json) => {
                      if (json.error) throw new Error(json.error);
                      setData(json);
                    })
                    .catch((err) => setError(err.message))
                    .finally(() => setLoading(false));
                }}
                className="mt-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Réessayer
              </button>
            </div>
          )}

          {!loading && !error && data && (
            <div className="space-y-6">
              {/* Titre du mail */}
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-snug">
                  {data.subject || "(Sans objet)"}
                </h2>
              </div>

              {/* Bloc Expéditeur / Destinataire / Date (Forme normale d'un mail) */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-sm shadow-indigo-100">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {data.from.name || data.from.address}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {data.from.address && (
                        <span>&lt;{data.from.address}&gt;</span>
                      )}
                    </p>
                    {data.to && data.to.length > 0 && (
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        À : {data.to.map((t) => t.name || t.address).join(", ")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end gap-1 text-xs text-slate-500 shrink-0">
                  <span className="flex items-center gap-1 font-medium">
                    <Clock size={13} className="text-slate-400" />
                    {formattedDate}
                  </span>
                </div>
              </div>

              {/* Pièces jointes (si présentes) */}
              {data.attachments && data.attachments.length > 0 && (
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2.5">
                    <Paperclip size={14} className="text-slate-500" />
                    <span>Pièces jointes ({data.attachments.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.attachments.map((att, index) => {
                      const isCalendar = att.isCalendar;
                      const isPdf = att.isPdf;
                      const sizeFormatted = att.size
                        ? `${Math.round(att.size / 1024)} Ko`
                        : "";

                      return (
                        <div
                          key={index}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white border border-slate-200 shadow-2xs hover:border-indigo-200 transition text-xs"
                        >
                          <div className="p-1 rounded-md bg-indigo-50 text-indigo-600">
                            {isCalendar ? (
                              <Calendar size={15} />
                            ) : isPdf ? (
                              <FileText size={15} />
                            ) : (
                              <Paperclip size={15} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 truncate max-w-[180px]">
                              {att.filename}
                            </p>
                            {sizeFormatted && (
                              <p className="text-[10px] text-slate-400">
                                {sizeFormatted}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Contenu formaté de l'email */}
              <FormattedEmailBody
                html={data.html}
                text={data.text}
                showImages={showImages}
                onToggleImages={() => setShowImages(!showImages)}
              />
            </div>
          )}
        </div>

        {/* Pied de la modale */}
        <div className="border-t border-slate-100 px-5 py-3 bg-slate-50/50 flex items-center justify-between text-xs text-slate-400">
          <span>Boîte Zmail · INSA Lyon</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
