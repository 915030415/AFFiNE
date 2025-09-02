# AFFiNE 项目 Framework 框架技术文档

## 概述

AFFiNE 项目采用了自研的依赖注入框架 `@toeverything/infra`，该框架提供了完整的依赖注入、模块管理和作用域管理功能。本文档详细介绍该框架的核心组件、实现原理以及使用方法。

## 框架架构

### 核心文件结构

```
packages/common/infra/src/framework/
├── core/
│   ├── framework.ts          # Framework 核心类
│   ├── provider.ts           # 依赖注入提供者
│   ├── components/
│   │   ├── component.ts      # 基础组件类
│   │   ├── service.ts        # 服务组件
│   │   ├── entity.ts         # 实体组件
│   │   ├── store.ts          # 状态存储组件
│   │   └── scope.ts          # 作用域组件
│   ├── identifier.ts         # 标识符系统
│   ├── event.ts             # 事件系统
│   └── types.ts             # 类型定义
├── react/
│   └── index.tsx            # React 集成
└── __tests__/
    └── framework.spec.ts    # 测试用例
```

## 核心组件详解

### 1. Framework 类

**文件位置**: `packages/common/infra/src/framework/core/framework.ts`

`Framework` 类是整个依赖注入系统的核心，负责管理所有组件的注册、工厂函数和作用域。

#### 核心数据结构

```typescript
export class Framework {
  // 三层嵌套的 Map 结构：作用域 -> 标识符名称 -> 变体 -> 工厂函数
  private readonly components: Map<
    string, // 作用域字符串
    Map<
      string, // 标识符名称
      Map<ComponentVariant, ComponentFactory> // 变体到工厂函数的映射
    >
  > = new Map();
}
```

#### 主要方法

1. **组件注册方法**

   ```typescript
   // 注册服务
   service<T extends Service>(service: Type<T>, deps?: any[]): FrameworkEditor

   // 注册实体
   entity<T extends Entity>(entity: Type<T>, deps?: any[]): FrameworkEditor

   // 注册存储
   store<T extends Store>(store: Type<T>, deps?: any[]): FrameworkEditor

   // 注册接口实现
   impl<T>(identifier: Identifier<T>, implementation: any, deps?: any[]): FrameworkEditor
   ```

2. **提供者创建**
   ```typescript
   provider(
     scope: FrameworkScopeStack = ROOT_SCOPE,
     parent: FrameworkProvider | null = null
   ): FrameworkProvider {
     return new BasicFrameworkProvider(this, scope, parent);
   }
   ```

### 2. 组件基类系统

#### Component 基类

**文件位置**: `packages/common/infra/src/framework/core/components/component.ts`

```typescript
export class Component<Props = {}> {
  readonly framework: FrameworkProvider; // 框架提供者引用
  readonly props: Props; // 组件属性
  protected readonly disposables: (() => void)[] = []; // 清理函数列表

  constructor() {
    // 从构造上下文中获取框架提供者和属性
    if (!CONSTRUCTOR_CONTEXT.current.provider) {
      throw new Error('Component must be created in the context of a provider');
    }
    this.framework = CONSTRUCTOR_CONTEXT.current.provider;
    this.props = CONSTRUCTOR_CONTEXT.current.props;
    CONSTRUCTOR_CONTEXT.current = {};
  }

  dispose() {
    this.disposables.forEach(dispose => dispose());
  }
}
```

#### Service 类

**文件位置**: `packages/common/infra/src/framework/core/components/service.ts`

```typescript
export class Service extends Component {
  readonly __isService = true;
  readonly __injectable = true; // 标记为可注入
}
```

#### Entity 类

**文件位置**: `packages/common/infra/src/framework/core/components/entity.ts`

```typescript
export class Entity<Props = {}> extends Component<Props> {
  readonly __isEntity = true;
}
```

#### Store 类

**文件位置**: `packages/common/infra/src/framework/core/components/store.ts`

```typescript
export class Store extends Component {
  readonly __isStore = true;
  readonly __injectable = true;
}
```

#### Scope 类

**文件位置**: `packages/common/infra/src/framework/core/components/scope.ts`

