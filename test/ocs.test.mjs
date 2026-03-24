import test from "node:test"
import assert from "node:assert/strict"
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { runCli } from "../src/ocs/cli.mjs"
import { buildTargetConfig, hasOmoPlugin, isOmoPlugin, loadConfig } from "../src/ocs/config.mjs"

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), "ocs-test-"))
}

function createEnv(configDir, extra = {}) {
  return {
    ...process.env,
    HOME: join(configDir, "..", ".."),
    OCS_CONFIG_DIR: configDir,
    ...extra
  }
}

function makeStreams() {
  const stdout = { chunks: [], write(chunk) { this.chunks.push(String(chunk)) } }
  const stderr = { chunks: [], write(chunk) { this.chunks.push(String(chunk)) } }
  return { stdout, stderr }
}

function createConfig(dir, filename, content) {
  mkdirSync(dir, { recursive: true })
  const filePath = join(dir, filename)
  writeFileSync(filePath, content, "utf-8")
  return filePath
}

function createFakeOpencode(dir, outputPath, exitCode = 0) {
  const scriptPath = join(dir, "fake-opencode.mjs")
  writeFileSync(
    scriptPath,
    `#!/usr/bin/env node
import { appendFileSync } from "node:fs"
appendFileSync(${JSON.stringify(outputPath)}, process.argv.slice(2).join(" ") + "\\n", "utf-8")
process.exit(${exitCode})
`,
    "utf-8"
  )
  chmodSync(scriptPath, 0o755)
  return scriptPath
}

test("优先读取 opencode.jsonc", async () => {
  const root = makeTempDir()
  const configDir = join(root, ".config", "opencode")
  const jsoncPath = createConfig(
    configDir,
    "opencode.jsonc",
    `{
  // preferred
  "plugin": ["oh-my-opencode@latest",]
}
`
  )
  createConfig(
    configDir,
    "opencode.json",
    JSON.stringify({ plugin: ["other-plugin"] }, null, 2)
  )

  const config = await loadConfig(createEnv(configDir))
  assert.equal(config.path, jsoncPath)
  assert.equal(config.format, "jsonc")
  assert.equal(hasOmoPlugin(config.data), true)
})

test("在没有 HOME 时会回退到 USERPROFILE 下的配置目录", async () => {
  const root = makeTempDir()
  const userProfile = join(root, "user-home")
  const configDir = join(userProfile, ".config", "opencode")
  const configPath = createConfig(
    configDir,
    "opencode.json",
    JSON.stringify({ plugin: ["oh-my-opencode@latest"] }, null, 2)
  )

  const config = await loadConfig({
    ...process.env,
    HOME: "",
    USERPROFILE: userProfile
  })

  assert.equal(config.path, configPath)
  assert.equal(config.format, "json")
  assert.equal(hasOmoPlugin(config.data), true)
})

test("严格识别 oh-my-opencode 插件名", () => {
  assert.equal(isOmoPlugin("oh-my-opencode"), true)
  assert.equal(isOmoPlugin("oh-my-opencode@latest"), true)
  assert.equal(isOmoPlugin("my-oh-my-opencode"), false)
  assert.equal(isOmoPlugin("oh-my-opencode-extra"), false)
})

test("without-omo 模式会移除插件", () => {
  const target = buildTargetConfig(
    { plugin: ["foo", "oh-my-opencode@latest", "bar"] },
    "without-omo"
  )

  assert.deepEqual(target.plugin, ["foo", "bar"])
})

test("with-omo 模式会自动补充插件", () => {
  const target = buildTargetConfig(
    { plugin: ["other-plugin"] },
    "with-omo"
  )

  assert.deepEqual(target.plugin, ["other-plugin", "oh-my-opencode@latest"])
})

test("ocs omo 在未检测到插件时会自动写入插件并继续启动", async () => {
  const root = makeTempDir()
  const configDir = join(root, ".config", "opencode")
  const configPath = createConfig(
    configDir,
    "opencode.json",
    JSON.stringify({ plugin: ["other-plugin"] }, null, 2)
  )
  const outputPath = join(root, "opencode-args.log")
  const fakeOpencode = createFakeOpencode(root, outputPath, 0)
  const { stdout, stderr } = makeStreams()

  const exitCode = await runCli(["omo"], {
    env: createEnv(configDir, { OPENCODE_BIN: fakeOpencode }),
    stdout,
    stderr
  })

  assert.equal(exitCode, 0)
  assert.equal(readFileSync(configPath, "utf-8"), `{
  "plugin": [
    "other-plugin",
    "oh-my-opencode@latest"
  ]
}
`)
  assert.equal(readFileSync(outputPath, "utf-8").trim(), "")
  assert.match(stdout.chunks.join(""), /未检测到 oh-my-opencode，将自动添加到 plugin 数组/)
  assert.match(stdout.chunks.join(""), /启动模式: with omo/)
  assert.match(stdout.chunks.join(""), /配置已更新并保留当前状态/)
  assert.equal(stderr.chunks.join(""), "")
})

