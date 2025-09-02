# AFFiNE 项目中文文档

## 项目概述

AFFiNE 是一个开源的、注重隐私的、本地优先的一体化工作空间，是 Notion 和 Miro 的替代方案。它将文档、画布和表格完美融合，为创意工作者提供了一个超融合的平台。

### 核心特点

- **隐私优先**：数据始终掌握在用户手中
- **本地优先**：支持离线工作，数据存储在本地
- **开源**：完全开源，社区驱动
- **多平台支持**：支持 Web、桌面端、移动端
- **实时协作**：支持多人实时协作编辑

## 主要功能

### 1. 真正的画布编辑器

- 将任何构建块放置在无边界画布上
- 支持富文本、便签、嵌入网页、多视图数据库、链接页面、形状和幻灯片
- 文档和白板完全融合

### 2. 多模态 AI 助手

- **AFFiNE AI** 提供强大的 AI 功能
- 支持专业工作报告撰写
- 将大纲转换为表现力强的幻灯片
- 将文章总结为结构化思维导图
- 任务规划和待办事项整理
- **Canvas AI** 用于头脑风暴生成思维导图

### 3. 本地优先 & 实时协作

- 数据始终保存在用户磁盘上
- 支持实时同步和跨平台协作
- 云端和本地数据完美结合

### 4. 自托管 & 定制化

- 支持自托管部署
- 可以 fork 和构建自己的 AFFiNE
- 插件社区和第三方块即将推出

## 技术架构

### 前端技术栈

#### 核心框架

- **React 19.0.0**：主要 UI 框架
- **TypeScript 5.7.2**：类型安全的 JavaScript
- **Lit 3.2.0**：Web Components 框架
- **Vite**：现代前端构建工具

#### 状态管理

- **Jotai**：原子化状态管理
- **@preact/signals-core**：响应式状态管理
- **RxJS**：响应式编程

#### UI 组件库

- **@radix-ui**：无样式 UI 组件
- **@emotion**：CSS-in-JS 样式解决方案
- **@toeverything/theme**：主题系统

#### 编辑器核心

- **BlockSuite**：协作编辑器项目
- **Y.js**：CRDT 实现，支持实时协作
- **@blocksuite/affine**：AFFiNE 特定的编辑器组件

### 后端技术栈

#### 核心框架

- **Node.js**：服务器运行时
- **NestJS**：企业级 Node.js 框架
- **GraphQL**：API 查询语言
- **Apollo Server**：GraphQL 服务器

#### 数据库

- **PostgreSQL**：主数据库
- **Prisma**：数据库 ORM
- **Redis**：缓存和会话存储

#### 认证与安全

- **JWT**：身份验证
- **OAuth**：第三方登录（GitHub 等）
- **Argon2**：密码哈希

#### 消息队列

- **BullMQ**：任务队列管理
- **Socket.IO**：实时通信

#### 监控与追踪

- **OpenTelemetry**：可观测性
- **Prometheus**：指标收集
- **Sentry**：错误追踪

### 移动端技术栈

#### 跨平台框架

- **Capacitor**：混合应用开发框架
- 支持 iOS 和 Android 原生功能

#### 原生模块

- **Rust + NAPI-RS**：高性能原生模块
- **@affine/native**：原生功能绑定

## 项目结构

```
AFFiNE/
├── blocksuite/                 # BlockSuite 编辑器核心
│   ├── affine/                 # AFFiNE 特定组件
│   ├── framework/              # 框架核心
│   └── playground/             # 开发测试环境
├── packages/
│   ├── backend/                # 后端服务
│   │   ├── native/            # Rust 原生模块
│   │   └── server/            # Node.js 服务器
│   ├── common/                 # 共享模块
│   │   ├── debug/             # 调试工具
│   │   ├── env/               # 环境配置
│   │   ├── graphql/           # GraphQL 定义
│   │   ├── infra/             # 基础设施
│   │   └── theme/             # 主题系统
│   └── frontend/               # 前端应用
│       ├── apps/              # 应用入口
│       ├── component/         # UI 组件
│       ├── core/              # 核心逻辑
│       └── native/            # 原生模块
├── tests/                      # 测试文件
├── tools/                      # 开发工具
└── docs/                       # 文档
```

## 开发环境搭建

### 系统要求

- **Node.js**: < 23.0.0 (推荐 LTS 版本)
- **Rust**: 最新稳定版
- **Yarn**: 4.x (现代版本)
- **Git**: 支持符号链接

### 安装步骤

1. **克隆仓库**

```bash
git clone https://github.com/toeverything/AFFiNE
cd AFFiNE
```

2. **设置 Node.js 环境**

```bash
# 启用 corepack
corepack enable
corepack prepare yarn@stable --activate

# 安装依赖
yarn install
```

