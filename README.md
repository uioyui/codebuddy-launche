# CodeBuddy 快速启动器 v2.0

为 CodeBuddy CLI 提供 GUI 文件夹选择、API 配置管理和交互命令行的启动器。

## 前置要求

- **Node.js** `v22+`
- **CodeBuddy CLI** 已安装且可在 PATH 中找到（命令行可执行 `codebuddy`）


## 快速开始
- **初始化配置** 执行npm install
### 方式一：双击 bat 启动

| bat 文件 | 功能 |
|----------|------|
| `快速启动.bat` | 弹出 GUI 文件夹选择对话框，选完直接启动 CodeBuddy |
| `启动CodeBuddy.bat` | 进入交互命令行模式，可切换模型/目录/配置，再启动 CodeBuddy |

### 方式二：命令行启动

```bash
# 快速启动（GUI 选目录后启动）
node launcher.js

# 交互命令行模式
node launcher.js --interactive

# 传统配置菜单
node launcher.js --config

# 查看帮助
node launcher.js --help
```

## 命令行参数

| 参数 | 说明 |
|------|------|
| &lt;无参数&gt; | 快速启动：GUI 弹窗选择工作目录后直接启动 CodeBuddy |
| `--interactive` `-i` | 交互模式：进入命令循环，可管理配置并反复启动 CodeBuddy |
| `--config` `-c` | 配置菜单：传统数字菜单式配置（修改 API/模型/目录） |
| `--help` `-h` | 显示帮助信息 |

## 交互模式命令

`启动CodeBuddy.bat` 进入后，显示以下菜单：

```
═══ 当前状态 ═══
  API  : xxx
  模型 : auto
  目录 : xxx
════════════════

  p        → 启动 CodeBuddy 交互模式
  /model   → 切换模型
  /dir     → 切换工作目录（GUI 选择）
  /config  → 查看/修改 API 配置
  /help    → 帮助
  /exit    → 退出
  直接输入 → 作为 prompt 单次执行
```

| 命令 | 别名 | 说明 |
|------|------|------|
| `p` | - | 启动 CodeBuddy 对话模式，退出后返回菜单 |
| `/model` | `/m` | 从 API 拉取可用模型列表并切换 |
| `/dir` | `/d` | 弹出 GUI 文件夹选择对话框切换工作目录 |
| `/config` | `/c` | 查看当前 API / Token / 模型，可选择 `y` 修改 |
| `/help` | `/h` | 显示命令帮助 |
| `/exit` | `/q` | 退出启动器 |
| 任意文本 | - | 作为 prompt 单次执行，完成后返回菜单 |

## 配置文件

启动器只从 launcher.js 同目录下的 `config.json` 读取配置，不混入任何硬编码默认值。

```json
{
  "baseUrl": "你的 API 地址",
  "apiKey": "你的 Token",
  "model": "auto",
  "workingDir": "C:\\Users\\xxx"
}
```

| 字段 | 说明 |
|------|------|
| `baseUrl` | API 基础地址（兼容 OpenAI 格式） |
| `apiKey` | API Token / Key |
| `model` | 默认模型名称，`auto` 表示自动选择 |
| `workingDir` | 默认工作目录 |

首次运行时若 `config.json` 不存在会自动创建模板文件。

## 构建 EXE

使用 [pkg](https://github.com/vercel/pkg) 打包为独立可执行文件（无需 Node.js）：

```bash
npm run build
```

输出 `codebuddy-launcher.exe`，放到任意目录运行。EXE 会在自身同目录读写 `config.json`。

## 目录结构

```
codebuddy-launcher-main/
├── launcher.js            # 主程序
├── package.json
├── config.json            # 用户配置文件
├── 快速启动.bat            # 快速启动脚本（GUI 选目录）
├── 启动CodeBuddy.bat       # 交互模式启动脚本
├── build-exe.bat          # 构建 EXE 脚本
├── node_modules/          # 依赖（axios）
└── README.md
```

## 技术栈

- Node.js / axios
- PowerShell + Windows Forms（GUI 文件夹选择）
- pkg（打包独立 EXE）