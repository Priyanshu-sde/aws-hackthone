import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = process.env.TABLE_NAME || 'deadlineai';

export async function putItem(item) {
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return item;
}

export async function getItem(pk, sk) {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: pk, SK: sk } })
  );
  return result.Item || null;
}

export async function queryByPK(pk, skPrefix, options = {}) {
  const params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: { ':pk': pk, ':skPrefix': skPrefix },
  };

  if (options.filterExpression) {
    params.FilterExpression = options.filterExpression;
    Object.assign(params.ExpressionAttributeValues, options.filterValues || {});
  }

  if (options.limit) {
    params.Limit = options.limit;
  }

  if (options.scanIndexForward !== undefined) {
    params.ScanIndexForward = options.scanIndexForward;
  }

  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
}

export async function queryGSI(indexName, pkName, pkValue, skName, skRange) {
  const params = {
    TableName: TABLE_NAME,
    IndexName: indexName,
    KeyConditionExpression: `${pkName} = :pk`,
    ExpressionAttributeValues: { ':pk': pkValue },
  };

  if (skRange && skName) {
    if (skRange.between) {
      params.KeyConditionExpression += ` AND ${skName} BETWEEN :start AND :end`;
      params.ExpressionAttributeValues[':start'] = skRange.between[0];
      params.ExpressionAttributeValues[':end'] = skRange.between[1];
    } else if (skRange.beginsWith) {
      params.KeyConditionExpression += ` AND begins_with(${skName}, :prefix)`;
      params.ExpressionAttributeValues[':prefix'] = skRange.beginsWith;
    }
  }

  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
}

export async function updateItem(pk, sk, updates) {
  const keys = Object.keys(updates);
  if (keys.length === 0) return;

  const expressionParts = [];
  const exprAttrNames = {};
  const exprAttrValues = {};

  keys.forEach((key, i) => {
    expressionParts.push(`#k${i} = :v${i}`);
    exprAttrNames[`#k${i}`] = key;
    exprAttrValues[`:v${i}`] = updates[key];
  });

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: pk, SK: sk },
      UpdateExpression: `SET ${expressionParts.join(', ')}`,
      ExpressionAttributeNames: exprAttrNames,
      ExpressionAttributeValues: exprAttrValues,
      ReturnValues: 'ALL_NEW',
    })
  );
  return result.Attributes;
}

export async function deleteItem(pk, sk) {
  await docClient.send(
    new DeleteCommand({ TableName: TABLE_NAME, Key: { PK: pk, SK: sk } })
  );
}

export async function batchWrite(items) {
  // DynamoDB BatchWriteItem supports max 25 items per call
  const chunks = [];
  for (let i = 0; i < items.length; i += 25) {
    chunks.push(items.slice(i, i + 25));
  }

  for (const chunk of chunks) {
    const requestItems = {
      [TABLE_NAME]: chunk.map((item) => ({
        PutRequest: { Item: item },
      })),
    };

    await docClient.send(new BatchWriteCommand({ RequestItems: requestItems }));
  }

  return items.length;
}

export { docClient, TABLE_NAME };
