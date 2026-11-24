from __future__ import annotations

import json
from uuid import uuid4

from openai import OpenAI

modele = "gpt-6-luna"
vector_store_id = "vs_6af2d778ea5c8191a9ebf54c43c258d7"

nb_questions_min_borne = 10
nb_questions_defaut = 15
nb_questions_max_borne = 50
nb_tours_api_max = 100

tous_les_departements = ["BTBI", "GM", "TC", "IF", "GCU", "GI", "MT", "GE", "GEN"]
echelle = ["Pas du tout", "Pas beaucoup", "Un peu", "Beaucoup"]

categories = {
    "maths_physique": "Goût et aisance pour les maths et la physique (théoriques ou appliquées)",
    "informatique_reseaux": "Programmation, algorithmique, données, réseaux, cybersécurité, systèmes informatiques",
    "electronique_energie": "Électronique, électricité, systèmes embarqués, énergie",
    "mecanique_materiaux": "Mécanique, conception d'objets, matériaux, fabrication",
    "vivant_chimie": "Biologie, chimie, santé, biotechnologies",
    "construction_environnement": "Bâtiment, urbanisme, génie civil, environnement, territoire",
    "industrie_organisation": "Organisation de la production, gestion de projet, qualité, management",
    "theorie_pratique": "Cours théoriques vs cours pratiques, profil final technique vs théorique",
    "projet_metier": "Travail en équipe, terrain / bureau / laboratoire, secteur visé, type de métier",
}

sessions: dict[str, dict] = {}


def creer_client() -> OpenAI:
    """Instancie le client OpenAI depuis la config du projet ou les variables d'environnement."""
    try:
        from app.config import Settings

        settings = Settings.from_environment()
        if settings.openai_api_key:
            return OpenAI(api_key=settings.openai_api_key)
    except Exception:
        pass
    return OpenAI()


def creer_etat() -> dict:
    """Crée l'état vide d'un questionnaire."""
    return {
        "compteur_questions": 0,
        "categories_couvertes": set(),
        "historique": [],
    }


def etat_questionnaire(etat: dict, nb_questions_cible: int) -> dict:
    """Résume l'avancement du questionnaire pour l'envoyer à l'IA."""
    return {
        "questions_posees": etat["compteur_questions"],
        "questions_restantes": max(nb_questions_cible - etat["compteur_questions"], 0),
        "categories_non_couvertes": [c for c in categories if c not in etat["categories_couvertes"]],
    }


def creer_schema_resultat(departements: list[str]) -> dict:
    """Construit le schéma JSON du résultat final imposé à l'IA."""
    return {
        "type": "object",
        "properties": {
            "classement": {
                "type": "array",
                "description": "Tous les départements, du plus au moins adapté.",
                "items": {
                    "type": "object",
                    "properties": {
                        "departement": {"type": "string", "enum": departements},
                        "score_matching": {
                            "type": "number",
                            "description": "Adéquation absolue entre le profil et ce département, de 0 à 100.",
                        },
                        "scores_par_categorie": {
                            "type": "array",
                            "description": "Un score de 0 à 100 pour chaque catégorie.",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "categorie": {"type": "string", "enum": list(categories.keys())},
                                    "score": {"type": "number"},
                                },
                                "required": ["categorie", "score"],
                                "additionalProperties": False,
                            },
                        },
                        "mini_explication": {
                            "type": "string",
                            "description": "2 à 3 phrases : pourquoi ce score, avec 1 ou 2 réponses précises citées.",
                        },
                    },
                    "required": ["departement", "score_matching", "scores_par_categorie", "mini_explication"],
                    "additionalProperties": False,
                },
            },
            "analyse_par_theme": {
                "type": "array",
                "description": "Une entrée par catégorie.",
                "items": {
                    "type": "object",
                    "properties": {
                        "categorie": {"type": "string", "enum": list(categories.keys())},
                        "explication": {
                            "type": "string",
                            "description": "Réponses de l'étudiant sur ce thème, ce qu'elles disent de son profil, "
                                           "départements favorisés et défavorisés, et pourquoi.",
                        },
                    },
                    "required": ["categorie", "explication"],
                    "additionalProperties": False,
                },
            },
            "explication_detaillee": {
                "type": "string",
                "description": "Longue explication en texte brut (sans markdown) de la logique du classement.",
            },
        },
        "required": ["classement", "analyse_par_theme", "explication_detaillee"],
        "additionalProperties": False,
    }


