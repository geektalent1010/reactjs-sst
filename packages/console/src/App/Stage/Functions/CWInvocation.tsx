import { useState } from "react";
import { Link } from "react-router-dom";
import { Anchor, Badge, JsonView, Row, Spacer, Stack } from "~/components";
import { useFunctionInvoke } from "~/data/aws";
import { styled, keyframes } from "~/stitches.config";
import type { Invocation } from "~/data/aws/function";

type InvocationProps = {
  invocation: Invocation;
};

export function CWInvocationRow(props: InvocationProps) {
  const {
    logLevel,
    duration,
    memUsed,
    requestId,
    summary,
    firstLineTime,
    logs,
  } = props.invocation;

  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <Row alignVertical="start">
        <p>{logLevel}</p>
        <Spacer horizontal="lg" />
        <p>{(new Date(firstLineTime!)).toISOString()}</p>
        <Spacer horizontal="lg" />
        <p>{memUsed ? `${memUsed} MB` : "-"}</p>
        <Spacer horizontal="lg" />
        <p>{duration ? `${duration} ms` : "-"}</p>
        <Spacer horizontal="lg" />
        <p>{requestId || "-"}</p>
        <Spacer horizontal="lg" />
        <Anchor onClick={() => setExpanded(!expanded)} >
          {expanded ? "▼" : "▶"}
          {summary}
        </Anchor>
      </Row>
      { expanded &&
        <Row alignVertical="start">
          <InvocationLogs logs={logs} />
        </Row>
      }
    </div>
  );
}

const InvocationStatusRoot = styled("div", {
  width: 100,
  flexShrink: 0,
});

const LogAnimation = keyframes({
  from: {
    opacity: 0,
  },
  to: {
    opacity: 1,
  },
});

const LogRow = styled("div", {
  fontSize: "$sm",
  lineHeight: 1.5,
  borderBottom: "1px solid $border",
  padding: "$sm 0",
  display: "flex",
  animation: `${LogAnimation} 300ms`,
  "&:first-child": {
    paddingTop: 0,
  },
  "&:last-child": {
    border: 0,
    paddingBottom: 0,
  },
  gap: "$md",

  "& > *:first-child": {
    flexBasis: "120px",
    flexShrink: 0,
  },
});

const LogTimestamp = styled("div", {});

const LogMessage = styled("div", {
  flexGrow: 1,
  whiteSpace: "pre-wrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

const LogDuration = styled("div", {
  flexShrink: 0,
  display: "none",
});

type InvocationLogsProps = {
  logs: string[];
};

const InvocationLogsRoot = styled("div", {
  flexGrow: 1,
  overflow: "hidden",
});

export function InvocationLogs(props: InvocationLogsProps) {
  return (
    <InvocationLogsRoot>
      {props.logs.map((log) => (
        <LogRow>
          <LogMessage>{log}</LogMessage>
          {/*
          <LogTimestamp>
            {new Date(item.timestamp).toISOString().split("T")[1]}
          </LogTimestamp>
          <LogMessage>{item.message}</LogMessage>
          <LogDuration>
            {item.timestamp - props.invocation.times.start}ms
          </LogDuration>
          */}
        </LogRow>
      ))}
    </InvocationLogsRoot>
  );
}
