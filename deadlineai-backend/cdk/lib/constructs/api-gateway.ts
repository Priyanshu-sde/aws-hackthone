import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface ApiGatewayProps {
  userPool: cognito.UserPool;
  handlers: Record<string, lambda.Function>;
}

export class ApiGatewayConstruct extends Construct {
  public readonly restApi: apigateway.RestApi;
  public readonly webSocketApi: apigwv2.CfnApi;
  public readonly webSocketStage: apigwv2.CfnStage;

  constructor(scope: Construct, id: string, props: ApiGatewayProps) {
    super(scope, id);

    // REST API
    this.restApi = new apigateway.RestApi(this, 'RestApi', {
      restApiName: 'DeadlineAI API',
      description: 'DeadlineAI Backend REST API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Authorization', 'Content-Type'],
      },
    });

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuth', {
      cognitoUserPools: [props.userPool],
      identitySource: 'method.request.header.Authorization',
    });

    const authMethodOptions: apigateway.MethodOptions = {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    // POST /syllabi/upload
    const syllabi = this.restApi.root.addResource('syllabi');
    const upload = syllabi.addResource('upload');
    upload.addMethod('POST', new apigateway.LambdaIntegration(props.handlers.pdfIngest), authMethodOptions);

    // /deadlines
    const deadlines = this.restApi.root.addResource('deadlines');
    deadlines.addMethod('GET', new apigateway.LambdaIntegration(props.handlers.getDeadlines), authMethodOptions);

    // POST /deadlines/confirm
    const confirm = deadlines.addResource('confirm');
    confirm.addMethod('POST', new apigateway.LambdaIntegration(props.handlers.confirmDeadlines), authMethodOptions);

    // GET /deadlines/clashes
    const clashes = deadlines.addResource('clashes');
    clashes.addMethod('GET', new apigateway.LambdaIntegration(props.handlers.clashAnalysis), authMethodOptions);

    // POST /deadlines/{deadlineId}/pace
    const deadlineById = deadlines.addResource('{deadlineId}');
    const pace = deadlineById.addResource('pace');
    pace.addMethod('POST', new apigateway.LambdaIntegration(props.handlers.paceScheduler), authMethodOptions);

    // /autopsies
    const autopsies = this.restApi.root.addResource('autopsies');
    autopsies.addMethod('POST', new apigateway.LambdaIntegration(props.handlers.autopsyInsight), authMethodOptions);

    // /squads
    const squads = this.restApi.root.addResource('squads');
    squads.addMethod('POST', new apigateway.LambdaIntegration(props.handlers.squadOps), authMethodOptions);
    squads.addMethod('GET', new apigateway.LambdaIntegration(props.handlers.squadOps), authMethodOptions);

    const squadById = squads.addResource('{squadId}');
    squadById.addMethod('GET', new apigateway.LambdaIntegration(props.handlers.squadOps), authMethodOptions);
    squadById.addMethod('DELETE', new apigateway.LambdaIntegration(props.handlers.squadOps), authMethodOptions);

    const join = squads.addResource('join');
    join.addMethod('POST', new apigateway.LambdaIntegration(props.handlers.squadOps), authMethodOptions);

    // WebSocket API for Squad Sync
    this.webSocketApi = new apigwv2.CfnApi(this, 'WebSocketApi', {
      name: 'DeadlineAI-WebSocket',
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.action',
    });

    const connectIntegration = new apigwv2.CfnIntegration(this, 'ConnectIntegration', {
      apiId: this.webSocketApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: `arn:aws:apigateway:${cdk.Stack.of(this).region}:lambda:path/2015-03-31/functions/${props.handlers.squadSync.functionArn}/invocations`,
    });

    new apigwv2.CfnRoute(this, 'ConnectRoute', {
      apiId: this.webSocketApi.ref,
      routeKey: '$connect',
      authorizationType: 'NONE',
      target: `integrations/${connectIntegration.ref}`,
    });

    const disconnectIntegration = new apigwv2.CfnIntegration(this, 'DisconnectIntegration', {
      apiId: this.webSocketApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: `arn:aws:apigateway:${cdk.Stack.of(this).region}:lambda:path/2015-03-31/functions/${props.handlers.squadSync.functionArn}/invocations`,
    });

    new apigwv2.CfnRoute(this, 'DisconnectRoute', {
      apiId: this.webSocketApi.ref,
      routeKey: '$disconnect',
      target: `integrations/${disconnectIntegration.ref}`,
    });

    const defaultIntegration = new apigwv2.CfnIntegration(this, 'DefaultIntegration', {
      apiId: this.webSocketApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: `arn:aws:apigateway:${cdk.Stack.of(this).region}:lambda:path/2015-03-31/functions/${props.handlers.squadSync.functionArn}/invocations`,
    });

    new apigwv2.CfnRoute(this, 'DefaultRoute', {
      apiId: this.webSocketApi.ref,
      routeKey: '$default',
      target: `integrations/${defaultIntegration.ref}`,
    });

    this.webSocketStage = new apigwv2.CfnStage(this, 'WebSocketStage', {
      apiId: this.webSocketApi.ref,
      stageName: 'prod',
      autoDeploy: true,
    });

    // Grant API Gateway permission to invoke WebSocket Lambda
    props.handlers.squadSync.addPermission('WebSocketInvoke', {
      principal: new cdk.aws_iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: `arn:aws:execute-api:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:${this.webSocketApi.ref}/*`,
    });
  }
}