def construire_instructions(departements: list[str], preferences: str, nb_questions_cible: int) -> str:
    """Construit les instructions système pour les départements et les préférences donnés."""
    liste_categories = "\n".join(f"- {nom} : {desc}" for nom, desc in categories.items())
    texte_preferences = preferences.strip() or "Aucune préférence renseignée au départ."
    return f"""
Tu es un assistant d'orientation qui aide un étudiant de l'INSA Lyon à trouver le département qui lui correspond le mieux.
Départements à évaluer (uniquement ceux-ci) : {", ".join(departements)}.
Préférences de l'étudiant : {texte_preferences}

DÉROULEMENT
1. Commence par consulter la documentation des départements avec file_search.
2. Pose exactement {nb_questions_cible} questions, une seule à la fois, avec rep_qcm ou rep_echelle.
   Attends la réponse avant de poser la suivante. Ne montre aucun score à l'étudiant pendant les questions.
3. Phase 1, couverture : couvre chaque catégorie ci-dessous au moins une fois. Après chaque réponse, l'outil te donne
   les catégories non couvertes et le nombre de questions restantes. Ne pose pas deux fois de suite la même catégorie
   tant qu'il en reste de non couvertes. Commence par celles qui départagent le mieux les départements choisis.
4. Phase 2, départage : utilise les questions restantes jusqu'à atteindre {nb_questions_cible} questions pour départager
   les départements proches et creuser les catégories ambiguës ou contradictoires. Vérifie aussi qu'un département qui semble
   défavorisé ne pourrait pas plaire à l'étudiant : ne pose pas que des questions sur le département en tête.
5. Dès que les {nb_questions_cible} questions ont été posées, produis immédiatement le résultat final au format JSON.

CATÉGORIES
{liste_categories}

RÈGLES POUR LES QUESTIONS
- Une seule idée par question, une phrase courte, sans jargon (explique un terme technique entre parenthèses).
- rep_qcm : 2 à 4 options courtes, chacune correspondant à un domaine ou une activité différente.
  À utiliser pour faire choisir entre des activités ou des situations concrètes.
- rep_echelle : une affirmation à la première personne qui décrit une activité ou un domaine
  (ex. : « J'aime comprendre comment fonctionne un réseau »). L'étudiant répond Pas du tout / Pas beaucoup / Un peu / Beaucoup.
  À utiliser pour mesurer l'intérêt pour un thème précis.
- Alterne les deux types de questions. Ne suggère jamais la réponse attendue.
- Ne redemande pas ce que l'étudiant a déjà dit clairement dans ses préférences : creuse les nuances
  (ex. : s'il dit détester les maths, teste s'il accepte les maths appliquées).

MÉTHODE D'ÉVALUATION
- Pour chaque département et chaque catégorie, donne un score de 0 à 100 : l'adéquation entre le profil de l'étudiant
  et ce que le département demande et propose dans cette catégorie, d'après la documentation (file_search),
  pas d'après des suppositions.
- Le score global (score_matching) est une moyenne pondérée des scores par catégorie. Le poids dépend de
  l'importance de la catégorie pour l'étudiant (préférences explicites, réponses extrêmes) et pour le département.
- Le score est ABSOLU et indépendant des autres départements : il mesure à quel point CE département correspond
  à l'étudiant. La somme des scores n'a pas à faire 100. Plusieurs départements peuvent avoir un score élevé,
  ou tous un score bas. Un département qui ne correspond pas du tout doit avoir un score très bas
  (0 à 15), même s'il n'est que troisième.
- Repères : 0-20 incompatible, 21-40 faible, 41-60 moyen, 61-80 bon, 81-100 très bon.
- Les réponses extrêmes (Pas du tout / Beaucoup) et les préférences explicites pèsent plus que les réponses nuancées.
  Un rejet net d'un domaine central d'un département doit plafonner nettement son score global.
- Signale et prends en compte les contradictions entre les préférences annoncées et les réponses.
- Pour une catégorie peu testée ou des réponses peu informatives, donne un score prudent proche de 50
  et mentionne l'incertitude dans l'explication.

RÉSULTAT FINAL (JSON imposé)
- classement : tous les départements, triés du plus au moins adapté. Pour chacun : score_matching,
  scores_par_categorie (toutes les catégories) et mini_explication (2 à 3 phrases, avec 1 ou 2 réponses précises citées).
- analyse_par_theme : une entrée pour chaque catégorie. Explique ce que l'étudiant a répondu (cite ses réponses),
  ce que cela dit de son profil, quels départements sont favorisés ou défavorisés sur ce thème et pourquoi.
- explication_detaillee : texte long, en texte brut sans markdown, en paragraphes : (1) le profil global de l'étudiant ;
  (2) pour chaque département dans l'ordre du classement, comment ses réponses ont conduit à son score
  (scores par catégorie, réponses décisives, éventuel point rédhibitoire) ; (3) pourquoi les premiers se démarquent
  ou sont proches ; (4) les limites du résultat et ce qu'il faudrait vérifier (journées portes ouvertes, rencontres
  avec des étudiants).

Ne pose jamais de question en dehors des outils rep_qcm et rep_echelle.
"""


