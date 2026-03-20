import { z } from 'zod';

export const PaceRequestSchema = z.object({
  hoursPerDay: z.number().min(0.5).max(12).optional().default(3),
});

export const PaceSessionSchema = z.object({
  session_number: z.number(),
  date: z.string(),
  duration_hours: z.number(),
  topic: z.string(),
  goals: z.array(z.string()),
  resources: z.array(z.string()),
  milestone: z.string().nullable(),
});

export function toPaceSessionItem(userId, sessionId, deadlineId, session) {
  return {
    PK: `USER#${userId}`,
    SK: `SESSION#${sessionId}`,
    sessionId,
    deadlineId,
    sessionNumber: session.session_number,
    date: session.date,
    durationHours: session.duration_hours,
    topic: session.topic,
    goals: session.goals,
    resources: session.resources,
    milestone: session.milestone,
    completed: false,
    createdAt: new Date().toISOString(),
  };
}
