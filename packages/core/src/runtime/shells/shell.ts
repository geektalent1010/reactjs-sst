#!/bin/node

import { spawn, execSync } from "child_process";
import { Command } from "../runtime";

const { SST_START, SST_BUILD } = process.env;
if (!SST_START) throw Error("SST_START set");
if (!SST_BUILD) throw Error("SST_BUILD not set");

const build: Command = JSON.parse(Buffer.from(SST_BUILD!, "base64").toString());

function start() {
  execSync(`${build.command} ${build.args.join(" ")}`, {
    stdio: "inherit",
    env: {
      ...process.env,
      ...build.environment,
    },
  });
  const result = spawn(SST_START!, [], {
    ...process.env,
  });

  result.on("close", (code) => {
    console.error(`Child process exited with code ${code}`);
    start();
  });
}

start();