```typescript
export class Scope<Props = {}> extends Component<Props> {
  readonly __injectable = true;

  // 提供便捷的框架方法访问
  get collection() {
    return this.framework.collection;
  }
  get scope() {
    return this.framework.scope;
  }
  get get() {
    return this.framework.get;
  }
  get getAll() {
    return this.framework.getAll;
  }
  get getOptional() {
    return this.framework.getOptional;
  }
  get createEntity() {
    return this.framework.createEntity;
  }
  get createScope() {
    return this.framework.createScope;
  }
  get emitEvent() {
    return this.framework.emitEvent;
  }
}
```

### 3. 依赖注入系统

#### FrameworkProvider 抽象类

**文件位置**: `packages/common/infra/src/framework/core/provider.ts`

```typescript
export abstract class FrameworkProvider {
  abstract collection: Framework;
  abstract scope: FrameworkScopeStack;
  abstract getRaw(identifier: IdentifierValue, options?: ResolveOptions): any;
  abstract getAllRaw(identifier: IdentifierValue, options?: ResolveOptions): Map<ComponentVariant, any>;
  abstract dispose(): void;
  abstract eventBus: EventBus;

  // 公共接口方法
  get = <T>(identifier: GeneralIdentifier<T>, options?: ResolveOptions): T => {
    return this.getRaw(parseIdentifier(identifier), {
      ...options,
      optional: false,
    });
  };

  getOptional = <T>(identifier: GeneralIdentifier<T>, options?: ResolveOptions): T | undefined => {
    return this.getRaw(parseIdentifier(identifier), {
      ...options,
      optional: true,
    });
  };

  createEntity = <T extends Entity<any>, Props>(identifier: GeneralIdentifier<T>, ...props: Props extends Record<string, never> ? [] : [Props]): T => {
    return this.getRaw(parseIdentifier(identifier), {
      noCache: true,
      sameScope: true,
      props,
    });
  };
}
```

#### BasicFrameworkProvider 实现类

```typescript
export class BasicFrameworkProvider extends FrameworkProvider {
  public readonly cache = new ComponentCachePool(); // 组件缓存池
  public readonly collection: Framework;
  public readonly eventBus: EventBus;
  disposed = false;

  constructor(
    collection: Framework,
    public readonly scope: string[],
    public readonly parent: FrameworkProvider | null
  ) {
    super();
    this.collection = collection;
    this.eventBus = new EventBus(this, this.parent?.eventBus);
  }

  getRaw(identifier: IdentifierValue, options?: ResolveOptions) {
    const resolver = new Resolver(this);
    return resolver.getRaw(identifier, options);
  }
}
```

#### Resolver 解析器

`Resolver` 类负责实际的依赖解析，包括循环依赖检测和递归限制：

```typescript
class Resolver extends FrameworkProvider {
  constructor(
    public readonly provider: BasicFrameworkProvider,
    public readonly depth = 0,
    public readonly stack: IdentifierValue[] = []
  ) {
    super();
  }

  getRaw(identifier: IdentifierValue, options: ResolveOptions = {}) {
    // 1. 从当前作用域获取工厂函数
    const factory = this.provider.collection.getFactory(identifier, this.provider.scope);

    if (!factory) {
      // 2. 如果当前作用域没有，尝试从父作用域获取
      if (this.provider.parent && !sameScope) {
        return this.provider.parent.getRaw(identifier, options);
      }

      // 3. 如果是可选的，返回 undefined
      if (optional) {
        return undefined;
      }

      // 4. 抛出组件未找到异常
      throw new ComponentNotFoundError(identifier);
    }

    const runFactory = () => {
      // 5. 创建新的解析器，用于循环依赖检测
      const nextResolver = this.track(identifier);
      try {
        // 6. 在构造上下文中执行工厂函数
        return withContext(() => factory(nextResolver), {
          provider: this.provider,
          props,
        });
      } catch (err) {
        if (err instanceof ComponentNotFoundError) {
          throw new MissingDependencyError(identifier, err.identifier, this.stack);
        }
        throw err;
      }
    };

    // 7. 根据缓存策略返回结果
    if (noCache) {
      return runFactory();
    }
    return this.provider.cache.getOrInsert(identifier, runFactory);
  }

  // 循环依赖检测
  track(identifier: IdentifierValue): Resolver {
    const depth = this.depth + 1;

    // 递归深度限制（最大 100 层）
    if (depth >= 100) {
      throw new RecursionLimitError();
    }

    // 循环依赖检测
    const circular = this.stack.find(i => i.identifierName === identifier.identifierName && i.variant === identifier.variant);
    if (circular) {
      throw new CircularDependencyError([...this.stack, identifier]);
    }

    return new Resolver(this.provider, depth, [...this.stack, identifier]);
  }
}
```

