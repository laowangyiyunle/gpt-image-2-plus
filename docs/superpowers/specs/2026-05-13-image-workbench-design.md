# Image Workbench Design

## Goal

把图片生成主体验从“聊天流里发消息”改成“创作工作台 + 结果画廊”。用户仍然可以保留会话历史和继续细化能力，但主要操作入口固定在创作面板中，生成结果以图片网格优先呈现。

## Scope

- 保留现有 Next.js App Router、SQLite、本地图片存储和图片生成接口。
- 不改 OpenAI 调用、任务轮询、模板持久化、下载、预览和失败重试后端。
- 前端主界面调整为左侧历史、中间结果画廊、右侧创作面板。
- 聊天消息流降级为“生成记录”，用于查看 prompt、进度、失败和删除。

## Experience

主区域先显示图片结果。每张生成图展示缩略图、来源提示词、生成时间和常用动作：预览、下载、重新生成、继续细化、设为模板。右侧创作面板固定展示提示词、参考图、尺寸、质量、张数、提示词优化、模板选择和生成按钮。

当当前会话还没有结果时，画廊显示简短空状态，引导用户在右侧创作面板开始生成。生成中或失败的消息仍然出现在生成记录里，避免隐藏任务状态。

## Architecture

- `lib/gallery-results.ts` 从 `ChatMessage[]` 中提取可展示的生成结果，保持 UI 组件简单。
- 新增 `ImageResultGallery` 组件负责画廊展示和图片动作。
- `ChatComposer` 继续复用原生成表单逻辑，但作为工作台侧栏中的创作面板渲染。
- `MessageList` 保留为生成记录，放在画廊下方的次级区域。

## Verification

- 新增纯逻辑测试覆盖：只展示 assistant 成功消息中的 generated 图片，并绑定最近的用户 prompt。
- 跑 `npm run test:validations`、`npm run typecheck`、`npm run build`。
