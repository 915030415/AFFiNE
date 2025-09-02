# AFFiNE 项目 Vite 配置说明文档

## 概述

AFFiNE 项目采用混合构建策略，主要使用 **Webpack** 作为主要构建工具，同时在特定场景下使用 **Vite** 进行开发和测试。本文档详细说明项目中所有 Vite 相关配置的位置、用途和配置详情。

## Vite 配置文件位置

### 1. 根目录测试配置

#### 📁 `/vitest.config.ts`

**用途**: 项目根目录的 Vitest 测试配置  
**作用范围**: 整个项目的单元测试

```typescript
// 主要配置特性:
- 使用 SWC 编译器进行快速编译
- 支持 TypeScript、JSX、装饰器语法
- 配置 vanilla-extract CSS-in-JS 插件
- 设置测试文件路径和覆盖率报告
- 配置路径别名防止 yjs 版本冲突
```

### 2. BlockSuite 相关配置

#### 📁 `/blocksuite/playground/vite.config.ts`

**用途**: BlockSuite 编辑器开发环境配置  
**作用范围**: 编辑器核心功能开发和调试

```typescript
// 主要配置特性:
- 开发服务器配置 (支持 HMR)
- 多入口点配置 (main, examples/inline)
- 自定义插件: sourcemapExclude、clearSiteDataPlugin
- 支持 WASM 模块
- 代码覆盖率配置 (Istanbul)
- 构建优化: 并行处理、Tree Shaking
```

#### 📁 `/blocksuite/integration-test/vite.config.ts`

**用途**: BlockSuite 集成测试配置  
**作用范围**: 编辑器集成测试环境

```typescript
// 主要配置特性:
- 简化的 Vite 配置用于测试
- 支持 WASM 和 vanilla-extract
- 服务器配置: host: true, allowedHosts: true
- 构建优化配置
```

#### 📁 `/packages/frontend/media-capture-playground/vite.config.ts`

**用途**: 媒体捕获功能开发环境  
**作用范围**: 媒体相关功能开发

```typescript
// 主要配置特性:
- React 插件支持
- TailwindCSS 集成
- API 代理配置 (代理到 localhost:6544)
- 自定义根目录 (./web)
```

### 3. 各模块测试配置

以下是各个 BlockSuite 模块的 Vitest 配置文件:

#### 📁 `/blocksuite/affine/*/vitest.config.ts`

- `/blocksuite/affine/inlines/footnote/vitest.config.ts`
- `/blocksuite/affine/blocks/bookmark/vitest.config.ts`
- `/blocksuite/affine/data-view/vitest.config.ts`
- `/blocksuite/affine/shared/vitest.config.ts`
- `/blocksuite/affine/all/vitest.config.ts`
- `/blocksuite/affine/ext-loader/vitest.config.ts`

#### 📁 `/blocksuite/framework/*/vitest.config.ts`

- `/blocksuite/framework/std/vitest.config.ts`
- `/blocksuite/framework/store/vitest.config.ts`

**共同特性**:

```typescript
// 所有模块测试配置的共同特点:
- 浏览器测试环境 (Playwright + Chromium)
- Istanbul 代码覆盖率
- 自定义控制台日志处理
- 测试超时配置
- 模块特定的覆盖率报告目录
```

## 主要配置特性分析

### 1. 编译器配置

#### SWC 编译器 (根目录)

```typescript
swc.vite({
  jsc: {
    parser: {
      syntax: 'typescript',
      tsx: true,
      decorators: true,
      dynamicImport: true,
    },
    target: 'es2022',
    transform: {
      react: { runtime: 'automatic' },
      decoratorVersion: '2022-03',
    },
  },
});
```

#### ESBuild 配置 (BlockSuite)

```typescript
esbuild: {
  target: 'es2018'; // 或 'es2022'
}
```

### 2. 插件生态

#### 核心插件

- **@vanilla-extract/vite-plugin**: CSS-in-JS 支持
- **vite-plugin-wasm**: WebAssembly 模块支持
- **vite-plugin-istanbul**: 代码覆盖率
- **@vitejs/plugin-react**: React 支持
- **@tailwindcss/vite**: TailwindCSS 支持

#### 自定义插件

- **hmrPlugin**: 热模块替换增强
- **sourcemapExclude**: 排除 node_modules 的 sourcemap
- **clearSiteDataPlugin**: 清除站点数据的开发工具

### 3. 测试配置

#### 浏览器测试环境

```typescript
test: {
  browser: {
    enabled: true,
    headless: true,
    name: 'chromium',
    provider: 'playwright'
  }
}
```

#### 代码覆盖率

```typescript
coverage: {
  provider: 'istanbul',
  reporter: ['lcov'],
  reportsDirectory: './coverage/[module-name]'
}
```

### 4. 开发服务器配置

