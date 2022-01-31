import AWS from 'aws-sdk';
import Button from "./components/Button";
import { useEffect, useState } from "react";
import Log from "./Log";
import "./App.scss";

export default function App({ ...props }) {
  // Setup websocket connection watcher
  const iamCred = {
    "AccessKeyId": "ASIATMMSIVGG3HY2FBNH",
    "SecretAccessKey": "BqEpaHBewbTf3nVpIS4dUghb3jni0TqDJNhDnSGQ",
    "SessionToken": "FwoGZXIvYXdzEGcaDB2CV38FYjEyQcnmJiKrAWThAraINr6Zh1u/QGKDk5zjCWDa+EO7EEGLqsEJZSjXCrFSGqf9bLUgAoZmLuEII7BgWthHtDwjGpgCyJ4StZcYsbbM5zwTrSvirJM8nS1nb/4dLZ/YMPfBDpPTInG8pLxN5+dRxvFHQi6kTzGD0LBTQc2kAD1VLY5x7BMFHl1F9rRf3a5pk7z2sswpq6c0739sVNPxrkXCbTLJYD14F1GWsA2YuQXCKJKhRyih5JOOBjItXcCgFcj4cJ3rXWjkn0eJ7eFD6n9ImPmH10/VEKwI9MxdMJ7bXwr46qPvt7sU",
    "Expiration": "2021-12-23T23:03:13+00:00"
};
  const functionName = "serverless-cd-api-prod-github_hook";
  const logGroupName = `/aws/lambda/${functionName}`;
  const runtime = "nodejs12.x";
  const [logs, setLogs] = useState([]);
  const [searchRange, setSearchRange] = useState(null);

  const invocations = groupLogs(logs);

  const cwLogs = new AWS.CloudWatchLogs({
      accessKeyId: iamCred.AccessKeyId,
      secretAccessKey: iamCred.SecretAccessKey,
      sessionToken: iamCred.SessionToken,
      region: "us-east-1",
  });

  useEffect(async () => {
    if (searchRange) {
      // Show logs in range
      const logs = await searchLogs(searchRange.start, searchRange.end);
      console.log(JSON.stringify(logs))
      setLogs(normalizeSearchedLogs(logs));
    }
    else {
      // Show logs from the past 5 minutes
      const startTime = Date.now() - 60000;
      const endTime = Date.now();
      const logStreamNames = await getLogStreams();
      const logs = await tailLogs(logStreamNames, startTime, endTime);
      setLogs(normalizeTailedLogs(logs));
    }
  }, [searchRange]);

  async function getLogStreams() {
    const ret = await cwLogs.describeLogStreams({
        logGroupName,
        descending: true,
        limit: 50,
        orderBy: "LastEventTime",
    }).promise();
    // TODO
    console.log("streams", ret);
    return ret.logStreams.map(stream => stream.logStreamName);
  }

  async function tailLogs(logStreamNames, startTime, endTime, nextToken) {
      const ret = await cwLogs.filterLogEvents({
          logGroupName,
          //logStreamNames,
          interleaved: true,
          startTime: startTime,
          //endTime: endTime,
          limit: 10000,
          nextToken,
      }).promise();
      console.log("ret", ret);
      const events1 = ret.events;
      console.log("Call 1 - ", ret.events.length, " NEXT ", ret.nextToken)

      let events2 = [];
      if (ret.nextToken) {
        const ret2 = await cwLogs.filterLogEvents({
            logGroupName,
            //logStreamNames,
            interleaved: true,
            startTime: startTime,
            //endTime: endTime,
            limit: 10000,
            nextToken: ret.nextToken,
        }).promise();
        events2 = ret2.events;
        console.log("Call 2 - ", ret2.events.length, " NEXT ", ret2.nextToken)
      }

      return [ ...events1, ...events2];
  }

  async function searchLogs(startTime, endTime, nextToken) {
    // Start query
    const queryString = [
      'fields @timestamp, @ingestionTime, @requestId, @logStream, @message',
      'sort @timestamp asc'
    ].filter(part => part !== undefined).join(' | ');
    const ret = await cwLogs.startQuery({
      logGroupName,
      startTime,
      endTime,
      queryString,
      limit: 1000,
    }).promise();

    return await getSearchResults(ret.queryId);
  }

  async function getSearchResults(queryId) {
    // Wait for 3s
    await new Promise((resolve) => setTimeout(() => resolve(), 3000));

    const ret = await cwLogs.getQueryResults({ queryId }).promise();
    if (ret.status === "Complete") {
      return ret.results;
    }
    if (ret.status === "Running" || ret.status === "Scheduled") {
      return await getSearchResults(queryId);
    }
    if (ret.status === "Timeout") {
      // TODO handle timeout error
    }
    // TODO handle query failed
  }

  //////////////
  // Callbacks
  //////////////

  function groupLogs(logs) {
    // 5 types of logs:
    // - has START has REPORT => complete invocation
    // - has START no REPORT => incomplete invocation
    // - no START has REPORT => incomplete invocation
    // - no START no REPORT => incomplete invocation
    // - no START no REPORT and between invocations => (error message between requests)

    // Parse logs
    const parsedLogs = logs.map(log => parseMetadata(log, runtime));

    // Group logs into invocation
    const invocations = [];
    let currentInvocation = { logs: [] };
    parsedLogs.forEach(log => {
        // mark start of a new invocation
        if (log.logStream !== currentInvocation.logStream) {
            currentInvocation.logs.length > 0 && invocations.push(currentInvocation);
            currentInvocation = { logs: [] };
        }

        if (log.type === "START") {
            currentInvocation.logs.length > 0 && invocations.push(currentInvocation);
            currentInvocation = { logs: [] };
            currentInvocation.logs.push(log.message);
            currentInvocation.requestId = log.requestId;
            currentInvocation.logStream = log.logStream;
            currentInvocation.firstLineTime = log.time;
            currentInvocation.startTime = log.time;
        }
        else if (log.type === "REPORT") {
            currentInvocation.logs.push(log.message);
            currentInvocation.requestId = currentInvocation.requestId || log.requestId;
            currentInvocation.logStream = log.logStream;
            currentInvocation.firstLineTime = currentInvocation.firstLineTime || log.time;
            currentInvocation.endTime = log.time;
            currentInvocation.duration = log.duration;
            currentInvocation.memSize = log.memSize;
            currentInvocation.memUsed = log.memUsed;
            currentInvocation.xrayTraceId = log.xrayTraceId;
            invocations.push(currentInvocation);
            currentInvocation = { logs: [] };
        }
        else {
            currentInvocation.logs.push(log.message);
            currentInvocation.requestId = currentInvocation.requestId || log.requestId;
            currentInvocation.logStream = log.logStream;
            currentInvocation.firstLineTime = currentInvocation.firstLineTime || log.time;
            currentInvocation.summary = currentInvocation.summary || log.summary;
            currentInvocation.hasError = currentInvocation.hasError || log.type === "ERROR";
            currentInvocation.hasWarn = currentInvocation.hasWarn || log.type === "WARN";
        }
    });

    currentInvocation.logs.length > 0 && invocations.push(currentInvocation);

    return invocations.sort((a,b) => b.firstLineTime - a.firstLineTime);
  }

  function normalizeTailedLogs(logs) {
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

  function normalizeSearchedLogs(logs) {
    //[
    //  {field: '@timestamp', value: '2021-12-20 09:23:56.589'}
    //  {field: '@ingestionTime', value: '2021-12-20 09:24:05.614'}
    //  {field: '@requestId', value: '19785c38-a91d-4f4d-ad89-2c75bfd9832c'}
    //  {field: '@logStream', value: '2021/12/20/[$LATEST]67ffbec1aa614e349d536a235e73e63b'}
    //  {field: '@message', value: 'START RequestId: 19785c38-a91d-4f4d-ad89-2c75bfd9832c Version: $LATEST\n'}
    //  {field: '@ptr', value: 'CnsKPwo7MjMyNzcxODU2NzgxOi9hd3MvbGFtYmRhL3NlcnZlcm…AA5IgASjD25253S8w9N6eud0vOFJA3L8GSPfPA1DU9QIQLxgB'}
    //]
    return logs
      // normalize fields
      .map(log => {
        const event = {};
        log.forEach(({ field, value }) => {
          if (field === "@timestamp") { event.timestamp = value; }
          else if (field === "@ingestionTime") { event.ingestionTime = value; }
          else if (field === "@logStream") { event.logStreamName = value; }
          else if (field === "@message") { event.message = value; }
          else if (field === "@ptr") { event.eventId = value; }
        })
        return event;
      })
      // sort by logStreamName, timestamp, and then 
      .map(log => ({ ...log,
        sortKey: `${log.logStreamName}-${log.timestamp}-${log.ingestionTime}-${log.eventId}`,
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

  function parseMetadata(event, runtime) {
    let meta;
  
    try {
      meta =
        meta ||
        parseLambdaSTART(event) ||
        parseLambdaEND(event) ||
        parseLambdaREPORT(event);
  
      const spcParts = event.message.split(" ");
  
      meta =
        meta ||
        parseLambdaUnknownApplicationError(event) ||
        parseLambdaModuleInitializationError(event) ||
        parseLambdaExited(event, spcParts) ||
        parseLambdaTimeoutOrMessage(event, spcParts);
  
      const tabParts = event.message.split("\t");

      ///////////////////
      // Node Errors
      ///////////////////
      if (runtime.startsWith("nodejs")) {
        meta = meta || parseLambdaNodeLog(event, tabParts);
      }
  
      ///////////////////
      // Python Errors
      ///////////////////
      if (runtime.startsWith("python")) {
        meta =
          meta ||
          parseLambdaPythonLog(event, tabParts) ||
          parseLambdaPythonTraceback(event);
      }
    } catch (e) {
    }

    meta = meta || { type: "INFO", summary: event.message }
  
    return { ...meta,
        id: event.eventId,
        time: event.timestamp,
        message: event.message.trim(),
        logStream: event.logStreamName,
    };
  }
  function parseLambdaSTART(event) {
    // START RequestId: 184b0c52-84d2-4c63-b4ef-93db5bb2189c Version: $LATEST
    if (event.message.startsWith("START RequestId: ")) {
      return {
        type: "START",
        requestId: event.message.substr(17, 36),
      };
    }
  }
  function parseLambdaEND(event) {
    // END RequestId: 184b0c52-84d2-4c63-b4ef-93db5bb2189c
    if (event.message.startsWith("END RequestId: ")) {
      return {
        type: "END",
        requestId: event.message.substr(15, 36),
      };
    }
  }
  function parseLambdaREPORT(event) {
    // REPORT RequestId: 6cbfe426-927b-43a3-b7b6-a525a3fd2756	Duration: 2.63 ms	Billed Duration: 100 ms	Memory Size: 1024 MB	Max Memory Used: 58 MB	Init Duration: 2.22 ms
    if (event.message.startsWith("REPORT RequestId: ")) {
      const meta = {
        type: "REPORT",
        requestId: event.message.substr(18, 36),
      };
      event.message.split("\t").forEach((part) => {
        part = part.trim();
        if (part.startsWith("Duration")) {
          meta.duration = part.split(" ")[1];
        } else if (part.startsWith("Memory Size")) {
          meta.memSize = part.split(" ")[2];
        } else if (part.startsWith("Max Memory Used")) {
          meta.memUsed = part.split(" ")[3];
        } else if (part.startsWith("XRAY TraceId")) {
          meta.xrayTraceId = part.split(" ")[2];
        }
      });
      return meta;
    }
  }
  function parseLambdaTimeoutOrMessage(event, spcParts) {
    // 2018-01-05T23:48:40.404Z f0fc759e-f272-11e7-87bd-577699d45526 hello
    // 2018-01-05T23:48:40.404Z f0fc759e-f272-11e7-87bd-577699d45526 Task timed out after 6.00 seconds
    if (
      spcParts.length >= 3 &&
      spcParts[0].match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/) !==
        null &&
      spcParts[1].match(/^[0-9a-fA-F-]{36}$/) !== null
    ) {
      const requestId = spcParts[1];
      const summary = spcParts.slice(2).join(" ");
      const type = summary.startsWith("Task timed out after")
        ? "ERROR"
        : "INFO";
      return { type, requestId, summary };
    }
  }
  function parseLambdaExited(event, spcParts) {
    // - Nodejs, Python 3.8
    // RequestId: 80925099-25b1-4a56-8f76-e0eda7ebb6d3 Error: Runtime exited with error: signal: aborted (core dumped)
    // - Python 2.7, 3.6, 3.7
    // RequestId: 80925099-25b1-4a56-8f76-e0eda7ebb6d3 Process exited before completing request
    if (
      spcParts.length >= 3 &&
      spcParts[0] === "RequestId:" &&
      spcParts[1].match(/^[0-9a-fA-F-]{36}$/) !== null
    ) {
      return {
        requestId: spcParts[1],
        type: "ERROR",
        summary: spcParts.slice(2).join(" "),
      };
    }
  }
  function parseLambdaUnknownApplicationError(event) {
    // Unknown application error occurred
    if (event.message.startsWith("Unknown application error occurred")) {
      return {
        type: "ERROR",
        summary: event.message,
      };
    }
  }
  function parseLambdaModuleInitializationError(event) {
    // module initialization error
    if (event.message.startsWith("module initialization error")) {
      return { type: "ERROR", summary: event.message };
    }
  }
  function parseLambdaNodeLog(event, tabParts) {
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
      const requestId =
        tabParts[1].match(/^[0-9a-fA-F-]{36}$/) !== null
          ? tabParts[1]
          : undefined;
      let type;
      let summary;
      // parse type
      if (tabParts[2] === "INFO") {
        return {
            requestId,
            type: "INFO",
            summary: tabParts.slice(3).join("\t"),
        };
      } else if (tabParts[2] === "WARN") {
        return {
            requestId,
            type: "WARN",
            summary: `Warn: ${tabParts.slice(3).join("\t")}`,
        };
      } else if (tabParts[2] === "ERROR") {
        let summary;
        try {
          const errorObject = JSON.parse(tabParts[4]);
          summary = errorObject.stack[0];
        } catch (e) {
          summary = `Error: ${tabParts.slice(3).join("\t")}`;
        }
        return {
            requestId,
            type: "ERROR",
            summary: `Error: ${tabParts.slice(3).join("\t")}`,
        };
      }

        return {
            requestId,
            type: "INFO",
            summary: tabParts.slice(2).join("\t"),
        };
    }
  }
  function parseLambdaPythonLog(event, tabParts) {
    // [WARNING] 2019-11-12T20:00:30.183Z	cc81b998-c7de-46fb-a9ef-3423ccdcda98 this is a warn
    // [ERROR] 2019-11-12T20:00:30.184Z	cc81b998-c7de-46fb-a9ef-3423ccdcda98 this is an error
    // [CRITICAL] 2019-11-12T20:00:30.184Z	cc81b998-c7de-46fb-a9ef-3423ccdcda98 this is critical
    if (
      tabParts.length >= 4 &&
      tabParts[1].match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/) !==
        null &&
      tabParts[2].match(/^[0-9a-fA-F-]{36}$/) !== null
    ) {
      let type;
      // parse type
      if (tabParts[0] === "[INFO]") {
        type = "INFO";
      } else if (tabParts[0] === "[WARNING]") {
        type = "WARN";
      } else if (tabParts[0] === "[ERROR]" || tabParts[0] === "[CRITICAL]") {
        type = "ERROR";
      } else {
        type = "INFO";
      }
      return {
        requestId: tabParts[2],
        type,
        summary: `${tabParts[0]} ${tabParts.slice(3).join("\t")}`,
      };
    }
  }
  function parseLambdaPythonTraceback(event) {
    // ...  Traceback (most recent call last): ...
    if (event.message.match(/\sTraceback \(most recent call last\):\s/) !== null) {
      const lineParts = event.message.split("\n");
      return { type: "ERROR", summary: lineParts[0] };
    }
  }

  //////////////
  // Render
  //////////////

  return (
    <div className="App">
      <Button
        size="sm"
        onClick={() => {
          const now = Date.now();
          setSearchRange({ start: now - 86400000, end: now })
        } }
      >
        1 day
      </Button>

      <Button
        size="sm"
        onClick={() => {
          const now = Date.now();
          setSearchRange({ start: now - 86400000 * 3, end: now })
        } }
      >
        3 days
      </Button>

      <table height="200">
        <tr>
          <th>Log Level</th>
          <th>Timestamp</th>
          <th>Duration</th>
          <th>Memory</th>
          <th>Request ID</th>
          <th width="300">Summary</th>
        </tr>
        { invocations.map(invocation => <Log invocation={invocation} /> ) }
      </table>
    </div>
  );
}
