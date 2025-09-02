# AFFiNE 项目 Emotion CSS-in-JS 缓存优化技术文档

## 概述

AFFiNE 项目采用 Emotion CSS-in-JS 库来管理样式，并通过 `CacheProvider` 实现了高效的样式缓存机制。本文档详细介绍了 Emotion 缓存系统的实现原理、优化策略以及在 AFFiNE 项目中的具体应用。

## 技术架构

### 核心组件

1. **@emotion/cache** - 样式缓存核心库
2. **@emotion/react** - React 集成组件
3. **CacheProvider** - 缓存上下文提供者
4. **createEmotionCache** - 自定义缓存创建函数

### 文件结构

```
packages/frontend/
├── core/src/utils/
│   └── create-emotion-cache.ts    # 缓存创建工具
├── apps/web/src/
│   └── app.tsx                    # 应用入口，CacheProvider 使用
└── package.json                   # Emotion 依赖配置

tools/cli/src/webpack/
├── template.html                  # HTML 模板，包含插入点
└── cache-group.ts                 # Webpack 缓存分组配置
```

## 核心实现

### 1. 缓存创建函数

**文件位置**: `packages/frontend/core/src/utils/create-emotion-cache.ts`

```typescript
import createCache from '@emotion/cache';

export default function createEmotionCache() {
  // 查找 HTML 中的 emotion-insertion-point 元标签
  const emotionInsertionPoint = document.querySelector<HTMLMetaElement>('meta[name="emotion-insertion-point"]');
  const insertionPoint = emotionInsertionPoint ?? undefined;

  // 创建 Emotion 缓存实例
  return createCache({
    key: 'affine', // 缓存键名，用于区分不同应用
    insertionPoint, // 样式插入点，控制 CSS 插入位置
  });
}
```

#### 关键参数说明

- **key**: `'affine'` - 缓存标识符，用于：

  - 区分不同应用的样式缓存
  - 生成唯一的 CSS 类名前缀
  - 避免样式冲突

- **insertionPoint**: 样式插入点，用于：
  - 控制生成的 CSS 在 DOM 中的插入位置
  - 确保样式优先级的正确性
  - 提高样式渲染性能

### 2. HTML 插入点配置

**文件位置**: `tools/cli/src/webpack/template.html`

```html
<!DOCTYPE html>
<html>
  <head>
    <!-- 其他 meta 标签 -->
    <meta name="emotion-insertion-point" content="" />
    <!-- 后续的 meta 标签和样式 -->
  </head>
  <body>
    <!-- 应用内容 -->
  </body>
</html>
```

#### 插入点作用

1. **样式顺序控制**: 确保 Emotion 生成的样式在特定位置插入
2. **优先级管理**: 避免样式被其他 CSS 覆盖
3. **性能优化**: 减少 DOM 操作，提高渲染效率

### 3. 应用级别集成

**文件位置**: `packages/frontend/apps/web/src/app.tsx`

```typescript
// 导入 Emotion 相关组件
import createEmotionCache from '@affine/core/utils/create-emotion-cache';
import { CacheProvider } from '@emotion/react';

// 创建全局缓存实例（应用启动时执行一次）
const cache = createEmotionCache();

// 应用根组件
export function App() {
  return (
    <Suspense>
      {/* 框架依赖注入 */}
      <FrameworkRoot framework={frameworkProvider}>
        {/* Emotion 缓存提供者 - 为整个应用提供样式缓存上下文 */}
        <CacheProvider value={cache}>
          {/* 国际化提供者 */}
          <I18nProvider>
            {/* AFFiNE 应用上下文 */}
            <AffineContext store={getCurrentStore()}>
              {/* 路由提供者 */}
              <RouterProvider
                fallbackElement={<AppContainer fallback />}
                router={router}
                future={future}
              />
            </AffineContext>
          </I18nProvider>
        </CacheProvider>
      </FrameworkRoot>
    </Suspense>
  );
}
```

#### 组件层次结构

