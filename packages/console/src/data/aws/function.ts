import {
  LambdaClient,
  GetFunctionCommand,
  InvokeCommand,
} from "@aws-sdk/client-lambda";
import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
  FilterLogEventsResponse,
} from "@aws-sdk/client-cloudwatch-logs";
import { uniqBy } from "remeda";
import { Buffer } from "buffer";
import { useInfiniteQuery, useMutation, useQuery } from "react-query";
import { useClient } from "./client";
import { Toast } from "~/components";

export function useFunctionQuery(arn: string) {
  const lambda = useClient(LambdaClient);
  return useQuery(["functions", arn], async () => {
    const result = await lambda.send(
      new GetFunctionCommand({
        FunctionName: arn,
      })
    );
    return result.Configuration!;
  });
}

export function useFunctionInvoke() {
  const lambda = useClient(LambdaClient);
  const toast = Toast.use();

  return useMutation({
    onError: () =>
    toast.create({
      type: "danger",
      text: "Failed to invoke lambda",
    }),
    mutationFn: async (opts: { arn: string; payload: any }) => {
      await lambda.send(
        new InvokeCommand({
          FunctionName: opts.arn,
          Payload: Buffer.from(JSON.stringify(opts.payload)),
        })
      );
    },
  });
}

type LogsOpts = {
  functionName: string;
  runtime: string;
};

export type Invocation = {
  logs: Log[];
  requestId?: string;
  logStream?: string;
  firstLineTime?: number;
  startTime?: number;
  endTime?: number;
  duration?: number;
  memSize?: number;
  memUsed?: number;
  xrayTraceId?: string;
  logLevel: "INFO" | "WARN" | "ERROR";
};
export type Log = {
  id: string;
  message: string;
  timestamp: number;
  level: "INFO" | "WARN" | "ERROR" | "START" | "END" | "REPORT";
  requestId?: string,
  logStream: string,
  invocationMetadata?: {
    duration?: number;
    memSize?: number;
    memUsed?: number;
    xrayTraceId?: string;
    isFailed?: boolean;
  },
};

export function useLogsQuery(opts: LogsOpts) {
  const cw = useClient(CloudWatchLogsClient);
  const resp = useInfiniteQuery({
    queryKey: ["logs", opts.functionName],
    queryFn: async() => {
      // Fetch logs
      const logGroupName = `/aws/lambda/${opts.functionName}`;
      return await cw.send(
        new FilterLogEventsCommand({
          logGroupName: logGroupName,
          interleaved: true,
          startTime: Date.now() - 60000,
          limit: 10000,
        })
      );
    },
    getNextPageParam: () => true,
  });

  // TODO
  const events = resp.data?.pages.flatMap(({ events }) => events) || [];
  //console.log(JSON.stringify(resp.data.pages.pop()));
  //const events = mockLogEvents();
  const unique = uniqBy(events, (event) => event?.eventId);
  const sorted = sortLogs(unique);
  const parsed = sorted.map(event => parseLogMetadata(event, opts.runtime));
  const invocations = groupLogs(parsed);
  return { data: invocations, query: resp };
}

function sortLogs(logs) {
  return logs
  // sort by logStreamName and eventId
    .map(log => ({ ...log,
      sortKey: `${log.logStreamName}-${log.eventId}`,
    }))
    .sort((logA, logB) => {
      if (logA.sortKey < logB.sortKey) {
        return -1;
      }
      if (logA.sortKey > logB.sortKey) {
        return 1;
      }
      return 0;
    });
}

