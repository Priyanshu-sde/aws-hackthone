// Twilio removed — stub that logs instead of sending messages.

export async function sendWhatsApp(to, message) {
  const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  console.log(`[STUB] sendWhatsApp to ${toNumber}:\n${message}`);
  return 'stub-sid';
}

export async function sendSMS(to, message) {
  console.log(`[STUB] sendSMS to ${to}:\n${message}`);
  return 'stub-sid';
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
