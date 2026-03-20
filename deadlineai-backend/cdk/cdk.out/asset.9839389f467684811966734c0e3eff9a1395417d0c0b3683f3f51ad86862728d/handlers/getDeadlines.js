import { verifyToken } from '../lib/auth.js';
import { queryByPK } from '../lib/dynamo.js';
import { computePriority } from '../lib/clash.js';
import { response } from '../lib/errors.js';

export const handler = async (event) => {
  try {
    const userId = await verifyToken(event);
    console.log('getDeadlines called by:', userId);

    const params = event.queryStringParameters || {};
    const { from, to, status } = params;

    // Build filter expression
    let filterExpression = null;
    const filterValues = {};

    const filters = [];

    if (from) {
      filters.push('dueDate >= :from');
      filterValues[':from'] = from;
    }
    if (to) {
      filters.push('dueDate <= :to');
      filterValues[':to'] = to;
    }
    if (status) {
      filters.push('#status = :status');
      filterValues[':status'] = status;
    }

    const options = {};
    if (filters.length > 0) {
      options.filterExpression = filters.join(' AND ');
      options.filterValues = filterValues;
      if (status) {
        // 'status' is a reserved word in DynamoDB
        options.filterExpression = options.filterExpression.replace('#status', '#st');
        options.expressionAttributeNames = { '#st': 'status' };
      }
    }

    let deadlines = await queryByPK(`USER#${userId}`, 'DEADLINE#', options);

    // Attach priority score to each deadline
    deadlines = deadlines.map((d) => ({
      ...d,
      priorityScore: computePriority(d),
    }));

    // Sort by priority score (highest first)
    deadlines.sort((a, b) => b.priorityScore - a.priorityScore);

    return response(200, { deadlines, count: deadlines.length });
  } catch (err) {
    if (err.statusCode) return response(err.statusCode, { error: { code: 'CLIENT_ERROR', message: err.message } });
    console.error('Unhandled error in getDeadlines:', err);
    return response(500, { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
};
