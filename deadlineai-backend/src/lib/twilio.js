import twilio from 'twilio';

// Read from Lambda environment variables directly
let twilioClient = null;
let whatsappFrom = null;

function ensureClient() {
  if (twilioClient) return;

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  whatsappFrom = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

  if (!sid || !token) {
    throw new Error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN environment variables');
  }

  twilioClient = twilio(sid, token);
}

export async function sendWhatsApp(to, message) {
  ensureClient();

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
  ensureClient();

  console.log(`Sending SMS to ${to}`);

  // HACKATHON NOTE: SMS sender number should be separate in production
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
