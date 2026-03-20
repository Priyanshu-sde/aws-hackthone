import { getItem, updateItem } from '../lib/dynamo.js';
import { sendWhatsApp } from '../lib/twilio.js';

// HACKATHON NOTE: Triggered by DynamoDB Streams on deadline updates.
// No auth needed — this is an internal event-driven function.

export const handler = async (event) => {
  console.log(`procrastinationWatch: processing ${event.Records.length} records`);

  for (const record of event.Records) {
    if (record.eventName !== 'MODIFY') continue;

    try {
      const newImage = record.dynamodb?.NewImage;
      if (!newImage) continue;

      // Only process deadline records
      const sk = newImage.SK?.S;
      if (!sk?.startsWith('DEADLINE#')) continue;

      const pk = newImage.PK?.S;
      const remindersDismissed = parseInt(newImage.remindersDismissed?.N || '0', 10);
      const paceModeSessionsCompleted = parseInt(newImage.paceModeSessionsCompleted?.N || '0', 10);
      const buddyNotified = newImage.buddyNotified?.BOOL || false;
      const title = newImage.title?.S || 'Unknown deadline';

      // Check the procrastination trigger conditions
      if (remindersDismissed >= 3 && paceModeSessionsCompleted === 0 && !buddyNotified) {
        console.log(`Procrastination detected for ${pk}, ${sk}: ${remindersDismissed} reminders dismissed, 0 pace sessions`);

        // Get user record to find buddy phone
        const userId = pk; // PK is USER#<userId>
        const user = await getItem(userId, 'META');

        if (!user?.buddyPhone) {
          console.log(`No buddy phone configured for ${userId}`);
          continue;
        }

        const message = [
          `🚨 DeadlineAI Buddy Alert`,
          `Your study buddy needs help!`,
          `They've been putting off: "${title}"`,
          `They've dismissed ${remindersDismissed} reminders and haven't started any study sessions.`,
          `Maybe check in on them? 💪`,
        ].join('\n');

        await sendWhatsApp(user.buddyPhone, message);

        // Mark as notified to prevent duplicate notifications
        await updateItem(pk, sk, {
          buddyNotified: true,
          buddyNotifiedAt: new Date().toISOString(),
        });

        console.log(`Buddy notification sent for ${pk}, ${sk}`);
      }
    } catch (err) {
      console.error('Error processing record:', err);
      // Don't throw — continue processing other records
    }
  }

  return { statusCode: 200, body: 'Processed' };
};
