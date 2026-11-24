This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Authentification et données

L’application utilise Supabase Auth et PostgreSQL. Crée un utilisateur invité depuis le tableau de bord Supabase, applique `supabase/migrations/20261124090000_agent_workspace.sql`, puis configure ces variables dans `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
IMAP_OWNER_EMAIL=
IMAP_HOST=
IMAP_PORT=993
IMAP_USER=
IMAP_PASSWORD=
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=
AI_MODEL=
```

`IMAP_OWNER_EMAIL` doit être l’adresse vérifiée du compte Supabase autorisé à accéder à l’unique boîte IMAP configurée. Les politiques RLS limitent les lignes aux comptes propriétaires. L’application n’utilise pas de clé Supabase `service_role`; ne l’ajoute pas au navigateur ni à `.env.local`.

Les tâches et les créneaux de cours du planning sont stockés dans PostgreSQL et initialisés une seule fois à partir des données de démonstration actuelles. Les suppressions sont réversibles. Les événements associatifs et leurs ajouts au planning restent encore en mémoire côté navigateur.

## Assistant IA

L’assistant utilise une API compatible OpenAI Chat Completions et des tools serveur pour rechercher/lire les 50 emails les plus récents, consulter les tâches, créer ou modifier une tâche, et proposer une mise à la corbeille. Il peut aussi analyser les annonces d’email concernant les cours et proposer l’ajout d’un cours, la modification d’un créneau existant ou l’annulation d’un cours. L’email source est accessible depuis la proposition; aucune modification du planning n’est appliquée sans confirmation dans le chat. Les emails sont récupérés côté serveur depuis IMAP et les résultats sont affichés sous forme de cartes, jamais comme du JSON brut.

L’accès email reste en lecture seule : aucun endpoint SMTP ou mécanisme d’archivage/déplacement n’est configuré. Ces actions ne sont donc pas exposées et l’assistant ne doit pas prétendre les avoir effectuées. Le classement actuel des emails continue d’utiliser le classificateur existant.

Choisis un modèle disponible qui prend en charge Chat Completions et l’appel d’outils. Le fournisseur IA reçoit les messages, les métadonnées des emails récents, les tâches et les cours du planning; le corps d’un email n’est lu que si l’outil `read_email` est appelé. Les clés IA restent côté serveur. Un endpoint HTTP local sur `localhost` est accepté.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
