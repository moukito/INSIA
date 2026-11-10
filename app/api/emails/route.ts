import { ImapFlow } from "imapflow";
import { classifyEmail, EmailCategory } from "@/lib/email-classifier";

export interface EmailListItem {
  id: number;
  subject: string;
  from: string;
  fromAddress: string;
  to: string;
  date: string | null;
  unread: boolean;
  category: EmailCategory;
}

export async function GET() {
  const client = new ImapFlow({
    host: process.env.IMAP_HOST!,
    port: Number(process.env.IMAP_PORT ?? 993),
    secure: true,
    auth: {
      user: process.env.IMAP_USER!,
      pass: process.env.IMAP_PASSWORD!,
    },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      const total =
        client.mailbox && typeof client.mailbox !== "boolean"
          ? client.mailbox.exists
          : 0;
      const unseen = (await client.search({ seen: false })) || [];
      const emails: EmailListItem[] = [];

      if (total > 0) {
        const start = Math.max(1, total - 29); // 30 derniers mails pour avoir assez de mails par catégorie
        for await (const msg of client.fetch(`${start}:*`, {
          envelope: true,
          flags: true,
          uid: true,
        })) {
          const from = msg.envelope?.from?.[0];
          const to = msg.envelope?.to?.[0];
          const subject = msg.envelope?.subject ?? "(sans objet)";
          const fromName = from?.name || "";
          const fromAddress = from?.address || "";
          const category = classifyEmail(subject, fromName, fromAddress);

          emails.push({
            id: msg.uid,
            subject,
            from: fromName || fromAddress || "Inconnu",
            fromAddress,
            to: to?.address || to?.name || "",
            date: msg.envelope?.date
              ? new Date(msg.envelope.date).toISOString()
              : null,
            unread: !msg.flags?.has("\\Seen"),
            category,
          });
        }
      }

      emails.reverse(); // plus récent en premier

      // Compteurs par catégorie
      const categoryCounts = {
        all: emails.length,
        stage: emails.filter((e) => e.category === "stage").length,
        urgence: emails.filter((e) => e.category === "urgence").length,
        association: emails.filter((e) => e.category === "association").length,
        cours: emails.filter((e) => e.category === "cours").length,
        autre: emails.filter((e) => e.category === "autre").length,
      };

      return Response.json({
        unreadCount: unseen.length,
        categoryCounts,
        emails,
      });
    } finally {
      lock.release();
    }
  } catch (error) {
    console.error("IMAP error:", error);
    return Response.json(
      { error: "Impossible de récupérer les emails." },
      { status: 500 }
    );
  } finally {
    await client.logout().catch(() => {});
  }
}
