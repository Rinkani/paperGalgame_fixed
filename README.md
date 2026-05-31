# Paper2Galgame_fixed

## 1. 项目概述

**Paper2Galgame** 是一个基于 Web 的应用，将学术论文（PDF）转化为沉浸式 Galgame（视觉小说）对话体验。上传一篇论文，角色"丛雨"（Murasame）会以二次元口吻对论文进行逐段讲解，期间你可以随时向她提问，她会结合论文内容作答。

感谢大佬 **Nova42x** 给予的原始框架，我只是在此基础上做了一些修改，主要是使其能够直接支持deepseek的api，以及增加了提问的功能
原始项目网址：[https://github.com/Nova42x/Paper2Galgame](https://github.com/Nova42x/Paper2Galgame)

本项目使用 **DeepSeek Chat API** 作为 AI 后端，前端使用 pdf.js 提取 PDF 文本后发送给模型。
以下是项目概述，以及主要修改的内容

---

## 2. 技术栈

| 分类 | 技术 |
|------|------|
| 核心框架 | React 19 (函数式组件 + Hooks) |
| 语言 | TypeScript |
| 构建工具 | [Vite 6](https://vite.dev/) |
| 样式 | [Tailwind CSS](https://tailwindcss.com/) (CDN 引入) |
| 图标 | [FontAwesome](https://fontawesome.com/) |
| PDF 解析 | [pdfjs-dist](https://www.npmjs.com/package/pdfjs-dist) 4.x |
| AI API | [DeepSeek Chat API](https://api.deepseek.com/chat/completions) (`deepseek-chat` 模型) |
| 字体 | Noto Serif SC (中文衬线) & Nunito |

---

## 3. 项目结构

```text
/
├── index.html                     # 入口 HTML，Tailwind CDN 配置、全局样式
├── index.tsx                      # React 根节点挂载
├── App.tsx                        # 顶层组件，管理页面路由 (Title → Upload → Game)
├── types.ts                       # TypeScript 类型定义 (DialogueLine, GameSettings 等)
├── vite.config.ts                 # Vite 构建配置
├── .env                           # 环境变量 (API Key)
├── services/
│   ├── deepseekService.ts         # 核心业务：PDF 文本提取、Prompt 构造、DeepSeek API 调用、Q&A
│   ├── geminiService.ts           # (已废弃) 旧版 Gemini 实现
│   └── README.md                  # 旧版维护文档（Gemini 架构参考）
└── components/
    ├── TitleScreen.tsx            # 标题 / 主菜单界面
    ├── UploadScreen.tsx           # PDF 上传与解析状态界面
    ├── SettingsScreen.tsx         # 设置界面（讲解深度、角色性格）
    └── GameScreen.tsx             # 游戏主界面（立绘、打字机效果、Q&A 输入框）
```

---

## 4. 快速开始

### 4.1 获取 DeepSeek API Key

前往 [DeepSeek 开放平台](https://platform.deepseek.com/) 注册并获取 API Key。

### 4.2 配置环境变量

在项目根目录创建 `.env` 文件：

```env
VITE_DEEPSEEK_API_KEY=sk-your-deepseek-api-key-here
```

> 注意：`.env` 已加入 `.gitignore`，不会被提交到仓库。

### 4.3 启动开发服务器

```bash
npm install
npm run dev
```

浏览器打开终端输出的地址（默认 `http://localhost:5173`）即可使用。

---

## 5. 核心功能

### 5.1 PDF → Galgame 对话脚本

**流程：**

1. 用户在 UploadScreen 上传 PDF 文件
2. `deepseekService.ts` 中的 `analyzePaper()` 函数：
   - 使用 pdfjs-dist 将 PDF 逐页提取为纯文本
   - 截断至 80,000 字符（DeepSeek 上下文限制）
   - 构造包含角色设定 + 讲解要求 + 论文全文的 Prompt
   - 调用 DeepSeek Chat API，`response_format: json_object` 获取结构化输出
   - 解析返回的 JSON，过滤出丛雨的对话，标准化 emotion 字段
3. 生成的 `DialogueLine[]` 传递给 GameScreen 逐条播放

**可设定项（SettingsScreen）：**

| 设定 | 选项 | 说明 |
|------|------|------|
| 讲解深度 | brief / detailed / academic | 控制对话轮数（15 / 25+ / 30）和细节程度 |
| 角色性格 | tsundere / gentle / strict | 傲娇 / 温柔大姐姐 / 魔鬼教官 |

### 5.2 论文讲解过程中的即时提问（Q&A）

在 GameScreen 中点击 **Ask** 按钮，弹出输入框，可以输入任何关于论文的问题。

**流程：**

1. 用户输入问题并提交
2. `deepseekService.ts` 中的 `askQuestion()` 函数被调用，携带：
   - 论文全文（`paperText`，作为回答依据）
   - 到当前为止的对话历史（`history`）
   - 用户的问题文本
3. DeepSeek 以丛雨的口吻、基于论文内容生成回答
4. 回答被追加到对话脚本末尾，自动滚动到最新消息

**技术细节：**

- 提问时调用独立的 `askQuestion()` 而非复用 `analyzePaper()`，以降低 token 消耗
- Q&A 的 system prompt 明确要求"简洁有重点，不要过于冗长"
- 支持 Shift+Enter 换行，Enter 直接发送

---

---

## 6. 架构说明：从 Gemini 迁移到 DeepSeek

> 旧版架构文档见 `services/README.md`，该项目最初基于 Google Gemini 构建。

**核心差异：**

| | Gemini 原版 | DeepSeek 当前版 |
|---|---|---|
| PDF 处理 | 直接传 Base64 PDF，模型原生解析 | 前端 pdf.js 提取文本后传纯文本 |
| API 调用 | `@google/genai` SDK | 原生 `fetch()` |
| 多模态 | 支持 | 不支持（纯文本） |
| JSON 模式 | `responseSchema` 结构化输出 | `response_format: json_object` |
| 新增功能 | 无 | 即时 Q&A 提问功能 |

**迁移代价：** 由于 DeepSeek 不接受 PDF 文件，必须在浏览器端用 pdfjs-dist 完成 PDF→文本转换，文本长度可能受上下文窗口限制（当前截断至 80k 字符）。

---

## 7. 常见问题

| 问题 | 排查方向 |
|------|----------|
| "感应不到 API Key" | 检查 `.env` 文件是否存在、Key 是否正确、是否以 `VITE_` 开头 |
| API 调用失败 | 打开浏览器控制台查看具体错误；确认网络能访问 `api.deepseek.com` |
| PDF 解析后无内容 | 确认 PDF 是文字型而非扫描图片型（扫描版 PDF 无法提取文本） |
| DeepSeek 返回格式异常 | `deepseek-chat` 模型对 JSON 模式的遵循度可能波动，检查控制台返回的原始 JSON |
| 页面白屏 | F12 查看控制台 JS 报错；确认 `npm install` 完整执行 |

---