#### 代理配置

```typescript
proxy: {
  '/api': {
    target: 'http://localhost:6544',
    changeOrigin: true,
    rewrite: path => path.replace(/^/api/, '')
  }
}
```

#### 服务器选项

```typescript
server: {
  host: true,
  allowedHosts: true
}
```

## 构建策略说明

### 主要构建工具: Webpack

AFFiNE 项目主要使用 **自定义 Webpack 配置** 进行构建:

- **位置**: `/tools/cli/src/webpack/`
- **配置文件**: `/tools/cli/src/bundle.ts`
- **支持平台**: Web、Electron、Mobile (iOS/Android)

### Vite 的使用场景

1. **开发环境**: BlockSuite 编辑器开发
2. **测试环境**: 单元测试和集成测试
3. **特定功能**: 媒体捕获等独立模块
4. **原型开发**: Playground 环境

## Webpack 配置详细说明

### 1. Webpack 配置文件结构

#### 📁 `/tools/cli/src/webpack/` 目录结构

```
webpack/
├── index.ts          # 核心 Webpack 配置
├── html-plugin.ts    # HTML 插件配置
├── cache-group.ts    # 缓存组配置
├── s3-plugin.ts      # S3 上传插件
├── template.html     # HTML 模板
├── error-handler.js  # 全局错误处理
├── node-loader.js    # Node 模块加载器
└── types.ts          # 类型定义
```

#### 📁 `/tools/cli/src/bundle.ts`

**用途**: Webpack 构建入口和配置管理  
**作用范围**: 整个项目的构建流程

```typescript
// 主要功能:
- createHTMLTargetConfig: Web 应用构建配置
- createWorkerTargetConfig: Web Worker 构建配置
- createNodeTargetConfig: Node.js 应用构建配置
- defaultDevServerConfig: 开发服务器配置
```

### 2. 三种构建目标配置

#### HTML Target (Web 应用)

```typescript
// 用于构建 Web 应用 (浏览器环境)
export function createHTMLTargetConfig(
  pkg: Package,
  entry: string | Record<string, string>,
  htmlConfig: Partial<CreateHTMLPluginConfig> = {},
  deps?: string[]
): webpack.Configuration

// 主要特性:
- 目标环境: ['web', 'es2022']
- 支持 TypeScript/React (使用 SWC 编译器)
- CSS 处理: vanilla-extract + PostCSS + TailwindCSS
- 资源处理: 图片、字体、SVG 等
- 代码分割和缓存优化
- 生产环境压缩和优化
```

#### Worker Target (Web Worker)

```typescript
// 用于构建 Web Worker
export function createWorkerTargetConfig(
  pkg: Package,
  entry: string
): webpack.Configuration

// 主要特性:
- 目标环境: ['webworker', 'es2022']
- 单文件输出 (maxChunks: 1)
- 不支持代码分割
- 专门的 Worker 环境优化
```

#### Node Target (服务端)

```typescript
// 用于构建 Node.js 应用
export function createNodeTargetConfig(
  pkg: Package,
  entry: string
): webpack.Configuration

// 主要特性:
- 目标环境: ['node', 'es2022']
- 外部依赖处理 (externals)
- 支持 .node 原生模块
- 忽略特定的懒加载模块
```

### 3. 核心插件配置

#### 性能和监控插件

```typescript
// Perfsee 性能监控
new PerfseePlugin({ project: 'affine-toeverything' });

// Sentry 错误监控
sentryWebpackPlugin({
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
```

#### CSS 和样式处理

```typescript
// vanilla-extract CSS-in-JS
new VanillaExtractPlugin();

// CSS 提取和压缩
new MiniCssExtractPlugin({
  filename: `[name].[contenthash:8].css`,
  ignoreOrder: true,
});
```

#### 资源和文件处理

```typescript
// 静态资源复制
new CopyPlugin({
  patterns: [
    {
      from: new Package('@affine/core').join('public').value,
    },
  ],
});

// S3 上传 (生产环境)
new WebpackS3Plugin();
```

### 4. 代码分割策略

#### 生产环境缓存组 (`cache-group.ts`)

```typescript
export const productionCacheGroups = {
  // 国际化文件分离
  i18n: {
    test: /frontend[\/]i18n[\/]/,
    name: module => `i18n-langs.${langName}`,
    priority: 200,
  },

  // 核心库分离
  blocksuite: { name: 'npm-blocksuite', test: /@blocksuite/ },
  react: { name: 'npm-react', test: /react|react-dom/ },
  jotai: { name: 'npm-jotai', test: /jotai/ },
  rxjs: { name: 'npm-rxjs', test: /rxjs/ },

  // 异步模块处理
  asyncVendor: {
    chunks: 'async',
    name: module => `npm-async-${packageName}`,
  },
};
```

