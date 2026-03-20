import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { verifyToken } from '../lib/auth.js';
import { batchWrite } from '../lib/dynamo.js';
import { detectClashes } from '../lib/clash.js';
import { ConfirmDeadlinesBodySchema, toDynamoItem } from '../schemas/deadline.js';
import { response } from '../lib/errors.js';

export const handler = async (event) => {
  try {
    const userId = await verifyToken(event);
    console.log('confirmDeadlines called by:', userId);

    const body = JSON.parse(event.body);
    const parsed = ConfirmDeadlinesBodySchema.safeParse(body);

    if (!parsed.success) {
      return response(400, {
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: parsed.error.issues },
      });
    }

    const { deadlines } = parsed.data;

    // Generate default reminder schedule for each deadline
    const items = deadlines.map((d) => {
      const deadlineId = d.deadlineId || uuidv4();
      const reminderSchedule = generateReminderSchedule(d.dueDate);
      return toDynamoItem(userId, { ...d, reminderSchedule }, deadlineId);
    });

    // Batch write to DynamoDB
    const savedCount = await batchWrite(items);

    // Detect clashes among the confirmed deadlines
    const clashes = detectClashes(items);

    console.log(`Saved ${savedCount} deadlines, found ${clashes.length} clashes`);

    return response(200, {
      saved: savedCount,
      deadlines: items.map((i) => ({
        deadlineId: i.deadlineId,
        title: i.title,
        dueDate: i.dueDate,
        type: i.type,
      })),
      clashes,
    });
  } catch (err) {
    if (err.statusCode) return response(err.statusCode, { error: { code: 'CLIENT_ERROR', message: err.message } });
    console.error('Unhandled error in confirmDeadlines:', err);
    return response(500, { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
};

/**
 * Generate default reminder schedule based on days until deadline.
 * Reminders at: 7 days, 3 days, 1 day, 3 hours before.
 */
function generateReminderSchedule(dueDate) {
  const due = dayjs(dueDate);
  const now = dayjs();
  const schedule = [];

  const offsets = [
    { days: 7, label: '7d' },
    { days: 3, label: '3d' },
    { days: 1, label: '1d' },
  ];

  for (const offset of offsets) {
    const reminderTime = due.subtract(offset.days, 'day');
    if (reminderTime.isAfter(now)) {
      schedule.push(reminderTime.toISOString());
    }
  }

  // 3 hours before
  const threeHoursBefore = due.subtract(3, 'hour');
  if (threeHoursBefore.isAfter(now)) {
    schedule.push(threeHoursBefore.toISOString());
  }

  return schedule;
}
