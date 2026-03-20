import { z } from 'zod';

export const CreateSquadSchema = z.object({
  name: z.string().min(1).max(50),
});

export const JoinSquadSchema = z.object({
  inviteCode: z.string().length(6),
});

export function toSquadMetaItem(squadId, name, inviteCode, creatorId) {
  return {
    PK: `SQUAD#${squadId}`,
    SK: 'META',
    squadId,
    name,
    inviteCode,
    createdBy: creatorId,
    memberCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function toSquadMemberItem(squadId, userId, displayName) {
  return {
    PK: `SQUAD#${squadId}`,
    SK: `MEMBER#${userId}`,
    squadId,
    userId,
    displayName: displayName || userId,
    joinedAt: new Date().toISOString(),
  };
}