### 4. 依赖工厂函数

**文件位置**: `packages/common/infra/src/framework/core/framework.ts` (dependenciesToFactory 函数)

```typescript
function dependenciesToFactory(cls: any, deps: any[] = []): ComponentFactory<any> {
  return (provider: FrameworkProvider) => {
    const args = [];

    // 解析每个依赖
    for (const dep of deps) {
      let isAll;
      let identifier;

      // 检查是否是数组依赖（获取所有实现）
      if (Array.isArray(dep)) {
        if (dep.length !== 1) {
          throw new Error('Invalid dependency');
        }
        isAll = true;
        identifier = dep[0];
      } else {
        isAll = false;
        identifier = dep;
      }

      // 获取依赖实例
      if (isAll) {
        args.push(Array.from(provider.getAll(identifier).values()));
      } else {
        args.push(provider.get(identifier));
      }
    }

    // 创建实例
    if (isConstructor(cls)) {
      return new cls(...args, provider);
    } else {
      return cls(...args, provider);
    }
  };
}
```

## React 集成

**文件位置**: `packages/common/infra/src/framework/react/index.tsx`

### Context 提供者

```typescript
export const FrameworkProviderContext = React.createContext<FrameworkProvider>(Framework.EMPTY.provider());
```

### Hooks

```typescript
// 获取框架提供者
export function useFramework(): FrameworkProvider {
  return useContext(FrameworkProviderContext);
}

// 获取单个服务
export function useService<T>(identifier: GeneralIdentifier<T>): T {
  return useContext(FrameworkProviderContext).get(identifier);
}

// 获取多个服务
export function useServices<T extends { [key in string]: GeneralIdentifier<Service> }>(identifiers: T): { [key in Uncapitalize<keyof T>]: IdentifierType<T[Capitalize<key>]> } {
  const provider = useContext(FrameworkProviderContext);
  const services: any = {};

  for (const [key, value] of Object.entries(identifiers)) {
    services[key.charAt(0).toLowerCase() + key.slice(1)] = provider.get(value);
  }

  return services;
}

// 获取可选服务
export function useServiceOptional<T extends Service>(identifier: Type<T>): T | undefined {
  return useContext(FrameworkProviderContext).getOptional(identifier);
}
```

### 根组件

```typescript
export const FrameworkRoot = ({
  framework,
  children,
}: React.PropsWithChildren<{ framework: FrameworkProvider }>) => {
  return (
    <FrameworkProviderContext.Provider value={framework}>
      {children}
    </FrameworkProviderContext.Provider>
  );
};
```

## 实际使用示例

### 1. 基础服务定义

**文件位置**: `packages/frontend/core/src/modules/template-doc/services/template-doc.ts`

```typescript
import { Service } from '@toeverything/infra';
import { TemplateDocList } from '../entities/list';
import { TemplateDocSetting } from '../entities/setting';

export class TemplateDocService extends Service {
  // 创建实体实例
  public readonly list = this.framework.createEntity(TemplateDocList);
  public readonly setting = this.framework.createEntity(TemplateDocSetting);
}
```

### 2. 依赖注入示例

```typescript
// 定义服务
class DatabaseService extends Service {
  connect() {
    console.log('Connected to database');
  }
}

class UserService extends Service {
  constructor(private db: DatabaseService) {
    super();
  }

  getUser(id: string) {
    this.db.connect();
    return { id, name: 'User' };
  }
}

// 注册服务
const framework = new Framework();
framework.service(DatabaseService).service(UserService, [DatabaseService]);

// 使用服务
const provider = framework.provider();
const userService = provider.get(UserService);
const user = userService.getUser('123');
```

### 3. 作用域管理示例

