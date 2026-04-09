import { getTwilioAccountSid, getTwilioAuthToken, getTwilioFromNumber } from "@/lib/env";

export type TwilioSendResult = {
  providerMessageId: string | null;
  rawStatus: number;
};

/**
 * Sends SMS via Twilio Programmable Messaging API.
 */
export async function sendTwilioSms(input: { to: string; body: string; fromOverride?: string }): Promise<TwilioSendResult> {
  const sid = getTwilioAccountSid();
  const token = getTwilioAuthToken();
  const from = input.fromOverride ?? getTwilioFromNumber();
  if (!sid || !token) {
    throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required for SMS.");
  }
  if (!from) {
    throw new Error("TWILIO_FROM_NUMBER is not set (E.164).");
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
  const auth = btoa(`${sid}:${token}`);

  const body = new URLSearchParams();
  body.set("To", input.to);
  body.set("From", from);
  body.set("Body", input.body);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const json = (await res.json().catch(() => null)) as { sid?: string; message?: string; code?: number } | null;
  if (!res.ok) {
    const msg = json?.message ?? (await res.text().catch(() => res.statusText));
    throw new Error(`Twilio ${res.status}: ${String(msg).slice(0, 500)}`);
  }

  return { providerMessageId: json?.sid ?? null, rawStatus: res.status };
}
