import { ImapFlow } from "imapflow";
import { classifyEmail, type EmailCategory } from "@/lib/email-classifier";

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

export async function listRecentEmails() {
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
        const start = Math.max(1, total - 49);
        for await (const message of client.fetch(`${start}:*`, {
          envelope: true,
          flags: true,
          uid: true,
        })) {
          const from = message.envelope?.from?.[0];
          const to = message.envelope?.to?.[0];
          const subject = message.envelope?.subject ?? "(sans objet)";
          const fromName = from?.name || "";
          const fromAddress = from?.address || "";

          emails.push({
            id: message.uid,
            subject,
            from: fromName || fromAddress || "Inconnu",
            fromAddress,
            to: to?.address || to?.name || "",
            date: message.envelope?.date
              ? new Date(message.envelope.date).toISOString()
              : null,
            unread: !message.flags?.has("\\Seen"),
            category: classifyEmail(subject, fromName, fromAddress),
          });
        }
      }

      emails.reverse();
      return { emails, unreadCount: unseen.length };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}