function parseLogMetadata(event, runtime) {
  let log: Log = {
    id: event.eventId,
    message: event.message.trim(),
    timestamp: event.timestamp,
    logStream: event.logStreamName,
  };

  try {
    parseLambdaSTART(log) ||
    parseLambdaEND(log) ||
    parseLambdaREPORT(log);

    const spcParts = log.message.split(" ");

    log.level ||
    parseLambdaUnknownApplicationError(log) ||
    parseLambdaModuleInitializationError(log) ||
    parseLambdaExited(log, spcParts) ||
    parseLambdaTimeoutOrMessage(log, spcParts);

    const tabParts = log.message.split("\t");

    ///////////////////
    // Node Errors
    ///////////////////
    if (runtime.startsWith("nodejs")) {
      log.level || parseLambdaNodeLog(log, tabParts);
    }

    ///////////////////
    // Python Errors
    ///////////////////
    if (runtime.startsWith("python")) {
      log.level ||
      parseLambdaPythonLog(log, tabParts) ||
      parseLambdaPythonTraceback(log);
    }
  } catch (e) {
  }

  // Did not match any pattern
  if (!log.level) {
    log.level = "INFO";
  }

  return log;
}
function parseLambdaSTART(log) {
  // START RequestId: 184b0c52-84d2-4c63-b4ef-93db5bb2189c Version: $LATEST
  if (log.message.startsWith("START RequestId: ")) {
    log.level = "START";
    log.requestId = log.message.substr(17, 36);
  }
}
function parseLambdaEND(log) {
  // END RequestId: 184b0c52-84d2-4c63-b4ef-93db5bb2189c
  if (log.message.startsWith("END RequestId: ")) {
    log.level = "END";
    log.requestId = log.message.substr(15, 36);
  }
}
function parseLambdaREPORT(log) {
  // REPORT RequestId: 6cbfe426-927b-43a3-b7b6-a525a3fd2756	Duration: 2.63 ms	Billed Duration: 100 ms	Memory Size: 1024 MB	Max Memory Used: 58 MB	Init Duration: 2.22 ms
  if (log.message.startsWith("REPORT RequestId: ")) {
    log.level = "REPORT";
    log.requestId = log.message.substr(18, 36);
    log.invocationMetadata = log.invocationMetadata || {};

    log.message.split("\t").forEach((part) => {
      part = part.trim();
      if (part.startsWith("Duration")) {
        log.invocationMetadata.duration = part.split(" ")[1];
      } else if (part.startsWith("Memory Size")) {
        log.invocationMetadata.memSize = part.split(" ")[2];
      } else if (part.startsWith("Max Memory Used")) {
        log.invocationMetadata.memUsed = part.split(" ")[3];
      } else if (part.startsWith("XRAY TraceId")) {
        log.invocationMetadata.xrayTraceId = part.split(" ")[2];
      }
    });
  }
}
function parseLambdaTimeoutOrMessage(log, spcParts) {
  // 2018-01-05T23:48:40.404Z f0fc759e-f272-11e7-87bd-577699d45526 hello
  // 2018-01-05T23:48:40.404Z f0fc759e-f272-11e7-87bd-577699d45526 Task timed out after 6.00 seconds
  if (
    spcParts.length >= 3 &&
    spcParts[0].match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/) !==
    null &&
    spcParts[1].match(/^[0-9a-fA-F-]{36}$/) !== null
  ) {
    const message = spcParts.slice(2).join(" ");
    const isFailed = message.startsWith("Task timed out after");
    log.requestId = spcParts[1];
    log.level = isFailed ? "ERROR" : "INFO";
    log.message = message;
    log.invocationMetadata = log.invocationMetadata || {};
    log.invocationMetadata.isFailed = log.invocationMetadata.isFailed || isFailed;
  }
}
function parseLambdaExited(log, spcParts) {
  // - Nodejs, Python 3.8
  // RequestId: 80925099-25b1-4a56-8f76-e0eda7ebb6d3 Error: Runtime exited with error: signal: aborted (core dumped)
  // - Python 2.7, 3.6, 3.7
  // RequestId: 80925099-25b1-4a56-8f76-e0eda7ebb6d3 Process exited before completing request
  if (
    spcParts.length >= 3 &&
    spcParts[0] === "RequestId:" &&
    spcParts[1].match(/^[0-9a-fA-F-]{36}$/) !== null
  ) {
    const message = spcParts.slice(2).join(" ");
    log.requestId = spcParts[1];
    log.level = "ERROR";
    log.message = message;
    log.invocationMetadata = log.invocationMetadata || {};
    log.invocationMetadata.isFailed = true;
  }
}
function parseLambdaUnknownApplicationError(log) {
  // Unknown application error occurred
  if (log.message.startsWith("Unknown application error occurred")) {
    log.level = "ERROR";
    log.invocationMetadata = log.invocationMetadata || {};
  }
}
function parseLambdaModuleInitializationError(log) {
  // module initialization error
  if (log.message.startsWith("module initialization error")) {
    log.level = "ERROR";
    log.invocationMetadata = log.invocationMetadata || {};
  }
}
function parseLambdaNodeLog(log, tabParts) {
  // - Nodejs 8.10
  // 2019-11-12T20:00:30.183Z	cc81b998-c7de-46fb-a9ef-3423ccdcda98	log hello
  // - Nodejs 10.x
  // 2019-11-12T20:00:30.183Z	cc81b998-c7de-46fb-a9ef-3423ccdcda98	INFO	log hello
  // 2019-11-12T20:00:30.184Z	cc81b998-c7de-46fb-a9ef-3423ccdcda98	WARN	warn hello
  // 2019-11-12T20:00:30.184Z	cc81b998-c7de-46fb-a9ef-3423ccdcda98	ERROR	error hello
  // 2019-11-12T20:15:19.686Z	77c628d3-d6cf-4643-88ac-bc9520ed3858	ERROR	Invoke Error
  // {
  //     "errorType": "ReferenceError",
  //     "errorMessage": "b is not defined",
  //     "stack": [
  //         "ReferenceError: b is not defined",
  //         "    at Runtime.module.exports.main [as handler] (/var/task/handler.js:9:15)",
  //         "    at Runtime.handleOnce (/var/runtime/Runtime.js:66:25)"
  //     ]
  // }
  // 2019-11-12T20:45:05.363Z	undefined	ERROR	Uncaught Exception
  // {
  //     "errorType": "ReferenceError",
  //     "errorMessage": "bad is not defined",
  //     "stack": [
  //         "ReferenceError: bad is not defined",
  //         "    at Object.<anonymous> (/var/task/handler.js:1:1)",
  //         "    at Module._compile (internal/modules/cjs/loader.js:778:30)",
  //     ]
  // }
  if (
    tabParts.length >= 3 &&
    tabParts[0].match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/) !== null
  ) {
    // parse request id
    log.requestId = requestId =
      tabParts[1].match(/^[0-9a-fA-F-]{36}$/) !== null
      ? tabParts[1]
      : undefined;
    let level;
    // parse level
    if (tabParts[2] === "INFO") {
      log.level = "INFO";
      log.message = tabParts.slice(3).join("\t");
    } else if (tabParts[2] === "WARN") {
      log.level = "WARN";
      log.message = tabParts.slice(3).join("\t");
    } else if (tabParts[2] === "ERROR") {
      log.level = "ERROR";
      log.message = tabParts.slice(3).join("\t");
    }
    else {
      log.level = "INFO";
      log.message = tabParts.slice(2).join("\t");
    }
  }
}
function parseLambdaPythonLog(log, tabParts) {
  // [WARNING] 2019-11-12T20:00:30.183Z	cc81b998-c7de-46fb-a9ef-3423ccdcda98 this is a warn
  // [ERROR] 2019-11-12T20:00:30.184Z	cc81b998-c7de-46fb-a9ef-3423ccdcda98 this is an error
  // [CRITICAL] 2019-11-12T20:00:30.184Z	cc81b998-c7de-46fb-a9ef-3423ccdcda98 this is critical
  if (
    tabParts.length >= 4 &&
    tabParts[1].match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/) !==
    null &&
    tabParts[2].match(/^[0-9a-fA-F-]{36}$/) !== null
  ) {
    log.requestId = tabParts[2];
    // parse level
    if (tabParts[0] === "[INFO]") {
      log.level = "INFO";
    } else if (tabParts[0] === "[WARNING]") {
      log.level = "WARN";
    } else if (tabParts[0] === "[ERROR]" || tabParts[0] === "[CRITICAL]") {
      log.level = "ERROR";
    } else {
      log.level = "INFO";
    }
    log.message = `${tabParts[0]} ${tabParts.slice(3).join("\t")}`;
  }
}
function parseLambdaPythonTraceback(log) {
  // ...  Traceback (most recent call last): ...
  if (log.message.match(/\sTraceback \(most recent call last\):\s/) !== null) {
    log.level = "ERROR";
    log.invocationMetadata = log.invocationMetadata || {};
    log.invocationMetadata.isFailed = true;
  }
}

