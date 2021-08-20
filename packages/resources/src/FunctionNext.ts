import * as cdk from "@aws-cdk/core";
import * as lambda from "@aws-cdk/aws-lambda";
import * as fs from "fs";
import path from "path";
import { App } from ".";
import { execSync } from "child_process";

type CustomRuntimeOpts = {
  srcPath: string;
  outPath: string;
  handler: string;
};

type CustomRuntimeCommand = {
  command: string;
  environment?: Record<string, string>;
};

type CustomRuntimeDefinition = {
  build: CustomRuntimeCommand;
  bundle: CustomRuntimeCommand;
  start: CustomRuntimeCommand;
  runtime: lambda.Runtime;
  handler: string;
};

type CustomRuntime = (opts: CustomRuntimeOpts) => CustomRuntimeDefinition;

export const GoRuntime = (): CustomRuntime => {
  return (opts) => {
    return {
      build: {
        command: `go build -ldflags="-s -w" -o ${opts.outPath}/handler ${opts.handler}`,
        environment: {
          GOOS: "linux",
          CGO_ENABLED: "0",
        },
      },
      start: {
        command: `${opts.outPath}/handler`,
      },
      bundle: {
        command: `go build ${opts.handler} -o ${opts.outPath}/handler`,
      },
      runtime: lambda.Runtime.GO_1_X,
      handler: "handler",
    };
  };
};

export const NodeRuntime = (): CustomRuntime => {
  return (opts) => {
    const [left, handler] = opts.handler.split(".");
    const input = left + ".ts";
    return {
      build: {
        command: `./node_modules/.bin/esbuild --outfile=${path.join(
          opts.outPath,
          "handler.js"
        )} --format=cjs --platform=node --target=node12 ${input}`,
      },
      start: {
        command: `./node_modules/.bin/aws-lambda-ric ${opts.outPath}/handler.${handler}`,
      },
      bundle: {
        command: "unknown",
      },
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: `handler.${handler}`,
    };
  };
};

type Props = {
  handler: string;
  srcPath?: string;
  customRuntime: CustomRuntime;
};

export class FunctionNext extends cdk.Construct {
  public readonly cdk: {
    readonly function: lambda.Function;
  };
  constructor(scope: cdk.Construct, id: string, props: Props) {
    super(scope, id);
    if (!(scope.node.root instanceof App))
      throw new Error("This construct can only be used in an SST application");

    const app: App = scope.node.root;
    // Temporarily use construct id
    const functionId = id;
    const outPath = path.join(app.buildDir, functionId.toString());
    const definition = props.customRuntime({
      outPath,
      srcPath: props.srcPath || process.cwd(),
      handler: props.handler,
    });
    fs.appendFileSync(
      path.join(app.buildDir, "sst-functions.jsonl"),
      JSON.stringify({
        id: functionId,
        outPath,
        definition,
      }) + "\n"
    );

    if (app.local) {
      this.cdk = {
        function: new lambda.Function(scope, id + "Function", {
          handler: "index.main",
          runtime: lambda.Runtime.NODEJS_12_X,
          code: lambda.Code.fromAsset(
            path.resolve(__dirname, "../dist/stub.zip")
          ),
          environment: {
            SST_FUNCTION_ID: functionId,
            SST_DEBUG_SRC_PATH: props.srcPath || ".",
            SST_DEBUG_SRC_HANDLER: props.handler,
            SST_DEBUG_ENDPOINT: app.debugEndpoint!,
            SST_DEBUG_BUCKET_NAME: app.debugBucketName!,
          },
        }),
      };
      return;
    }

    const cwd = path.join(process.cwd(), props.srcPath || "");
    execSync(definition.build.command, {
      env: {
        ...process.env,
        ...definition.build.environment,
      },
      cwd,
    });

    this.cdk = {
      function: new lambda.Function(scope, id + "Function", {
        handler: definition.handler,
        runtime: definition.runtime,
        code: lambda.Code.fromAsset(outPath),
      }),
    };
  }
}
