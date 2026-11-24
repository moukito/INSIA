/**
 * Profil étudiant – INSIA
 *
 * Ce module centralise les informations de l'étudiant connecté.
 * À terme, ces données viendront d'une authentification réelle (LDAP / SSO INSA).
 * Pour l'instant, le département est déduit de l'adresse email IMAP configurée.
 *
 * Règle de déduction :
 *   - `omeima.kotti@insa-lyon.fr`  → TC  (login TC connu)
 *   - adresses *@insa-lyon.fr avec tag dept-if / if  → IF
 *   - adresses *@insa-lyon.fr génériques             → "INSA Lyon"
 */

export type Department =
  | "TC"   // Télécommunications
  | "IF"   // Informatique
  | "GEN"  // Génie Electrique & Optique
  | "GMC"  // Génie Mécanique et Civil
  | "SGM"  // Science et Génie des Matériaux
  | "SPE"  // Sciences et Physique de l'Environnement
  | "BiS"  // Biosciences
  | "GI"   // Génie Industriel
  | null;  // non déterminé

export interface UserProfile {
  /** Prénom */
  firstName: string;
  /** Nom */
  lastName: string;
  /** Initiales (pour l'avatar) */
  initials: string;
  /** Adresse email complète */
  email: string;
  /** Département (null = générique / inconnu) */
  department: Department;
  /** Libellé long du département pour l'affichage */
  departmentLabel: string;
  /** Promotion (ex: "5TC", "4IF", "3GEN") */
  promo: string;
  /** Établissement */
  school: string;
}

/**
 * Déduit le département à partir de l'adresse email ou du login IMAP.
 * On peut enrichir cette fonction à partir de l'API LDAP INSA ultérieurement.
 */
function inferDepartment(email: string): { dept: Department; label: string; promo: string } {
  const e = email.toLowerCase();

  // Heuristique sur le login (préfixe avant @)
  const login = e.split("@")[0] ?? "";

  // Listes de logins TC connus (peut être étendu)
  const knownTC = ["omeima.kotti", "o.kotti"];
  if (knownTC.some((l) => login === l) || e.includes("dept-tc") || e.includes("@tc.insa")) {
    return { dept: "TC", label: "Télécommunications", promo: "5TC" };
  }
  if (e.includes("dept-if") || e.includes("@if.insa")) {
    return { dept: "IF", label: "Informatique", promo: "5IF" };
  }

  // Fallback : on retourne null (générique)
  return { dept: null, label: "INSA Lyon", promo: "" };
}

function buildProfile(): UserProfile {
  // Adresse email de l'étudiant connecté – lue depuis la variable d'environnement
  // si disponible, sinon valeur par défaut (session locale).
  const rawEmail =
    (typeof process !== "undefined" && process.env.IMAP_USER) ||
    "omeima.kotti@insa-lyon.fr";

  // Déduire prénom / nom depuis l'email (login = prenom.nom ou initialenom)
  const login = rawEmail.split("@")[0] ?? "";
  const parts = login.split(".");
  const firstName =
    parts.length >= 2
      ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
      : login;
  const lastName =
    parts.length >= 2
      ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1)
      : "";

  const initials =
    (firstName[0] ?? "") + (lastName[0] ?? "").toUpperCase() || "?";

  const { dept, label, promo } = inferDepartment(rawEmail);

  return {
    firstName,
    lastName,
    initials,
    email: rawEmail,
    department: dept,
    departmentLabel: label,
    promo,
    school: "INSA Lyon",
  };
}

/** Profil de l'étudiant actuellement connecté. */
export const CURRENT_USER: UserProfile = buildProfile();

/**
 * Retourne le label court du département pour l'affichage dans l'interface.
 * Si le département est inconnu, retourne "Mon département".
 */
export function getDeptShortLabel(user: UserProfile = CURRENT_USER): string {
  if (user.department) return user.department;
  return "Mon département";
}

/**
 * Retourne le libellé complet pour les filtres email, planning, etc.
 * Ex: "Département TC" ou "Mon département" si inconnu.
 */
export function getDeptFilterLabel(user: UserProfile = CURRENT_USER): string {
  if (user.department) return `Département ${user.department}`;
  return "Mon département";
}

/**
 * Retourne la promo formatée pour l'affichage dans le profil sidebar.
 * Ex: "5TC · INSA Lyon" ou "INSA Lyon"
 */
export function getPromoDisplay(user: UserProfile = CURRENT_USER): string {
  if (user.promo) return `${user.promo} · ${user.school}`;
  return user.school;
}