function groupLogs(logs) {
  // 5 types of logs:
  // - has START has REPORT => complete invocation
  // - has START no REPORT => incomplete invocation
  // - no START has REPORT => incomplete invocation
  // - no START no REPORT => incomplete invocation
  // - no START no REPORT and between invocations => (error message between requests)

  // Group logs into invocation
  const invocations: Invocation[] = [];
  let currentInvocation: Invocation = { logs: [], logLevel: "INFO" };
  logs.forEach(log => {
    // mark start of a new invocation
    if (log.logStream !== currentInvocation.logStream) {
      currentInvocation.logs.length > 0 && invocations.push(currentInvocation);
      currentInvocation = { logs: [], logLevel: "INFO" };
    }

    if (log.level === "START") {
      currentInvocation.logs.length > 0 && invocations.push(currentInvocation);
      currentInvocation = { logs: [], logLevel: "INFO" };
      currentInvocation.logs.push(log.message);
      currentInvocation.requestId = log.requestId;
      currentInvocation.logStream = log.logStream;
      currentInvocation.firstLineTime = log.timestamp;
      currentInvocation.startTime = log.timestamp;
    }
    else if (log.level === "REPORT") {
      currentInvocation.logs.push(log.message);
      currentInvocation.requestId = currentInvocation.requestId || log.requestId;
      currentInvocation.logStream = log.logStream;
      currentInvocation.firstLineTime = currentInvocation.firstLineTime || log.timestamp;
      currentInvocation.endTime = log.timestamp;
      currentInvocation.duration = log.invocationMetadata?.duration;
      currentInvocation.memSize = log.invocationMetadata?.memSize;
      currentInvocation.memUsed = log.invocationMetadata?.memUsed;
      currentInvocation.xrayTraceId = log.invocationMetadata?.xrayTraceId;
      invocations.push(currentInvocation);
      currentInvocation = { logs: [], logLevel: "INFO" };
    }
    else {
      currentInvocation.logs.push(log.message);
      currentInvocation.requestId = currentInvocation.requestId || log.requestId;
      currentInvocation.logStream = log.logStream;
      currentInvocation.firstLineTime = currentInvocation.firstLineTime || log.timestamp;
      currentInvocation.logLevel = log.level === "ERROR"
        ? "ERROR"
        : (log.level === "WARN" && currentInvocation.logLevel !== "ERROR" ? "WARN" : "INFO");
    }
  });

  currentInvocation.logs.length > 0 && invocations.push(currentInvocation);

  return invocations.sort((a,b) => b.firstLineTime - a.firstLineTime);
}

