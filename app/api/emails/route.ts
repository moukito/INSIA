import {
  authenticateRequest,
  authorizeMailboxUser,
} from "@/lib/supabase-server";
import { listRecentEmails } from "@/lib/imap-service";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  const mailboxAccessError = authorizeMailboxUser(auth.user);
  if (mailboxAccessError) return mailboxAccessError;

  try {
    const { emails, unreadCount } = await listRecentEmails();
    const categoryCounts = {
      all: emails.length,
      stage: emails.filter((email) => email.category === "stage").length,
      departement: emails.filter((email) => email.category === "departement").length,
      association: emails.filter((email) => email.category === "association").length,
      urgence: emails.filter((email) => email.category === "urgence").length,
      cours: emails.filter((email) => email.category === "cours").length,
      autre: emails.filter((email) => email.category === "autre").length,
    };
    return Response.json({ unreadCount, categoryCounts, emails });
  } catch (error) {
    console.error("IMAP error:", error);
    return Response.json(
      { error: "Impossible de récupérer les emails." },
      { status: 500 }
    );
  }
}
