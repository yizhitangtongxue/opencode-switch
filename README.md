# opencode-switch

`ocs` 是 `opencode` 的插件切换命令。  
它会修改 `plugin` 配置后再启动 `opencode`，用于在带/不带 `oh-my-opencode` 之间快速切换。

- npm: [opencode-switch](https://www.npmjs.com/package/opencode-switch)
- GitHub: [yizhitangtongxue/opencode-switch](https://github.com/yizhitangtongxue/opencode-switch)

## 安装

```bash
npm install -g opencode-switch
```

## 用法

```bash
ocs
ocs omo
ocs -s session_id
ocs omo -s session_id
```

- `ocs`：移除 `oh-my-opencode` 后启动 `opencode`
- `ocs omo`：检查本机已安装 `oh-my-opencode`，并确保插件在数组中后启动 `opencode`
- 其余参数会透传给 `opencode`

## 配置文件路径

- macOS / Linux: `~/.config/opencode`
- Windows: `C:\Users\用户名\.config\opencode`

读取顺序：

1. `opencode.jsonc`
2. `opencode.json`

## 行为规则

- 配置修改是永久生效，不会自动回滚
- `opencode.jsonc` 存在时优先使用它
- 配置文件不存在会直接报错退出
- `ocs omo` 在未检测到 `oh-my-opencode` 安装时会报错退出

## 测试

```bash
npm test
```
