import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class DynamoTables extends Construct {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.table = new dynamodb.Table(this, 'MainTable', {
      tableName: 'deadlineai',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI1: Query deadlines by date (SK becomes PK)
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI2: Squad queries by squadId + date
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'squadId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'dueDate', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI3: Reminder dispatch queries by status + nextReminderAt
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI3',
      partitionKey: { name: 'reminderStatus', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'nextReminderAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
  }
}
