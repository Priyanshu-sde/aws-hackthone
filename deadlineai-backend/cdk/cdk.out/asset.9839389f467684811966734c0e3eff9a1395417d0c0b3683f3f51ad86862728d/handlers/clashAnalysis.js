import dayjs from 'dayjs';
import { verifyToken } from '../lib/auth.js';
import { queryByPK } from '../lib/dynamo.js';
import { detectClashes } from '../lib/clash.js';
import { callClaudeJSON } from '../lib/anthropic.js';
import { buildClashReschedulePrompt } from '../lib/prompts.js';
import { response } from '../lib/errors.js';

export const handler = async (event) => {
  try {
    const userId = await verifyToken(event);
    console.log('clashAnalysis called by:', userId);

    // Fetch all upcoming deadlines
    const allDeadlines = await queryByPK(`USER#${userId}`, 'DEADLINE#');
    const now = dayjs();
    const upcoming = allDeadlines.filter((d) => dayjs(d.dueDate).isAfter(now) && d.status === 'active');

    const clashes = detectClashes(upcoming);

    if (clashes.length === 0) {
      return response(200, { clashes: [], message: 'No clashes detected!' });
    }

    // Generate rescue plan for the most severe clash
    const params = event.queryStringParameters || {};
    const withPlan = params.plan === 'true';

    if (withPlan && clashes.length > 0) {
      const topClash = clashes[0];
      const availableDays = [];
      const start = dayjs().add(1, 'day');
      const end = dayjs(
        topClash.deadlineA.dueDate < topClash.deadlineB.dueDate
          ? topClash.deadlineB.dueDate
          : topClash.deadlineA.dueDate
      );

      for (let d = start; d.isBefore(end) || d.isSame(end); d = d.add(1, 'day')) {
        availableDays.push(d.format('YYYY-MM-DD'));
      }

      try {
        const prompt = buildClashReschedulePrompt(
          topClash.deadlineA,
          topClash.deadlineB,
          availableDays
        );
        const rescuePlan = await callClaudeJSON(prompt);
        topClash.rescuePlan = rescuePlan;
      } catch (aiErr) {
        console.warn('Failed to generate rescue plan:', aiErr.message);
        topClash.rescuePlan = null;
      }
    }

    return response(200, { clashes, count: clashes.length });
  } catch (err) {
    if (err.statusCode) return response(err.statusCode, { error: { code: 'CLIENT_ERROR', message: err.message } });
    console.error('Unhandled error in clashAnalysis:', err);
    return response(500, { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
};
