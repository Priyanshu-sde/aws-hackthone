import { verifyToken } from '../lib/auth.js';
import { getItem } from '../lib/dynamo.js';
import { response } from '../lib/errors.js';

// HACKATHON NOTE: Extraction is synchronous in the hackathon build.
// This poller exists for API completeness — in production it would poll an SQS-backed job.

export const handler = async (event) => {
  try {
    const userId = await verifyToken(event);
    const jobId = event.pathParameters?.jobId;

    if (!jobId) {
      return response(400, { error: { code: 'BAD_REQUEST', message: 'Missing jobId' } });
    }

    const job = await getItem(`USER#${userId}`, `JOB#${jobId}`);

    if (!job) {
      return response(404, { error: { code: 'NOT_FOUND', message: 'Job not found' } });
    }

    return response(200, {
      jobId: job.jobId,
      status: job.status,
      deadlineCount: job.deadlineCount || 0,
      createdAt: job.createdAt,
    });
  } catch (err) {
    if (err.statusCode) return response(err.statusCode, { error: { code: 'CLIENT_ERROR', message: err.message } });
    console.error('Unhandled error in extractionPoller:', err);
    return response(500, { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
};
