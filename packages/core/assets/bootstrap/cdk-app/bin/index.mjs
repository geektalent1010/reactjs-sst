#!/usr/bin/env node

import url from "url";
import * as path from "path";
import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import {
  Bootstrap,
} from "@serverless-stack/core";

const region = process.argv[2];
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Create CDK App
const app = new cdk.App();
const stack = new cdk.Stack(app, "SSTBootstrap", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region,
  },
});

const bucket = createS3Bucket();
const fn = createStackMetadataFunction(bucket);
createSsmParams({
  [Bootstrap.SSM_NAME_VERSION]: Bootstrap.LATEST_VERSION,
  [Bootstrap.SSM_NAME_STACK_NAME]: stack.stackName,
  [Bootstrap.SSM_NAME_BUCKET_NAME]: bucket.bucketName,
  [Bootstrap.SSM_NAME_STACK_METADATA_FUNCTION_ARN]: fn.functionArn,
});

function createS3Bucket() {
  return new s3.Bucket(stack, region, {
    encryption: s3.BucketEncryption.S3_MANAGED,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  });
}

function createStackMetadataFunction(bucket) {
  // Create execution policy
  const policyStatement = new iam.PolicyStatement();
  policyStatement.addAllResources();
  policyStatement.addActions(
    "s3:*",
  );

  // Create Lambda
  return new lambda.Function(stack, "stack-metadata", {
    code: lambda.Code.fromAsset(path.join(__dirname, "../custom-resources")),
    handler: "stack-metadata.handler",
    runtime: lambda.Runtime.NODEJS_16_X,
    timeout: cdk.Duration.seconds(900),
    memorySize: 1024,
    environment: {
      BUCKET_NAME: bucket.bucketName,
    },
    initialPolicy: [policyStatement],
  });
}

function createSsmParams(data) {
  Object.keys(data).forEach(key => {
    new ssm.StringParameter(stack, key, {
      parameterName: key,
      stringValue: data[key],
      description: `SST Bootstrap Stack ${key}`,
      tier: ssm.ParameterTier.STANDARD,
    });
  });
}