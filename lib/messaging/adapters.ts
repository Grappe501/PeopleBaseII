/**
 * Channel adapters — orchestrator creates `comms_queue` rows; delivery uses:
 * - `lib/integrations/sendgrid-mail` (email)
 * - `lib/integrations/twilio-sms` (SMS)
 *
 * Future: P2P, social, phonebank surface as workflow tasks or dedicated queues — keep orchestration thin.
 */

export { sendSendGridEmail } from "@/lib/integrations/sendgrid-mail";
export { sendTwilioSms } from "@/lib/integrations/twilio-sms";
