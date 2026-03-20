import { z } from 'zod';

export const UserSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  phone: z.string().optional(),
  buddyPhone: z.string().optional(),
  timezone: z.string().optional().default('Asia/Kolkata'),
  squads: z.array(z.string()).optional().default([]),
});

export function toUserDynamoItem(userId, data) {
  return {
    PK: `USER#${userId}`,
    SK: 'META',
    userId,
    email: data.email,
    name: data.name || null,
    phone: data.phone || null,
    buddyPhone: data.buddyPhone || null,
    timezone: data.timezone || 'Asia/Kolkata',
    squads: data.squads || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
