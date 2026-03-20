import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface EventBridgeRulesProps {
  reminderDispatchFn: lambda.Function;
  autopsyInsightFn: lambda.Function;
}

export class EventBridgeRules extends Construct {
  constructor(scope: Construct, id: string, props: EventBridgeRulesProps) {
    super(scope, id);

    // Reminder dispatch every 15 minutes
    new events.Rule(this, 'ReminderSchedule', {
      ruleName: 'deadlineai-reminder-dispatch',
      schedule: events.Schedule.rate(cdk.Duration.minutes(15)),
      targets: [new targets.LambdaFunction(props.reminderDispatchFn)],
    });

    // Autopsy insight daily at 04:30 UTC (10:00 AM IST)
    new events.Rule(this, 'AutopsyDaily', {
      ruleName: 'deadlineai-autopsy-daily',
      schedule: events.Schedule.cron({ minute: '30', hour: '4' }),
      targets: [new targets.LambdaFunction(props.autopsyInsightFn)],
    });
  }
}
