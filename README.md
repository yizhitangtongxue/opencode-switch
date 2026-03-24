# opencode-switch

`opencode-switch` 提供一个很小的 CLI：`ocs`。

它的作用是改写 `~/.config/opencode/opencode.json` 或 `opencode.jsonc` 里的 `plugin` 配置，再启动 `opencode`。

配置变更会永久保留，不会在 `opencode` 退出后自动恢复。

主要用途：

- `ocs [args...]`：移除 `oh-my-opencode` 插件后启动 `opencode`
- `ocs omo [args...]`：确保 `oh-my-opencode` 存在于插件数组中，再启动 `opencode`

特性：

- 优先读取 `~/.config/opencode/opencode.jsonc`
- 如果命中 `jsonc`，会明确提示当前正在使用 `jsonc` 配置文件
- 先写入目标配置，再启动 `opencode`
- 写入后的状态会保留给后续 `opencode` 会话继续使用
- 其余参数会原样透传给 `opencode`

## 工作原理

`ocs` 会按下面的顺序选择配置文件：

1. `~/.config/opencode/opencode.jsonc`
2. `~/.config/opencode/opencode.json`

行为规则：

- 如果 `opencode.jsonc` 存在，会忽略 `opencode.json`
- 如果两个文件都不存在，命令会直接失败
- `ocs omo` 会在 `plugin` 数组里补上 `oh-my-opencode@latest`（如果尚未存在）
- `ocs` 会从 `plugin` 数组中移除 `oh-my-opencode`

## 安装

### 方式 1：本地开发安装

先安装依赖：

```bash
npm install
```

然后用 `npm link` 把 `ocs` 链接到全局命令：

```bash
npm link
```

安装完成后可以直接运行：

```bash
ocs --help
ocs
ocs omo
ocs --model gpt-5
```

### 方式 2：直接用 Node 执行

不做全局安装时，也可以直接运行入口文件：

```bash
node bin/ocs.mjs
node bin/ocs.mjs omo
```

### 方式 3：从 npm 全局安装

发布到 npm 后，用户可以这样安装：

```bash
npm install -g opencode-switch
```

然后直接运行：

```bash
ocs
ocs omo
```

## 使用示例

普通模式启动，并永久禁用 `oh-my-opencode`：

```bash
ocs
```

带参数启动：

```bash
ocs --model gpt-5 --profile default
```

显式以带 `oh-my-opencode` 的模式启动：

```bash
ocs omo
```

同样支持透传参数：

```bash
ocs omo --model gpt-5
```

## 测试

运行全部测试：

```bash
npm test
```

当前测试覆盖：

- `jsonc` 优先于 `json`
- `oh-my-opencode` 插件严格识别
- `ocs omo` 会在缺少插件时自动写入
- `ocs omo` 在插件已存在时不会重复写入
- 参数透传给 `opencode`
- 写入后的配置会保留
- 启动失败时不会回滚已写入配置

## 发布到 npm

当前仓库里的 `package.json` 还是：

```json
{
  "private": true
}
```

这意味着现在不能直接发布。发布前需要先做下面几步。

### 1. 修改 `package.json`

至少确认这些字段：

```json
{
  "name": "opencode-switch",
  "version": "0.1.0",
  "private": false,
  "type": "module",
  "bin": {
    "ocs": "./bin/ocs.mjs"
  }
}
```

建议同时补充：

- `description`
- `license`
- `repository`
- `homepage`
- `bugs`
- `files`
- `keywords`

如果 `opencode-switch` 这个包名已被占用，需要换成一个未被占用的新名字。

### 2. 登录 npm

```bash
npm login
```

### 3. 发布前自检

先确认测试通过：

```bash
npm test
```

再确认实际会发布哪些文件：

```bash
npm pack --dry-run
```

### 4. 首次发布

公开包通常这样发：

```bash
npm publish --access public
```

如果是作用域包，比如 `@your-scope/opencode-switch`，也通常使用：

```bash
npm publish --access public
```

### 5. 后续发版

每次发布前先升级版本号：

```bash
npm version patch
```

或者：

```bash
npm version minor
npm version major
```

然后重新发布：

```bash
npm publish
```

## 发布建议

为了让 npm 包更干净，建议在发布前补一个 `files` 白名单，例如：

```json
{
  "files": [
    "bin",
    "src",
    "README.md"
  ]
}
```

这样可以避免把测试文件或其他无关文件一起发出去。

如果你希望，我下一步可以继续帮你把 `package.json` 也整理成“可直接发布到 npm”的状态。