```
App
├── Suspense (异步加载处理)
│   └── FrameworkRoot (依赖注入框架)
│       └── CacheProvider (Emotion 缓存上下文) ← 关键层级
│           └── I18nProvider (国际化)
│               └── AffineContext (应用状态)
│                   └── RouterProvider (路由管理)
```

## 缓存优化机制

### 1. 样式缓存策略

#### 缓存键生成

```typescript
// Emotion 内部缓存键生成逻辑（简化版）
function generateCacheKey(styles: string, key: string): string {
  return `${key}-${hash(styles)}`;
}

// 示例：
// key: 'affine'
// styles: 'color: red; font-size: 14px;'
// 生成: 'affine-abc123'
```

#### 缓存存储结构

```typescript
interface EmotionCache {
  key: string; // 缓存标识符
  sheet: StyleSheet; // 样式表实例
  nonce?: string; // CSP nonce
  inserted: Record<string, boolean>; // 已插入样式记录
  registered: Record<string, string>; // 已注册样式映射
}
```

### 2. 性能优化特性

#### 样式去重

```typescript
// 相同样式只会生成一次 CSS 类名
const style1 = css`
  color: red;
`; // 生成: affine-abc123
const style2 = css`
  color: red;
`; // 复用: affine-abc123
```

#### 懒加载插入

```typescript
// 只有当组件实际渲染时，样式才会被插入到 DOM
function MyComponent() {
  const dynamicStyle = css`
    color: ${props.color};
    font-size: ${props.size}px;
  `;

  return <div className={dynamicStyle}>Content</div>;
}
```

#### 批量更新

```typescript
// Emotion 会批量处理样式更新，减少 DOM 操作
function BatchStyleUpdate() {
  const styles = useMemo(() => [
    css`color: red;`,
    css`font-size: 14px;`,
    css`margin: 10px;`
  ], []);

  // 所有样式会在一次 DOM 操作中插入
  return <div className={styles.join(' ')}>Content</div>;
}
```

### 3. Webpack 缓存分组优化

**文件位置**: `tools/cli/src/webpack/cache-group.ts`

```typescript
export const cacheGroups = {
  // Emotion 相关库单独分组，提高缓存效率
  emotion: {
    name: `npm-emotion`,
    test: testPackageName(/[\/]node_modules[\/](@emotion)[\/]/),
    priority: 200, // 高优先级
    enforce: true, // 强制分组
  },

  // 样式文件单独分组
  styles: {
    name: 'styles',
    test: (module: any) => module.nameForCondition && module.nameForCondition()?.endsWith('.css') && !module.type.startsWith('javascript'),
    chunks: 'all' as const,
    minSize: 1,
    minChunks: 1,
    reuseExistingChunk: true,
    priority: 1000, // 最高优先级
    enforce: true,
  },
};
```

## 实际应用示例

### 1. 基础样式使用

```typescript
import { css } from '@emotion/css';
import { cssVar } from '@toeverything/theme';

// 静态样式（编译时优化）
const containerStyle = css`
  display: flex;
  flex-direction: column;
  padding: 16px;
  background-color: ${cssVar('backgroundPrimaryColor')};
`;

// 动态样式（运行时缓存）
const dynamicStyle = (isActive: boolean) => css`
  color: ${isActive ? cssVar('primaryColor') : cssVar('textSecondaryColor')};
  font-weight: ${isActive ? 600 : 400};
`;

function MyComponent({ isActive }: { isActive: boolean }) {
  return (
    <div className={containerStyle}>
      <span className={dynamicStyle(isActive)}>Dynamic Content</span>
    </div>
  );
}
```

### 2. 主题变量集成

```typescript
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

// 使用主题变量的样式（支持主题切换）
export const themeAwareStyle = style({
  backgroundColor: cssVarV2('layer/background/primary'),
  color: cssVarV2('text/primary'),
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,

  // 响应式设计
  '@media': {
    'screen and (max-width: 768px)': {
      padding: '8px',
      fontSize: '14px',
    },
  },

  // 交互状态
  ':hover': {
    backgroundColor: cssVarV2('layer/background/hoverOverlay'),
  },

  // 选择器嵌套
  selectors: {
    '&[data-active="true"]': {
      borderColor: cssVarV2('layer/insideBorder/primaryBorder'),
    },
  },
});
```

