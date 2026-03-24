import { spawn } from "node:child_process"

import {
  buildTargetConfig,
  hasOmoPlugin,
  loadConfig,
  serializeConfig,
  writeTempConfig
} from "./config.mjs"

function writeLine(stream, message) {
  stream.write(`${message}\n`)
}

function parseCliArgs(argv) {
  if (argv[0] === "omo") {
    return {
      mode: "with-omo",
      opencodeArgs: argv.slice(1)
    }
  }

  return {
    mode: "without-omo",
    opencodeArgs: argv
  }
}

function getOpencodeBin(env) {
  return env.OPENCODE_BIN || "opencode"
}

export async function runCli(argv, options = {}) {
  const env = options.env || process.env
  const stdout = options.stdout || process.stdout
  const stderr = options.stderr || process.stderr

  const { mode, opencodeArgs } = parseCliArgs(argv)

  let config
  try {
    config = await loadConfig(env)
  } catch (error) {
    writeLine(stderr, error.message)
    return 1
  }

  writeLine(stdout, `使用配置文件: ${config.path}`)
  if (config.format === "jsonc") {
    writeLine(stdout, "当前使用 jsonc 配置文件，优先使用 opencode.jsonc")
  }

  const omoInstalled = hasOmoPlugin(config.data)
  if (mode === "without-omo" && !omoInstalled) {
    writeLine(stdout, "当前本就未启用 oh-my-opencode，将继续以 without omo 模式启动")
  }
  if (mode === "with-omo" && !omoInstalled) {
    writeLine(stdout, "未检测到 oh-my-opencode，将自动添加到 plugin 数组")
  }

  writeLine(stdout, `启动模式: ${mode === "with-omo" ? "with omo" : "without omo"}`)

  const targetConfig = buildTargetConfig(config.data, mode)
  const nextContent = serializeConfig(targetConfig, config)
  let child = null
  let finalSignal = null

  const signalHandler = signal => {
    finalSignal = signal
    if (child && !child.killed) {
      child.kill(signal)
    }
  }

  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, signalHandler)
  }

  try {
    writeTempConfig(config.path, nextContent)
  } catch (error) {
    writeLine(stderr, `写入配置失败: ${error.message}`)
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
      process.off(signal, signalHandler)
    }
    return 1
  }

  try {
    child = spawn(getOpencodeBin(env), opencodeArgs, {
      stdio: "inherit",
      env
    })
  } catch (error) {
    writeLine(stderr, `启动 opencode 失败: ${error.message}`)
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
      process.off(signal, signalHandler)
    }
    return 1
  }

  return await new Promise(resolve => {
    child.once("error", error => {
      writeLine(stderr, `启动 opencode 失败: ${error.message}`)
      for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
        process.off(signal, signalHandler)
      }
      resolve(1)
    })

    child.once("exit", (code, signal) => {
      if (signal && !finalSignal) {
        finalSignal = signal
      }

      for (const signalName of ["SIGINT", "SIGTERM", "SIGHUP"]) {
        process.off(signalName, signalHandler)
      }

      if (finalSignal) {
        resolve(128)
        return
      }

      writeLine(stdout, "配置已更新并保留当前状态")
      resolve(code ?? 0)
    })
  })
}
