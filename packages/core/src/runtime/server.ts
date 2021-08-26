import express from "express";
import spawn from "cross-spawn";
import { Definition } from "./runtime";

const API_VERSION = "2018-06-01";

type SerializedDefinition = {
  id: string;
  outPath: string;
  definition: Definition;
};

type StartOpts = {
  port: string;
  host: string;
  functions: SerializedDefinition[];
};

type Payload = {
  event: any;
  context: any;
  timeoutAt: string;
};

export function start(opts: StartOpts) {
  const app = express();

  const funs: Record<string, (payload: Payload) => void> = {};
  const pending: Record<string, (result: string) => void> = {};

  // For .NET runtime, the "aws-lambda-dotnet" package sets the type to
  // "application/*+json" for requests made to the error endpoint.
  app.use(
    express.json({
      type: ["application/json", "application/*+json"],
      limit: "10mb",
      strict: false,
    })
  );

  app.get(`/:fun/${API_VERSION}/runtime/invocation/next`, (req, res) => {
    console.log(req.path);
    const { fun } = req.params;
    funs[fun] = (payload) => {
      res.set({
        "Lambda-Runtime-Aws-Request-Id": payload.context.awsRequestId,
        "Lambda-Runtime-Deadline-Ms": payload.timeoutAt,
        "Lambda-Runtime-Invoked-Function-Arn":
          payload.context.invokedFunctionArn,
        //'Lambda-Runtime-Trace-Id – The AWS X-Ray tracing header.
        "Lambda-Runtime-Client-Context": JSON.stringify(
          payload.context.identity || {}
        ),
        "Lambda-Runtime-Cognito-Identity": JSON.stringify(
          payload.context.clientContext || {}
        ),
      });
      res.json(payload);
    };
  });

  app.post(
    `/:fun/${API_VERSION}/runtime/invocation/:awsRequestId/response`,
    (req, res) => {
      const { awsRequestId } = req.params;
      const cb = pending[awsRequestId];
      cb(req.body);
      res.status(202);
      res.json("ok");
    }
  );

  app.post(
    `/:fun/${API_VERSION}/runtime/invocation/:awsRequestId/error`,
    (req, res) => {
      const { awsRequestId } = req.params;
      const cb = pending[awsRequestId];
      cb(req.body);
      res.status(202);
      res.json("ok");
    }
  );

  const server = app.listen(opts.port, () => {
    for (const sd of opts.functions) {
      const p = spawn(
        sd.definition.start.command,
        sd.definition.start.args || [],
        {
          env: {
            ...process.env,
            ...sd.definition.start.environment,
            AWS_LAMBDA_RUNTIME_API: `localhost:${opts.port}/${sd.id}`,
          },
        }
      );
      p.on("close", console.log);
      p.stdout!.on("data", (i) => console.log(i.toString()));
      p.stderr!.on("data", (i) => console.log(i.toString()));
    }
  });

  return {
    server,
    async invoke(fun: string, payload: Payload) {
      return new Promise((resolve) => {
        const f = funs[fun];
        pending[payload.context.awsRequestId] = (result) => {
          resolve(result);
        };
        f(payload);
      });
    },
  };
}
