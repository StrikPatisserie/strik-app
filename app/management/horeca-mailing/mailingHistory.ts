export type SentMail = {
  company: string;
  email: string;
  subject: string;
  sentAt: string;
};

export type MailingHistoryEntry = {
  key: string;
  subject: string;
  firstSentAt: string;
  lastSentAt: string;
  mailCount: number;
  recipientCount: number;
};

const calendarDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Amsterdam",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dateLabel = new Intl.DateTimeFormat("nl-NL", {
  timeZone: "Europe/Amsterdam",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const timeLabel = new Intl.DateTimeFormat("nl-NL", {
  timeZone: "Europe/Amsterdam",
  hour: "2-digit",
  minute: "2-digit",
});

export function groupMailingHistory(mails: readonly SentMail[]): MailingHistoryEntry[] {
  const groups = new Map<string, Omit<MailingHistoryEntry, "recipientCount"> & { recipients: Set<string> }>();
  for (const mail of mails) {
    if (!mail || typeof mail.email !== "string" || typeof mail.subject !== "string" || typeof mail.sentAt !== "string") continue;
    const sentAt = Date.parse(mail.sentAt);
    const email = mail.email.trim().toLowerCase();
    if (!Number.isFinite(sentAt) || !email) continue;
    const key = JSON.stringify([calendarDay.format(sentAt), mail.subject]);
    const group = groups.get(key);
    if (group) {
      group.mailCount += 1;
      group.recipients.add(email);
      if (sentAt < Date.parse(group.firstSentAt)) group.firstSentAt = mail.sentAt;
      if (sentAt > Date.parse(group.lastSentAt)) group.lastSentAt = mail.sentAt;
    } else {
      groups.set(key, {
        key,
        subject: mail.subject,
        firstSentAt: mail.sentAt,
        lastSentAt: mail.sentAt,
        mailCount: 1,
        recipients: new Set([email]),
      });
    }
  }
  return Array.from(groups.values(), ({ recipients, ...group }) => ({
    ...group,
    recipientCount: recipients.size,
  })).sort((a, b) => Date.parse(b.lastSentAt) - Date.parse(a.lastSentAt));
}

export function mailingHistoryLabel(entry: MailingHistoryEntry): string {
  const first = new Date(entry.firstSentAt);
  const last = new Date(entry.lastSentAt);
  const firstTime = timeLabel.format(first);
  const lastTime = timeLabel.format(last);
  const time = firstTime === lastTime ? lastTime : `${firstTime}–${lastTime}`;
  const recipients = `${entry.recipientCount} ontvanger${entry.recipientCount === 1 ? "" : "s"}`;
  const count = entry.mailCount === entry.recipientCount
    ? recipients
    : `${entry.mailCount} mails naar ${recipients}`;
  return `${dateLabel.format(last)}, ${time} · ${count} · ${entry.subject || "Zonder onderwerp"}`;
}
