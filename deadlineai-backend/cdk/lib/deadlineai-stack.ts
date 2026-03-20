import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';

import { DynamoTables } from './constructs/dynamo-tables';
import { LambdaFunctions } from './constructs/lambda-functions';
import { ApiGatewayConstruct } from './constructs/api-gateway';
import { EventBridgeRules } from './constructs/eventbridge-rules';

export class DeadlineAiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for temporary PDF storage
    const pdfBucket = new s3.Bucket(this, 'PdfBucket', {
      bucketName: `deadlineai-pdfs-${this.account}-${this.region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(1), // HACKATHON NOTE: S3 minimum is 1 day; in production use a cleanup Lambda for shorter TTL
          enabled: true,
        },
      ],
    });

    // Cognito User Pool
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'deadlineai-users',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: false, mutable: true },
        phoneNumber: { required: false, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: false,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      userPoolClientName: 'deadlineai-app',
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
    });

    // DynamoDB
    const dynamo = new DynamoTables(this, 'DynamoTables');

    // Lambda Functions
    const lambdas = new LambdaFunctions(this, 'LambdaFunctions', {
      table: dynamo.table,
      bucket: pdfBucket,
      userPool,
      userPoolClient,
    });

    // API Gateway (REST + WebSocket)
    const api = new ApiGatewayConstruct(this, 'ApiGateway', {
      userPool,
      handlers: lambdas.handlers,
    });

    // Set WEBSOCKET_ENDPOINT env var on all handlers that need it
    const wsEndpoint = `https://${api.webSocketApi.ref}.execute-api.${this.region}.amazonaws.com/prod`;
    lambdas.handlers.squadSync.addEnvironment('WEBSOCKET_ENDPOINT', wsEndpoint);
    lambdas.handlers.squadOps.addEnvironment('WEBSOCKET_ENDPOINT', wsEndpoint);

    // Grant squadSync permission to manage WebSocket connections
    lambdas.handlers.squadSync.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['execute-api:ManageConnections'],
      resources: [`arn:aws:execute-api:${this.region}:${this.account}:${api.webSocketApi.ref}/*`],
    }));

    // EventBridge Rules
    new EventBridgeRules(this, 'EventBridgeRules', {
      reminderDispatchFn: lambdas.handlers.reminderDispatch,
      autopsyInsightFn: lambdas.handlers.autopsyInsight,
    });

    // DynamoDB Stream → procrastinationWatch
    lambdas.handlers.procrastinationWatch.addEventSource(
      new lambdaEventSources.DynamoEventSource(dynamo.table, {
        startingPosition: cdk.aws_lambda.StartingPosition.TRIM_HORIZON,
        batchSize: 10,
        retryAttempts: 2,
      })
    );

    // SNS Topic for push notification fan-out
    const notifTopic = new sns.Topic(this, 'NotifTopic', {
      topicName: 'deadlineai-notifications',
    });
    lambdas.handlers.reminderDispatch.addEnvironment('SNS_TOPIC_ARN', notifTopic.topicArn);
    notifTopic.grantPublish(lambdas.handlers.reminderDispatch);

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.restApi.url,
      description: 'REST API URL',
    });

    new cdk.CfnOutput(this, 'WebSocketUrl', {
      value: `wss://${api.webSocketApi.ref}.execute-api.${this.region}.amazonaws.com/prod`,
      description: 'WebSocket API URL',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: dynamo.table.tableName,
    });
  }
}
