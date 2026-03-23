# 快速启动指南

## 1. 配置后端环境变量

复制环境变量示例文件：
```bash
cp packages/backend/.env.example packages/backend/.env
```

编辑 `packages/backend/.env`，填入你的 Gemini API Key：
```
GEMINI_API_KEY=your_actual_api_key
```

## 2. 启动项目

```bash
pnpm dev
```

这会同时启动前端和后端服务：
- 前端: http://localhost:5173
- 后端: http://localhost:3000

## 3. 测试功能

打开浏览器访问 http://localhost:5173，你应该能看到一个空白的画布。

当前实现的核心功能：
- React Flow 画布
- 节点卡片组件（支持 Markdown 渲染）
- 文本划线选择
- 后端 LLM 集成（Gemini）

## 下一步

需要添加初始节点创建功能，让用户可以：
1. 输入 prompt 生成第一个节点
2. 在节点中划线文本来扩展新节点
