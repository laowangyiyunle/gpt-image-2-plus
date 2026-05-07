# GPT Image Chat 设计文档

## 1. 目标

本项目是一个基于 `gpt-image-2` 的图片生成应用，采用 `Next.js + Tailwind + Route Handlers` 的前后端一体化架构。

首版目标：

- 支持纯文字生图
- 支持图片 + 文字生图
- 提供中文对话式界面
- 生成结果以内嵌消息的形式出现在会话中
- 保存历史会话和历史生成记录
- 通过环境变量配置单个系统级 API Key
- 提供网页入口填写并保存单个当前生效的 API Key
- 提供网页入口设置全局 OpenAI Base URL

非目标：

- 不做用户登录和多租户
- 不做多图上传
- 不做复杂异步任务队列
- 不做对象存储和云端文件系统
- 不做后台 API Key 管理页面
- 不做多 Key 和自动切换
- 不做 API Key 密码保护
- 不做多环境配置切换

## 2. 总体方案

项目采用单体 Web 应用架构：

- 前端：Next.js App Router 页面，Tailwind 负责界面样式
- 后端：Next.js Route Handlers 负责接口、参数校验、OpenAI 调用和数据落库
- 数据库：SQLite
- ORM：Prisma
- 文件存储：本地文件系统

后端保持轻量，只承担以下职责：

- 接收和校验前端输入
- 管理图片上传
- 调用 OpenAI 图片接口
- 保存会话、消息和图片记录
- 从环境变量读取单个 API Key
- 从数据库读取网页保存的当前 API Key
- 从数据库读取网页保存的全局 Base URL

## 3. 产品形态

### 3.1 页面结构

首版使用中文界面，整体分为两部分：

- 左侧：历史会话列表
- 右侧：当前会话聊天区

主要入口：

- 图片对话
- 设置

### 3.2 对话式交互

聊天区以消息流形式组织交互：

- 用户消息支持纯文字输入
- 用户消息支持图片 + 文字一起提交
- 助手消息展示生成进度、错误信息和结果图片
- 生成结果默认以内嵌消息形式插入当前会话

每条结果消息下支持以下操作：

- 下载图片
- 重新生成
- 继续细化

### 3.3 历史会话

历史记录按“会话”组织：

- 一次连续的对话生成过程对应一个会话
- 会话标题默认取首条用户消息的前 20 到 30 个字符
- 左侧列表按最近更新时间倒序展示
- 点击会话可以恢复完整消息历史

### 3.4 设置页

设置页提供一个极小的 API Key 管理入口：

- 左侧栏提供“设置”入口
- 页面中展示 OpenAI API Key 输入框
- 页面中展示 Base URL 输入框
- 支持保存当前 Key
- 支持保存当前 Base URL
- 支持测试连接
- 若数据库中已存在 Key，只显示脱敏值，例如 `sk-****abcd`
- 不回显完整 Key
- 若数据库中已存在 Base URL，则显示完整 URL

## 4. 核心流程

### 4.1 纯文字生图

1. 用户在输入框中填写中文提示词
2. 前端将用户消息写入当前会话视图
3. 前端调用 `POST /api/images/generate`
4. 后端校验参数并读取环境变量中的 API Key
5. 后端调用 OpenAI 图片生成接口
6. 后端将结果图片保存到本地并写入数据库
7. 后端返回助手消息和图片记录
8. 前端将结果作为助手消息插入会话

### 4.2 图片 + 文字生图

1. 用户上传一张参考图并输入提示词
2. 前端构造 `multipart/form-data`
3. 前端调用 `POST /api/images/edit`
4. 后端校验图片类型、大小和文本参数
5. 后端调用 OpenAI 图片编辑或变体接口
6. 后端保存结果图片和消息记录
7. 前端将结果以内嵌消息形式展示

### 4.3 继续细化

1. 用户基于某条结果消息继续输入要求
2. 前端保持在同一会话内继续提交
3. 可选地将上一张结果图作为新的输入图
4. 服务端复用相同生成链路

## 5. API 设计

### 5.1 会话接口

`POST /api/chat/sessions`

- 创建新会话
- 输入：可选初始标题
- 输出：会话基础信息

`GET /api/chat/sessions`

- 获取会话列表
- 输出：会话 id、标题、最后更新时间、最后一条消息摘要

`GET /api/chat/sessions/:id`

- 获取单个会话详情
- 输出：会话信息、消息列表、图片记录

### 5.2 图片生成接口

`POST /api/images/generate`

- 用于纯文字生图
- 输入：
  - `sessionId`
  - `prompt`
  - 可选 `size`
  - 可选 `quality`
  - 可选 `count`
- 输出：
  - 助手消息
  - 图片记录

`POST /api/images/edit`

- 用于图片 + 文字生图
- 输入：
  - `sessionId`
  - `prompt`
  - `image`
  - 可选 `size`
  - 可选 `quality`
- 可选 `count`
- 输出同上

### 5.3 设置接口

`GET /api/settings/openai-key`

- 获取当前 Key 与 Base URL 配置状态
- 返回：
  - `configured`: 是否已配置
  - `maskedKey`: 脱敏值，未配置时为空
  - `baseUrl`: 当前 Base URL，未配置时为空
  - `source`: `database` | `env` | `default` | `none`

`PUT /api/settings/openai-key`

