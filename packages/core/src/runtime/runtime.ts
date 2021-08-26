import * as lambda from "@aws-cdk/aws-lambda";
export * as Server from "./server";

export type Command = {
  command: string;
  args: string[];
  environment?: Record<string, string>;
};

export type Definition = {
  build: Command;
  start: Command;
  runtime: lambda.Runtime;
  handler: string;
};

type PluginOpts = {
  srcPath: string;
  outPath: string;
  handler: string;
};

export type Plugin = (opts: PluginOpts) => Definition;

export const Go = (): Plugin => {
  return (opts) => {
    const build = {
      command: `go`,
      args: [
        "build",
        '-ldflags="-s -w"',
        "-o",
        opts.outPath + "/handler",
        opts.handler,
      ],
      environment: {
        GOOS: "linux",
        CGO_ENABLED: "0",
      },
    };
    return {
      build,
      start: {
        command: "node",
        args: [
          require.resolve(
            "@serverless-stack/core/dist/runtime/shells/shell.js"
          ),
        ],
        environment: {
          SST_START: `${opts.outPath}/handler`,
          SST_BUILD: new Buffer(JSON.stringify(build)).toString("base64"),
        },
      },
      runtime: lambda.Runtime.GO_1_X,
      handler: "handler",
    };
  };
};