def add_tool(payload: dict, name: str, description: str, parameters: list[dict]) -> None:
    """Déclare un tool de type fonction dans le payload."""
    payload["tools"].append({
        "type": "function",
        "name": name,
        "description": description,
        "parameters": {
            "type": "object",
            "properties": {
                parameter["name"]: {
                    "type": parameter["type"],
                    "description": parameter["description"],
                    **parameter.get("extra", {}),
                }
                for parameter in parameters
            },
            "required": [parameter["name"] for parameter in parameters],
            "additionalProperties": False,
        },
        "strict": True,
    })


def construire_payload(departements: list[str], preferences: str, nb_questions_cible: int) -> dict:
    """Construit le payload initial envoyé à l'API OpenAI."""
    texte_preferences = preferences.strip() or "Aucune préférence renseignée."
    payload = {
        "model": modele,
        "instructions": construire_instructions(departements, preferences, nb_questions_cible),
        "input": [
            {
                "role": "user",
                "content": f"Mes préférences : {texte_preferences}. Départements choisis : {', '.join(departements)}. Commence le questionnaire.",
            }
        ],
        "tools": [
            {
                "type": "file_search",
                "vector_store_ids": [vector_store_id],
            }
        ],
        "parallel_tool_calls": False,
        "text": {
            "format": {
                "type": "json_schema",
                "name": "resultat_orientation",
                "strict": True,
                "schema": creer_schema_resultat(departements),
            }
        },
    }

    add_tool(
        payload,
        name="rep_qcm",
        description="Pose un QCM de 2 à 4 options à l'étudiant et renvoie l'option choisie.",
        parameters=[
            {
                "name": "categorie",
                "type": "string",
                "description": "Catégorie évaluée par cette question.",
                "extra": {"enum": list(categories.keys())},
            },
            {
                "name": "question",
                "type": "string",
                "description": "La question, courte, avec une seule idée.",
            },
            {
                "name": "options",
                "type": "array",
                "description": "2 à 4 options de réponse courtes.",
                "extra": {"items": {"type": "string"}},
            },
        ],
    )

    add_tool(
        payload,
        name="rep_echelle",
        description="Affirme quelque chose et demande à l'étudiant si cela lui correspond.",
        parameters=[
            {
                "name": "categorie",
                "type": "string",
                "description": "Catégorie évaluée par cette question.",
                "extra": {"enum": list(categories.keys())},
            },
            {
                "name": "affirmation",
                "type": "string",
                "description": "Affirmation à la première personne décrivant un domaine ou une activité.",
            },
        ],
    )

    return payload