test("ocs omo 在插件已存在时不会重复写入", async () => {
  const root = makeTempDir()
  const configDir = join(root, ".config", "opencode")
  const configPath = createConfig(
    configDir,
    "opencode.json",
    JSON.stringify({ plugin: ["oh-my-opencode@latest", "other-plugin"] }, null, 2)
  )
  const outputPath = join(root, "opencode-args.log")
  const fakeOpencode = createFakeOpencode(root, outputPath, 0)
  const { stdout, stderr } = makeStreams()

  const exitCode = await runCli(["omo"], {
    env: createEnv(configDir, { OPENCODE_BIN: fakeOpencode }),
    stdout,
    stderr
  })

  assert.equal(exitCode, 0)
  assert.equal(readFileSync(configPath, "utf-8"), `{
  "plugin": [
    "oh-my-opencode@latest",
    "other-plugin"
  ]
}
`)
  assert.doesNotMatch(stdout.chunks.join(""), /自动添加到 plugin 数组/)
  assert.equal(stderr.chunks.join(""), "")
})

test("ocs 会在无参数模式下保留新的 jsonc 配置", async () => {
  const root = makeTempDir()
  const configDir = join(root, ".config", "opencode")
  const configPath = createConfig(
    configDir,
    "opencode.jsonc",
    `{
  // keep comment
  "plugin": ["oh-my-opencode@latest", "other-plugin"]
}
`
  )
  const outputPath = join(root, "opencode-args.log")
  const fakeOpencode = createFakeOpencode(root, outputPath, 0)
  const { stdout, stderr } = makeStreams()

  const exitCode = await runCli([], {
    env: createEnv(configDir, { OPENCODE_BIN: fakeOpencode }),
    stdout,
    stderr
  })

  assert.equal(exitCode, 0)
  assert.equal(readFileSync(configPath, "utf-8"), `{
  "plugin": [
    "other-plugin"
  ]
}
`)
  assert.equal(readFileSync(outputPath, "utf-8").trim(), "")
  assert.match(stdout.chunks.join(""), /当前使用 jsonc 配置文件/)
  assert.match(stdout.chunks.join(""), /启动模式: without omo/)
  assert.match(stdout.chunks.join(""), /配置已更新并保留当前状态/)
  assert.equal(stderr.chunks.join(""), "")
})

test("出现额外参数时会直接报错退出", async () => {
  const root = makeTempDir()
  const configDir = join(root, ".config", "opencode")
  const configPath = createConfig(
    configDir,
    "opencode.json",
    JSON.stringify({ plugin: ["oh-my-opencode@latest"] }, null, 2)
  )
  const { stdout, stderr } = makeStreams()

  const exitCode = await runCli(["--model", "gpt-5"], {
    env: createEnv(configDir),
    stdout,
    stderr
  })

  assert.equal(exitCode, 1)
  assert.equal(readFileSync(configPath, "utf-8"), JSON.stringify({ plugin: ["oh-my-opencode@latest"] }, null, 2))
  assert.equal(stdout.chunks.join(""), "")
  assert.match(stderr.chunks.join(""), /仅支持 `ocs` 或 `ocs omo`，不再支持额外参数/)
})

test("启动失败时保留已写入的新配置", async () => {
  const root = makeTempDir()
  const configDir = join(root, ".config", "opencode")
  const original = JSON.stringify({ plugin: ["oh-my-opencode@latest"] }, null, 2)
  const configPath = createConfig(configDir, "opencode.json", original)
  const { stdout, stderr } = makeStreams()

  const exitCode = await runCli([], {
    env: createEnv(configDir, { OPENCODE_BIN: join(root, "missing-opencode") }),
    stdout,
    stderr
  })

  assert.equal(exitCode, 1)
  assert.equal(readFileSync(configPath, "utf-8"), `{
  "plugin": []
}
`)
  assert.match(stderr.chunks.join(""), /启动 opencode 失败/)
  assert.equal(existsSync(configPath), true)
})