function mockLogEvents() {
  // most recent logs at the bottom
  const messages = [];
  [
    mockNoEnd,
    mockNoStart,
    mockLongJSONSummary,
    mockDefault,
  ].forEach((mockFn, i) => {
    const reqId = `${i}`.padStart(12, "0");
    messages.push(...mockFn(reqId));
  });

  // Build log object
  const ts = Date.now() - messages.length * 1000;
  return messages.map((message, i) => ({
    eventId: `366564888943019255673637982628033313325854${ts + i * 1000}`,
    ingestionTime: ts + i * 1000,
    logStreamName: "2022/02/01/[$LATEST]3b66f77bc3f24fee8ccd70dd7315144e",
    message,
    timestamp: ts + i * 1000,
  }));
}
function mockDefault(reqId) {
  return [
    `START RequestId: 18269d91-6b89-4021-8b58-${reqId} Version: $LATEST\n`,
    `2022-02-01T16:43:31.048Z\t18269d91-6b89-4021-8b58-${reqId}\tINFO\tsendMessage() - send request\n`,
    `END RequestId: 18269d91-6b89-4021-8b58-${reqId}\n`,
    `REPORT RequestId: 18269d91-6b89-4021-8b58-${reqId}\tDuration: 509.89 ms\tBilled Duration: 510 ms\tMemory Size: 1024 MB\tMax Memory Used: 80 MB\t\nXRAY TraceId: 1-61f96332-54eba86c47245db57214005f\tSegmentId: 246eafc77f3a0d33\tSampled: true\t\n`,
  ];
}
function mockLongJSONSummary(reqId) {
  return [
    `START RequestId: 18269d91-6b89-4021-8b58-${reqId} Version: $LATEST\n`,
    `2022-02-01T16:44:32.994Z\t46d02f3a-f831-45ff-bd2f-441552944af8\tINFO\tws.onmessage {"action":"client.lambdaResponse","debugRequestId":"46d02f3a-f831-45ff-bd2f-441552944af8-1643733872505","stubConnectionId":"M3uYidvroAMCLMA=","payload":"H4sIAAAAAAAAE6tWKkotLsjPK051SSxJVLKqViouSSwpLXbOT0lVsjIyMNBRSspPqVSyUsrIVKqtBQB6xuCnLwAAAA=="}\n`,
    `END RequestId: 18269d91-6b89-4021-8b58-${reqId}\n`,
    `REPORT RequestId: 18269d91-6b89-4021-8b58-${reqId}\tDuration: 509.89 ms\tBilled Duration: 510 ms\tMemory Size: 1024 MB\tMax Memory Used: 80 MB\t\nXRAY TraceId: 1-61f96332-54eba86c47245db57214005f\tSegmentId: 246eafc77f3a0d33\tSampled: true\t\n`,
  ];
}
function mockNoStart(reqId) {
  return [
    `REPORT RequestId: 18269d91-6b89-4021-8b58-${reqId}\tDuration: 509.89 ms\tBilled Duration: 510 ms\tMemory Size: 1024 MB\tMax Memory Used: 80 MB\t\nXRAY TraceId: 1-61f96332-54eba86c47245db57214005f\tSegmentId: 246eafc77f3a0d33\tSampled: true\t\n`,
  ];
}
function mockNoEnd(reqId) {
  return [
    `START RequestId: 18269d91-6b89-4021-8b58-${reqId} Version: $LATEST\n`,
  ];
}