### 5. HTML 生成配置

#### HTML 插件功能 (`html-plugin.ts`)

```typescript
// 主要功能:
- 动态 HTML 模板生成
- CDN 路径配置
- 跨域资源处理
- 全局错误处理注入
- 资源清单生成
- Electron 特殊页面支持

// 公共路径配置
export const getPublicPath = (BUILD_CONFIG) => {
  // 开发环境: '/'
  // 生产环境: CDN 地址
  switch (BUILD_TYPE) {
    case 'stable': return 'https://prod.affineassets.com/'
    case 'beta': return 'https://beta.affineassets.com/'
    default: return 'https://dev.affineassets.com/'
  }
}
```

### 6. 编译器配置

#### SWC 编译器配置

```typescript
// TypeScript 文件
{
  test: /\.ts$/,
  loader: 'swc-loader',
  options: {
    jsc: {
      parser: {
        syntax: 'typescript',
        decorators: true,
        dynamicImport: true
      },
      target: 'es2022',
      transform: {
        decoratorVersion: '2022-03'
      }
    }
  }
}

// React TSX 文件
{
  test: /\.tsx$/,
  loader: 'swc-loader',
  options: {
    jsc: {
      transform: {
        react: { runtime: 'automatic' }
      }
    }
  }
}
```

### 7. 开发服务器配置

#### DevServer 配置 (`bundle.ts`)

```typescript
export const defaultDevServerConfig = {
  allowedHosts: 'all',
  proxy: {
    '/api': {
      target: 'http://localhost:3010',
      changeOrigin: true,
    },
    '/socket.io': {
      target: 'http://localhost:3010',
      ws: true,
    },
    '/graphql': {
      target: 'http://localhost:3010',
    },
  },
};
```

### 8. 构建优化配置

#### 生产环境优化

```typescript
optimization: {
  minimize: !buildConfig.debug,
  minimizer: [
    new TerserPlugin({
      minify: TerserPlugin.swcMinify,
      parallel: true,
      terserOptions: {
        compress: { unused: true },
        mangle: { keep_classnames: true }
      }
    })
  ],
  splitChunks: {
    chunks: 'all',
    cacheGroups: productionCacheGroups
  }
}
```

#### 开发环境优化

```typescript
// 开发环境禁用优化以提升构建速度
if (buildConfig.debug && !IN_CI) {
  config.optimization = {
    minimize: false,
    runtimeChunk: false,
    splitChunks: {
      cacheGroups: {
        defaultVendors: {
          test: /node_modules/,
          reuseExistingChunk: true,
        },
      },
    },
  };
}
```

## 如何查看配置文件

### Webpack 配置文件查看

#### 使用命令行查看

```bash
# 查看核心 Webpack 配置
cat tools/cli/src/webpack/index.ts

# 查看构建入口配置
cat tools/cli/src/bundle.ts

# 查看 HTML 插件配置
cat tools/cli/src/webpack/html-plugin.ts

# 查看缓存组配置
cat tools/cli/src/webpack/cache-group.ts

# 查看 S3 插件配置
cat tools/cli/src/webpack/s3-plugin.ts
```

#### 搜索 Webpack 相关配置

```bash
# 搜索所有 Webpack 配置文件
find . -path "*/webpack/*" -name "*.ts" -type f

# 搜索 Webpack 相关依赖
rg "webpack" package.json

# 搜索构建脚本
rg "affine bundle" --type json

# 查看 CLI 工具的 Webpack 依赖
cat tools/cli/package.json | grep webpack
```

### Vite 配置文件查看

#### 使用命令行查看

```bash
# 查看根目录测试配置
cat vitest.config.ts

# 查看 BlockSuite Playground 配置
cat blocksuite/playground/vite.config.ts

# 查看媒体捕获配置
cat packages/frontend/media-capture-playground/vite.config.ts

# 查看特定模块测试配置
cat blocksuite/affine/all/vitest.config.ts
```

#### 搜索 Vite 相关配置

```bash
# 搜索所有 Vite 配置文件
find . -name "vite.config.*" -type f

# 搜索所有 Vitest 配置文件
find . -name "vitest.config.*" -type f

# 使用 ripgrep 搜索配置内容
rg "defineConfig" --type ts
```

### 使用编辑器查看

推荐使用支持 TypeScript 的编辑器 (如 VS Code) 查看配置文件，可以获得:

- 语法高亮
- 类型提示
- 配置项说明
- 跳转到定义

### 构建脚本查看

#### 查看项目构建命令

```bash
# 查看主要构建脚本
cat package.json | grep -A 10 -B 10 "scripts"

# 查看 Web 应用构建脚本
cat packages/frontend/apps/web/package.json | grep "bundle"

# 查看 Electron 应用构建脚本
cat packages/frontend/apps/electron-renderer/package.json | grep "bundle"
```

