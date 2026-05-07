# GPT Image Chat

一个轻量级、下载即可用的中文图片生成工具。项目使用 Next.js + Tailwind + Route Handlers，后端保持在 Next.js 内部，数据和图片默认都保存在本地。

## 功能

- 文字生图
- 参考图 + 文字编辑生图
- 中文对话式界面
- 本地历史会话
- 会话和单条消息删除
- 参考图上传、粘贴、预览、删除和重新选择
- 生成参数：尺寸、质量、张数
- 生成中占位、自动滚动到底部
- 图片下载和大图预览
- 重新生成和继续细化
- 网页内配置 OpenAI API Key 和 Base URL
- 本地存储清理：清理无用图片、清空全部历史和图片

## 环境要求

- Node.js 18+

## 快速启动

1. 安装依赖

```bash
npm install
```

2. 准备环境变量

```bash
copy .env.example .env
```

`.env` 至少需要包含数据库路径：

```dotenv
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY=
OPENAI_BASE_URL=
```

API Key 和 Base URL 也可以直接在网页左侧底部的「设置」里填写并保存到本地 SQLite。

3. 构建并启动

```bash
npm run build
npm run start
```

4. 打开浏览器

```text
http://localhost:3000
```

## 配置优先级

运行时读取顺序：

1. 优先读取网页设置保存到 SQLite 的 API Key / Base URL
2. 如果数据库未配置，再读取 `.env` 中的 `OPENAI_API_KEY` / `OPENAI_BASE_URL`
3. 如果 Base URL 未配置，则使用 OpenAI SDK 默认地址

设置页不会回显完整 Key，只会显示脱敏值，例如 `sk-****abcd`。

## 本地存储

- SQLite 数据库默认保存到 `dev.db`
- 上传参考图保存到 `public/uploads`
- 生成结果图保存到 `public/generated`
- 运行时新增图片通过动态路由访问，生产模式下也能立即显示

## 说明

- 当前图片生成与编辑请求使用模型 `gpt-image-2`
- 项目定位是单机本地工具，不包含登录、多用户、云同步或复杂任务队列
- 如果首次打开未配置 API Key，会自动弹出设置窗口
