import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import sanitizeHtml from "sanitize-html";
import { classifyEmail } from "@/lib/email-classifier";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const uid = Number(id);

  if (!Number.isInteger(uid) || uid <= 0) {
    return Response.json({ error: "Identifiant invalide." }, { status: 400 });
  }

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
      const msg = await client.fetchOne(
        String(uid),
        { source: true },
        { uid: true }
      );

      if (!msg || !msg.source) {
        return Response.json({ error: "Email introuvable." }, { status: 404 });
      }

      const parsed = await simpleParser(msg.source);

      // Images intégrées au mail (cid:...) -> data URI pour qu'elles s'affichent
      let rawHtml = typeof parsed.html === "string" ? parsed.html : "";
      if (!rawHtml && parsed.textAsHtml) {
        rawHtml = parsed.textAsHtml;
      }

      if (parsed.attachments && Array.isArray(parsed.attachments)) {
        for (const att of parsed.attachments) {
          if (
            att.contentId &&
            att.content &&
            att.contentType?.startsWith("image/") &&
            !att.contentType?.includes("svg")
          ) {
            const cid = att.contentId.replace(/[<>]/g, "");
            const dataUri = `data:${att.contentType};base64,${att.content.toString("base64")}`;
            rawHtml = rawHtml.split(`cid:${cid}`).join(dataUri);
          }
        }
      }

      // Nettoyage : retire scripts, formulaires, iframes...
      const html = rawHtml
        ? sanitizeHtml(rawHtml, {
            allowedTags: sanitizeHtml.defaults.allowedTags.concat([
              "img",
              "center",
              "font",
              "span",
              "div",
              "table",
              "thead",
              "tbody",
              "tr",
              "th",
              "td",
              "hr",
              "br",
              "p",
              "b",
              "i",
              "u",
              "strong",
              "em",
              "h1",
              "h2",
              "h3",
              "h4",
              "h5",
              "h6",
              "ul",
              "ol",
              "li",
              "blockquote",
            ]),
            allowedAttributes: {
              "*": [
                "style",
                "class",
                "align",
                "valign",
                "bgcolor",
                "width",
                "height",
                "colspan",
                "rowspan",
                "border",
                "cellpadding",
                "cellspacing",
                "dir",
                "color",
                "face",
                "size",
              ],
              a: ["href", "name", "target", "rel", "title"],
              img: ["src", "alt", "width", "height", "style", "title"],
            },
            allowedSchemes: ["http", "https", "mailto", "tel", "data"],
            allowedSchemesByTag: { img: ["data", "http", "https"] },
            transformTags: {
              a: sanitizeHtml.simpleTransform("a", {
                target: "_blank",
                rel: "noopener noreferrer",
              }),
            },
          })
        : "";

      const fromFirst = parsed.from?.value?.[0];
      const fromName = fromFirst?.name || "";
      const fromAddress = fromFirst?.address || "";
      const subject = parsed.subject || "(sans objet)";
      const category = classifyEmail(subject, fromName, fromAddress);

      // Traitement des pièces jointes avec nom convivial et taille
      const attachments = (parsed.attachments || []).map((att, index) => {
        let filename = att.filename;
        const isCalendar = att.contentType === "text/calendar";
        const isImage = Boolean(att.contentType?.startsWith("image/"));
        const isPdf = att.contentType === "application/pdf";

        if (!filename) {
          if (isCalendar) filename = "invitation-reunion.ics";
          else if (isImage) filename = `image-${index + 1}.png`;
          else if (isPdf) filename = `document-${index + 1}.pdf`;
          else filename = `piece-jointe-${index + 1}`;
        }

        return {
          filename,
          contentType: att.contentType || "application/octet-stream",
          size: att.size || 0,
          isCalendar,
          isImage,
          isPdf,
        };
      });

      const toList = (parsed.to ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]) : [])
        .flatMap((t) => t.value || [])
        .map((t) => ({ name: t.name || "", address: t.address || "" }));

      return Response.json({
        id: uid,
        subject,
        from: {
          name: fromName || fromAddress || "Inconnu",
          address: fromAddress,
        },
        to: toList,
        date: parsed.date ? new Date(parsed.date).toISOString() : null,
        category,
        html,
        text: parsed.text ?? "",
        attachments,
      });
    } finally {
      lock.release();
    }
  } catch (error) {
    console.error("IMAP error:", error);
    return Response.json(
      { error: "Impossible de récupérer le message." },
      { status: 500 }
    );
  } finally {
    await client.logout().catch(() => {});
  }
}
