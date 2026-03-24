# opencode-switch

`opencode-switch` 是一个给 `opencode` 用的插件切换工具，提供一个简单命令：`ocs`。

它的核心用途，是帮你在“带 `oh-my-opencode` 插件”和“不带这个插件”两种运行状态之间快速切换，而不需要每次手动编辑 `~/.config/opencode/opencode.json` 或 `opencode.jsonc`。

适合的使用场景：

- 你想临时切回普通 `opencode`，不带 `oh-my-opencode`
- 你想快速恢复 `oh-my-opencode` 插件环境
- 你不想反复手改 `plugin` 数组
- 你希望改完配置后直接启动 `opencode`

这两个命令分别对应两种状态：

- `ocs`：移除 `oh-my-opencode` 插件后启动 `opencode`
- `ocs omo`：确保 `oh-my-opencode` 存在于插件数组中，再启动 `opencode`

需要注意的是，`ocs` 对配置文件的修改是永久生效的，不会在 `opencode` 退出后自动恢复。

主要特性：

- 不需要手动编辑配置文件
- 直接基于 `opencode` 现有全局配置工作
- 优先读取 `~/.config/opencode/opencode.jsonc`
- 如果命中 `jsonc`，会明确提示当前正在使用 `jsonc` 配置文件
- 先写入目标配置，再启动 `opencode`
- 写入后的状态会保留给后续 `opencode` 会话继续使用
- 只支持 `ocs` 和 `ocs omo` 两种固定命令形式

## 工作原理

`ocs` 会按下面的顺序选择配置文件：

1. `~/.config/opencode/opencode.jsonc`
2. `~/.config/opencode/opencode.json`

行为规则：

- 如果 `opencode.jsonc` 存在，会忽略 `opencode.json`
- 如果两个文件都不存在，命令会直接失败
- `ocs omo` 会在 `plugin` 数组里补上 `oh-my-opencode@latest`（如果尚未存在）
- `ocs` 会从 `plugin` 数组中移除 `oh-my-opencode`

## 快速理解

最常用的两个命令就是：

```bash
ocs
ocs omo
```

可以把它们理解成：

- `ocs`：切到不带 `oh-my-opencode` 的状态
- `ocs omo`：切到带 `oh-my-opencode` 的状态

## 安装

### 方式 1：从 npm 全局安装

安装：

```bash
npm install -g opencode-switch
```

然后直接运行：

```bash
ocs
ocs omo
```

### 方式 2：直接用 Node 执行

不做全局安装时，也可以直接运行入口文件：

```bash
node bin/ocs.mjs
node bin/ocs.mjs omo
```

### 方式 3：本地开发安装

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
ocs
ocs omo
```

## 使用示例

普通模式启动，并永久禁用 `oh-my-opencode`：

```bash
ocs
```

显式以带 `oh-my-opencode` 的模式启动：

```bash
ocs omo
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
- 出现额外参数时会直接报错
- 写入后的配置会保留
- 启动失败时不会回滚已写入配置
