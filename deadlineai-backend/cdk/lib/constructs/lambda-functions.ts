import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

export interface LambdaFunctionsProps {
  table: dynamodb.Table;
  bucket: s3.Bucket;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
}

export class LambdaFunctions extends Construct {
  public readonly handlers: Record<string, lambda.Function>;

  constructor(scope: Construct, id: string, props: LambdaFunctionsProps) {
    super(scope, id);

    const srcPath = path.join(__dirname, '..', '..', '..', 'src');

    // Environment variables — Twilio creds are set directly (no SSM)
    // Set real values via CDK context, CLI overrides, or edit after deploy
    const commonEnv: Record<string, string> = {
      TABLE_NAME: props.table.tableName,
      BUCKET_NAME: props.bucket.bucketName,
      USER_POOL_ID: props.userPool.userPoolId,
      USER_POOL_CLIENT_ID: props.userPoolClient.userPoolClientId,
      AWS_REGION_OVERRIDE: 'ap-south-1',
      // Twilio — replace with real values before deploy or update in Lambda console
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || 'REPLACE_ME',
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || 'REPLACE_ME',
      TWILIO_WHATSAPP_FROM: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
      NODE_ENV: 'production',
    };

    const bedrockPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel'],
      resources: ['*'],
    });

    const fnDefs: Record<string, { handler: string; timeout: number; extras?: (fn: lambda.Function) => void }> = {
      pdfIngest: {
        handler: 'handlers/pdfIngest.handler',
        timeout: 90,
        extras: (fn) => {
          props.bucket.grantReadWrite(fn);
          props.table.grantReadWriteData(fn);
          fn.addToRolePolicy(bedrockPolicy);
        },
      },
      confirmDeadlines: {
        handler: 'handlers/confirmDeadlines.handler',
        timeout: 15,
        extras: (fn) => {
          props.table.grantReadWriteData(fn);
        },
      },
      getDeadlines: {
        handler: 'handlers/getDeadlines.handler',
        timeout: 10,
        extras: (fn) => {
          props.table.grantReadData(fn);
        },
      },
      clashAnalysis: {
        handler: 'handlers/clashAnalysis.handler',
        timeout: 30,
        extras: (fn) => {
          props.table.grantReadData(fn);
          fn.addToRolePolicy(bedrockPolicy);
        },
      },
      paceScheduler: {
        handler: 'handlers/paceScheduler.handler',
        timeout: 30,
        extras: (fn) => {
          props.table.grantReadWriteData(fn);
          fn.addToRolePolicy(bedrockPolicy);
        },
      },
      reminderDispatch: {
        handler: 'handlers/reminderDispatch.handler',
        timeout: 60,
        extras: (fn) => {
          props.table.grantReadWriteData(fn);
        },
      },
      autopsyInsight: {
        handler: 'handlers/autopsyInsight.handler',
        timeout: 30,
        extras: (fn) => {
          props.table.grantReadWriteData(fn);
          fn.addToRolePolicy(bedrockPolicy);
        },
      },
      squadOps: {
        handler: 'handlers/squadOps.handler',
        timeout: 15,
        extras: (fn) => {
          props.table.grantReadWriteData(fn);
        },
      },
      squadSync: {
        handler: 'handlers/squadSync.handler',
        timeout: 10,
        extras: (fn) => {
          props.table.grantReadWriteData(fn);
        },
      },
      procrastinationWatch: {
        handler: 'handlers/procrastinationWatch.handler',
        timeout: 15,
        extras: (fn) => {
          props.table.grantReadWriteData(fn);
        },
      },
    };

    this.handlers = {};

    for (const [name, def] of Object.entries(fnDefs)) {
      const fn = new lambda.Function(this, `${name}Fn`, {
        functionName: `deadlineai-${name}`,
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: def.handler,
        code: lambda.Code.fromAsset(srcPath),
        memorySize: 128,
        timeout: cdk.Duration.seconds(def.timeout),
        environment: commonEnv,
        logRetention: logs.RetentionDays.ONE_WEEK,
      });

      if (def.extras) {
        def.extras(fn);
      }

      this.handlers[name] = fn;
    }
  }
}
