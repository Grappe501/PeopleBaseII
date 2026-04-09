import { getSendGridApiKey, getSendGridFromEmail } from "@/lib/env";

export type SendGridSendResult = {
  providerMessageId: string | null;
  rawStatus: number;
};

/**
 * Sends a single email via SendGrid v3 Mail Send API.
 * @see https://docs.sendgrid.com/api-reference/mail-send/mail-send
 */
export async function sendSendGridEmail(input: {
  to: string;
  subject: string;
  text: string;
  fromOverride?: string;
}): Promise<SendGridSendResult> {
  const apiKey = getSendGridApiKey();
  const fromEmail = input.fromOverride ?? getSendGridFromEmail();
  if (!apiKey) {
    throw new Error("SENDGRID_API_KEY is not set.");
  }
  if (!fromEmail) {
    throw new Error("SENDGRID_FROM_EMAIL is not set.");
  }

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: input.to }] }],
      from: { email: fromEmail },
      subject: input.subject,
      content: [{ type: "text/plain", value: input.text }],
    }),
  });

  const providerMessageId = res.headers.get("x-message-id");
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`SendGrid ${res.status}: ${errText.slice(0, 500)}`);
  }

  return { providerMessageId, rawStatus: res.status };
}
