import dayjs from 'dayjs';
import { queryGSI, updateItem } from '../lib/dynamo.js';
import { sendWhatsApp, formatReminderMessage } from '../lib/twilio.js';
import { response } from '../lib/errors.js';
import { getItem } from '../lib/dynamo.js';

// HACKATHON NOTE: Triggered by EventBridge every 15 minutes, not by API Gateway.
// No auth check needed — this is an internal cron function.

export const handler = async (event) => {
  try {
    console.log('reminderDispatch triggered at:', new Date().toISOString());

    const now = dayjs();
    const windowEnd = now.add(15, 'minute');

    // Query GSI3 for deadlines with pending reminders in the next 15-minute window
    const pendingReminders = await queryGSI(
      'GSI3',
      'reminderStatus', 'PENDING',
      'nextReminderAt', {
        between: [now.toISOString(), windowEnd.toISOString()],
      }
    );

    console.log(`Found ${pendingReminders.length} reminders to dispatch`);

    let sent = 0;
    let failed = 0;

    for (const deadline of pendingReminders) {
      try {
        // Fetch user record to get phone number
        const user = await getItem(deadline.PK, 'META');
        if (!user?.phone) {
          console.warn(`No phone for user ${deadline.PK}, skipping reminder`);
          continue;
        }

        const tip = generateQuickTip(deadline);
        const message = formatReminderMessage(deadline, tip);

        await sendWhatsApp(user.phone, message);

        // Pop the sent reminder from schedule and set next one
        const schedule = deadline.reminderSchedule || [];
        const remaining = schedule.filter((r) => dayjs(r).isAfter(now));
        const nextReminder = remaining.length > 0 ? remaining[0] : null;

        await updateItem(deadline.PK, deadline.SK, {
          reminderSchedule: remaining,
          nextReminderAt: nextReminder,
          reminderStatus: nextReminder ? 'PENDING' : 'COMPLETE',
          lastReminderSentAt: now.toISOString(),
          updatedAt: now.toISOString(),
        });

        sent++;
      } catch (sendErr) {
        console.error(`Failed to send reminder for ${deadline.SK}:`, sendErr.message);
        failed++;
      }
    }

    console.log(`Dispatch complete: ${sent} sent, ${failed} failed`);

    return response(200, { dispatched: sent, failed });
  } catch (err) {
    console.error('Unhandled error in reminderDispatch:', err);
    return response(500, { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
};

function generateQuickTip(deadline) {
  const tips = {
    exam: 'Review past papers and focus on high-weight topics first.',
    midterm: 'Skim your notes, then do practice problems for weak areas.',
    assignment: 'Start with the hardest part while your focus is fresh.',
    quiz: 'Quick review of key formulas and definitions.',
    project: 'Break it into milestones and tackle the riskiest part first.',
    lab: 'Read the lab manual and pre-fill what you can.',
    presentation: 'Practice your opening and closing — they stick most.',
    other: 'Set a timer and work in focused 25-minute blocks.',
  };
  return tips[deadline.type] || tips.other;
}
