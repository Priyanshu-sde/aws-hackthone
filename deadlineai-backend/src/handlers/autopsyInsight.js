import { v4 as uuidv4 } from 'uuid';
import { verifyToken } from '../lib/auth.js';
import { putItem, queryByPK } from '../lib/dynamo.js';
import { callClaudeJSON } from '../lib/anthropic.js';
import { buildAutopsyInsightPrompt } from '../lib/prompts.js';
import { AutopsySchema, toAutopsyItem } from '../schemas/autopsy.js';
import { response } from '../lib/errors.js';

export const handler = async (event) => {
  try {
    // Handle EventBridge scheduled invocation (no auth)
    if (event.source === 'aws.events') {
      console.log('autopsyInsight triggered by EventBridge schedule');
      // HACKATHON NOTE: In production, this would batch process users who need daily insights
      return response(200, { message: 'Scheduled autopsy processing not implemented for hackathon' });
    }

    const userId = await verifyToken(event);
    console.log('autopsyInsight called by:', userId);

    const body = JSON.parse(event.body);
    const parsed = AutopsySchema.safeParse(body);

    if (!parsed.success) {
      return response(400, {
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: parsed.error.issues },
      });
    }

    const reportId = uuidv4();
    const autopsyItem = toAutopsyItem(userId, reportId, parsed.data);

    // Check if user has 3+ autopsies for AI insight generation
    const allAutopsies = await queryByPK(`USER#${userId}`, 'AUTOPSY#');

    let aiInsight = null;

    if (allAutopsies.length >= 2) {
      // Include the current one (not yet saved) for a total of 3+
      const autopsiesForAnalysis = [...allAutopsies, autopsyItem];

      try {
        const prompt = buildAutopsyInsightPrompt(autopsiesForAnalysis);
        aiInsight = await callClaudeJSON(prompt);
        autopsyItem.aiInsight = aiInsight;
      } catch (aiErr) {
        console.warn('Failed to generate AI insight:', aiErr.message);
      }
    }

    await putItem(autopsyItem);

    console.log(`Autopsy ${reportId} saved. AI insight: ${aiInsight ? 'generated' : 'not enough data'}`);

    return response(200, {
      reportId,
      aiInsight,
      totalAutopsies: allAutopsies.length + 1,
    });
  } catch (err) {
    if (err.statusCode) return response(err.statusCode, { error: { code: 'CLIENT_ERROR', message: err.message } });
    console.error('Unhandled error in autopsyInsight:', err);
    return response(500, { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
};
