import { z } from 'zod';

export const AutopsySchema = z.object({
  deadlineId: z.string(),
  completedOnTime: z.boolean(),
  satisfaction: z.number().min(1).max(5),
  whatWentWell: z.string().optional(),
  whatWentWrong: z.string().optional(),
  lessonsLearned: z.string().optional(),
  wouldChangeApproach: z.boolean().optional(),
  hoursSpent: z.number().min(0).optional(),
  startedDaysBefore: z.number().min(0).optional(),
});

export function toAutopsyItem(userId, reportId, data) {
  return {
    PK: `USER#${userId}`,
    SK: `AUTOPSY#${reportId}`,
    reportId,
    deadlineId: data.deadlineId,
    completedOnTime: data.completedOnTime,
    satisfaction: data.satisfaction,
    whatWentWell: data.whatWentWell || null,
    whatWentWrong: data.whatWentWrong || null,
    lessonsLearned: data.lessonsLearned || null,
    wouldChangeApproach: data.wouldChangeApproach ?? null,
    hoursSpent: data.hoursSpent ?? null,
    startedDaysBefore: data.startedDaysBefore ?? null,
    aiInsight: null,
    createdAt: new Date().toISOString(),
  };
}
