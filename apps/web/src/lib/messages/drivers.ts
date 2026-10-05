// How messages leave the app. Without provider settings everything is simulated:
// the message is only recorded in the Messages log (and printed to the server console).
//
// Real sending turns on per channel when these environment variables are set:
//   Email via Resend:  RESEND_API_KEY, EMAIL_FROM (e.g. "Salon <bookings@yourdomain.com>")
//   SMS via Twilio:    TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (e.g. +447700900000)

export type Channel = "EMAIL" | "SMS";

export interface OutgoingMessage {
  channel: Channel;
  recipient: string;
  subject?: string | null;
  body: string;
}

export function deliveryMode(channel: Channel): "resend" | "twilio" | "simulated" {
  if (channel === "EMAIL" && process.env.RESEND_API_KEY && process.env.EMAIL_FROM) return "resend";
  if (channel === "SMS" && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) return "twilio";
  return "simulated";
}

/** Sends one message. Throws with a readable reason if the provider rejects it. */
export async function send(message: OutgoingMessage): Promise<void> {
  const mode = deliveryMode(message.channel);

  if (mode === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: message.recipient, subject: message.subject ?? "", text: message.body }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return;
  }

  if (mode === "twilio") {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: message.recipient, From: process.env.TWILIO_FROM!, Body: message.body }),
    });
    if (!res.ok) throw new Error(`Twilio ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return;
  }

  if (process.env.NODE_ENV !== "test") {
    console.log(`[simulated ${message.channel}] to ${message.recipient}${message.subject ? ` | ${message.subject}` : ""}\n${message.body}`);
  }
}