### 3. 复杂组件样式管理

```typescript
// 文件：packages/frontend/core/src/components/comment/sidebar/style.css.ts
import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

// 容器样式
export const container = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  paddingBottom: '64px',
  position: 'relative',
  minHeight: '100%',
});

// 评论项样式（包含复杂的状态管理）
export const commentItem = style({
  padding: '12px',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',

  // 悬停效果
  ':hover': {
    backgroundColor: cssVarV2('layer/background/hoverOverlay'),
  },

  // 复杂选择器
  selectors: {
    // 高亮状态
    '&[data-highlighting="true"]:before': {
      content: '',
      display: 'block',
      width: '2px',
      height: '100%',
      backgroundColor: cssVarV2('layer/insideBorder/primaryBorder'),
      position: 'absolute',
      top: '0',
      left: '0',
    },

    // 高亮背景
    '&[data-highlighting="true"]': {
      backgroundColor: cssVarV2('block/comment/hanelActive'),
    },

    // 已解决状态
    '&[data-resolved="true"]': {
      opacity: 0.5,
    },
  },
});
```

## 性能监控与优化

### 1. 缓存命中率监控

```typescript
// 开发环境下的缓存监控
if (process.env.NODE_ENV === 'development') {
  const originalCreateCache = createCache;

  function monitoredCreateCache(options: any) {
    const cache = originalCreateCache(options);
    const originalInsert = cache.insert;

    let hitCount = 0;
    let missCount = 0;

    cache.insert = function (rule: string) {
      if (cache.inserted[rule]) {
        hitCount++;
        console.log(`Cache hit: ${rule}, hit rate: ${hitCount / (hitCount + missCount)}`);
      } else {
        missCount++;
        console.log(`Cache miss: ${rule}`);
      }

      return originalInsert.call(this, rule);
    };

    return cache;
  }
}
```

### 2. 样式大小优化

```typescript
// 样式压缩和优化
const optimizedStyles = {
  // 使用简写属性
  margin: '10px 15px', // 而不是分别设置 marginTop, marginRight 等

  // 合并相似样式
  ...commonTextStyles,

  // 避免重复的样式定义
  ...(isActive && activeStyles),
};

// 公共样式提取
const commonTextStyles = {
  fontFamily: 'var(--affine-font-family)',
  fontSize: 'var(--affine-font-size-base)',
  lineHeight: '1.5',
};

const activeStyles = {
  color: cssVarV2('text/primary'),
  fontWeight: 600,
};
```

### 3. 运行时性能优化

```typescript
// 使用 useMemo 缓存样式计算
function OptimizedComponent({ theme, size, isActive }: Props) {
  const computedStyles = useMemo(() => {
    return css`
      background-color: ${theme.backgroundColor};
      font-size: ${size}px;
      color: ${isActive ? theme.activeColor : theme.textColor};
    `;
  }, [theme, size, isActive]);

  return <div className={computedStyles}>Content</div>;
}

// 样式对象缓存
const styleCache = new Map<string, string>();

function getCachedStyle(key: string, styleFactory: () => string): string {
  if (!styleCache.has(key)) {
    styleCache.set(key, styleFactory());
  }
  return styleCache.get(key)!;
}
```

## 最佳实践

### 1. 样式组织

```typescript
// ✅ 推荐：按功能模块组织样式文件
src/
├── components/
│   ├── button/
│   │   ├── button.tsx
│   │   └── button.css.ts        # 组件专用样式
│   └── modal/
│       ├── modal.tsx
│       └── modal.css.ts
├── styles/
│   ├── common.css.ts            # 公共样式
│   ├── animations.css.ts        # 动画样式
│   └── layouts.css.ts           # 布局样式
```

### 2. 样式命名