#### 常用构建命令

```bash
# 开发环境构建
npm run dev

# 生产环境构建
npm run build

# 构建 Web 应用
cd packages/frontend/apps/web && npm run bundle

# 构建 Electron 应用
cd packages/frontend/apps/electron-renderer && npm run bundle
```

## Webpack 配置用途说明

### 1. 多平台构建支持

#### Web 平台

- **目标**: 现代浏览器环境
- **特性**: PWA 支持、CDN 优化、代码分割
- **输出**: 优化的静态资源包

#### Electron 平台

- **目标**: 桌面应用环境
- **特性**: 原生模块支持、文件协议处理
- **输出**: 桌面应用资源包

#### Mobile 平台

- **目标**: iOS/Android 混合应用
- **特性**: 移动端优化、触摸适配
- **输出**: 移动应用资源包

### 2. 构建环境区分

#### 开发环境 (debug: true)

```typescript
// 特性:
- 快速构建 (禁用压缩)
- 详细的 sourcemap
- HMR 热更新支持
- 代理服务器配置
```

#### 生产环境 (debug: false)

```typescript
// 特性:
- 代码压缩和混淆
- 资源优化和缓存
- CDN 部署支持
- 性能监控集成
```

### 3. 构建渠道管理

```typescript
// 支持的构建渠道:
const availableChannels = [
  'canary', // 金丝雀版本 (最新功能)
  'beta', // 测试版本 (稳定测试)
  'stable', // 稳定版本 (生产发布)
  'internal', // 内部版本 (开发测试)
];
```

## 配置优化建议

### 1. Webpack 性能优化

- **编译器**: 使用 SWC 替代 Babel 提升编译速度
- **并行处理**: 启用 TerserPlugin 并行压缩
- **缓存策略**: 合理配置 splitChunks 和 cacheGroups
- **Tree Shaking**: 启用 usedExports 减少包体积
- **外部依赖**: Node 环境使用 externals 减少打包体积

### 2. Vite 性能优化

- 配置并行处理: `maxParallelFileOps`
- 启用 Tree Shaking 减少包体积
- 使用 SWC 替代 Babel 提升编译速度

### 3. 开发体验优化

- **HMR**: Vite 天然支持，Webpack 需要配置
- **Sourcemap**: 开发环境使用 cheap-module-source-map
- **代理配置**: 统一的 API 代理解决跨域问题
- **错误处理**: 全局错误处理和友好的错误提示

### 4. 测试配置优化

- 使用浏览器环境进行真实测试
- 配置代码覆盖率监控
- 设置合理的测试超时时间
- 模块化的测试配置管理

## 总结

AFFiNE 项目采用 **Webpack 主导 + Vite 辅助** 的混合构建策略:

### Webpack 的核心作用

- **生产构建**: 负责所有平台的生产环境打包
- **多目标支持**: Web、Electron、Mobile 三大平台
- **复杂优化**: 代码分割、缓存策略、资源优化
- **插件生态**: 丰富的插件支持 (Sentry、Perfsee、S3 等)
- **构建渠道**: 支持多个发布渠道的差异化构建

### Vite 的辅助作用

- **开发环境**: BlockSuite 编辑器快速开发
- **测试环境**: 单元测试和集成测试
- **特定模块**: 媒体捕获等独立功能模块
- **原型开发**: Playground 快速验证

### 技术优势

#### Webpack 优势

- 成熟稳定的构建生态
- 强大的代码分割和优化能力
- 完善的多平台支持
- 丰富的插件和 loader 生态

#### Vite 优势

- 极快的开发服务器启动
- 原生 ESM 支持
- 现代化的开发体验
- 简洁的配置方式

### 配置文件定位指南

| 配置类型     | 主要文件位置                           | 用途说明         |
| ------------ | -------------------------------------- | ---------------- |
| Webpack 核心 | `tools/cli/src/webpack/index.ts`       | 三种构建目标配置 |
| 构建入口     | `tools/cli/src/bundle.ts`              | 构建流程管理     |
| HTML 生成    | `tools/cli/src/webpack/html-plugin.ts` | HTML 模板和插件  |
| 缓存优化     | `tools/cli/src/webpack/cache-group.ts` | 代码分割策略     |
| Vite 开发    | `blocksuite/playground/vite.config.ts` | 编辑器开发环境   |
| Vite 测试    | `vitest.config.ts`                     | 项目测试配置     |

通过本文档，开发者可以:

1. **快速定位** 相关配置文件
2. **理解构建策略** 和技术选型
3. **掌握优化方法** 提升构建效率
4. **进行配置修改** 满足特定需求

这种混合构建策略充分发挥了两种工具的优势，为 AFFiNE 项目提供了强大而灵活的构建能力。