3. **构建原生依赖**

```bash
# 构建前端原生模块
yarn affine @affine/native build

# 构建服务器原生模块
yarn affine @affine/server-native build
```

4. **启动开发服务器**

```bash
# 启动前端开发服务器
yarn dev

# 或使用简化命令
yarn af dev
```

### 数据库设置

```bash
# 初始化数据库
yarn init

# 运行数据库迁移
yarn prisma migrate dev

# 生成 Prisma 客户端
yarn prisma generate
```

## 部署方案

### Docker 部署

AFFiNE 提供了完整的 Docker 部署方案：

```bash
# 使用 Docker Compose
docker-compose -f .docker/selfhost/compose.yml up -d
```

### 自托管部署

详细的自托管部署指南请参考：[官方文档](https://docs.affine.pro/self-host-affine)

## 核心模块说明

### 1. BlockSuite 编辑器

- **@blocksuite/affine**：AFFiNE 特定的编辑器组件
- **@blocksuite/std**：标准编辑器功能
- **@blocksuite/store**：数据存储和同步
- **@blocksuite/global**：全局工具和类型

### 2. 状态管理

- **@toeverything/infra**：基础设施框架
- 模块化的服务架构
- 依赖注入系统
- 作用域管理

### 3. 数据同步

- **Y.js CRDT**：冲突解决数据类型
- **OctoBase**：本地优先数据库
- **NBStore**：原生数据存储

### 4. AI 集成

- 支持多种 AI 提供商：
  - OpenAI
  - Anthropic
  - Google AI
  - Perplexity
- 模型上下文协议 (MCP) 支持

## 测试

### 运行测试

```bash
# 运行所有测试
yarn test

# 运行 UI 测试
yarn test:ui

# 运行覆盖率测试
yarn test:coverage

# 运行 E2E 测试
yarn e2e
```

### 测试框架

- **Vitest**：单元测试和集成测试
- **AVA**：后端测试
- **Playwright**：E2E 测试

## 代码质量

### 代码检查

```bash
# ESLint 检查
yarn lint:eslint

# Prettier 格式化
yarn lint:prettier

# OXLint 检查
yarn lint:ox

# 修复所有问题
yarn lint:fix
```

### 类型检查

```bash
# TypeScript 类型检查
yarn typecheck
```

## 贡献指南

### 参与方式

1. **Bug 报告**：[创建 Bug 报告](https://github.com/toeverything/AFFiNE/issues/new?template=BUG-REPORT.yml)
2. **功能请求**：[提交功能请求](https://github.com/toeverything/AFFiNE/issues/new?template=FEATURE-REQUEST.yml)
3. **代码贡献**：查看 [贡献指南](docs/CONTRIBUTING.md)
4. **翻译**：访问 [i18n 社区](https://community.affine.pro/c/i18n-general)

### 开发流程

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 创建 Pull Request
5. 代码审查
6. 合并到主分支

## 社区资源

### 官方链接

- **官网**：https://affine.pro
- **在线演示**：https://app.affine.pro
- **文档**：https://docs.affine.pro
- **博客**：https://affine.pro/blog
- **社区**：https://community.affine.pro

### 社交媒体

- **Discord**：https://affine.pro/redirect/discord
- **GitHub**：https://github.com/toeverything/AFFiNE
- **Product Hunt**：获得特色产品

## 许可证

### 版本说明

- **AFFiNE 社区版 (CE)**：MIT 许可证，免费自托管
- **AFFiNE 企业版 (EE)**：即将发布，包含高级功能

### 开源生态

AFFiNE 基于众多优秀的开源项目构建：

- **BlockSuite**：协作编辑器
- **OctoBase**：本地优先数据库
- **React**：UI 框架
- **Electron**：桌面应用
- **Vite**：构建工具

## 模板和资源

### 热门模板

- 愿景板模板
- 单页模板
- 数学课程计划模板
- 数字规划器
- ADHD 规划器
- 阅读日志
- 康奈尔笔记模板

### 博客资源

- AI 作业助手
- 愿景板制作器
- 行程模板
- SWOT 分析模板
- 动态 AI 笔记
- Canvas AI 最佳实践

## 技术支持

### 获取帮助

1. **GitHub Discussions**：技术讨论
2. **Discord 社区**：实时交流
3. **官方文档**：详细指南
4. **社区论坛**：用户交流

### 常见问题

- 查看 [构建文档](docs/BUILDING.md)
- 参考 [故障排除指南](docs/troubleshooting.md)
- 浏览 [FAQ 页面](https://docs.affine.pro/faq)

---

_本文档基于 AFFiNE v0.22.4 版本编写，如有更新请参考官方最新文档。_
