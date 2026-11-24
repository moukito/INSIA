"use client";

import { useState, useEffect, useRef } from "react";
import {
  Compass,
  Sparkles,
  CheckSquare,
  Square,
  Loader2,
  AlertCircle,
  RotateCcw,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

const DEPARTEMENTS_DEFAUT = ["BTBI", "GM", "TC", "IF", "GCU", "GI", "MT", "GE", "GEN"];

const API_URL = "http://127.0.0.1:8000";

const LABELS_CATEGORIES: Record<string, string> = {
  maths_physique: "Maths & Physique",
  informatique_reseaux: "Informatique & Réseaux",
  electronique_energie: "Électronique & Énergie",
  mecanique_materiaux: "Mécanique & Matériaux",
  vivant_chimie: "Vivant & Chimie",
  construction_environnement: "Construction & Environnement",
  industrie_organisation: "Industrie & Organisation",
  theorie_pratique: "Théorie vs Pratique",
  projet_metier: "Projet & Métier",
};

type QuestionData = {
  numero: number;
  total: number;
  type: "qcm" | "echelle";
  categorie: string;
  texte: string;
  options: string[];
};

type DepartementResult = {
  departement: string;
  score_matching: number;
  scores_par_categorie: { categorie: string; score: number }[];
  mini_explication: string;
};

type ResultatData = {
  classement: DepartementResult[];
  analyse_par_theme: { categorie: string; explication: string }[];
  explication_detaillee: string;
  avertissements?: string[];
};

export function OrientationView() {
  const [etape, setEtape] = useState<"accueil" | "config" | "questionnaire" | "resultat">("accueil");

  const [departementsDisponibles, setDepartementsDisponibles] = useState<string[]>(DEPARTEMENTS_DEFAUT);
  const [departementsChoisis, setDepartementsChoisis] = useState<string[]>(DEPARTEMENTS_DEFAUT);
  const [nbQuestions, setNbQuestions] = useState<number>(15);
  const [preferences, setPreferences] = useState<string>("");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [resultat, setResultat] = useState<ResultatData | null>(null);
  const [chargement, setChargement] = useState<boolean>(false);
  const [erreur, setErreur] = useState<string>("");
  const [deptOuvert, setDeptOuvert] = useState<string | null>(null);

  const verrouEnvoi = useRef<boolean>(false);

  useEffect(() => {
    fetch(`${API_URL}/api/orientation/departements`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setDepartementsDisponibles(data);
          setDepartementsChoisis(data);
        }
      })
      .catch(() => {});
  }, []);

  function toggleDepartement(dept: string) {
    setDepartementsChoisis((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  }

  function toggleTousDepartements() {
    if (departementsChoisis.length === departementsDisponibles.length) {
      setDepartementsChoisis([]);
    } else {
      setDepartementsChoisis(departementsDisponibles);
    }
  }

  async function lancerSession() {
    if (verrouEnvoi.current) return;
    if (departementsChoisis.length === 0) {
      setErreur("Sélectionne au moins un département.");
      return;
    }
    if (nbQuestions < 10 || nbQuestions > 50) {
      setErreur("Le nombre de questions doit être compris entre 10 et 50.");
      return;
    }

    verrouEnvoi.current = true;
    setChargement(true);
    setErreur("");

    try {
      const res = await fetch(`${API_URL}/api/orientation/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departements: departementsChoisis,
          nb_questions: nbQuestions,
          preferences,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Erreur lors du démarrage du questionnaire.");
      }

      setSessionId(data.session_id);
      if (data.fini) {
        setResultat(data.resultat);
        setEtape("resultat");
      } else {
        setQuestion(data.question);
        setEtape("questionnaire");
      }
    } catch (err) {
      setErreur(
        err instanceof Error
          ? err.message
          : "Impossible de contacter le serveur backend."
      );
    } finally {
      verrouEnvoi.current = false;
      setChargement(false);
    }
  }

  async function envoyerReponse(numeroChoisi: number) {
    if (!sessionId || verrouEnvoi.current) return;

    verrouEnvoi.current = true;
    setChargement(true);
    setErreur("");

    try {
      const res = await fetch(`${API_URL}/api/orientation/sessions/${sessionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numeros: [numeroChoisi] }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Erreur lors de l'envoi de la réponse.");
      }

      if (data.fini) {
        setResultat(data.resultat);
        setQuestion(null);
        setEtape("resultat");
      } else {
        setQuestion(data.question);
      }
    } catch (err) {
      setErreur(
        err instanceof Error
          ? err.message
          : "Erreur de communication avec le backend."
      );
    } finally {
      verrouEnvoi.current = false;
      setChargement(false);
    }
  }

  function recommencer() {
    verrouEnvoi.current = false;
    setEtape("config");
    setSessionId(null);
    setQuestion(null);
    setResultat(null);
    setDeptOuvert(null);
    setErreur("");
  }

  const estDerniereQuestion = question ? question.numero >= question.total : false;

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-600 p-6 text-white shadow-xl shadow-indigo-100 sm:p-9">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium">
          <Compass size={14} /> Orientation INSA Lyon
        </div>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Trouve ton département idéal
        </h2>
        <p className="mt-2 max-w-xl text-sm text-indigo-100">
          Réponds à un questionnaire adapté à ton profil pour découvrir les départements qui te correspondent le mieux.
        </p>
      </div>

      {erreur && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-700">
          <AlertCircle size={16} className="shrink-0" />
          <span>{erreur}</span>
        </div>
      )}

      {etape === "accueil" && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-slate-900">
            Prêt à découvrir le département fait pour toi ?
          </h3>
          <p className="text-sm text-slate-500 max-w-2xl">
            Tu vas pouvoir sélectionner les départements qui t&apos;intéressent et choisir la longueur du questionnaire avant de lancer l&apos;analyse IA.
          </p>
          <button
            onClick={() => setEtape("config")}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            <Sparkles size={16} /> Démarrer le questionnaire
          </button>
        </div>
      )}

      {etape === "config" && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-bold text-slate-900">
                1. Départements à évaluer ({departementsChoisis.length} sélectionné{departementsChoisis.length > 1 ? "s" : ""})
              </label>
              <button
                type="button"
                onClick={toggleTousDepartements}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                {departementsChoisis.length === departementsDisponibles.length
                  ? "Tout décocher"
                  : "Tout cocher"}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
              {departementsDisponibles.map((dept) => {
                const coche = departementsChoisis.includes(dept);
                return (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => toggleDepartement(dept)}
                    className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition ${
                      coche
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {coche ? (
                      <CheckSquare size={17} className="text-indigo-600 shrink-0" />
                    ) : (
                      <Square size={17} className="text-slate-300 shrink-0" />
                    )}
                    <span>{dept}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="nb-questions"
              className="block text-sm font-bold text-slate-900 mb-2"
            >
              2. Nombre de questions (entre 10 et 50)
            </label>
            <div className="flex items-center gap-4 max-w-md">
              <input
                id="nb-questions"
                type="range"
                min={10}
                max={50}
                value={nbQuestions}
                onChange={(e) => setNbQuestions(Number(e.target.value))}
                className="flex-1 accent-indigo-600"
              />
              <input
                type="number"
                min={10}
                max={50}
                value={nbQuestions}
                onChange={(e) => setNbQuestions(Number(e.target.value))}
                className="w-20 rounded-xl border border-slate-200 px-3 py-2 text-center text-sm font-bold text-slate-900 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="preferences"
              className="block text-sm font-bold text-slate-900 mb-2"
            >
              3. Tes préférences de départ (optionnel)
            </label>
            <textarea
              id="preferences"
              rows={3}
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              placeholder="Ex. : J'aime l'informatique et la cybersécurité, je préfère la pratique à la théorie..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={lancerSession}
              disabled={chargement}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {chargement ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Génération de la première question...
                </>
              ) : (
                <>
                  Lancer les questions <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {etape === "questionnaire" && question && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-5">
          <div className="space-y-2 border-b border-slate-100 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-lg bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                Question {question.numero} / {question.total}
              </span>
              <span className="text-xs font-medium text-slate-400">
                Thème : {LABELS_CATEGORIES[question.categorie] || question.categorie}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${Math.min((question.numero / question.total) * 100, 100)}%` }}
              />
            </div>
          </div>

          <div className="space-y-1">
            {question.type === "echelle" && (
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Est-ce que cela te correspond ?
              </p>
            )}
            <h3 className="text-lg font-bold text-slate-900">
              {question.type === "echelle" ? `« ${question.texte} »` : question.texte}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {question.options.map((option, index) => (
              <button
                key={index}
                type="button"
                disabled={chargement}
                onClick={() => envoyerReponse(index + 1)}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left text-sm font-medium text-slate-800 transition hover:border-indigo-500 hover:bg-indigo-50/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700">
                  {index + 1}
                </span>
                <span>{option}</span>
              </button>
            ))}
          </div>

          {chargement && (
            <div className="flex items-center gap-2 rounded-xl bg-indigo-50/70 p-3 text-xs font-medium text-indigo-700">
              <Loader2 size={15} className="animate-spin shrink-0" />
              <span>
                {estDerniereQuestion
                  ? "Toutes les questions sont terminées ! Rédaction de ton compte rendu personnalisé en cours (10 à 15 secondes)..."
                  : "Analyse de ta réponse et préparation de la question suivante..."}
              </span>
            </div>
          )}
        </div>
      )}

      {etape === "resultat" && resultat && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Classement & matching par département
                </h3>
                <p className="text-xs text-slate-400">
                  Score d&apos;adéquation absolu sur 100 pour chaque département sélectionné
                </p>
              </div>
              <button
                type="button"
                onClick={recommencer}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <RotateCcw size={14} /> Refaire le test
              </button>
            </div>

            <div className="space-y-4">
              {resultat.classement.map((item, idx) => {
                const estOuvert = deptOuvert === item.departement;
                return (
                  <div
                    key={item.departement}
                    className={`rounded-xl border p-4 space-y-3 transition ${
                      idx === 0
                        ? "border-indigo-200 bg-indigo-50/40"
                        : "border-slate-100 bg-slate-50/60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-slate-900">
                        {idx + 1}. {item.departement}
                      </span>
                      <span
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold text-white ${
                          idx === 0 ? "bg-indigo-600" : "bg-slate-700"
                        }`}
                      >
                        {item.score_matching.toFixed(1)} / 100
                      </span>
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full ${
                          idx === 0 ? "bg-indigo-600" : "bg-slate-500"
                        }`}
                        style={{ width: `${item.score_matching}%` }}
                      />
                    </div>

                    <p className="text-xs leading-5 text-slate-600">
                      {item.mini_explication}
                    </p>

                    {item.scores_par_categorie && item.scores_par_categorie.length > 0 && (
                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            setDeptOuvert(estOuvert ? null : item.departement)
                          }
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          <ChevronDown
                            size={13}
                            className={`transition-transform ${estOuvert ? "rotate-180" : ""}`}
                          />
                          <span>
                            {estOuvert ? "Masquer" : "Voir"} les scores par thème
                          </span>
                        </button>

                        {estOuvert && (
                          <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200/70">
                            {item.scores_par_categorie.map((sc) => (
                              <div
                                key={sc.categorie}
                                className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 text-[11px] border border-slate-100"
                              >
                                <span className="text-slate-600 truncate pr-2">
                                  {LABELS_CATEGORIES[sc.categorie] || sc.categorie}
                                </span>
                                <span className="font-bold text-slate-900 shrink-0">
                                  {sc.score.toFixed(0)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Analyse par thème</h3>
              <p className="text-xs text-slate-400">
                Ce que tes réponses révèlent sur chaque dimension
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {resultat.analyse_par_theme.map((theme) => (
                <div
                  key={theme.categorie}
                  className="rounded-xl border border-slate-100 p-4 space-y-1.5"
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                    {LABELS_CATEGORIES[theme.categorie] || theme.categorie}
                  </p>
                  <p className="text-xs leading-5 text-slate-600">
                    {theme.explication}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Compte rendu détaillé</h3>
              <p className="text-xs text-slate-400">
                Interprétation complète de ton profil et justification du classement
              </p>
            </div>
            <p className="whitespace-pre-line text-sm leading-6 text-slate-700">
              {resultat.explication_detaillee}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}