```typescript
// ✅ 推荐：使用描述性的样式名称
export const primaryButton = style({
  backgroundColor: cssVarV2('button/primary'),
  color: cssVarV2('button/pureWhiteText'),
});

export const dangerButton = style({
  backgroundColor: cssVarV2('button/error'),
  color: cssVarV2('button/pureWhiteText'),
});

// ❌ 避免：使用无意义的名称
export const btn1 = style({
  /* ... */
});
export const redBtn = style({
  /* ... */
});
```

### 3. 性能优化

```typescript
// ✅ 推荐：提取静态样式
const staticStyles = style({
  display: 'flex',
  alignItems: 'center',
  padding: '8px 16px',
});

// ✅ 推荐：动态样式使用函数
const dynamicStyles = (variant: 'primary' | 'secondary') => style({
  backgroundColor: variant === 'primary'
    ? cssVarV2('button/primary')
    : cssVarV2('button/secondary'),
});

// ❌ 避免：在渲染函数中创建样式
function BadComponent() {
  const styles = style({  // 每次渲染都会重新创建
    color: 'red',
  });

  return <div className={styles}>Content</div>;
}
```

### 4. 主题集成

```typescript
// ✅ 推荐：使用主题变量
const themeAwareStyle = style({
  backgroundColor: cssVarV2('layer/background/primary'),
  color: cssVarV2('text/primary'),

  // 支持暗色模式自动切换
  '@media': {
    '(prefers-color-scheme: dark)': {
      // 暗色模式特定样式（如果需要）
    },
  },
});

// ❌ 避免：硬编码颜色值
const hardcodedStyle = style({
  backgroundColor: '#ffffff', // 不支持主题切换
  color: '#000000',
});
```

## 故障排查

### 1. 常见问题

#### 样式不生效

```typescript
// 检查 CacheProvider 是否正确配置
function App() {
  return (
    <CacheProvider value={cache}>  {/* 确保 cache 实例存在 */}
      <YourComponent />
    </CacheProvider>
  );
}

// 检查样式是否正确应用
function YourComponent() {
  const styles = css`color: red;`;

  // 确保 className 正确设置
  return <div className={styles}>Content</div>;
}
```

#### 样式优先级问题

```typescript
// 使用 !important 或提高选择器权重
const highPriorityStyle = style({
  color: `${cssVarV2('text/primary')} !important`,

  // 或者使用更具体的选择器
  selectors: {
    '&.specific-class': {
      color: cssVarV2('text/primary'),
    },
  },
});
```

#### 缓存失效

```typescript
// 清除缓存（开发环境）
if (process.env.NODE_ENV === 'development') {
  // 清除样式缓存
  cache.sheet.flush();

  // 重新创建缓存实例
  const newCache = createEmotionCache();
}
```

### 2. 调试工具

```typescript
// 开发环境调试信息
if (process.env.NODE_ENV === 'development') {
  // 显示生成的类名
  console.log(
    'Generated class:',
    css`
      color: red;
    `
  );

  // 显示缓存状态
  console.log('Cache info:', {
    key: cache.key,
    inserted: Object.keys(cache.inserted).length,
    registered: Object.keys(cache.registered).length,
  });
}
```

## 总结

AFFiNE 项目通过精心设计的 Emotion CSS-in-JS 缓存系统实现了以下优化效果：

### 性能优势

1. **样式缓存**: 相同样式只生成一次，避免重复计算
2. **懒加载**: 样式按需插入，减少初始加载时间
3. **批量更新**: 减少 DOM 操作次数，提高渲染性能
4. **代码分割**: Webpack 层面的缓存分组优化

### 开发体验

1. **类型安全**: TypeScript 支持，编译时检查
2. **主题集成**: 无缝支持主题切换
3. **调试友好**: 开发环境下的详细调试信息
4. **维护性**: 模块化的样式组织结构

### 扩展性

1. **插件系统**: 支持自定义 Emotion 插件
2. **缓存策略**: 可配置的缓存行为
3. **性能监控**: 内置的性能分析工具
4. **向后兼容**: 渐进式升级路径

通过这套完整的缓存优化方案，AFFiNE 项目在保持开发效率的同时，实现了出色的运行时性能表现。
