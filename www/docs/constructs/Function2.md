---
description: "Docs for the sst.Function construct in the @serverless-stack/resources package"
---


## Constructor
```ts
new Function(scope: Construct, id: string, props: FunctionProps)
```
_Parameters_
- scope [`Construct`](https://docs.aws.amazon.com/cdk/api/v2/docs/constructs.Construct.html)
- id `string`
- props [`FunctionProps`](#functionprops)
## Properties
An instance of `Function` has the following properties.
### _isLiveDevEnabled

_Type_ : `boolean`

## Methods
An instance of `Function` has the following methods.
### attachPermissions

```ts
attachPermissions(permissions: Permissions)
```
_Parameters_
- permissions [`Permissions`](Permissions)
## FunctionBundleCopyFilesProps
### from

_Type_ : `string`

### to

_Type_ : `string`

## FunctionBundleEsbuildConfig
### define

_Type_ : unknown

### keepNames

_Type_ : `boolean`

### plugins

_Type_ : `string`

## FunctionBundleNodejsProps
### commandHooks

_Type_ : [`ICommandHooks`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.ICommandHooks.html)

### esbuildConfig

_Type_ : [`FunctionBundleEsbuildConfig`](#functionbundleesbuildconfig)

### externalModules

_Type_ : unknown

### format

_Type_ : `"cjs"`&nbsp; | &nbsp;`"esm"`

### loader

_Type_ : unknown

### minify

_Type_ : `boolean`

### nodeModules

_Type_ : unknown

## FunctionBundlePythonProps
### installCommands

_Type_ : unknown

## FunctionHandlerProps
### bundle

_Type_ : unknown&nbsp; | &nbsp;`boolean`

### handler

_Type_ : `string`

### runtime

_Type_ : `string`

### srcPath

_Type_ : `string`

## FunctionNameProps
### functionProps

_Type_ : [`FunctionProps`](#functionprops)

### stack

_Type_ : [`Stack`](Stack)

## FunctionProps
### allowAllOutbound

_Type_ : `boolean`

Whether to allow the Lambda to send all network traffic.
true
stable

### allowPublicSubnet

_Type_ : `boolean`

Lambda Functions in a public subnet can NOT access the internet.
false
https://stackoverflow.com/questions/52992085/why-cant-an-aws-lambda-function-inside-a-public-subnet-in-a-vpc-connect-to-the/52994841#52994841
stable

### architecture

_Type_ : [`Architecture`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.Architecture.html)

The system architectures compatible with this lambda function.
Architecture.X86_64
stable

### bundle

_Type_ : unknown&nbsp; | &nbsp;`boolean`

Disable bundling with esbuild.
- Defaults to true

### codeSigningConfig

_Type_ : [`ICodeSigningConfig`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.ICodeSigningConfig.html)

Code signing config associated with this function.
- Not Sign the Code
stable

### currentVersionOptions

_Type_ : [`VersionOptions`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.VersionOptions.html)

Options for the `lambda.Version` resource automatically created by the `fn.currentVersion` method.
- default options as described in `VersionOptions`
stable

### deadLetterQueue

_Type_ : [`IQueue`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.IQueue.html)

The SQS queue to use if DLQ is enabled.
- SQS queue with 14 day retention period if `deadLetterQueueEnabled` is `true`
stable

### deadLetterQueueEnabled

_Type_ : `boolean`

Enabled DLQ.
- false unless `deadLetterQueue` is set, which implies DLQ is enabled.
stable

### description

_Type_ : `string`

A description of the function.
- No description.
stable

### enableLiveDev

_Type_ : `boolean`

Enable local development
- Defaults to true

### environment

_Type_ : unknown

Key-value pairs that Lambda caches and makes available for your Lambda functions.
- No environment variables.
stable

### environmentEncryption

_Type_ : [`IKey`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.IKey.html)

The AWS KMS key that's used to encrypt your function's environment variables.
- AWS Lambda creates and uses an AWS managed customer master key (CMK).
stable

### events

_Type_ : unknown

Event sources for this function.
- No event sources.
stable

### filesystem

_Type_ : [`FileSystem`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.FileSystem.html)

The filesystem configuration for the lambda function.
- will not mount any filesystem
stable

### functionName

_Type_ : `string`&nbsp; | &nbsp;unknown

The source directory where the entry point is located. The node_modules in this
directory is used to generate the bundle.
- A name for the function or a callback that returns the name.

### handler

_Type_ : `string`

Path to the entry point and handler function. Of the format:
`/path/to/file.function`.
### initialPolicy

_Type_ : unknown

Initial policy statements to add to the created Lambda Role.
- No policy statements are added to the created Lambda role.
stable

### insightsVersion

_Type_ : [`LambdaInsightsVersion`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.LambdaInsightsVersion.html)

Specify the version of CloudWatch Lambda insights to use for monitoring.
- No Lambda Insights
https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Lambda-Insights-Getting-Started-docker.html
stable

### layers

_Type_ : unknown

### logRetention

_Type_ : [`RetentionDays`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.RetentionDays.html)

The number of days log events are kept in CloudWatch Logs.
logs.RetentionDays.INFINITE
stable

### logRetentionRetryOptions

_Type_ : [`LogRetentionRetryOptions`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.LogRetentionRetryOptions.html)

When log retention is specified, a custom resource attempts to create the CloudWatch log group.
- Default AWS SDK retry options.
stable

### logRetentionRole

_Type_ : [`IRole`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.IRole.html)

The IAM role for the Lambda function associated with the custom resource that sets the retention policy.
- A new role is created.
stable

### maxEventAge

_Type_ : [`Duration`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.Duration.html)

The maximum age of a request that Lambda sends to a function for processing.
Duration.hours(6)
stable

### memorySize

_Type_ : `number`

The amount of memory in MB allocated.
- Defaults to 1024

### onFailure

_Type_ : [`IDestination`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.IDestination.html)

The destination for failed invocations.
- no destination
stable

### onSuccess

_Type_ : [`IDestination`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.IDestination.html)

The destination for successful invocations.
- no destination
stable

### permissions

_Type_ : [`Permissions`](Permissions)

### profiling

_Type_ : `boolean`

Enable profiling.
- No profiling.
https://docs.aws.amazon.com/codeguru/latest/profiler-ug/setting-up-lambda.html
stable

### profilingGroup

_Type_ : [`IProfilingGroup`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.IProfilingGroup.html)

Profiling Group.
- A new profiling group will be created if `profiling` is set.
https://docs.aws.amazon.com/codeguru/latest/profiler-ug/setting-up-lambda.html
stable

### reservedConcurrentExecutions

_Type_ : `number`

The maximum of concurrent executions you want to reserve for the function.
- No specific limit - account limit.
https://docs.aws.amazon.com/lambda/latest/dg/concurrent-executions.html
stable

### retryAttempts

_Type_ : `number`

The maximum number of times to retry when the function returns an error.
2
stable

### role

_Type_ : [`IRole`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.IRole.html)

Lambda execution role.
- A unique role will be generated for this lambda function.
Both supplied and generated roles can always be changed by calling `addToRolePolicy`.
stable

### runtime

_Type_ : `"nodejs"`&nbsp; | &nbsp;`"nodejs4.3"`&nbsp; | &nbsp;`"nodejs6.10"`&nbsp; | &nbsp;`"nodejs8.10"`&nbsp; | &nbsp;`"nodejs10.x"`&nbsp; | &nbsp;`"nodejs12.x"`&nbsp; | &nbsp;`"nodejs14.x"`&nbsp; | &nbsp;`"python2.7"`&nbsp; | &nbsp;`"python3.6"`&nbsp; | &nbsp;`"python3.7"`&nbsp; | &nbsp;`"python3.8"`&nbsp; | &nbsp;`"python3.9"`&nbsp; | &nbsp;`"dotnetcore1.0"`&nbsp; | &nbsp;`"dotnetcore2.0"`&nbsp; | &nbsp;`"dotnetcore2.1"`&nbsp; | &nbsp;`"dotnetcore3.1"`&nbsp; | &nbsp;`"go1.x"`&nbsp; | &nbsp;[`Runtime`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.Runtime.html)

The runtime environment.
- Defaults to NODEJS_12_X

### securityGroups

_Type_ : unknown

The list of security groups to associate with the Lambda's network interfaces.
- If the function is placed within a VPC and a security group is
not specified, either by this or securityGroup prop, a dedicated security
group will be created for this function.
stable

### srcPath

_Type_ : `string`

The source directory where the entry point is located. The node_modules in this
directory is used to generate the bundle.
- Defaults to the app directory.

### timeout

_Type_ : `number`&nbsp; | &nbsp;[`Duration`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.Duration.html)

The execution timeout in seconds.
- number

### tracing

_Type_ : [`Tracing`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.Tracing.html)

Enable AWS X-Ray Tracing.
- Defaults to ACTIVE

### vpc

_Type_ : [`IVpc`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.IVpc.html)

VPC network to place Lambda network interfaces.
- Function is not placed within a VPC.
stable

### vpcSubnets

_Type_ : [`SubnetSelection`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.SubnetSelection.html)

Where to place the network interfaces within the VPC.
- the Vpc default strategy if not specified
stable
