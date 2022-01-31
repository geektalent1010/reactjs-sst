import Button from "./components/Button";
import { useEffect, useState } from "react";

export default function Log({ invocation }) {
  const {
    hasError,
    hasWarn,
    duration,
    memUsed,
    requestId,
    summary,
    firstLineTime,
    logs,
  } = invocation;

  const [expanded, setExpanded] = useState(false);

  return (
    <tr>
      <td>
        {hasError && <p>ERROR</p>}
        {!hasError && hasWarn && <p>WARN</p>}
        {!hasError && !hasWarn && <p>INFO</p>}
      </td>

      <td><p>{(new Date(firstLineTime)).toISOString()}</p></td>

      <td>{duration ? `${duration} ms` : "-"}</td>
      <td>{memUsed ? `${memUsed} MB` : "-"}</td>
      <td>RequestId: {requestId || "-"}</td>
      <td>
        {expanded ? (
          <pre>
            <Button size="sm" onClick={() => setExpanded(false)}>
              ▼
            </Button>
            {logs.map((log) => (
              <p>{log}</p>
            ))}
          </pre>
        ) : (
          <pre>
            <Button size="sm" onClick={() => setExpanded(true)}>
              ▶
            </Button>
            <p>{summary || ""}</p>
          </pre>
        )}
      </td>
    </tr>
  );
}
