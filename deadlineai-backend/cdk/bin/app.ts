#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DeadlineAiStack } from '../lib/deadlineai-stack';

const app = new cdk.App();
new DeadlineAiStack(app, 'DeadlineAiStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});