def limiter_score(valeur: float) -> float:
    """Ramène un score dans l'intervalle 0-100 et l'arrondit à une décimale."""
    return round(min(max(float(valeur), 0.0), 100.0), 1)


def calculer_resultat(texte: str, departements: list[str]) -> dict:
    """Formate le JSON final renvoyé par l'IA et trie le classement."""
    data = json.loads(texte)
    classement = data["classement"]

    for departement in classement:
        departement["score_matching"] = limiter_score(departement["score_matching"])
        for score in departement["scores_par_categorie"]:
            score["score"] = limiter_score(score["score"])
    classement.sort(key=lambda d: d["score_matching"], reverse=True)

    presents = {d["departement"] for d in classement}
    avertissements = [f"Département absent du résultat : {d}" for d in departements if d not in presents]

    return {
        "classement": classement,
        "analyse_par_theme": data["analyse_par_theme"],
        "explication_detaillee": data["explication_detaillee"],
        "avertissements": avertissements,
    }


def _valider_appel_outil(etat: dict, nb_questions_cible: int, nom_outil: str, arguments: dict) -> dict:
    """Vérifie les paramètres envoyés par l'IA et normalise la question."""
    if etat["compteur_questions"] >= nb_questions_cible:
        return {"erreur": "Nombre de questions demandé atteint. Donne maintenant le résultat final."}

    categorie = arguments.get("categorie")
    if categorie not in categories:
        return {"erreur": "Catégorie inconnue. Refais l'appel avec une catégorie de la liste."}

    if nom_outil == "rep_qcm":
        texte = arguments["question"]
        options = arguments["options"]
        type_question = "qcm"
    elif nom_outil == "rep_echelle":
        texte = arguments["affirmation"]
        options = echelle
        type_question = "echelle"
    else:
        return {"erreur": f"Outil inconnu : {nom_outil}"}

    if not 2 <= len(options) <= 4:
        return {"erreur": "Il faut entre 2 et 4 options. Refais l'appel."}

    return {
        "type": type_question,
        "categorie": categorie,
        "texte": texte,
        "options": options,
    }


def _avancer_session(session: dict) -> dict:
    """Exécute les tours d'API jusqu'à obtenir une question à afficher ou le résultat final."""
    client = creer_client()
    payload = session["payload"]
    etat = session["etat"]
    nb_cible = session["nb_questions"]

    for _ in range(nb_tours_api_max):
        appel_payload = dict(payload)
        if etat["compteur_questions"] >= nb_cible:
            appel_payload["tool_choice"] = "none"

        response = client.responses.create(**appel_payload)
        payload["input"].extend(response.output)

        tool_calls = [item for item in response.output if item.type == "function_call"]

        if not tool_calls:
            if etat["compteur_questions"] < nb_cible:
                payload["input"].append({
                    "role": "user",
                    "content": (
                        f"Tu n'as posé que {etat['compteur_questions']} questions sur {nb_cible}. "
                        f"Continue avec rep_qcm ou rep_echelle."
                    ),
                })
                continue

            try:
                resultat = calculer_resultat(response.output_text, session["departements"])
            except (json.JSONDecodeError, KeyError, TypeError) as exc:
                raise RuntimeError(f"Résultat illisible : {exc}") from exc

            resultat["reponses"] = etat["historique"]
            session["resultat"] = resultat
            return {
                "session_id": session["id"],
                "fini": True,
                "resultat": resultat,
            }

        for extra_call in tool_calls[1:]:
            payload["input"].append({
                "type": "function_call_output",
                "call_id": extra_call.call_id,
                "output": json.dumps({"erreur": "Une seule question à la fois."}, ensure_ascii=False),
            })

        tool_call = tool_calls[0]
        arguments = json.loads(tool_call.arguments)
        validation = _valider_appel_outil(etat, nb_cible, tool_call.name, arguments)

        if "erreur" in validation:
            payload["input"].append({
                "type": "function_call_output",
                "call_id": tool_call.call_id,
                "output": json.dumps(validation, ensure_ascii=False),
            })
            continue

        question_courante = {
            "numero": etat["compteur_questions"] + 1,
            "total": nb_cible,
            "type": validation["type"],
            "categorie": validation["categorie"],
            "texte": validation["texte"],
            "options": validation["options"],
        }
        session["question_en_attente"] = {
            "call_id": tool_call.call_id,
            **question_courante,
        }
        return {
            "session_id": session["id"],
            "fini": False,
            "question": question_courante,
        }

    raise RuntimeError("Nombre maximum de tours d'API atteint.")


