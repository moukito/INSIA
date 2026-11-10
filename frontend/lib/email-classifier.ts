export type EmailCategory = "stage" | "urgence" | "association" | "cours" | "autre";

export interface CategoryInfo {
  id: EmailCategory;
  label: string;
  shortLabel: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  icon: string;
}

export const CATEGORIES: Record<EmailCategory, CategoryInfo> = {
  stage: {
    id: "stage",
    label: "Stages & Recrutement",
    shortLabel: "Stage",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-700",
    badgeBorder: "border-emerald-200",
    dotColor: "bg-emerald-500",
    icon: "Briefcase",
  },
  urgence: {
    id: "urgence",
    label: "Urgences & Important",
    shortLabel: "Urgent",
    badgeBg: "bg-rose-50",
    badgeText: "text-rose-700",
    badgeBorder: "border-rose-200",
    dotColor: "bg-rose-500",
    icon: "AlertTriangle",
  },
  association: {
    id: "association",
    label: "Associations & Vie étudiante",
    shortLabel: "Asso",
    badgeBg: "bg-purple-50",
    badgeText: "text-purple-700",
    badgeBorder: "border-purple-200",
    dotColor: "bg-purple-500",
    icon: "Users",
  },
  cours: {
    id: "cours",
    label: "Cours & Campus",
    shortLabel: "Cours",
    badgeBg: "bg-blue-50",
    badgeText: "text-blue-700",
    badgeBorder: "border-blue-200",
    dotColor: "bg-blue-500",
    icon: "GraduationCap",
  },
  autre: {
    id: "autre",
    label: "Autres",
    shortLabel: "Autre",
    badgeBg: "bg-slate-50",
    badgeText: "text-slate-600",
    badgeBorder: "border-slate-200",
    dotColor: "bg-slate-400",
    icon: "Mail",
  },
};

export function classifyEmail(
  subject: string = "",
  fromName: string = "",
  fromAddress: string = ""
): EmailCategory {
  const text = `${subject} ${fromName} ${fromAddress}`.toLowerCase();

  // 1. Urgence & Important (prioritaire si rappel ou action critique)
  if (
    text.includes("urgent") ||
    text.includes("urgence") ||
    text.includes("rappel") ||
    text.includes("important") ||
    text.includes("alerte") ||
    text.includes("dernier délai") ||
    text.includes("action requise") ||
    text.includes("mobilisation") ||
    text.includes("attention") ||
    text.includes("deadline") ||
    text.includes("convocation")
  ) {
    return "urgence";
  }

  // 2. Stage & Recrutement & Alternance & Offres
  if (
    text.includes("stage") ||
    text.includes("entretien") ||
    text.includes("alternance") ||
    text.includes("recrutement") ||
    text.includes("candidature") ||
    text.includes("candidat") ||
    text.includes("offre d'emploi") ||
    text.includes("offre") ||
    text.includes("hellowork") ||
    text.includes("indeed") ||
    text.includes("jobteaser") ||
    text.includes("alstom-job") ||
    text.includes("alstom") ||
    text.includes("orange.jobs") ||
    text.includes("groupeonepoint") ||
    text.includes("onepoint") ||
    text.includes("recruteur") ||
    text.includes("jobnotification") ||
    text.includes("jobalert") ||
    text.includes("cv") ||
    text.includes("rh")
  ) {
    return "stage";
  }

  // 3. Associations & Vie étudiante & Élus
  if (
    text.includes("association") ||
    text.includes("asso") ||
    text.includes("bde") ||
    text.includes("bds") ||
    text.includes("bda") ||
    text.includes("club") ||
    text.includes("elus") ||
    text.includes("élus") ||
    text.includes("étudiant") ||
    text.includes("etudiant") ||
    text.includes("vie étudiante") ||
    text.includes("soirée") ||
    text.includes("foyer") ||
    text.includes("k-fêt") ||
    text.includes("kfet") ||
    text.includes("forum") ||
    text.includes("gala") ||
    text.includes("bureau des") ||
    text.includes("humanitaire") ||
    text.includes("carnaval")
  ) {
    return "association";
  }

  // 4. Cours & Vie académique / Campus
  if (
    text.includes("cours") ||
    text.includes("tp") ||
    text.includes("td") ||
    text.includes("examen") ||
    text.includes("partiel") ||
    text.includes("note") ||
    text.includes("amphi") ||
    text.includes("bibliothèque") ||
    text.includes("bibliotheque") ||
    text.includes("carrel") ||
    text.includes("affluences") ||
    text.includes("professeur") ||
    text.includes("enseignant") ||
    text.includes("lab") ||
    text.includes("assignement") ||
    text.includes("assignment") ||
    text.includes("moodle") ||
    text.includes("sport") ||
    text.includes("yoga") ||
    text.includes("5tc") ||
    text.includes("4tc") ||
    text.includes("3tc") ||
    text.includes("fimi") ||
    text.includes("insa")
  ) {
    return "cours";
  }

  return "autre";
}
