export interface AssociationEvent {
  id: number;
  emailId: number;
  title: string;
  association: string;
  date: string;
  fullDate: string;
  day: string;
  month: string;
  time: string;
  place: string;
  category: "Soirée" | "Sport" | "Culture" | "Solidarité" | "Conférence" | "Vie étudiante";
  badge: string;
  sourceSubject: string;
  description: string;
  color: string;
}

/**
 * Liste des vrais événements associatifs extraits directement des emails reçus
 * dans la boîte aux lettres Zmail INSA Lyon (Missives de la Vie Associative et Élus étudiants).
 */
export const REAL_ASSOCIATION_EVENTS: AssociationEvent[] = [
  {
    id: 1,
    emailId: 34584,
    title: "Soirée recrutement, démontage & plancha",
    association: "Club Les Bikers (Vélo INSA)",
    date: "Mardi 17 Novembre",
    fullDate: "Mardi 17 Novembre 2026",
    day: "17",
    month: "NOV",
    time: "19:00 - Fin de soirée",
    place: "Résidence H - RdC (en face de la K-Fêt)",
    category: "Soirée",
    badge: "Missive VA #8",
    sourceSubject: "[info.associations] MISSIVE VA #8 - Malgré les exams de novembre, se détendre avec les event VA",
    description:
      "Soirée démontage pour faire découvrir le monde de l'autoréparation de vélo. Sortie de vélos de la cave pour les mettre en pièces avec plancha et boissons toute la soirée !",
    color: "bg-purple-100 text-purple-700 border-purple-200",
  },
  {
    id: 2,
    emailId: 34584,
    title: "Concert Acoustique #2",
    association: "AMI (Association Musicale de l'INSA)",
    date: "Mercredi 18 Novembre",
    fullDate: "Mercredi 18 Novembre 2026",
    day: "18",
    month: "NOV",
    time: "12:45 - 13:45",
    place: "La Rotonde - Salle René Char · Campus La Doua",
    category: "Culture",
    badge: "Missive VA #8",
    sourceSubject: "[info.associations] MISSIVE VA #8 - Malgré les exams de novembre, se détendre avec les event VA",
    description:
      "L'Association Musicale de l'INSA vous invite à venir écouter son concert acoustique #2 pour une pause méridienne conviviale en musique.",
    color: "bg-amber-100 text-amber-700 border-amber-200",
  },
  {
    id: 3,
    emailId: 34577,
    title: "Temps d’échange sur la mobilisation étudiante",
    association: "Élus étudiants INSA Lyon",
    date: "Mercredi 18 Novembre",
    fullDate: "Mercredi 18 Novembre 2026",
    day: "18",
    month: "NOV",
    time: "12:15 - 14:00",
    place: "Amphithéâtre Gaston Berger · Campus La Doua",
    category: "Vie étudiante",
    badge: "Élus Étudiants",
    sourceSubject: "[etudiants.cycle2] Mercredi 18 novembre 12h-14h - Temps d’échange entre élèves de l'INSA Lyon",
    description:
      "Temps d'échange et assemblée générale ouverte à tous les élèves ingénieurs sur les conditions d'études, les blocages et la vie de campus.",
    color: "bg-rose-100 text-rose-700 border-rose-200",
  },
  {
    id: 4,
    emailId: 34584,
    title: "Forum alternatif : Transition écologique & Solidaire",
    association: "ALTE²S (Alternatives Écologiques Étudiantes)",
    date: "Jeudi 19 Novembre",
    fullDate: "Jeudi 19 Novembre 2026",
    day: "19",
    month: "NOV",
    time: "13:00 - 17:30 (Goûter à 17h)",
    place: "La Ruche · Campus La Doua",
    category: "Solidarité",
    badge: "Missive VA #8",
    sourceSubject: "[info.associations] MISSIVE VA #8 - Malgré les exams de novembre, se détendre avec les event VA",
    description:
      "Rencontre de structures engagées dans la transition écologique et l'économie sociale et solidaire (ESS). Opportunités d'engagement, stages et goûter solidaire offert à 17h.",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  {
    id: 5,
    emailId: 34584,
    title: "Atelier fabrication composite (Fibre de carbone)",
    association: "MECASPORT INSA Lyon",
    date: "Jeudi 19 Novembre",
    fullDate: "Jeudi 19 Novembre 2026",
    day: "19",
    month: "NOV",
    time: "14:00 - 17:00",
    place: "CEREP - Sous-sol · Campus La Doua",
    category: "Conférence",
    badge: "Missive VA #8",
    sourceSubject: "[info.associations] MISSIVE VA #8 - Malgré les exams de novembre, se détendre avec les event VA",
    description:
      "Fabriquez votre première pièce en fibre de carbone avec instructeur professionnel dans les locaux de MECASPORT (limité à 10 places, EPI obligatoires).",
    color: "bg-indigo-100 text-indigo-700 border-indigo-200",
  },
  {
    id: 6,
    emailId: 34584,
    title: "Table-ronde : « École de commerce après l'INSA ? »",
    association: "INSA Finance Association (IFA)",
    date: "Jeudi 19 Novembre",
    fullDate: "Jeudi 19 Novembre 2026",
    day: "19",
    month: "NOV",
    time: "18:15 - 19:30",
    place: "Amphithéâtre Marc Seguin · Campus La Doua",
    category: "Conférence",
    badge: "Missive VA #8",
    sourceSubject: "[info.associations] MISSIVE VA #8 - Malgré les exams de novembre, se détendre avec les event VA",
    description:
      "Échanges sur les admissions sur titre (AST) en Masters in Management (HEC, ESSEC, ESCP) et le double diplôme avec l'emlyon. Ouvert à tous sans inscription préalable.",
    color: "bg-blue-100 text-blue-700 border-blue-200",
  },
  {
    id: 7,
    emailId: 34584,
    title: "Match d'Improvisation Théâtrale : « (non)-conformeS »",
    association: "Troupe Théâtrale de l'INSA (TTI)",
    date: "Jeudi 19 Novembre",
    fullDate: "Jeudi 19 Novembre 2026",
    day: "19",
    month: "NOV",
    time: "20:30 - 22:30",
    place: "La Rotonde - Salle de spectacle · Campus La Doua",
    category: "Culture",
    badge: "Missive VA #8",
    sourceSubject: "[info.associations] MISSIVE VA #8 - Malgré les exams de novembre, se détendre avec les event VA",
    description:
      "Match d’improvisation avec la J2P dans le cadre du Fassil centré sur le thème « (non)-conformeS ». Billetterie sur HelloAsso et sur place à prix libre.",
    color: "bg-purple-100 text-purple-700 border-purple-200",
  },
  {
    id: 8,
    emailId: 34584,
    title: "Atelier Céramique & Sculpture en Argile",
    association: "Club Les Lézarts",
    date: "Dimanche 22 Novembre",
    fullDate: "Dimanche 22 Novembre 2026",
    day: "22",
    month: "NOV",
    time: "13:30 - 17:30",
    place: "Résidence B - RdC · Campus La Doua",
    category: "Culture",
    badge: "Missive VA #8",
    sourceSubject: "[info.associations] MISSIVE VA #8 - Malgré les exams de novembre, se détendre avec les event VA",
    description:
      "Atelier d'initiation et de perfectionnement à la sculpture en terre ouvert à tous. Le club Les Lézarts fournit le matériel et les conseils.",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  {
    id: 9,
    emailId: 34541,
    title: "RAID Dingue de Villeurbanne - 17ème édition",
    association: "Bureau des Élèves (BdE INSA Lyon)",
    date: "Dimanche 15 Novembre",
    fullDate: "Dimanche 15 Novembre 2026",
    day: "15",
    month: "NOV",
    time: "14:00 - 20:00",
    place: "Maison des Étudiants (MDE) · Campus La Doua",
    category: "Sport",
    badge: "Missive VA #7",
    sourceSubject: "[info.associations] MISSIVE VA #7 - Petite semaine de novembre",
    description:
      "Course sportive en binôme combinant Trail, VTT, Run & Bike et Course d'Orientation avec village d'arrivée à la MDE.",
    color: "bg-blue-100 text-blue-700 border-blue-200",
  },
  {
    id: 10,
    emailId: 34471,
    title: "30 Impros Chrono",
    association: "Troupe Théâtrale de l'INSA (TTI)",
    date: "Jeudi 05 Novembre",
    fullDate: "Jeudi 5 Novembre 2026",
    day: "05",
    month: "NOV",
    time: "20:30 - 22:00",
    place: "La Rotonde - Salle de spectacle · Campus La Doua",
    category: "Culture",
    badge: "Missive VA #6",
    sourceSubject: "[info.associations] MISSIVE VA #6 - ERRATUM",
    description:
      "Défi théâtral inédit : 30 improvisations en seulement 1 heure par la troupe théâtrale de l'INSA. Préventes en ligne et entrée sur place.",
    color: "bg-amber-100 text-amber-700 border-amber-200",
  },
  {
    id: 11,
    emailId: 34471,
    title: "Pot d'Halloween & Soirée Dansante",
    association: "SLIDE (Standard Latino Insa Dance)",
    date: "Vendredi 06 Novembre",
    fullDate: "Vendredi 6 Novembre 2026",
    day: "06",
    month: "NOV",
    time: "22:00 - 02:00",
    place: "Résidence F - RdC · Campus La Doua",
    category: "Soirée",
    badge: "Missive VA #6",
    sourceSubject: "[info.associations] MISSIVE VA #6 - ERRATUM",
    description:
      "Soirée dansante costumée (salsa, bachata, rueda) organisée par l'association SLIDE dans la résidence F.",
    color: "bg-purple-100 text-purple-700 border-purple-200",
  },
];
