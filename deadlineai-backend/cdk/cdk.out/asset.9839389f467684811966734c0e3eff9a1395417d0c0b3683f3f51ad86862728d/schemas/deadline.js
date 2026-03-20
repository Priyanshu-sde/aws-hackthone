import { z } from 'zod';

export const DeadlineType = z.enum([
  'exam', 'midterm', 'quiz', 'assignment', 'project', 'lab', 'presentation', 'other',
]);

export const ExtractedDeadlineSchema = z.object({
  title: z.string().min(1),
  course_code: z.string().nullable(),
  course_name: z.string().nullable(),
  type: DeadlineType,
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_time: z.string().nullable(),
  weight: z.number().min(0).max(100).nullable(),
  description: z.string().nullable(),
  is_hard_deadline: z.boolean(),
  confidence: z.number().min(0).max(1),
});

export const ExtractedDeadlinesArraySchema = z.array(ExtractedDeadlineSchema);

export const ConfirmDeadlineSchema = z.object({
  deadlineId: z.string().optional(),
  title: z.string().min(1),
  courseCode: z.string().nullable().optional(),
  courseName: z.string().nullable().optional(),
  type: DeadlineType,
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueTime: z.string().nullable().optional(),
  weight: z.number().min(0).max(100).nullable().optional(),
  description: z.string().nullable().optional(),
  isHardDeadline: z.boolean().optional().default(true),
  reminderSchedule: z.array(z.string()).optional(),
  sharedWithSquad: z.string().nullable().optional(),
});

export const ConfirmDeadlinesBodySchema = z.object({
  deadlines: z.array(ConfirmDeadlineSchema).min(1).max(50),
});

/**
 * Convert a confirmed deadline to DynamoDB item format.
 */
export function toDynamoItem(userId, deadline, deadlineId) {
  return {
    PK: `USER#${userId}`,
    SK: `DEADLINE#${deadlineId}`,
    deadlineId,
    title: deadline.title,
    courseCode: deadline.courseCode || null,
    courseName: deadline.courseName || null,
    type: deadline.type,
    dueDate: deadline.dueDate,
    dueTime: deadline.dueTime || null,
    weight: deadline.weight || null,
    description: deadline.description || null,
    isHardDeadline: deadline.isHardDeadline ?? true,
    status: 'active',
    reminderSchedule: deadline.reminderSchedule || [],
    nextReminderAt: deadline.reminderSchedule?.[0] || null,
    reminderStatus: 'PENDING',
    remindersDismissed: 0,
    paceModeSessionsCompleted: 0,
    sharedWithSquad: deadline.sharedWithSquad || null,
    squadId: deadline.sharedWithSquad || null,
    buddyNotified: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
