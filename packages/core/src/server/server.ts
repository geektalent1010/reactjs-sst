import express from "express";
import fs from "fs";
import path from "path";
import { exec, execSync } from "child_process";

const API_VERSION = "2018-06-01";

type StartOpts = {
  port: string;
  host: string;
  rootDir: string;
};

type Payload = {
  event: any;
  context: any;
  timeoutAt: string;
};

type Pending = {
  resolve: (data: string) => void;
  reject: (data: string) => void;
};

export function start(opts: StartOpts) {
  const app = express();

  const funs: Record<string, (payload: Payload) => void> = {};
  const pending: Record<string, Pending> = {};

  // For .NET runtime, the "aws-lambda-dotnet" package sets the type to
  // "application/*+json" for requests made to the error endpoint.
  app.use(
    express.json({
      type: ["application/json", "application/*+json"],
      limit: "10mb",
      strict: false,
    })
  );

  app.get(`/:fun/${API_VERSION}/runtime/invocation/next`, async (req, res) => {
    console.log(req.path);
    const { fun } = req.params;
    const promise = new Promise<Payload>((resolve) => {
      funs[fun] = resolve;
    });
    const payload = await promise;
    res.set({
      "Lambda-Runtime-Aws-Request-Id": payload.context.awsRequestId,
      "Lambda-Runtime-Deadline-Ms": payload.timeoutAt,
      "Lambda-Runtime-Invoked-Function-Arn": payload.context.invokedFunctionArn,
      //'Lambda-Runtime-Trace-Id – The AWS X-Ray tracing header.
      "Lambda-Runtime-Client-Context": JSON.stringify(
        payload.context.identity || {}
      ),
      "Lambda-Runtime-Cognito-Identity": JSON.stringify(
        payload.context.clientContext || {}
      ),
    });
    res.json(payload);
  });

  app.post(
    `/:fun/${API_VERSION}/runtime/invocation/:awsRequestId/response`,
    (req, res) => {
      console.log(req.path);
      const { awsRequestId } = req.params;
      const { resolve } = pending[awsRequestId];
      console.log(req.body);
      resolve(req.body);
      res.status(202);
      res.json("ok");
    }
  );

  app.post(
    `/:fun/${API_VERSION}/runtime/invocation/:awsRequestId/error`,
    (req, res) => {
      console.log(req.path);
      const { awsRequestId } = req.params;
      const { reject } = pending[awsRequestId];
      reject(req.body);
    }
  );

  const server = app.listen(opts.port, () => {
    for (const line of fs
      .readFileSync(path.join(opts.rootDir, ".build", "sst-functions.jsonl"))
      .toString()
      .trim()
      .split("\n")) {
      if (!line) continue;
      const parsed = JSON.parse(line);
      const { definition } = parsed;
      fs.mkdirSync(parsed.outPath);
      execSync(definition.build.command, {
        env: {
          ...process.env,
          ...definition.build.environment,
        },
        stdio: "inherit",
      });
      const p = exec(definition.start.command, {
        env: {
          ...process.env,
          ...definition.start.environment,
          AWS_LAMBDA_RUNTIME_API: `localhost:${opts.port}/${parsed.id}`,
        },
      });
      p.stdout!.on("data", console.log);
      p.stderr!.on("data", console.log);
    }
  });

  return {
    server,
    async invoke(fun: string, payload: Payload) {
      const f = funs[fun];
      const promise = new Promise<string>((resolve, reject) => {
        pending[payload.context.awsRequestId] = { resolve, reject };
      });
      const time = Date.now();
      f(payload);
      const result = await promise;
      console.log(Date.now() - time);
      return result;
    },
  };
}
