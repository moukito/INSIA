export type EmailCategory =
  | "stage"
  | "departement"
  | "association"
  | "urgence"
  | "cours"
  | "autre";

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
    label: "Offres de stage & Recrutement",
    shortLabel: "Offre de stage",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-700",
    badgeBorder: "border-emerald-200",
    dotColor: "bg-emerald-500",
    icon: "Briefcase",
  },
  departement: {
    id: "departement",
    label: "Mon département",
    shortLabel: "Département",
    badgeBg: "bg-blue-50",
    badgeText: "text-blue-700",
    badgeBorder: "border-blue-200",
    dotColor: "bg-blue-500",
    icon: "Building2",
  },
  association: {
    id: "association",
    label: "Associations & Vie étudiante",
    shortLabel: "Association",
    badgeBg: "bg-purple-50",
    badgeText: "text-purple-700",
    badgeBorder: "border-purple-200",
    dotColor: "bg-purple-500",
    icon: "Users",
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
  cours: {
    id: "cours",
    label: "Cours & Campus",
    shortLabel: "Cours",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-800",
    badgeBorder: "border-amber-200",
    dotColor: "bg-amber-500",
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
  const s = subject.toLowerCase();
  const fn = fromName.toLowerCase();
  const fa = fromAddress.toLowerCase();

  // Détection des élections ou conseils de département (ne pas confondre avec offres de stage)
  const isDeptCouncilOrElection =
    s.includes("conseil de département") ||
    s.includes("conseil de departement") ||
    s.includes("élections du conseil") ||
    s.includes("elections du conseil") ||
    s.includes("collège unique") ||
    s.includes("college unique");

  // 1. Offres de stage, alternance & recrutement
  const isStage =
    s.includes("offre de stage") ||
    s.includes("offres de stage") ||
    s.includes("sujet de stage") ||
    s.includes("sujets de stage") ||
    s.includes("convention de stage") ||
    s.includes("stage pfe") ||
    s.includes("stage ingénieur") ||
    s.includes("stage ingenieur") ||
    s.includes("stage ouvrier") ||
    s.includes("stage technicien") ||
    s.includes("stage rémunéré") ||
    s.includes("stage remunere") ||
    s.includes("internship") ||
    s.includes("alternance") ||
    s.includes("embauche") ||
    s.includes("offre d'emploi") ||
    s.includes("offre d’emploi") ||
    s.includes("nouvelles offres d'emploi") ||
    s.includes("forum entreprises") ||
    s.includes("job dating") ||
    fa.includes("hellowork") ||
    fa.includes("jobteaser") ||
    fa.includes("jobs2web") ||
    fa.includes("indeed") ||
    fa.includes("efinancialcareers") ||
    fa.includes("hackerrank") ||
    fa.includes("teamtailor") ||
    fa.includes("recruteur") ||
    fa.includes("alstom-job") ||
    fa.includes("orange.jobs") ||
    fa.includes("groupeonepoint") ||
    text.includes("espace carrières") ||
    text.includes("espace carrieres") ||
    ((s.includes("stage") ||
      s.includes("recrutement") ||
      s.includes("candidature") ||
      s.includes("entretien d'embauche") ||
      s.includes("votre cv")) &&
      !isDeptCouncilOrElection &&
      !s.includes("fondation"));

  if (isStage) {
    return "stage";
  }

  // 2. Associations & Vie étudiante
  const isAsso =
    fa.includes("asso-insa") ||
    fa.includes("bde") ||
    fa.includes("bds") ||
    fa.includes("bda") ||
    fa.includes("elus.etudiants") ||
    fa.includes("kfet") ||
    fa.includes("k-fet") ||
    fn.includes("vie associative") ||
    fn.includes("elus étudiants") ||
    fn.includes("élus étudiants") ||
    fn.includes("bde") ||
    fn.includes("bds") ||
    fn.includes("bda") ||
    fn.includes("club") ||
    fn.includes("association") ||
    s.includes("[info.associations]") ||
    s.includes("missive va") ||
    s.includes("temps d’échange entre élèves") ||
    s.includes("temps d'échange entre élèves") ||
    s.includes("mobilisation étudiante") ||
    s.includes("raid insa") ||
    s.includes("resultats raid") ||
    s.includes("k-fet") ||
    s.includes("kfet") ||
    s.includes("foyer") ||
    s.includes("karnaval") ||
    s.includes("carnaval") ||
    s.includes("gala insa") ||
    s.includes("24h de l'insa") ||
    s.includes("24h insa") ||
    s.includes("soirée") ||
    s.includes("soiree") ||
    s.includes("vie étudiante") ||
    s.includes("vie etudiante") ||
    s.includes("wei insa") ||
    s.includes("campagne bde") ||
    s.includes("humanitaire") ||
    text.includes("bureau des élèves") ||
    text.includes("bureau des eleves") ||
    text.includes("bureau des sports") ||
    text.includes("bureau des arts");

  if (isAsso) {
    return "association";
  }

  // 3. Département (TC ou IF)
  const isDepartement =
    isDeptCouncilOrElection ||
    s.includes("[etudiants tc") ||
    s.includes("[étudiants tc") ||
    s.includes("[etudiants 5tc") ||
    s.includes("[etudiants 4tc") ||
    s.includes("[etudiants 3tc") ||
    s.includes("[etudiants if") ||
    s.includes("[étudiants if") ||
    s.includes("[etudiants 5if") ||
    s.includes("[etudiants 4if") ||
    s.includes("[etudiants 3if") ||
    s.includes("département tc") ||
    s.includes("departement tc") ||
    s.includes("département telecommunications") ||
    s.includes("département télécommunications") ||
    s.includes("conseil de département tc") ||
    s.includes("département if") ||
    s.includes("departement if") ||
    s.includes("département informatique") ||
    s.includes("conseil de département if") ||
    s.includes("insal-tc-pi") ||
    s.includes("5tc") ||
    s.includes("4tc") ||
    s.includes("3tc") ||
    s.includes("5if") ||
    s.includes("4if") ||
    s.includes("3if") ||
    text.includes("scolarité tc") ||
    text.includes("scolarite tc") ||
    text.includes("secrétariat tc") ||
    text.includes("secretariat tc") ||
    text.includes("scolarité if") ||
    text.includes("scolarite if") ||
    text.includes("secrétariat if") ||
    text.includes("secretariat if") ||
    fa.includes("christelle.debize@insa-lyon.fr") ||
    fa.includes("razvan.stanica@insa-lyon.fr") ||
    fa.includes("tc@insa-lyon.fr") ||
    fa.includes("if@insa-lyon.fr") ||
    fa.includes("secr-tc") ||
    fa.includes("secr-if") ||
    fa.includes("dept-tc") ||
    fa.includes("dept-if") ||
    fa.includes("telecom@insa-lyon.fr") ||
    fa.includes("informatique@insa-lyon.fr");

  if (isDepartement) {
    return "departement";
  }

  // 4. Urgence & Important
  if (
    s.includes("urgent") ||
    s.includes("urgence") ||
    s.includes("alerte") ||
    s.includes("important") ||
    s.includes("erreur de connexion") ||
    s.includes("action requise") ||
    s.includes("dernier délai") ||
    s.includes("dernier delai") ||
    s.includes("convocation")
  ) {
    return "urgence";
  }

  // 5. Cours & Vie académique générale / Campus
  if (
    s.includes("cours") ||
    s.includes("ds arm") ||
    s.includes("exam") ||
    s.includes("partiel") ||
    s.includes("moodle") ||
    s.includes("tp ") ||
    s.includes("td ") ||
    s.includes("amphi") ||
    s.includes("affluences") ||
    fa.includes("affluences") ||
    s.includes("bibliothèque") ||
    s.includes("bibliotheque") ||
    s.includes("carrel") ||
    s.includes("yoga") ||
    s.includes("sport")
  ) {
    return "cours";
  }

  return "autre";
}
