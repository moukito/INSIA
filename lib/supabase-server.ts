import "server-only";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

type AuthenticatedRequest =
  | { ok: true; client: SupabaseClient; user: User }
  | { ok: false; response: Response };

export async function authenticateRequest(
  request: Request
): Promise<AuthenticatedRequest> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!url || !anonKey) {
    return {
      ok: false,
      response: Response.json(
        { error: "L’authentification Supabase n’est pas configurée." },
        { status: 503 }
      ),
    };
  }

  if (!token) {
    return {
      ok: false,
      response: Response.json(
        { error: "Authentification requise." },
        { status: 401 }
      ),
    };
  }

  const client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });

  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      return {
        ok: false,
        response: Response.json(
          { error: "La session est invalide ou a expiré. Reconnecte-toi." },
          { status: 401 }
        ),
      };
    }
    return { ok: true, client, user: data.user };
  } catch (error) {
    console.error(
      "Supabase authentication failed:",
      error instanceof Error ? error.message : "Erreur inconnue"
    );
    return {
      ok: false,
      response: Response.json(
        { error: "Le service d’authentification est temporairement indisponible." },
        { status: 503 }
      ),
    };
  }
}

export function authorizeMailboxUser(user: User) {
  const ownerEmail = process.env.IMAP_OWNER_EMAIL?.trim().toLocaleLowerCase();
  if (!ownerEmail) {
    return Response.json(
      { error: "La boîte email n’est pas associée à un compte autorisé." },
      { status: 503 }
    );
  }
  if (!user.email || user.email.toLocaleLowerCase() !== ownerEmail) {
    return Response.json(
      { error: "Tu n’es pas autorisé à accéder à cette boîte email." },
      { status: 403 }
    );
  }
  return null;
}
