import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { verifyToken } from '../lib/auth.js';
import { getItem, batchWrite } from '../lib/dynamo.js';
import { callClaudeJSON } from '../lib/anthropic.js';
import { buildPaceSessionPrompt } from '../lib/prompts.js';
import { PaceRequestSchema, toPaceSessionItem } from '../schemas/paceSession.js';
import { response, AppError } from '../lib/errors.js';

export const handler = async (event) => {
  try {
    const userId = await verifyToken(event);
    const deadlineId = event.pathParameters?.deadlineId;

    if (!deadlineId) {
      throw new AppError(400, 'Missing deadlineId');
    }

    console.log('paceScheduler called by:', userId, 'for deadline:', deadlineId);

    // Parse optional request body
    let body = {};
    if (event.body) {
      body = JSON.parse(event.body);
    }
    const parsed = PaceRequestSchema.safeParse(body);
    const hoursPerDay = parsed.success ? parsed.data.hoursPerDay : 3;

    // Fetch the deadline
    const deadline = await getItem(`USER#${userId}`, `DEADLINE#${deadlineId}`);
    if (!deadline) {
      throw new AppError(404, 'Deadline not found');
    }

    const daysRemaining = dayjs(deadline.dueDate).diff(dayjs(), 'day');
    if (daysRemaining <= 0) {
      throw new AppError(400, 'Deadline has already passed');
    }

    // Call Claude to generate pace sessions
    const prompt = buildPaceSessionPrompt(deadline, daysRemaining, hoursPerDay);
    const sessions = await callClaudeJSON(prompt);

    if (!Array.isArray(sessions) || sessions.length === 0) {
      throw new AppError(422, 'Could not generate study sessions');
    }

    // Store sessions in DynamoDB
    const sessionItems = sessions.map((s) => {
      const sessionId = uuidv4();
      return toPaceSessionItem(userId, sessionId, deadlineId, s);
    });

    await batchWrite(sessionItems);

    console.log(`Generated ${sessionItems.length} pace sessions for deadline ${deadlineId}`);

    return response(200, {
      deadlineId,
      sessions: sessionItems,
      totalSessions: sessionItems.length,
    });
  } catch (err) {
    if (err.statusCode) return response(err.statusCode, { error: { code: 'CLIENT_ERROR', message: err.message } });
    console.error('Unhandled error in paceScheduler:', err);
    return response(500, { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
};
