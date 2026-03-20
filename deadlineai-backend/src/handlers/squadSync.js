import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { putItem, deleteItem, queryByPK } from '../lib/dynamo.js';
import { response } from '../lib/errors.js';

export const handler = async (event) => {
  const routeKey = event.requestContext?.routeKey;
  const connectionId = event.requestContext?.connectionId;

  console.log(`squadSync: route=${routeKey}, connectionId=${connectionId}`);

  try {
    switch (routeKey) {
      case '$connect':
        return await handleConnect(event, connectionId);
      case '$disconnect':
        return await handleDisconnect(connectionId);
      case '$default':
        return await handleMessage(event, connectionId);
      default:
        return { statusCode: 400, body: 'Unknown route' };
    }
  } catch (err) {
    console.error(`Error in squadSync (${routeKey}):`, err);
    return { statusCode: 500, body: 'Internal server error' };
  }
};

async function handleConnect(event, connectionId) {
  const params = event.queryStringParameters || {};
  const { userId, squadId } = params;

  if (!userId || !squadId) {
    return { statusCode: 400, body: 'Missing userId or squadId query params' };
  }

  await putItem({
    PK: `WS#${connectionId}`,
    SK: 'META',
    connectionId,
    userId,
    squadId,
    connectedAt: new Date().toISOString(),
  });

  console.log(`WebSocket connected: ${connectionId} (user=${userId}, squad=${squadId})`);
  return { statusCode: 200, body: 'Connected' };
}

async function handleDisconnect(connectionId) {
  await deleteItem(`WS#${connectionId}`, 'META');
  console.log(`WebSocket disconnected: ${connectionId}`);
  return { statusCode: 200, body: 'Disconnected' };
}

async function handleMessage(event, connectionId) {
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { action, data } = body;

  // Get the sender's connection info
  const senderConn = await import('../lib/dynamo.js').then((m) =>
    m.getItem(`WS#${connectionId}`, 'META')
  );

  if (!senderConn) {
    return { statusCode: 400, body: 'Connection not found' };
  }

  if (action === 'broadcast') {
    // Broadcast to all connections in the same squad
    await broadcastToSquad(senderConn.squadId, {
      type: 'squad_update',
      from: senderConn.userId,
      data,
      timestamp: new Date().toISOString(),
    }, connectionId);
  }

  return { statusCode: 200, body: 'Message processed' };
}

async function broadcastToSquad(squadId, message, excludeConnectionId) {
  // HACKATHON NOTE: We query all WS connections. In production, use a GSI on squadId
  // for efficient lookup. For hackathon, the connection count will be very low.
  const { queryGSI } = await import('../lib/dynamo.js');

  // Scan for connections — simple approach for hackathon
  const allConnections = await queryGSI('GSI1', 'SK', 'META', null, null);
  const squadConnections = allConnections.filter(
    (c) => c.PK?.startsWith('WS#') && c.squadId === squadId
  );

  const endpoint = process.env.WEBSOCKET_ENDPOINT;
  const apiClient = new ApiGatewayManagementApiClient({ endpoint });

  const messageStr = JSON.stringify(message);

  const sendPromises = squadConnections
    .filter((c) => c.connectionId !== excludeConnectionId)
    .map(async (conn) => {
      try {
        await apiClient.send(
          new PostToConnectionCommand({
            ConnectionId: conn.connectionId,
            Data: messageStr,
          })
        );
      } catch (err) {
        if (err.statusCode === 410) {
          // Connection is stale, clean it up
          console.log(`Stale connection ${conn.connectionId}, removing`);
          await deleteItem(`WS#${conn.connectionId}`, 'META');
        } else {
          console.error(`Failed to send to ${conn.connectionId}:`, err.message);
        }
      }
    });

  await Promise.all(sendPromises);
}
