import { v4 as uuidv4 } from 'uuid';
import { verifyToken } from '../lib/auth.js';
import { putItem, getItem, queryByPK, queryGSI, deleteItem, updateItem } from '../lib/dynamo.js';
import { CreateSquadSchema, JoinSquadSchema, toSquadMetaItem, toSquadMemberItem } from '../schemas/squad.js';
import { response, AppError } from '../lib/errors.js';

export const handler = async (event) => {
  try {
    const userId = await verifyToken(event);
    const method = event.httpMethod;
    const path = event.resource;

    console.log(`squadOps: ${method} ${path} by ${userId}`);

    if (method === 'POST' && path === '/squads') {
      return await createSquad(userId, event);
    }
    if (method === 'POST' && path === '/squads/join') {
      return await joinSquad(userId, event);
    }
    if (method === 'GET' && path === '/squads') {
      return await listSquads(userId);
    }
    if (method === 'GET' && path === '/squads/{squadId}') {
      return await getSquadBoard(userId, event);
    }
    if (method === 'DELETE' && path === '/squads/{squadId}') {
      return await leaveSquad(userId, event);
    }

    return response(400, { error: { code: 'BAD_REQUEST', message: 'Unknown squad operation' } });
  } catch (err) {
    if (err.statusCode) return response(err.statusCode, { error: { code: 'CLIENT_ERROR', message: err.message } });
    console.error('Unhandled error in squadOps:', err);
    return response(500, { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
};

async function createSquad(userId, event) {
  const body = JSON.parse(event.body);
  const parsed = CreateSquadSchema.safeParse(body);
  if (!parsed.success) {
    return response(400, { error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: parsed.error.issues } });
  }

  const squadId = uuidv4();
  const inviteCode = generateInviteCode();

  const metaItem = toSquadMetaItem(squadId, parsed.data.name, inviteCode, userId);
  const memberItem = toSquadMemberItem(squadId, userId, null);

  await putItem(metaItem);
  await putItem(memberItem);

  // Update user's squad list
  const user = await getItem(`USER#${userId}`, 'META');
  if (user) {
    const squads = user.squads || [];
    squads.push(squadId);
    await updateItem(`USER#${userId}`, 'META', { squads });
  }

  console.log(`Squad ${squadId} created with invite code ${inviteCode}`);

  return response(201, {
    squadId,
    name: parsed.data.name,
    inviteCode,
  });
}

async function joinSquad(userId, event) {
  const body = JSON.parse(event.body);
  const parsed = JoinSquadSchema.safeParse(body);
  if (!parsed.success) {
    return response(400, { error: { code: 'VALIDATION_ERROR', message: 'Invalid invite code format' } });
  }

  // Find squad by invite code — scan GSI or use a lookup pattern
  // HACKATHON NOTE: Using a scan with filter since we don't have a GSI on inviteCode.
  // In production, add a GSI on inviteCode for O(1) lookups.
  const allSquads = await queryGSI('GSI1', 'SK', 'META', null, null);
  const squad = allSquads.find(
    (s) => s.inviteCode === parsed.data.inviteCode && s.PK?.startsWith('SQUAD#')
  );

  if (!squad) {
    throw new AppError(404, 'Invalid invite code');
  }

  // Check if already a member
  const existing = await getItem(`SQUAD#${squad.squadId}`, `MEMBER#${userId}`);
  if (existing) {
    return response(200, { message: 'Already a member', squadId: squad.squadId });
  }

  const memberItem = toSquadMemberItem(squad.squadId, userId, null);
  await putItem(memberItem);

  // Update member count
  await updateItem(`SQUAD#${squad.squadId}`, 'META', {
    memberCount: (squad.memberCount || 1) + 1,
    updatedAt: new Date().toISOString(),
  });

  // Update user's squad list
  const user = await getItem(`USER#${userId}`, 'META');
  if (user) {
    const squads = user.squads || [];
    squads.push(squad.squadId);
    await updateItem(`USER#${userId}`, 'META', { squads });
  }

  return response(200, { squadId: squad.squadId, name: squad.name });
}

async function listSquads(userId) {
  const user = await getItem(`USER#${userId}`, 'META');
  const squadIds = user?.squads || [];

  const squads = [];
  for (const squadId of squadIds) {
    const meta = await getItem(`SQUAD#${squadId}`, 'META');
    if (meta) squads.push(meta);
  }

  return response(200, { squads });
}

async function getSquadBoard(userId, event) {
  const squadId = event.pathParameters?.squadId;
  if (!squadId) throw new AppError(400, 'Missing squadId');

  // Verify user is a member
  const membership = await getItem(`SQUAD#${squadId}`, `MEMBER#${userId}`);
  if (!membership) throw new AppError(403, 'Not a member of this squad');

  // Get all members
  const members = await queryByPK(`SQUAD#${squadId}`, 'MEMBER#');

  // Fetch shared deadlines for each member
  const board = [];
  for (const member of members) {
    const deadlines = await queryByPK(`USER#${member.userId}`, 'DEADLINE#');
    const shared = deadlines.filter((d) => d.sharedWithSquad === squadId);
    board.push({
      userId: member.userId,
      displayName: member.displayName,
      deadlines: shared,
    });
  }

  return response(200, { squadId, members: members.length, board });
}

async function leaveSquad(userId, event) {
  const squadId = event.pathParameters?.squadId;
  if (!squadId) throw new AppError(400, 'Missing squadId');

  await deleteItem(`SQUAD#${squadId}`, `MEMBER#${userId}`);

  // Update user's squad list
  const user = await getItem(`USER#${userId}`, 'META');
  if (user) {
    const squads = (user.squads || []).filter((id) => id !== squadId);
    await updateItem(`USER#${userId}`, 'META', { squads });
  }

  // Decrement member count
  const meta = await getItem(`SQUAD#${squadId}`, 'META');
  if (meta) {
    await updateItem(`SQUAD#${squadId}`, 'META', {
      memberCount: Math.max(0, (meta.memberCount || 1) - 1),
      updatedAt: new Date().toISOString(),
    });
  }

  return response(200, { message: 'Left squad', squadId });
}

function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
