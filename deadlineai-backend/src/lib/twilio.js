import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import twilio from 'twilio';

const ssmClient = new SSMClient({});

// Cache credentials at module scope for warm Lambda starts
let twilioClient = null;
let whatsappFrom = null;

async function getParam(name) {
  const result = await ssmClient.send(
    new GetParameterCommand({ Name: name, WithDecryption: true })
  );
  return result.Parameter.Value;
}

async function ensureClient() {
  if (twilioClient) return;

  const [sid, token, from] = await Promise.all([
    getParam(process.env.TWILIO_SID_PARAM),
    getParam(process.env.TWILIO_TOKEN_PARAM),
    getParam(process.env.TWILIO_FROM_PARAM),
  ]);

  twilioClient = twilio(sid, token);
  whatsappFrom = from;
}

export async function sendWhatsApp(to, message) {
  await ensureClient();

  const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

  console.log(`Sending WhatsApp to ${toNumber}`);

  const result = await twilioClient.messages.create({
    body: message,
    from: whatsappFrom,
    to: toNumber,
  });

  console.log(`WhatsApp sent: SID=${result.sid}`);
  return result.sid;
}

export async function sendSMS(to, message) {
  await ensureClient();

  console.log(`Sending SMS to ${to}`);

  // HACKATHON NOTE: SMS sender number should be a separate SSM param in production
  const result = await twilioClient.messages.create({
    body: message,
    from: whatsappFrom.replace('whatsapp:', ''),
    to,
  });

  console.log(`SMS sent: SID=${result.sid}`);
  return result.sid;
}

/**
 * Format a deadline reminder message.
 */
export function formatReminderMessage(deadline, tip) {
  const daysLeft = Math.ceil(
    (new Date(deadline.dueDate) - new Date()) / (1000 * 60 * 60 * 24)
  );

  return [
    `📚 DeadlineAI Reminder`,
    `${deadline.title}`,
    `📅 Due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} — ${deadline.dueDate}`,
    `📊 Weight: ${deadline.weight || '?'}% (${deadline.isHardDeadline ? 'Hard' : 'Soft'} deadline)`,
    tip ? `💡 Tip: ${tip}` : '',
    `Reply DONE to mark complete. Reply PAUSE to silence for 24h.`,
  ].filter(Boolean).join('\n');
}
