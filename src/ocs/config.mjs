import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const OMO_PLUGIN_PATTERN = /^oh-my-opencode(?:@.+)?$/i
const OMO_PLUGIN_ENTRY = "oh-my-opencode@latest"

async function parseJsonc(text) {
  try {
    const { parse } = await import("jsonc-parser")
    return parse(text)
  } catch {
    return JSON.parse(stripJsonCommentsAndTrailingCommas(text))
  }
}

function stripJsonCommentsAndTrailingCommas(text) {
  let result = ""
  let inString = false
  let isEscaped = false
  let inLineComment = false
  let inBlockComment = false

  for (let index = 0; index < text.length; index += 1) {
    const current = text[index]
    const next = text[index + 1]

    if (inLineComment) {
      if (current === "\n") {
        inLineComment = false
        result += current
      }
      continue
    }

    if (inBlockComment) {
      if (current === "*" && next === "/") {
        inBlockComment = false
        index += 1
      }
      continue
    }

    if (!inString && current === "/" && next === "/") {
      inLineComment = true
      index += 1
      continue
    }

    if (!inString && current === "/" && next === "*") {
      inBlockComment = true
      index += 1
      continue
    }

    result += current

    if (current === "\"" && !isEscaped) {
      inString = !inString
    }

    isEscaped = current === "\\" && !isEscaped
    if (current !== "\\") {
      isEscaped = false
    }
  }

  let normalized = ""
  inString = false
  isEscaped = false

  for (let index = 0; index < result.length; index += 1) {
    const current = result[index]

    if (current === "\"" && !isEscaped) {
      inString = !inString
    }

    if (!inString && current === ",") {
      let lookahead = index + 1
      while (lookahead < result.length && /\s/.test(result[lookahead])) {
        lookahead += 1
      }

      if (result[lookahead] === "]" || result[lookahead] === "}") {
        isEscaped = false
        continue
      }
    }

    normalized += current

    isEscaped = current === "\\" && !isEscaped
    if (current !== "\\") {
      isEscaped = false
    }
  }

  return normalized
}

export function isOmoPlugin(value) {
  return typeof value === "string" && OMO_PLUGIN_PATTERN.test(value.trim())
}

export function getPluginList(config) {
  return Array.isArray(config?.plugin) ? config.plugin : []
}

function getConfigDir(env) {
  return env.OCS_CONFIG_DIR || join(env.HOME || "", ".config", "opencode")
}

function getEol(text) {
  return text.includes("\r\n") ? "\r\n" : "\n"
}

export async function loadConfig(env = process.env) {
  const configDir = getConfigDir(env)
  const jsoncPath = join(configDir, "opencode.jsonc")
  const jsonPath = join(configDir, "opencode.json")

  let selectedPath = null
  let format = null

  if (existsSync(jsoncPath)) {
    selectedPath = jsoncPath
    format = "jsonc"
  } else if (existsSync(jsonPath)) {
    selectedPath = jsonPath
    format = "json"
  } else {
    const error = new Error("未找到 opencode 配置文件")
    error.code = "CONFIG_NOT_FOUND"
    throw error
  }

  const raw = readFileSync(selectedPath, "utf-8")
  let data
  try {
    data = format === "jsonc" ? await parseJsonc(raw) : JSON.parse(raw)
  } catch (cause) {
    const error = new Error(`配置文件解析失败: ${selectedPath}`)
    error.code = "CONFIG_PARSE_FAILED"
    error.cause = cause
    throw error
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    const error = new Error(`配置文件内容无效: ${selectedPath}`)
    error.code = "CONFIG_INVALID"
    throw error
  }

  return {
    configDir,
    path: selectedPath,
    format,
    raw,
    eol: getEol(raw),
    data
  }
}

export function hasOmoPlugin(config) {
  return getPluginList(config).some(isOmoPlugin)
}

export function buildTargetConfig(config, mode) {
  const nextConfig = structuredClone(config)

  if (mode === "with-omo") {
    const pluginList = Array.isArray(nextConfig.plugin) ? nextConfig.plugin : []
    if (!pluginList.some(isOmoPlugin)) {
      nextConfig.plugin = [...pluginList, OMO_PLUGIN_ENTRY]
    } else {
      nextConfig.plugin = pluginList
    }
    return nextConfig
  }

  if (!Array.isArray(nextConfig.plugin)) {
    return nextConfig
  }

  nextConfig.plugin = nextConfig.plugin.filter(item => !isOmoPlugin(item))
  return nextConfig
}

export function serializeConfig(config, original) {
  return `${JSON.stringify(config, null, 2)}${original.eol}`
}

export function writeTempConfig(targetPath, content) {
  writeFileSync(targetPath, content, "utf-8")
}