```typescript
// 定义作用域
class WorkspaceScope extends Scope<{ workspaceId: string }> {}
class PageScope extends Scope<{ pageId: string }> {}

// 定义服务
class WorkspaceService extends Service {
  constructor(public workspace: WorkspaceScope) {
    super();
  }

  get workspaceId() {
    return this.workspace.props.workspaceId;
  }
}

class PageService extends Service {
  constructor(
    public workspace: WorkspaceService,
    public page: PageScope
  ) {
    super();
  }
}

// 注册服务
framework.scope(WorkspaceScope).service(WorkspaceService, [WorkspaceScope]).scope(PageScope).service(PageService, [WorkspaceService, PageScope]);

// 使用作用域
const rootProvider = framework.provider();
const workspaceScope = rootProvider.createScope(WorkspaceScope, { workspaceId: 'ws-1' });
const pageScope = workspaceScope.createScope(PageScope, { pageId: 'page-1' });
const pageService = pageScope.get(PageService);
```

### 4. React 组件中使用

**文件位置**: `packages/frontend/core/src/components/providers/current-server-scope.tsx`

```typescript
import { ServersService } from '@affine/core/modules/cloud';
import { GlobalContextService } from '@affine/core/modules/global-context';
import { FrameworkScope, useLiveData, useService } from '@toeverything/infra';

export const CurrentServerScopeProvider = ({ children }: { children: React.ReactNode }) => {
  // 使用 Hook 获取服务
  const globalContext = useService(GlobalContextService).globalContext;
  const serversService = useService(ServersService);

  // 响应式数据
  const currentServerId = useLiveData(globalContext.serverId.$);
  const serverService = useLiveData(
    useMemo(() => {
      if (!currentServerId) return null;
      return serversService.server$(currentServerId);
    }, [currentServerId, serversService])
  );

  if (!serverService) {
    return null;
  }

  return (
    <FrameworkScope scope={serverService.scope}>
      {children}
    </FrameworkScope>
  );
};
```

## 核心特性

### 1. 依赖注入

- **构造函数注入**: 通过构造函数参数自动注入依赖
- **工厂函数**: 支持自定义工厂函数创建复杂对象
- **循环依赖检测**: 自动检测并抛出循环依赖异常
- **可选依赖**: 支持可选依赖注入

### 2. 作用域管理

- **层级作用域**: 支持多层嵌套的作用域结构
- **作用域隔离**: 不同作用域的服务实例相互隔离
- **父子关系**: 子作用域可以访问父作用域的服务
- **属性传递**: 作用域可以携带类型安全的属性

### 3. 生命周期管理

- **自动清理**: 支持 `Symbol.dispose` 自动资源清理
- **手动清理**: 提供 `dispose()` 方法手动清理资源
- **级联清理**: 作用域销毁时自动清理所有子组件

### 4. 类型安全

- **TypeScript 支持**: 完整的 TypeScript 类型定义
- **泛型约束**: 使用泛型确保类型安全
- **编译时检查**: 在编译时检查依赖关系

### 5. 性能优化

- **单例模式**: 默认使用单例模式缓存服务实例
- **懒加载**: 服务在首次使用时才创建
- **缓存池**: 使用缓存池管理组件实例
- **递归限制**: 限制依赖解析的最大深度（100层）

## 错误处理

框架提供了完善的错误处理机制：

1. **ComponentNotFoundError**: 组件未找到
2. **MissingDependencyError**: 缺少依赖
3. **CircularDependencyError**: 循环依赖
4. **DuplicateDefinitionError**: 重复定义
5. **RecursionLimitError**: 递归深度超限

## 最佳实践

### 1. 服务设计

- 保持服务的单一职责
- 避免在服务中直接操作 DOM
- 使用接口定义服务契约

### 2. 依赖管理

- 明确声明所有依赖
- 避免循环依赖
- 使用可选依赖处理非必需的服务

### 3. 作用域使用

- 合理设计作用域层次
- 避免过深的作用域嵌套
- 及时清理不需要的作用域

### 4. React 集成

- 在应用根部提供 FrameworkRoot
- 使用 useService Hook 获取服务
- 避免在 render 函数中创建服务实例

## 总结

AFFiNE 的 Framework 框架提供了一个功能完整、类型安全、性能优化的依赖注入解决方案。通过合理的架构设计和丰富的特性支持，它能够有效地管理复杂应用的依赖关系，提高代码的可维护性和可测试性。框架的模块化设计使得它既可以独立使用，也可以与 React 等前端框架无缝集成。
