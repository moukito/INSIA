"use client";

import { useState } from "react";
import { Video, ExternalLink, ChevronDown, ChevronUp, Image as ImageIcon } from "lucide-react";

interface FormattedEmailBodyProps {
  html: string;
  text: string;
  showImages: boolean;
  onToggleImages: () => void;
}

export function FormattedEmailBody({
  html,
  text,
  showImages,
  onToggleImages,
}: FormattedEmailBodyProps) {
  const [viewMode, setViewMode] = useState<"html" | "text">(html ? "html" : "text");
  const [showLegal, setShowLegal] = useState(false);

  // Détection de réunion en visio (Teams, Zoom, Google Meet)
  const meetingMatch =
    text.match(/https:\/\/(?:teams\.microsoft\.com\/[^\s<>"]+|meet\.google\.com\/[^\s<>"]+|[a-zA-Z0-9-]+\.zoom\.us\/j\/[^\s<>"]+)/i) ||
    html.match(/href="(https:\/\/(?:teams\.microsoft\.com\/[^\s<>"]+|meet\.google\.com\/[^\s<>"]+|[a-zA-Z0-9-]+\.zoom\.us\/j\/[^\s<>"]+))"/i);

  const meetingUrl = meetingMatch ? (meetingMatch[1] || meetingMatch[0]) : null;

  // Détection code secret ou ID de réunion
  const meetingIdMatch = text.match(/(?:Num[ée]ro de r[ée]union|Meeting ID)\s*:\s*([0-9\s]+)/i);
  const passcodeMatch = text.match(/(?:Code secret|Passcode)\s*:\s*([a-zA-Z0-9]+)/i);

  // Découpage du texte pour séparer les mentions légales longues
  const legalSeparators = [
    /_{10,}/,
    /Ce message et ses pieces jointes peuvent contenir/i,
    /This message and its attachments may contain confidential/i,
    /CAUTION : This email originated outside/i,
    /ATTENTION : Cet e-mail provient de l'extérieur/i,
  ];

  let mainText = text;
  let legalNotice = "";

  for (const sep of legalSeparators) {
    const parts = text.split(sep);
    if (parts.length > 1 && parts[0].trim().length > 30) {
      mainText = parts[0];
      legalNotice = parts.slice(1).join("\n").trim();
      break;
    }
  }

  // Injecter un style propre pour les emails HTML dans l'iframe
  const iframeContent = html
    ? `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https:; ${
    showImages ? "img-src data: https: http:;" : "img-src data:;"
  } font-src https: data:; link-src https:; base-uri 'none';">
  <base target="_blank">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #1e293b;
      margin: 0;
      padding: 16px;
      word-wrap: break-word;
      background: #ffffff;
    }
    img { max-width: 100% !important; height: auto !important; }
    table { max-width: 100% !important; border-collapse: collapse; }
    a { color: #4f46e5; text-decoration: underline; }
    p { margin-top: 0; margin-bottom: 1em; }
    blockquote {
      border-left: 3px solid #cbd5e1;
      padding-left: 12px;
      color: #64748b;
      margin: 12px 0;
    }
    pre, code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
      background: #f8fafc;
      padding: 8px 12px;
      border-radius: 6px;
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>`
    : "";

  return (
    <div className="space-y-4">
      {/* Bannière de détection de réunion en visio */}
      {meetingUrl && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 text-indigo-950">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-indigo-200">
              <Video size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-indigo-900">
                Lien de visioconférence détecté
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-indigo-700">
                {meetingIdMatch && (
                  <span>N° réunion : <strong>{meetingIdMatch[1].trim()}</strong></span>
                )}
                {passcodeMatch && (
                  <span>· Code secret : <strong>{passcodeMatch[1].trim()}</strong></span>
                )}
              </div>
            </div>
          </div>
          <a
            href={meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition"
          >
            Rejoindre la visio <ExternalLink size={13} />
          </a>
        </div>
      )}

      {/* Barre d'outils d'affichage : Images externes & bascule HTML / Texte */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          {html && (
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
              <button
                onClick={() => setViewMode("html")}
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  viewMode === "html"
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Mise en page e-mail
              </button>
              <button
                onClick={() => setViewMode("text")}
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  viewMode === "text"
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Texte clair
              </button>
            </div>
          )}
        </div>

        {html && viewMode === "html" && (
          <button
            onClick={onToggleImages}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition ${
              showImages
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <ImageIcon size={13} />
            {showImages ? "Images affichées" : "Afficher les images externes"}
          </button>
        )}
      </div>

      {/* Contenu HTML formaté */}
      {viewMode === "html" && html ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <iframe
            title="Contenu du mail"
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            srcDoc={iframeContent}
            className="w-full min-h-[420px] max-h-[640px] resize-y rounded-xl border-none"
          />
        </div>
      ) : (
        /* Contenu Texte propre */
        <div className="rounded-xl border border-slate-200/80 bg-white p-5 text-sm leading-relaxed text-slate-800 shadow-xs">
          <div className="whitespace-pre-wrap break-words font-sans space-y-3">
            {mainText.split("\n\n").map((para, i) => {
              const cleanPara = para.trim();
              if (!cleanPara) return null;

              // Si c'est une citation de réponse
              if (cleanPara.startsWith(">") || cleanPara.startsWith("De :") || cleanPara.startsWith("From:")) {
                return (
                  <blockquote
                    key={i}
                    className="border-l-3 border-indigo-200 pl-3.5 py-1 my-2 text-xs text-slate-500 bg-slate-50/60 rounded-r-lg"
                  >
                    {cleanPara}
                  </blockquote>
                );
              }

              return (
                <p key={i} className="text-slate-700 leading-6 text-sm">
                  {cleanPara}
                </p>
              );
            })}
          </div>

          {/* Mentions légales / Confidentialité rétractable */}
          {legalNotice && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <button
                onClick={() => setShowLegal(!showLegal)}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 transition"
              >
                <span>Mentions légales & confidentialité ({legalNotice.length} caractères)</span>
                {showLegal ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showLegal && (
                <div className="mt-2 p-3 rounded-lg bg-slate-50 text-[11px] leading-5 text-slate-500 whitespace-pre-wrap">
                  {legalNotice}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
