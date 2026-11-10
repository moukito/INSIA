# INSIA

INSIA est un assistant numérique destiné aux étudiants de l’INSA Lyon. Le
projet a pour objectif de centraliser les informations utiles à la vie
étudiante : emploi du temps, événements, tâches et, à terme, assistance par
IA.

> **Statut :** projet en développement. Le backend et le module calendrier
> constituent actuellement le premier périmètre fonctionnel.

## Fonctionnalités actuelles

- créer, consulter, modifier et supprimer des événements personnels ;
- filtrer les événements par période ;
- importer un calendrier au format iCalendar (`.ics`) ;
- synchroniser un calendrier iCalendar distant ;
- exposer les outils calendrier nécessaires à un assistant IA ;
- isoler les données par utilisateur via l’en-tête `X-Owner-ID`.

Les fonctionnalités d’orientation, de gestion des mails, de tâches et de
tableau de bord sont prévues mais ne sont pas encore considérées comme
disponibles.

## Architecture

```text
INSIA/
├── backend/       API FastAPI, logique métier, persistance et tests
├── frontend/      Interface web (en cours de développement)
├── docs/          Documentation technique et décisions d’implémentation
└── scripts/       Scripts utilitaires
```

Le backend utilise Python 3.14+, FastAPI et PostgreSQL. La gestion des
calendriers s’appuie sur le format iCalendar.

## Installation du backend

### Prérequis

- Python 3.14 ou supérieur ;
- PostgreSQL accessible localement ou sur le réseau ;
- `pip` ou [uv](https://docs.astral.sh/uv/).

### Configuration

Depuis la racine du dépôt :

```powershell
Copy-Item backend\.env.example backend\.env
```

Modifiez ensuite `backend\.env` avec les paramètres de votre environnement,
notamment `DATABASE_URL`.

### Environnement Python

Avec un environnement virtuel Python classique :

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
```

Avec `uv` :

```powershell
cd backend
uv sync
```

### Lancer l’API

Depuis le dossier `backend` :

```powershell
python -m uvicorn app.main:app --reload
```

L’API est alors disponible à l’adresse `http://127.0.0.1:8000`. La
documentation interactive est accessible sur
[`/docs`](http://127.0.0.1:8000/docs) et [`/redoc`](http://127.0.0.1:8000/redoc).

## Tester

Les tests du backend peuvent être lancés depuis le dossier `backend` :

```powershell
python -m pytest
```

Les tests du calendrier utilisent un dépôt en mémoire pour les scénarios
unitaires et API ; PostgreSQL n’est donc pas nécessaire pour cette suite.

## API calendrier

Toutes les routes calendrier nécessitent l’en-tête `X-Owner-ID` :

| Méthode  | Route                                   | Description                    |
|----------|-----------------------------------------|--------------------------------|
| `GET`    | `/api/calendar/events`                  | Lister les événements          |
| `POST`   | `/api/calendar/events`                  | Créer un événement             |
| `GET`    | `/api/calendar/events/{id}`             | Consulter un événement         |
| `PATCH`  | `/api/calendar/events/{id}`             | Modifier un événement          |
| `DELETE` | `/api/calendar/events/{id}`             | Supprimer un événement         |
| `POST`   | `/api/calendar/sources/{source}/import` | Importer un fichier iCalendar  |
| `POST`   | `/api/calendar/sources/{source}/sync`   | Synchroniser un flux iCalendar |

Exemple :

```powershell
curl.exe -H "X-Owner-ID: 1" http://127.0.0.1:8000/api/calendar/events
```

## Documentation et contribution

- [Documentation technique](docs/README.md) : architecture cible, conventions,
  décisions d’implémentation et feuille de route ;
- [Catalogue des formations de l’INSA Lyon](https://www.insa-lyon.fr/fr/formation/catalogue).

Avant de proposer une modification, créez une branche dédiée, ajoutez ou
mettez à jour les tests concernés, puis ouvrez une pull request décrivant le
changement.

Ne commitez jamais de fichier `.env`, de mot de passe ou de clé secrète.