- 保存或更新当前生效的 Key 与 Base URL
- 输入：
  - `apiKey`
  - 可选 `baseUrl`

`POST /api/settings/openai-key/test`

- 测试当前输入或已保存的 Key 与 Base URL 是否可用
- 输入：
  - 可选 `apiKey`
  - 可选 `baseUrl`
- 输出：
  - `ok`: 是否测试成功
  - `message`: 中文结果说明

## 6. 数据模型

### 6.1 Session

- `id`
- `title`
- `createdAt`
- `updatedAt`

### 6.2 Message

- `id`
- `sessionId`
- `role`：`user` | `assistant`
- `content`
- `status`：`pending` | `success` | `failed`
- `createdAt`

说明：

- 用户输入和助手输出都以消息形式保存
- 结果图通过关联表挂到助手消息上

### 6.3 ImageAsset

- `id`
- `messageId`
- `sessionId`
- `filePath`
- `mimeType`
- `width`
- `height`
- `sourceType`：`generated` | `uploaded`
- `createdAt`

说明：

- 上传参考图和生成结果图都可以复用该模型
- 首版以本地文件路径或相对访问路径作为主引用

### 6.4 RuntimeConfig

- `key`
- `value`
- `updatedAt`

说明：

- 使用单表键值结构保存轻量运行时配置
- 当前只保存一个配置项：`openai_api_key`
- 同时保存一个配置项：`openai_base_url`

## 7. API Key 使用策略

### 7.1 基本策略

- 系统仅使用一个 API Key
- API Key 可通过网页写入数据库保存
- Base URL 可通过网页写入数据库保存
- 若数据库未配置，则回退到 `.env.local` 中的 `OPENAI_API_KEY`
- 若数据库未配置 Base URL，则回退到 `.env.local` 中的 `OPENAI_BASE_URL`
- 若数据库和环境变量都未配置 Base URL，则使用 OpenAI SDK 默认地址
- 应用处理请求时按“数据库优先，环境变量回退，最后默认值”读取

### 7.2 失败处理

- 若数据库与环境变量均未配置 API Key，页面或接口返回明确的初始化提示
- 若 Key 无效、额度不足或请求被上游拒绝，返回统一错误文案
- 若 Base URL 非法或目标服务不可达，返回统一错误文案
- 服务端日志记录可诊断信息，但禁止输出完整 Key

### 7.3 管理规则

- 前端不展示完整 Key
- API Key 可存入数据库
- 业务接口不回传完整 Key
- 设置页只显示脱敏值，例如 `sk-****abcd`
- Base URL 可存入数据库
- 设置页可显示完整 Base URL

## 8. 存储与文件策略

首版采用本地文件保存图片：

- 上传图保存到本地上传目录
- 生成结果图保存到本地输出目录
- 数据库保存相对路径和元数据

这样做的原因：

- 实现简单
- 不依赖外部对象存储
- 便于历史会话回显

后续若接入对象存储，可保持 `ImageAsset` 对外接口不变，只替换底层存储实现。

## 9. 安全要求

### 9.1 输入安全

- 对所有文本参数做空值、长度和基础格式校验
- 对上传文件做类型、大小和空文件校验
- 严禁信任前端传入的文件名和路径

### 9.2 Key 安全

- API Key 不写入前端
- API Key 不明文回传
- API Key 可保存在数据库中
- Base URL 可保存在数据库中
- 服务端日志禁止输出完整 Key

### 9.3 文件安全

- 上传目录和输出目录使用固定白名单路径
- 文件名由服务端生成
- 防止路径穿越

## 10. 错误处理

### 10.1 前端

- 上传前提示不合法文件
- 生成中展示加载状态
- 失败时将错误以内嵌助手消息展示
- 对用户显示友好提示，不暴露内部异常详情

### 10.2 后端

- 统一封装错误响应
- OpenAI 详细错误仅写服务端日志
- 对数据库写入和文件保存使用明确的失败分支
- 避免出现“图片已生成但消息未落库”的半成功状态

建议流程：

- 先完成外部调用
- 再保存文件
- 最后在单次事务中写入消息与图片元数据

若文件已保存但数据库事务失败：

- 尝试删除已写入的临时文件
- 删除失败则记录告警日志，等待后续清理任务处理

## 11. 首版边界

首版包含：

- 中文聊天式图片生成界面
- 图文混合输入
- 会话历史保存
- 图片结果内嵌消息展示
- 单个环境变量 API Key 配置
- 设置页保存单个当前生效的 API Key
- 设置页保存全局 Base URL

首版不包含：

- 用户登录
- 多用户隔离
- 多图上传
- WebSocket 实时流式状态
- 云端对象存储
- 复杂监控看板
- 多 Key 与自动切换
- API Key 密码保护
- 多环境 Base URL 切换

## 12. 推荐目录结构

```text
app/
  api/
    chat/
      sessions/
    images/
      generate/
      edit/
    settings/
      openai-key/
  page.tsx
components/
  chat/
  history/
  settings/
lib/
  db/
  openai/
  storage/
  security/
  validations/
prisma/
  schema.prisma
public/
  uploads/
  generated/
```

## 13. 后续演进方向

- 后续如有需要，可增加设置页密码保护
- 引入对象存储
- 支持登录和多用户隔离
- 支持更多图片参数模板
