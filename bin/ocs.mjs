#!/usr/bin/env node

import { runCli } from "../src/ocs/cli.mjs"

const exitCode = await runCli(process.argv.slice(2), {
  env: process.env,
  stdout: process.stdout,
  stderr: process.stderr
})

process.exit(exitCode)