def demarrer_session(
    departements: list[str],
    nb_questions: int = nb_questions_defaut,
    preferences: str = "",
) -> dict:
    """Initialise une nouvelle session d'orientation et renvoie la première question."""
    invalides = [d for d in departements if d not in tous_les_departements]
    if invalides:
        raise ValueError(f"Départements inconnus : {', '.join(invalides)}")
    if not nb_questions_min_borne <= nb_questions <= nb_questions_max_borne:
        raise ValueError(f"Le nombre de questions doit être entre {nb_questions_min_borne} et {nb_questions_max_borne}.")

    session_id = uuid4().hex
    session = {
        "id": session_id,
        "departements": departements,
        "nb_questions": nb_questions,
        "etat": creer_etat(),
        "payload": construire_payload(departements, preferences, nb_questions),
        "question_en_attente": None,
        "en_cours": False,
    }
    sessions[session_id] = session
    return _avancer_session(session)


def repondre(session_id: str, numeros: list[int]) -> dict:
    """Enregistre le numéro choisi pour la question en cours et avance la session."""
    session = sessions[session_id]
    if "resultat" in session:
        return {"session_id": session_id, "fini": True, "resultat": session["resultat"]}

    if len(numeros) != 1:
        raise ValueError("Une seule réponse est attendue.")
    numero = numeros[0]

    if session.get("en_cours"):
        raise ValueError("Une réponse est déjà en cours de traitement.")

    question = session.get("question_en_attente")
    if question is None:
        raise ValueError("Aucune question en attente pour cette session.")

    options = question["options"]
    if not 1 <= numero <= len(options):
        raise ValueError(f"Choix invalide : il faut un numéro entre 1 et {len(options)}.")

    session["en_cours"] = True
    try:
        etat = session["etat"]
        etat["compteur_questions"] += 1
        etat["categories_couvertes"].add(question["categorie"])

        reponse = options[numero - 1]
        etat["historique"].append({
            "numero": question["numero"],
            "type": question["type"],
            "categorie": question["categorie"],
            "texte": question["texte"],
            "options": options,
            "reponse": reponse,
        })

        resultat_outil = {
            "type": question["type"],
            "categorie": question["categorie"],
            "question": question["texte"],
            "reponse": reponse,
            **etat_questionnaire(etat, session["nb_questions"]),
        }
        if question["type"] == "echelle":
            resultat_outil["niveau_sur_4"] = numero

        session["question_en_attente"] = None
        session["payload"]["input"].append({
            "type": "function_call_output",
            "call_id": question["call_id"],
            "output": json.dumps(resultat_outil, ensure_ascii=False),
        })

        return _avancer_session(session)
    finally:
        session["en_cours"] = False