# Jotai 和 RxJS 结合 React 使用详细文档

## 概述

本文档详细介绍如何在 React 应用中结合使用 Jotai 和 RxJS，实现高效的状态管理和响应式编程。Jotai 提供了原子化的状态管理，而 RxJS 提供了强大的响应式编程能力，两者结合可以构建出灵活、可维护的现代 React 应用。

## 为什么 AFFiNE 项目使用 LiveData 和 useLiveData 而不直接使用 Jotai 和 RxJS

### 技术选型背景

AFFiNE 项目在状态管理方面采用了自研的 `LiveData` 和 `useLiveData` 解决方案，而不是直接使用 Jotai 和 RxJS 的组合。这个决策基于以下几个关键考虑：

#### 1. **统一的响应式数据模型**

```typescript
// AFFiNE 的 LiveData 方案
// 文件位置: packages/common/infra/src/livedata/livedata.ts
class LiveData<T> extends Observable<T> {
  constructor(private _value: T) {
    super();
  }

  get value(): T {
    return this._value;
  }

  next(value: T): void {
    this._value = value;
    // 自动通知所有订阅者
  }

  // 专为 React 优化的订阅机制
  reactSubscribe = (cb: () => void) => {
    const subscription = this.subscribe(cb);
    return () => subscription.unsubscribe();
  };

  reactGetSnapshot = () => {
    return this._value;
  };
}
```

相比之下，Jotai + RxJS 需要额外的桥接代码：

```typescript
// 使用 Jotai + RxJS 需要的桥接代码
import { atom } from 'jotai';
import { BehaviorSubject } from 'rxjs';

const rxSubject = new BehaviorSubject(0);
const jotaiAtom = atom(0);

// 需要手动同步两个状态系统
rxSubject.subscribe(value => {
  // 手动更新 Jotai atom
});
```

#### 2. **更好的 React 18 集成**

```typescript
// AFFiNE 的 useLiveData 实现
// 文件位置: packages/common/infra/src/livedata/react.ts
export function useLiveData<Input extends LiveData<any> | null | undefined>(liveData: Input): NonNullable<Input> extends LiveData<infer T> ? (Input extends undefined ? T | undefined : Input extends null ? T | null : T) : never {
  return useSyncExternalStore(liveData ? liveData.reactSubscribe : noopSubscribe, liveData ? liveData.reactGetSnapshot : liveData === undefined ? undefinedGetSnapshot : nullGetSnapshot);
}
```

这种实现直接利用了 React 18 的 `useSyncExternalStore`，提供了：

- **并发安全**：支持 React 18 的并发特性
- **自动订阅管理**：组件挂载时订阅，卸载时自动取消订阅
- **性能优化**：只有数据真正变化时才触发重新渲染

#### 3. **框架级别的依赖注入集成**

```typescript
// AFFiNE Framework 中的服务使用 LiveData
// 文件位置: packages/frontend/core/src/modules/workspace/services/workspace.ts
class WorkspaceService extends Service {
  // 使用 LiveData 暴露响应式状态
  readonly workspaces$ = new LiveData<Workspace[]>([]);
  readonly currentWorkspace$ = new LiveData<Workspace | null>(null);
  readonly isLoading$ = new LiveData<boolean>(false);

  // 计算属性也是 LiveData
  readonly hasWorkspaces$ = this.workspaces$.map(workspaces => workspaces.length > 0);

  constructor(
    private storageService: StorageService,
    private syncService: SyncService
  ) {
    super();
    this.loadWorkspaces();
  }

  async createWorkspace(name: string): Promise<Workspace> {
    this.isLoading$.next(true);
    try {
      const workspace = await this.storageService.createWorkspace(name);
      this.workspaces$.next([...this.workspaces$.value, workspace]);
      return workspace;
    } finally {
      this.isLoading$.next(false);
    }
  }
}
```

#### 4. **类型安全和开发体验**

LiveData 提供了完整的 TypeScript 类型推导：

```typescript
// 完整的类型安全
const userService = useService(UserService);
const currentUser = useLiveData(userService.currentUser$); // 类型: User | null
const isLoggedIn = useLiveData(userService.isLoggedIn$); // 类型: boolean
const userName = useLiveData(userService.userName$); // 类型: string
```

#### 5. **内存管理和性能优化**

LiveData 内置了智能的订阅管理：

```typescript
// 自动的内存管理
class DocumentService extends Service {
  private documents = new Map<string, LiveData<Document>>();

  getDocument$(id: string): LiveData<Document> {
    if (!this.documents.has(id)) {
      const doc$ = new LiveData<Document>(null);
      this.documents.set(id, doc$);

      // 当没有订阅者时自动清理
      doc$.subscribe().add(() => {
        if (doc$.observers.length === 0) {
          this.documents.delete(id);
        }
      });
    }
    return this.documents.get(id)!;
  }
}
```

### AFFiNE 项目中的实际应用场景

#### 1. **通知系统**

```typescript
// 文件位置: packages/frontend/component/src/components/notification-center/index.jotai.ts
import { atom } from 'jotai';

// AFFiNE 仍然在某些场景使用 Jotai（主要是 UI 状态）
const notificationsBaseAtom = atom<Notification[]>([]);
const expandNotificationCenterBaseAtom = atom(false);

export const notificationsAtom = atom<Notification[]>(get => get(notificationsBaseAtom));

export const pushNotificationAtom = atom<null, [Notification], void>(null, (_, set, newNotification) => {
  newNotification.key = newNotification.key || nanoid();
  set(notificationsBaseAtom, notifications => [{ ...newNotification }, ...notifications]);
});
```

#### 2. **应用更新管理**

```typescript
// 文件位置: packages/frontend/core/src/components/hooks/use-app-updater.ts
import { atom, useAtom, useAtomValue } from 'jotai';
import { atomWithObservable } from 'jotai/utils';
import { Observable } from 'rxjs';

// 混合使用 Jotai 和 RxJS
const updateMetaAtom = atomWithObservable(() => {
  return new Observable<UpdateMeta>(subscriber => {
    // RxJS Observable 逻辑
  });
});
```

#### 3. **页面列表状态管理**

```typescript
// 文件位置: packages/frontend/core/src/components/page-list/scoped-atoms.tsx
import { atom } from 'jotai';
import { selectAtom } from 'jotai/utils';

// 使用 Jotai 的 selectAtom 进行性能优化
export const listPropsAtom = atom<ListProps<ListItem> & Partial<VirtualizedListProps<ListItem>>>();

const selectionActiveAtom = atom(false);

export const selectionStateAtom = atom(get => {
  const baseAtom = selectAtom(
    listPropsAtom,
    props => {
      const { selectable, selectedIds, onSelectedIdsChange } = props ?? {};
      return { selectable, selectedIds, onSelectedIdsChange };
    },
    shallowEqual
  );
  const baseState = get(baseAtom);
  const selectionActive = baseState.selectable === 'toggle' ? get(selectionActiveAtom) : baseState.selectable;
  return { ...baseState, selectionActive };
});
```

### 总结

AFFiNE 项目采用 LiveData + useLiveData 的原因：

1. **架构一致性**：与 Framework 的依赖注入系统深度集成
2. **性能优化**：专为 React 18 优化，支持并发特性
3. **开发体验**：更好的 TypeScript 支持和类型推导
4. **内存管理**：自动的订阅管理和资源清理
5. **业务适配**：更适合 AFFiNE 的复杂业务场景

同时，AFFiNE 在特定场景下仍然使用 Jotai（如 UI 状态管理）和 RxJS（如复杂的异步数据流），体现了技术选型的灵活性和实用性。

## LiveData/useLiveData 与 Jotai/RxJS 详细对比

### 技术特性对比表

| 对比维度          | LiveData + useLiveData           | Jotai + RxJS              | 说明                                  |
| ----------------- | -------------------------------- | ------------------------- | ------------------------------------- |
| **架构集成**      | ✅ 深度集成 Framework 依赖注入   | ❌ 需要额外桥接代码       | LiveData 与 AFFiNE Framework 无缝集成 |
| **React 18 支持** | ✅ 原生支持 useSyncExternalStore | ⚠️ 需要额外适配           | LiveData 专为 React 18 并发特性优化   |
| **类型安全**      | ✅ 完整 TypeScript 类型推导      | ⚠️ 需要手动类型定义       | LiveData 提供端到端类型安全           |
| **内存管理**      | ✅ 自动订阅管理和清理            | ❌ 需要手动管理订阅       | LiveData 内置智能内存管理             |
| **学习成本**      | ✅ 统一 API，学习成本低          | ❌ 需要掌握两套不同的 API | 单一概念模型 vs 双重概念模型          |
| **性能优化**      | ✅ 内置性能优化                  | ⚠️ 需要手动优化           | LiveData 自动处理重复渲染等问题       |
| **并发安全**      | ✅ 原生并发安全                  | ⚠️ 需要额外处理           | 支持 React 18 并发渲染                |
| **代码复杂度**    | ✅ 代码简洁                      | ❌ 需要更多样板代码       | 减少桥接和同步代码                    |
| **生态系统**      | ⚠️ AFFiNE 专用                   | ✅ 丰富的社区生态         | 权衡：专用 vs 通用                    |
| **调试支持**      | ✅ 集成调试工具                  | ⚠️ 需要分别调试           | 统一的调试体验                        |

### 代码实现对比

#### 1. 基础状态管理

**LiveData 方案：**

```typescript
// 服务中定义
class UserService extends Service {
  readonly currentUser$ = new LiveData<User | null>(null);
  readonly isLoading$ = new LiveData<boolean>(false);
}

// 组件中使用
function UserComponent() {
  const userService = useService(UserService);
  const user = useLiveData(userService.currentUser$);
  const loading = useLiveData(userService.isLoading$);

  return <div>{loading ? 'Loading...' : user?.name}</div>;
}
```

**Jotai + RxJS 方案：**

```typescript
// 需要桥接代码
const userSubject = new BehaviorSubject<User | null>(null);
const userAtom = atom<User | null>(null);
const loadingAtom = atom<boolean>(false);

// 手动同步
userSubject.subscribe(user => {
  // 需要额外的同步逻辑
});

// 组件中使用
function UserComponent() {
  const user = useAtomValue(userAtom);
  const loading = useAtomValue(loadingAtom);

  // 需要手动管理订阅
  useEffect(() => {
    const subscription = userSubject.subscribe(setUser);
    return () => subscription.unsubscribe();
  }, []);

  return <div>{loading ? 'Loading...' : user?.name}</div>;
}
```

#### 2. 计算属性

**LiveData 方案：**

```typescript
class WorkspaceService extends Service {
  readonly workspaces$ = new LiveData<Workspace[]>([]);

  // 自动计算属性
  readonly hasWorkspaces$ = this.workspaces$.map(ws => ws.length > 0);
  readonly workspaceCount$ = this.workspaces$.map(ws => ws.length);
}
```

**Jotai + RxJS 方案：**

```typescript
// 需要分别定义
const workspacesAtom = atom<Workspace[]>([]);
const hasWorkspacesAtom = atom(get => get(workspacesAtom).length > 0);
const workspaceCountAtom = atom(get => get(workspacesAtom).length);

// 还需要 RxJS 的计算逻辑
const workspaces$ = new BehaviorSubject<Workspace[]>([]);
const hasWorkspaces$ = workspaces$.pipe(map(ws => ws.length > 0));
```

#### 3. 异步操作

**LiveData 方案：**

```typescript
class DocumentService extends Service {
  async loadDocument(id: string): Promise<void> {
    this.isLoading$.next(true);
    try {
      const doc = await this.api.getDocument(id);
      this.currentDocument$.next(doc);
    } catch (error) {
      this.error$.next(error.message);
    } finally {
      this.isLoading$.next(false);
    }
  }
}
```

**Jotai + RxJS 方案：**

```typescript
// 需要更复杂的设置
const loadDocumentAtom = atom(null, async (get, set, id: string) => {
  set(loadingAtom, true);
  try {
    const doc = await api.getDocument(id);
    set(documentAtom, doc);
    // 还需要同步到 RxJS
    documentSubject.next(doc);
  } catch (error) {
    set(errorAtom, error.message);
  } finally {
    set(loadingAtom, false);
  }
});
```

### 性能对比

| 性能指标       | LiveData + useLiveData | Jotai + RxJS | 差异说明                  |
| -------------- | ---------------------- | ------------ | ------------------------- |
| **初始化开销** | 低                     | 中等         | LiveData 无需桥接代码     |
| **内存占用**   | 低                     | 高           | 避免双重状态存储          |
| **更新性能**   | 高                     | 中等         | 直接通知，无需同步        |
| **订阅管理**   | 自动                   | 手动         | 自动清理 vs 手动清理      |
| **重复渲染**   | 自动避免               | 需要优化     | 内置 distinctUntilChanged |
| **并发处理**   | 原生支持               | 需要额外处理 | React 18 并发特性         |

### 开发体验对比

| 开发体验       | LiveData + useLiveData | Jotai + RxJS    | 说明            |
| -------------- | ---------------------- | --------------- | --------------- |
| **API 一致性** | ✅ 统一 API            | ❌ 两套不同 API | 学习和使用成本  |
| **类型提示**   | ✅ 完整类型推导        | ⚠️ 部分类型推导 | IDE 支持程度    |
| **错误处理**   | ✅ 统一错误处理        | ❌ 分散错误处理 | 调试和维护难度  |
| **代码可读性** | ✅ 高可读性            | ⚠️ 中等可读性   | 代码理解难度    |
| **重构友好**   | ✅ 重构安全            | ❌ 重构复杂     | 类型安全保障    |
| **测试便利性** | ✅ 易于测试            | ⚠️ 测试复杂     | Mock 和断言难度 |

### 适用场景分析

#### LiveData + useLiveData 适用场景：

1. **企业级应用开发**

   - 需要严格的类型安全
   - 复杂的业务逻辑
   - 长期维护的项目

2. **团队协作项目**

   - 统一的开发规范
   - 降低学习成本
   - 减少代码审查负担

3. **性能敏感应用**
   - 大量状态更新
   - 复杂的计算属性
   - 内存使用敏感

#### Jotai + RxJS 适用场景：

1. **原型开发**

   - 快速验证想法
   - 利用现有生态
   - 短期项目

2. **特定功能模块**

   - 复杂的异步数据流
   - 需要丰富的操作符
   - 与现有 RxJS 代码集成

3. **学习和实验**
   - 了解不同的状态管理方案
   - 技术选型评估
   - 概念验证

### 迁移建议

#### 从 Jotai + RxJS 迁移到 LiveData：

1. **逐步迁移策略**

   ```typescript
   // 第一步：保持现有 Jotai atoms
   const legacyUserAtom = atom<User | null>(null);

   // 第二步：创建 LiveData 包装
   class UserService extends Service {
     readonly user$ = new LiveData<User | null>(null);

     constructor() {
       super();
       // 临时桥接
       this.user$.subscribe(user => {
         // 同步到 legacy atom
       });
     }
   }

   // 第三步：逐步替换组件中的使用
   function UserComponent() {
     // 新代码使用 LiveData
     const userService = useService(UserService);
     const user = useLiveData(userService.user$);

     // 旧代码继续使用 Jotai（逐步替换）
     // const user = useAtomValue(legacyUserAtom);
   }
   ```

2. **类型安全迁移**

   ```typescript
   // 创建类型兼容的接口
   interface LegacyState {
     user: User | null;
     loading: boolean;
   }

   // 提供迁移辅助函数
   function createLiveDataFromAtom<T>(atom: Atom<T>): LiveData<T> {
     // 实现转换逻辑
   }
   ```

### 总结建议

基于以上对比分析，建议：

1. **新项目**：直接使用 LiveData + useLiveData
2. **现有项目**：评估迁移成本，可以采用渐进式迁移
3. **特定场景**：在 UI 状态管理等简单场景可以继续使用 Jotai
4. **复杂数据流**：对于特别复杂的异步数据处理，可以在底层使用 RxJS，上层封装为 LiveData

LiveData + useLiveData 方案在 AFFiNE 项目中体现了更好的架构一致性、开发体验和性能表现，是更适合企业级应用开发的选择。

## 核心概念

### Jotai 核心概念

- **Atom（原子）**: 最小的状态单元，可以被读取和写入
- **Provider**: 提供状态作用域的组件
- **Hooks**: 用于在组件中访问和更新原子状态

### RxJS 核心概念

- **Observable**: 可观察的数据流
- **Observer**: 观察者，订阅 Observable
- **Operators**: 操作符，用于转换和组合数据流
- **Subject**: 既是 Observable 又是 Observer

## 安装和基础设置

### 安装依赖

```bash
npm install jotai rxjs
# 或
yarn add jotai rxjs
```

### 基础配置

```typescript
// types/index.ts
import { Observable } from 'rxjs';
import { Atom } from 'jotai';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppState {
  user: User | null;
  todos: Todo[];
  loading: boolean;
  error: string | null;
}
```

## 基础使用示例

### 1. 创建基础 Atoms

```typescript
// atoms/userAtoms.ts
import { atom } from 'jotai';
import { User } from '../types';

// 基础用户状态原子
export const userAtom = atom<User | null>(null);
export const userLoadingAtom = atom<boolean>(false);
export const userErrorAtom = atom<string | null>(null);

// 派生原子 - 用户是否已登录
export const isLoggedInAtom = atom(get => {
  const user = get(userAtom);
  return user !== null;
});

// 派生原子 - 用户显示名称
export const userDisplayNameAtom = atom(get => {
  const user = get(userAtom);
  return user ? user.name : 'Guest';
});
```

### 2. 创建 RxJS Observables

```typescript
// services/userService.ts
import { Observable, BehaviorSubject, throwError, timer } from 'rxjs';
import { map, catchError, switchMap, retry, shareReplay } from 'rxjs/operators';
import { User } from '../types';

class UserService {
  private userSubject = new BehaviorSubject<User | null>(null);
  public user$ = this.userSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  private errorSubject = new BehaviorSubject<string | null>(null);
  public error$ = this.errorSubject.asObservable();

  // 获取用户信息
  fetchUser(userId: string): Observable<User> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return timer(1000).pipe(
      // 模拟网络延迟
      switchMap(() => this.mockApiCall(userId)),
      map(response => {
        const user = response.data;
        this.userSubject.next(user);
        this.loadingSubject.next(false);
        return user;
      }),
      catchError(error => {
        this.errorSubject.next(error.message);
        this.loadingSubject.next(false);
        return throwError(() => error);
      }),
      retry(2), // 重试2次
      shareReplay(1) // 缓存最新结果
    );
  }

  // 更新用户信息
  updateUser(userId: string, updates: Partial<User>): Observable<User> {
    this.loadingSubject.next(true);

    return timer(500).pipe(
      switchMap(() => this.mockUpdateApiCall(userId, updates)),
      map(response => {
        const updatedUser = response.data;
        this.userSubject.next(updatedUser);
        this.loadingSubject.next(false);
        return updatedUser;
      }),
      catchError(error => {
        this.errorSubject.next(error.message);
        this.loadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  // 登出
  logout(): void {
    this.userSubject.next(null);
    this.errorSubject.next(null);
  }

  // 模拟 API 调用
  private mockApiCall(userId: string): Observable<{ data: User }> {
    return new Observable(observer => {
      // 模拟随机失败
      if (Math.random() < 0.2) {
        observer.error(new Error('Network error'));
        return;
      }

      observer.next({
        data: {
          id: userId,
          name: `User ${userId}`,
          email: `user${userId}@example.com`,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
        },
      });
      observer.complete();
    });
  }

  private mockUpdateApiCall(userId: string, updates: Partial<User>): Observable<{ data: User }> {
    return new Observable(observer => {
      const currentUser = this.userSubject.value;
      if (!currentUser) {
        observer.error(new Error('User not found'));
        return;
      }

      observer.next({
        data: { ...currentUser, ...updates },
      });
      observer.complete();
    });
  }
}

export const userService = new UserService();
```

### 3. 连接 Jotai 和 RxJS

```typescript
// atoms/rxjsAtoms.ts
import { atom } from 'jotai';
import { userService } from '../services/userService';
import { User } from '../types';

// 创建连接 RxJS Observable 的原子
export const rxUserAtom = atom<User | null>(null);
export const rxUserLoadingAtom = atom<boolean>(false);
export const rxUserErrorAtom = atom<string | null>(null);

// 创建订阅管理原子
export const userSubscriptionAtom = atom(null, (get, set) => {
  // 订阅用户数据流
  const userSubscription = userService.user$.subscribe(user => {
    set(rxUserAtom, user);
  });

  const loadingSubscription = userService.loading$.subscribe(loading => {
    set(rxUserLoadingAtom, loading);
  });

  const errorSubscription = userService.error$.subscribe(error => {
    set(rxUserErrorAtom, error);
  });

  // 返回清理函数
  return () => {
    userSubscription.unsubscribe();
    loadingSubscription.unsubscribe();
    errorSubscription.unsubscribe();
  };
});

// 创建操作原子
export const fetchUserAtom = atom(null, (get, set, userId: string) => {
  return userService.fetchUser(userId).toPromise();
});

export const updateUserAtom = atom(null, (get, set, { userId, updates }: { userId: string; updates: Partial<User> }) => {
  return userService.updateUser(userId, updates).toPromise();
});
```

### 4. 自定义 Hook 封装

```typescript
// hooks/useRxJotai.ts
import { useEffect, useCallback } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Observable, Subscription } from 'rxjs';
import { atom } from 'jotai';

// 通用的 RxJS Observable 转 Jotai Atom Hook
export function useObservableAtom<T>(observable: Observable<T>, initialValue: T) {
  const [valueAtom] = useState(() => atom<T>(initialValue));
  const [value, setValue] = useAtom(valueAtom);

  useEffect(() => {
    const subscription = observable.subscribe(setValue);
    return () => subscription.unsubscribe();
  }, [observable, setValue]);

  return value;
}

// 用户相关的自定义 Hook
export function useUser() {
  const user = useAtomValue(rxUserAtom);
  const loading = useAtomValue(rxUserLoadingAtom);
  const error = useAtomValue(rxUserErrorAtom);
  const fetchUser = useSetAtom(fetchUserAtom);
  const updateUser = useSetAtom(updateUserAtom);

  // 初始化订阅
  const initSubscription = useSetAtom(userSubscriptionAtom);

  useEffect(() => {
    const cleanup = initSubscription();
    return cleanup;
  }, [initSubscription]);

  const handleFetchUser = useCallback(
    async (userId: string) => {
      try {
        await fetchUser(userId);
      } catch (error) {
        console.error('Failed to fetch user:', error);
      }
    },
    [fetchUser]
  );

  const handleUpdateUser = useCallback(
    async (userId: string, updates: Partial<User>) => {
      try {
        await updateUser({ userId, updates });
      } catch (error) {
        console.error('Failed to update user:', error);
      }
    },
    [updateUser]
  );

  const logout = useCallback(() => {
    userService.logout();
  }, []);

  return {
    user,
    loading,
    error,
    fetchUser: handleFetchUser,
    updateUser: handleUpdateUser,
    logout,
    isLoggedIn: user !== null,
  };
}
```

## React 组件使用示例

### 1. 用户资料组件

```typescript
// components/UserProfile.tsx
import React, { useState } from 'react';
import { useUser } from '../hooks/useRxJotai';
import { User } from '../types';

interface UserProfileProps {
  userId: string;
}

export const UserProfile: React.FC<UserProfileProps> = ({ userId }) => {
  const { user, loading, error, fetchUser, updateUser, logout } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '' });

  // 组件挂载时获取用户数据
  React.useEffect(() => {
    if (userId && !user) {
      fetchUser(userId);
    }
  }, [userId, user, fetchUser]);

  // 初始化编辑表单
  React.useEffect(() => {
    if (user) {
      setEditForm({ name: user.name, email: user.email });
    }
  }, [user]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (user) {
      await updateUser(user.id, editForm);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setEditForm({ name: user.name, email: user.email });
    }
    setIsEditing(false);
  };

  if (loading) {
    return (
      <div className="user-profile loading">
        <div className="spinner">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-profile error">
        <p>Error: {error}</p>
        <button onClick={() => fetchUser(userId)}>Retry</button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="user-profile empty">
        <p>No user data</p>
        <button onClick={() => fetchUser(userId)}>Load User</button>
      </div>
    );
  }

  return (
    <div className="user-profile">
      <div className="avatar">
        {user.avatar ? (
          <img src={user.avatar} alt={user.name} />
        ) : (
          <div className="avatar-placeholder">{user.name.charAt(0)}</div>
        )}
      </div>

      <div className="user-info">
        {isEditing ? (
          <div className="edit-form">
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Name"
            />
            <input
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
              placeholder="Email"
            />
            <div className="form-actions">
              <button onClick={handleSave} disabled={loading}>Save</button>
              <button onClick={handleCancel}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="display-info">
            <h2>{user.name}</h2>
            <p>{user.email}</p>
            <div className="actions">
              <button onClick={handleEdit}>Edit</button>
              <button onClick={logout} className="logout-btn">Logout</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
```

### 2. 待办事项管理组件

```typescript
// services/todoService.ts
import { Observable, BehaviorSubject, timer } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { Todo } from '../types';

class TodoService {
  private todosSubject = new BehaviorSubject<Todo[]>([]);
  public todos$ = this.todosSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  // 获取待办事项列表
  fetchTodos(): Observable<Todo[]> {
    this.loadingSubject.next(true);

    return timer(800).pipe(
      switchMap(() => this.mockFetchTodos()),
      map(todos => {
        this.todosSubject.next(todos);
        this.loadingSubject.next(false);
        return todos;
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        throw error;
      })
    );
  }

  // 添加待办事项
  addTodo(title: string): Observable<Todo> {
    const newTodo: Todo = {
      id: `todo-${Date.now()}`,
      title,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return timer(300).pipe(
      map(() => {
        const currentTodos = this.todosSubject.value;
        const updatedTodos = [...currentTodos, newTodo];
        this.todosSubject.next(updatedTodos);
        return newTodo;
      })
    );
  }

  // 切换完成状态
  toggleTodo(id: string): Observable<Todo> {
    return timer(200).pipe(
      map(() => {
        const currentTodos = this.todosSubject.value;
        const updatedTodos = currentTodos.map(todo => (todo.id === id ? { ...todo, completed: !todo.completed, updatedAt: new Date() } : todo));
        this.todosSubject.next(updatedTodos);
        return updatedTodos.find(todo => todo.id === id)!;
      })
    );
  }

  // 删除待办事项
  deleteTodo(id: string): Observable<void> {
    return timer(200).pipe(
      map(() => {
        const currentTodos = this.todosSubject.value;
        const updatedTodos = currentTodos.filter(todo => todo.id !== id);
        this.todosSubject.next(updatedTodos);
      })
    );
  }

  private mockFetchTodos(): Observable<Todo[]> {
    return new Observable(observer => {
      const mockTodos: Todo[] = [
        {
          id: '1',
          title: 'Learn Jotai',
          completed: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          title: 'Master RxJS',
          completed: false,
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
        {
          id: '3',
          title: 'Build awesome apps',
          completed: false,
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-03'),
        },
      ];

      observer.next(mockTodos);
      observer.complete();
    });
  }
}

export const todoService = new TodoService();
```

```typescript
// atoms/todoAtoms.ts
import { atom } from 'jotai';
import { todoService } from '../services/todoService';
import { Todo } from '../types';

export const todosAtom = atom<Todo[]>([]);
export const todoLoadingAtom = atom<boolean>(false);

// 派生原子 - 已完成的待办事项
export const completedTodosAtom = atom(get => {
  const todos = get(todosAtom);
  return todos.filter(todo => todo.completed);
});

// 派生原子 - 未完成的待办事项
export const pendingTodosAtom = atom(get => {
  const todos = get(todosAtom);
  return todos.filter(todo => !todo.completed);
});

// 派生原子 - 统计信息
export const todoStatsAtom = atom(get => {
  const todos = get(todosAtom);
  const completed = get(completedTodosAtom);
  const pending = get(pendingTodosAtom);

  return {
    total: todos.length,
    completed: completed.length,
    pending: pending.length,
    completionRate: todos.length > 0 ? (completed.length / todos.length) * 100 : 0,
  };
});

// 订阅管理原子
export const todoSubscriptionAtom = atom(null, (get, set) => {
  const todosSubscription = todoService.todos$.subscribe(todos => {
    set(todosAtom, todos);
  });

  const loadingSubscription = todoService.loading$.subscribe(loading => {
    set(todoLoadingAtom, loading);
  });

  return () => {
    todosSubscription.unsubscribe();
    loadingSubscription.unsubscribe();
  };
});

// 操作原子
export const fetchTodosAtom = atom(null, () => todoService.fetchTodos().toPromise());

export const addTodoAtom = atom(null, (get, set, title: string) => todoService.addTodo(title).toPromise());

export const toggleTodoAtom = atom(null, (get, set, id: string) => todoService.toggleTodo(id).toPromise());

export const deleteTodoAtom = atom(null, (get, set, id: string) => todoService.deleteTodo(id).toPromise());
```

```typescript
// hooks/useTodos.ts
import { useEffect, useCallback } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { todosAtom, todoLoadingAtom, completedTodosAtom, pendingTodosAtom, todoStatsAtom, todoSubscriptionAtom, fetchTodosAtom, addTodoAtom, toggleTodoAtom, deleteTodoAtom } from '../atoms/todoAtoms';

export function useTodos() {
  const todos = useAtomValue(todosAtom);
  const loading = useAtomValue(todoLoadingAtom);
  const completedTodos = useAtomValue(completedTodosAtom);
  const pendingTodos = useAtomValue(pendingTodosAtom);
  const stats = useAtomValue(todoStatsAtom);

  const fetchTodos = useSetAtom(fetchTodosAtom);
  const addTodo = useSetAtom(addTodoAtom);
  const toggleTodo = useSetAtom(toggleTodoAtom);
  const deleteTodo = useSetAtom(deleteTodoAtom);
  const initSubscription = useSetAtom(todoSubscriptionAtom);

  // 初始化订阅
  useEffect(() => {
    const cleanup = initSubscription();
    return cleanup;
  }, [initSubscription]);

  // 获取待办事项
  const handleFetchTodos = useCallback(async () => {
    try {
      await fetchTodos();
    } catch (error) {
      console.error('Failed to fetch todos:', error);
    }
  }, [fetchTodos]);

  // 添加待办事项
  const handleAddTodo = useCallback(
    async (title: string) => {
      if (!title.trim()) return;

      try {
        await addTodo(title.trim());
      } catch (error) {
        console.error('Failed to add todo:', error);
      }
    },
    [addTodo]
  );

  // 切换完成状态
  const handleToggleTodo = useCallback(
    async (id: string) => {
      try {
        await toggleTodo(id);
      } catch (error) {
        console.error('Failed to toggle todo:', error);
      }
    },
    [toggleTodo]
  );

  // 删除待办事项
  const handleDeleteTodo = useCallback(
    async (id: string) => {
      try {
        await deleteTodo(id);
      } catch (error) {
        console.error('Failed to delete todo:', error);
      }
    },
    [deleteTodo]
  );

  return {
    todos,
    completedTodos,
    pendingTodos,
    loading,
    stats,
    fetchTodos: handleFetchTodos,
    addTodo: handleAddTodo,
    toggleTodo: handleToggleTodo,
    deleteTodo: handleDeleteTodo,
  };
}
```

```typescript
// components/TodoApp.tsx
import React, { useState, useEffect } from 'react';
import { useTodos } from '../hooks/useTodos';
import { Todo } from '../types';

export const TodoApp: React.FC = () => {
  const {
    todos,
    completedTodos,
    pendingTodos,
    loading,
    stats,
    fetchTodos,
    addTodo,
    toggleTodo,
    deleteTodo
  } = useTodos();

  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // 组件挂载时获取数据
  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTodoTitle.trim()) {
      await addTodo(newTodoTitle);
      setNewTodoTitle('');
    }
  };

  const getFilteredTodos = () => {
    switch (filter) {
      case 'pending':
        return pendingTodos;
      case 'completed':
        return completedTodos;
      default:
        return todos;
    }
  };

  const filteredTodos = getFilteredTodos();

  return (
    <div className="todo-app">
      <header className="todo-header">
        <h1>Todo App</h1>
        <div className="stats">
          <span>Total: {stats.total}</span>
          <span>Pending: {stats.pending}</span>
          <span>Completed: {stats.completed}</span>
          <span>Progress: {stats.completionRate.toFixed(1)}%</span>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="add-todo-form">
        <input
          type="text"
          value={newTodoTitle}
          onChange={(e) => setNewTodoTitle(e.target.value)}
          placeholder="Add a new todo..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !newTodoTitle.trim()}>
          Add
        </button>
      </form>

      <div className="filter-tabs">
        <button
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          All ({stats.total})
        </button>
        <button
          className={filter === 'pending' ? 'active' : ''}
          onClick={() => setFilter('pending')}
        >
          Pending ({stats.pending})
        </button>
        <button
          className={filter === 'completed' ? 'active' : ''}
          onClick={() => setFilter('completed')}
        >
          Completed ({stats.completed})
        </button>
      </div>

      {loading && <div className="loading">Loading...</div>}

      <div className="todo-list">
        {filteredTodos.map(todo => (
          <TodoItem
            key={todo.id}
            todo={todo}
            onToggle={toggleTodo}
            onDelete={deleteTodo}
          />
        ))}

        {filteredTodos.length === 0 && !loading && (
          <div className="empty-state">
            {filter === 'all' ? 'No todos yet' : `No ${filter} todos`}
          </div>
        )}
      </div>
    </div>
  );
};

// 待办事项组件
interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

const TodoItem: React.FC<TodoItemProps> = ({ todo, onToggle, onDelete }) => {
  return (
    <div className={`todo-item ${todo.completed ? 'completed' : ''}`}>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo.id)}
      />
      <span className="todo-title">{todo.title}</span>
      <span className="todo-date">
        {todo.updatedAt.toLocaleDateString()}
      </span>
      <button
        className="delete-btn"
        onClick={() => onDelete(todo.id)}
        aria-label="Delete todo"
      >
        ×
      </button>
    </div>
  );
};
```

## 高级用法和模式

### 1. 复杂数据流组合

```typescript
// services/analyticsService.ts
import { Observable, combineLatest, interval } from 'rxjs';
import { map, startWith, distinctUntilChanged } from 'rxjs/operators';
import { userService } from './userService';
import { todoService } from './todoService';

class AnalyticsService {
  // 组合多个数据流
  public analytics$ = combineLatest([
    userService.user$,
    todoService.todos$,
    interval(5000).pipe(startWith(0)), // 每5秒更新一次
  ]).pipe(
    map(([user, todos, tick]) => {
      if (!user) return null;

      const completedTodos = todos.filter(t => t.completed);
      const todayTodos = todos.filter(t => t.createdAt.toDateString() === new Date().toDateString());

      return {
        userId: user.id,
        userName: user.name,
        totalTodos: todos.length,
        completedTodos: completedTodos.length,
        todayTodos: todayTodos.length,
        completionRate: todos.length > 0 ? (completedTodos.length / todos.length) * 100 : 0,
        lastUpdated: new Date(),
        tick,
      };
    }),
    distinctUntilChanged((prev, curr) => {
      if (!prev || !curr) return false;
      return prev.totalTodos === curr.totalTodos && prev.completedTodos === curr.completedTodos && prev.todayTodos === curr.todayTodos;
    })
  );

  // 用户活跃度分析
  public userActivity$ = todoService.todos$.pipe(
    map(todos => {
      const now = new Date();
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const recentTodos = todos.filter(t => t.createdAt >= last7Days);
      const monthlyTodos = todos.filter(t => t.createdAt >= last30Days);

      return {
        last7Days: recentTodos.length,
        last30Days: monthlyTodos.length,
        averageDaily: recentTodos.length / 7,
        averageWeekly: monthlyTodos.length / 4,
      };
    })
  );
}

export const analyticsService = new AnalyticsService();
```

### 2. 错误处理和重试机制

```typescript
// utils/rxjsHelpers.ts
import { Observable, throwError, timer } from 'rxjs';
import { retryWhen, mergeMap, finalize } from 'rxjs/operators';

// 智能重试操作符
export function smartRetry<T>(maxRetries: number = 3, delayMs: number = 1000) {
  return (source: Observable<T>) => {
    return source.pipe(
      retryWhen(errors =>
        errors.pipe(
          mergeMap((error, index) => {
            if (index >= maxRetries) {
              return throwError(() => error);
            }

            console.log(`Retry attempt ${index + 1}/${maxRetries} after ${delayMs}ms`);
            return timer(delayMs * Math.pow(2, index)); // 指数退避
          })
        )
      )
    );
  };
}

// 带加载状态的操作符
export function withLoadingState<T>(loadingCallback: (loading: boolean) => void) {
  return (source: Observable<T>) => {
    return new Observable<T>(observer => {
      loadingCallback(true);

      const subscription = source.pipe(finalize(() => loadingCallback(false))).subscribe(observer);

      return () => subscription.unsubscribe();
    });
  };
}
```

### 3. 性能优化技巧

```typescript
// atoms/optimizedAtoms.ts
import { atom } from 'jotai';
import { selectAtom } from 'jotai/utils';
import { todosAtom } from './todoAtoms';

// 使用 selectAtom 进行精确订阅
export const todoCountAtom = selectAtom(
  todosAtom,
  todos => todos.length,
  (a, b) => a === b // 自定义比较函数
);

export const firstTodoAtom = selectAtom(todosAtom, todos => todos[0] || null);

// 分页原子
export const todosPageAtom = atom(1);
export const todosPerPageAtom = atom(10);

export const paginatedTodosAtom = atom(get => {
  const todos = get(todosAtom);
  const page = get(todosPageAtom);
  const perPage = get(todosPerPageAtom);

  const startIndex = (page - 1) * perPage;
  const endIndex = startIndex + perPage;

  return {
    items: todos.slice(startIndex, endIndex),
    totalPages: Math.ceil(todos.length / perPage),
    currentPage: page,
    totalItems: todos.length,
  };
});
```

### 4. 测试策略

```typescript
// __tests__/userService.test.ts
import { TestScheduler } from 'rxjs/testing';
import { userService } from '../services/userService';

describe('UserService', () => {
  let testScheduler: TestScheduler;

  beforeEach(() => {
    testScheduler = new TestScheduler((actual, expected) => {
      expect(actual).toEqual(expected);
    });
  });

  it('should emit user data', () => {
    testScheduler.run(({ cold, expectObservable }) => {
      const mockUser = { id: '1', name: 'Test User', email: 'test@example.com' };

      // 模拟用户数据流
      const user$ = cold('a', { a: mockUser });

      expectObservable(user$).toBe('a', { a: mockUser });
    });
  });
});

// __tests__/userAtoms.test.ts
import { renderHook } from '@testing-library/react';
import { useAtomValue } from 'jotai';
import { userAtom, isLoggedInAtom } from '../atoms/userAtoms';
import { TestProvider } from './testUtils';

describe('User Atoms', () => {
  it('should calculate login status correctly', () => {
    const { result } = renderHook(
      () => {
        const user = useAtomValue(userAtom);
        const isLoggedIn = useAtomValue(isLoggedInAtom);
        return { user, isLoggedIn };
      },
      { wrapper: TestProvider }
    );

    expect(result.current.isLoggedIn).toBe(false);
  });
});
```

## 最佳实践

### 1. 架构原则

- **单一数据源**: 使用 RxJS 服务作为数据的唯一来源
- **响应式优先**: 优先使用 Observable 而不是 Promise
- **原子化状态**: 将状态分解为小的、可组合的原子
- **派生状态**: 使用派生原子计算状态，避免重复计算

### 2. 性能优化

```typescript
// 使用 React.memo 优化组件渲染
const OptimizedComponent = React.memo<Props>(({ data }) => {
  const processedData = useMemo(() => {
    return expensiveComputation(data);
  }, [data]);

  return <div>{processedData}</div>;
});

// 使用 selectAtom 进行精确订阅
const specificDataAtom = selectAtom(
  largeDataAtom,
  (data) => data.specificField
);
```

### 3. 错误处理

```typescript
// 统一错误处理
const withErrorHandling = <T>(source: Observable<T>) => {
  return source.pipe(
    catchError(error => {
      console.error('Operation failed:', error);
      // 发送到错误监控服务
      errorReportingService.report(error);
      return throwError(() => error);
    })
  );
};
```

### 4. 内存管理

```typescript
// 确保正确清理订阅
useEffect(() => {
  const subscription = observable$.subscribe(handler);
  return () => subscription.unsubscribe();
}, []);

// 使用 shareReplay 避免重复请求
const sharedData$ = expensiveOperation$.pipe(shareReplay(1));
```

## 总结

Jotai 和 RxJS 的结合为 React 应用提供了强大的状态管理和响应式编程能力：

### 优势

1. **类型安全**: 完整的 TypeScript 支持
2. **性能优化**: 精确的更新控制和订阅管理
3. **可组合性**: 原子化状态和操作符的灵活组合
4. **可测试性**: 清晰的数据流和依赖关系
5. **开发体验**: 优秀的开发工具和调试支持

### 适用场景

- 复杂的状态管理需求
- 实时数据更新
- 多组件间的状态共享
- 异步操作密集的应用
- 需要精确性能控制的场景

通过遵循本文档的指导和最佳实践，您可以构建出高性能、可维护的现代 React 应用程序。

## LiveData + useLiveData 详细使用方法

### 概述

`LiveData` 和 `useLiveData` 是 AFFiNE Framework 中的核心响应式数据管理解决方案。`LiveData` 是一个继承自 RxJS `Observable` 的响应式数据类，专为 React 应用优化；`useLiveData` 是基于 React 18 `useSyncExternalStore` 构建的 Hook，提供了类型安全、性能优化的状态订阅机制。

### 核心概念

#### LiveData 特性

- **响应式数据流**: 继承 RxJS Observable 的所有能力
- **React 优化**: 专为 React 组件优化的订阅机制
- **类型安全**: 完整的 TypeScript 类型推导
- **内存管理**: 自动的订阅管理和资源清理
- **并发安全**: 支持 React 18 并发特性

#### useLiveData 特性

- **自动订阅**: 组件挂载时自动订阅，卸载时自动取消
- **性能优化**: 只有数据真正变化时才触发重新渲染
- **空值处理**: 安全处理 null 和 undefined 的 LiveData
- **类型推导**: 完整的 TypeScript 类型支持

### 基础 API

#### LiveData 类

```typescript
// 基础构造
class LiveData<T> extends Observable<T> {
  constructor(initialValue: T);

  // 核心属性和方法
  get value(): T; // 获取当前值
  next(value: T): void; // 更新值

  // React 集成方法
  reactSubscribe: (cb: () => void) => () => void;
  reactGetSnapshot: () => T;

  // 操作符方法
  map<U>(fn: (value: T) => U): LiveData<U>;
  filter(predicate: (value: T) => boolean): LiveData<T>;
  distinctUntilChanged(): LiveData<T>;
  throttleTime(duration: number): LiveData<T>;

  // 静态方法
  static from<T>(observable: Observable<T>): LiveData<T>;
  static computed<T>(fn: () => T, deps: LiveData<any>[]): LiveData<T>;
}
```

#### useLiveData Hook

```typescript
function useLiveData<T>(liveData: LiveData<T> | null | undefined): T | null | undefined;
```

### 基础使用示例

#### 1. 创建和使用 LiveData

```typescript
// 在服务中创建 LiveData
class CounterService extends Service {
  // 基础状态
  readonly count$ = new LiveData<number>(0);
  readonly isLoading$ = new LiveData<boolean>(false);

  // 计算属性
  readonly isEven$ = this.count$.map(count => count % 2 === 0);
  readonly doubleCount$ = this.count$.map(count => count * 2);

  // 业务方法
  increment(): void {
    this.count$.next(this.count$.value + 1);
  }

  decrement(): void {
    this.count$.next(this.count$.value - 1);
  }

  async asyncIncrement(): Promise<void> {
    this.isLoading$.next(true);
    try {
      // 模拟异步操作
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.increment();
    } finally {
      this.isLoading$.next(false);
    }
  }
}
```

#### 2. 在 React 组件中使用

```typescript
// 基础使用
function CounterComponent() {
  const counterService = useService(CounterService);
  const count = useLiveData(counterService.count$);
  const isLoading = useLiveData(counterService.isLoading$);
  const isEven = useLiveData(counterService.isEven$);

  return (
    <div>
      <h2>计数器: {count}</h2>
      <p>是否为偶数: {isEven ? '是' : '否'}</p>
      <button
        onClick={() => counterService.increment()}
        disabled={isLoading}
      >
        {isLoading ? '加载中...' : '增加'}
      </button>
      <button
        onClick={() => counterService.decrement()}
        disabled={isLoading}
      >
        减少
      </button>
      <button
        onClick={() => counterService.asyncIncrement()}
        disabled={isLoading}
      >
        异步增加
      </button>
    </div>
  );
}
```

### 高级使用示例

#### 1. 复杂状态管理

```typescript
// 用户管理服务
class UserService extends Service {
  // 基础状态
  readonly currentUser$ = new LiveData<User | null>(null);
  readonly users$ = new LiveData<User[]>([]);
  readonly isLoading$ = new LiveData<boolean>(false);
  readonly error$ = new LiveData<string | null>(null);

  // 计算属性
  readonly isLoggedIn$ = this.currentUser$.map(user => user !== null);
  readonly userCount$ = this.users$.map(users => users.length);
  readonly hasUsers$ = this.userCount$.map(count => count > 0);

  // 过滤和搜索
  readonly searchQuery$ = new LiveData<string>('');
  readonly filteredUsers$ = LiveData.computed(() => {
    const users = this.users$.value;
    const query = this.searchQuery$.value.toLowerCase();
    return users.filter(user => user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query));
  }, [this.users$, this.searchQuery$]);

  constructor(
    private apiService: ApiService,
    private storageService: StorageService
  ) {
    super();
    this.loadCurrentUser();
  }

  async loadCurrentUser(): Promise<void> {
    try {
      const token = this.storageService.getToken();
      if (token) {
        this.isLoading$.next(true);
        const user = await this.apiService.getCurrentUser();
        this.currentUser$.next(user);
      }
    } catch (error) {
      this.error$.next(error.message);
    } finally {
      this.isLoading$.next(false);
    }
  }

  async login(email: string, password: string): Promise<void> {
    this.isLoading$.next(true);
    this.error$.next(null);

    try {
      const { user, token } = await this.apiService.login(email, password);
      this.storageService.setToken(token);
      this.currentUser$.next(user);
    } catch (error) {
      this.error$.next(error.message);
      throw error;
    } finally {
      this.isLoading$.next(false);
    }
  }

  logout(): void {
    this.storageService.removeToken();
    this.currentUser$.next(null);
    this.users$.next([]);
    this.error$.next(null);
  }

  searchUsers(query: string): void {
    this.searchQuery$.next(query);
  }
}
```

#### 2. 组件中的高级使用

```typescript
// 用户列表组件
function UserListComponent() {
  const userService = useService(UserService);

  // 订阅多个 LiveData
  const currentUser = useLiveData(userService.currentUser$);
  const filteredUsers = useLiveData(userService.filteredUsers$);
  const isLoading = useLiveData(userService.isLoading$);
  const error = useLiveData(userService.error$);
  const isLoggedIn = useLiveData(userService.isLoggedIn$);

  // 本地状态
  const [searchInput, setSearchInput] = useState('');

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      userService.searchUsers(searchInput);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, userService]);

  if (!isLoggedIn) {
    return <LoginComponent />;
  }

  return (
    <div className="user-list">
      <header>
        <h2>用户列表</h2>
        <p>当前用户: {currentUser?.name}</p>
      </header>

      <div className="search-bar">
        <input
          type="text"
          placeholder="搜索用户..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {error && (
        <div className="error-message">
          错误: {error}
        </div>
      )}

      {isLoading ? (
        <div className="loading">加载中...</div>
      ) : (
        <div className="user-grid">
          {filteredUsers.map(user => (
            <UserCard key={user.id} user={user} />
          ))}
          {filteredUsers.length === 0 && (
            <div className="empty-state">没有找到用户</div>
          )}
        </div>
      )}
    </div>
  );
}
```

#### 3. 条件订阅和动态 LiveData

```typescript
// 文档服务
class DocumentService extends Service {
  private documents = new Map<string, LiveData<Document | null>>();

  // 获取文档的 LiveData（懒加载）
  getDocument$(documentId: string): LiveData<Document | null> {
    if (!this.documents.has(documentId)) {
      const doc$ = new LiveData<Document | null>(null);
      this.documents.set(documentId, doc$);

      // 异步加载文档
      this.loadDocument(documentId, doc$);
    }

    return this.documents.get(documentId)!;
  }

  private async loadDocument(
    documentId: string,
    doc$: LiveData<Document | null>
  ): Promise<void> {
    try {
      const document = await this.apiService.getDocument(documentId);
      doc$.next(document);
    } catch (error) {
      console.error('Failed to load document:', error);
      // 可以设置错误状态或保持 null
    }
  }
}

// 文档组件 - 条件订阅
function DocumentComponent({ documentId }: { documentId?: string }) {
  const documentService = useService(DocumentService);

  // 条件订阅：只有当 documentId 存在时才订阅
  const document = useLiveData(
    documentId ? documentService.getDocument$(documentId) : null
  );

  if (!documentId) {
    return <div>请选择一个文档</div>;
  }

  if (!document) {
    return <div>加载文档中...</div>;
  }

  return (
    <div className="document">
      <h1>{document.title}</h1>
      <div className="content">{document.content}</div>
    </div>
  );
}
```

### 操作符和工具方法

#### 1. 内置操作符

```typescript
class DataService extends Service {
  readonly rawData$ = new LiveData<number[]>([]);

  // map 操作符
  readonly processedData$ = this.rawData$.map(data => data.map(x => x * 2));

  // filter 操作符
  readonly evenNumbers$ = this.rawData$.map(data => data.filter(x => x % 2 === 0));

  // distinctUntilChanged - 避免重复更新
  readonly uniqueData$ = this.rawData$.distinctUntilChanged();

  // throttleTime - 节流更新
  readonly throttledData$ = this.rawData$.throttleTime(1000);
}
```

#### 2. 组合多个 LiveData

```typescript
class CombinedService extends Service {
  readonly userService = this.framework.get(UserService);
  readonly settingsService = this.framework.get(SettingsService);

  // 使用 computed 组合多个 LiveData
  readonly userProfile$ = LiveData.computed(() => {
    const user = this.userService.currentUser$.value;
    const settings = this.settingsService.userSettings$.value;

    if (!user) return null;

    return {
      ...user,
      preferences: settings,
      displayName: settings.useNickname ? settings.nickname : user.name,
    };
  }, [this.userService.currentUser$, this.settingsService.userSettings$]);
}
```

#### 3. 从 RxJS Observable 创建 LiveData

```typescript
class WebSocketService extends Service {
  private socket = new WebSocket('ws://localhost:8080');

  // 从 RxJS Observable 创建 LiveData
  readonly messages$ = LiveData.from(
    new Observable<string>(subscriber => {
      this.socket.onmessage = event => {
        subscriber.next(event.data);
      };

      this.socket.onerror = error => {
        subscriber.error(error);
      };

      this.socket.onclose = () => {
        subscriber.complete();
      };

      return () => {
        this.socket.close();
      };
    })
  );

  sendMessage(message: string): void {
    this.socket.send(message);
  }
}
```

### 性能优化最佳实践

#### 1. 避免在渲染中创建 LiveData

```typescript
// ❌ 错误：在组件中创建 LiveData
function BadComponent() {
  const data$ = new LiveData(0); // 每次渲染都会创建新的 LiveData
  const value = useLiveData(data$);
  return <div>{value}</div>;
}

// ✅ 正确：在服务中创建 LiveData
class MyService extends Service {
  readonly data$ = new LiveData(0);
}

function GoodComponent() {
  const service = useService(MyService);
  const value = useLiveData(service.data$);
  return <div>{value}</div>;
}
```

#### 2. 使用 useMemo 优化计算

```typescript
function OptimizedComponent() {
  const userService = useService(UserService);
  const users = useLiveData(userService.users$);
  const searchQuery = useLiveData(userService.searchQuery$);

  // 使用 useMemo 缓存计算结果
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  const filteredUsers = useMemo(() => {
    return sortedUsers.filter(user =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [sortedUsers, searchQuery]);

  return (
    <div>
      {filteredUsers.map(user => (
        <UserItem key={user.id} user={user} />
      ))}
    </div>
  );
}
```

#### 3. 条件渲染优化

```typescript
function ConditionalComponent() {
  const userService = useService(UserService);
  const isLoggedIn = useLiveData(userService.isLoggedIn$);

  // 只有在登录时才订阅用户数据
  const currentUser = useLiveData(
    isLoggedIn ? userService.currentUser$ : null
  );

  if (!isLoggedIn) {
    return <LoginForm />;
  }

  return (
    <div>
      <h1>欢迎, {currentUser?.name}!</h1>
      <UserDashboard />
    </div>
  );
}
```

### 错误处理和调试

#### 1. 错误处理模式

```typescript
class ErrorHandlingService extends Service {
  readonly data$ = new LiveData<string | null>(null);
  readonly error$ = new LiveData<Error | null>(null);
  readonly isLoading$ = new LiveData<boolean>(false);

  async loadData(): Promise<void> {
    this.isLoading$.next(true);
    this.error$.next(null);

    try {
      const data = await this.apiService.fetchData();
      this.data$.next(data);
    } catch (error) {
      this.error$.next(error as Error);
      // 可以选择保持之前的数据或清空
      // this.data$.next(null);
    } finally {
      this.isLoading$.next(false);
    }
  }

  clearError(): void {
    this.error$.next(null);
  }
}

// 错误边界组件
function ErrorBoundaryComponent() {
  const service = useService(ErrorHandlingService);
  const data = useLiveData(service.data$);
  const error = useLiveData(service.error$);
  const isLoading = useLiveData(service.isLoading$);

  if (error) {
    return (
      <div className="error-state">
        <h3>出现错误</h3>
        <p>{error.message}</p>
        <button onClick={() => service.clearError()}>
          清除错误
        </button>
        <button onClick={() => service.loadData()}>
          重试
        </button>
      </div>
    );
  }

  if (isLoading) {
    return <div className="loading">加载中...</div>;
  }

  return <div className="data">{data}</div>;
}
```

#### 2. 调试工具

```typescript
// 开发环境下的调试辅助
class DebugService extends Service {
  readonly counter$ = new LiveData<number>(0);

  constructor() {
    super();

    if (process.env.NODE_ENV === 'development') {
      // 添加调试订阅
      this.counter$.subscribe(value => {
        console.log('Counter changed:', value);
      });

      // 添加到全局对象以便在控制台调试
      (window as any).debugService = this;
    }
  }

  increment(): void {
    const newValue = this.counter$.value + 1;
    console.log('Incrementing counter from', this.counter$.value, 'to', newValue);
    this.counter$.next(newValue);
  }
}
```

### 测试

#### 1. 服务测试

```typescript
// 测试 LiveData 服务
describe('CounterService', () => {
  let service: CounterService;

  beforeEach(() => {
    service = new CounterService();
  });

  it('should increment counter', () => {
    expect(service.count$.value).toBe(0);

    service.increment();
    expect(service.count$.value).toBe(1);

    service.increment();
    expect(service.count$.value).toBe(2);
  });

  it('should update computed properties', () => {
    expect(service.isEven$.value).toBe(true); // 0 is even

    service.increment();
    expect(service.isEven$.value).toBe(false); // 1 is odd

    service.increment();
    expect(service.isEven$.value).toBe(true); // 2 is even
  });

  it('should handle async operations', async () => {
    expect(service.isLoading$.value).toBe(false);

    const promise = service.asyncIncrement();
    expect(service.isLoading$.value).toBe(true);

    await promise;
    expect(service.isLoading$.value).toBe(false);
    expect(service.count$.value).toBe(1);
  });
});
```

#### 2. 组件测试

```typescript
// 测试使用 LiveData 的组件
import { render, screen, fireEvent } from '@testing-library/react';
import { TestFramework } from '@affine/framework/testing';

describe('CounterComponent', () => {
  let framework: TestFramework;
  let counterService: CounterService;

  beforeEach(() => {
    framework = new TestFramework();
    counterService = framework.get(CounterService);
  });

  it('should display current count', () => {
    render(
      <FrameworkProvider framework={framework}>
        <CounterComponent />
      </FrameworkProvider>
    );

    expect(screen.getByText('计数器: 0')).toBeInTheDocument();
  });

  it('should increment when button clicked', () => {
    render(
      <FrameworkProvider framework={framework}>
        <CounterComponent />
      </FrameworkProvider>
    );

    fireEvent.click(screen.getByText('增加'));
    expect(screen.getByText('计数器: 1')).toBeInTheDocument();
  });

  it('should show loading state during async operation', async () => {
    render(
      <FrameworkProvider framework={framework}>
        <CounterComponent />
      </FrameworkProvider>
    );

    fireEvent.click(screen.getByText('异步增加'));
    expect(screen.getByText('加载中...')).toBeInTheDocument();

    // 等待异步操作完成
    await screen.findByText('增加');
    expect(screen.getByText('计数器: 1')).toBeInTheDocument();
  });
});
```

### 迁移指南

#### 从 useState 迁移到 LiveData

```typescript
// 之前：使用 useState
function OldComponent() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const increment = () => setCount(c => c + 1);

  return (
    <div>
      <span>{count}</span>
      <button onClick={increment}>+</button>
    </div>
  );
}

// 之后：使用 LiveData
class CounterService extends Service {
  readonly count$ = new LiveData(0);
  readonly loading$ = new LiveData(false);

  increment() {
    this.count$.next(this.count$.value + 1);
  }
}

function NewComponent() {
  const service = useService(CounterService);
  const count = useLiveData(service.count$);
  const loading = useLiveData(service.loading$);

  return (
    <div>
      <span>{count}</span>
      <button onClick={() => service.increment()}>+</button>
    </div>
  );
}
```

#### 从 Context 迁移到 LiveData

```typescript
// 之前：使用 Context
const UserContext = createContext<{
  user: User | null;
  setUser: (user: User | null) => void;
}>({ user: null, setUser: () => {} });

function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
}

// 之后：使用 LiveData Service
class UserService extends Service {
  readonly currentUser$ = new LiveData<User | null>(null);

  setUser(user: User | null) {
    this.currentUser$.next(user);
  }
}

// 不需要 Provider，直接在组件中使用
function UserComponent() {
  const userService = useService(UserService);
  const user = useLiveData(userService.currentUser$);

  return <div>{user?.name}</div>;
}
```

## LiveData 核心方法详解

### 1. map<U>(fn: (value: T) => U): LiveData<U>

**作用**: 将 LiveData 的值通过转换函数映射为新的类型，返回一个新的 LiveData。

**用途**:

- 数据格式转换
- 计算派生属性
- 类型转换

**示例**:

```typescript
class UserService extends Service {
  readonly user$ = new LiveData<User | null>(null);

  // 将用户对象映射为用户名
  readonly userName$ = this.user$.map(user => user?.name || 'Guest');

  // 将用户对象映射为是否为管理员
  readonly isAdmin$ = this.user$.map(user => user?.role === 'admin');

  // 复杂的数据转换
  readonly userDisplayInfo$ = this.user$.map(user => {
    if (!user) return { name: 'Guest', avatar: '/default-avatar.png' };
    return {
      name: user.name,
      avatar: user.avatar || '/default-avatar.png',
      initials: user.name.split(' ').map(n => n[0]).join('').toUpperCase()
    };
  });
}

// 在组件中使用
function UserComponent() {
  const userService = useService(UserService);
  const userName = useLiveData(userService.userName$);
  const isAdmin = useLiveData(userService.isAdmin$);
  const displayInfo = useLiveData(userService.userDisplayInfo$);

  return (
    <div>
      <h1>欢迎, {userName}!</h1>
      {isAdmin && <AdminPanel />}
      <img src={displayInfo.avatar} alt={displayInfo.initials} />
    </div>
  );
}
```

### 2. filter(predicate: (value: T) => boolean): LiveData<T>

**作用**: 根据谓词函数过滤 LiveData 的值，只有满足条件的值才会被发出。

**用途**:

- 条件性数据更新
- 过滤无效数据
- 状态变化控制

**示例**:

```typescript
class NotificationService extends Service {
  readonly allNotifications$ = new LiveData<Notification[]>([]);

  // 只显示未读通知
  readonly unreadNotifications$ = this.allNotifications$.filter(notifications => notifications.some(n => !n.isRead));

  // 只在有重要通知时更新
  readonly importantNotifications$ = this.allNotifications$.filter(notifications => notifications.some(n => n.priority === 'high'));
}

class SearchService extends Service {
  readonly searchQuery$ = new LiveData<string>('');

  // 只有当搜索词长度大于2时才触发搜索
  readonly validSearchQuery$ = this.searchQuery$.filter(query => query.length > 2);

  constructor() {
    super();

    // 监听有效搜索词并执行搜索
    this.validSearchQuery$.subscribe(query => {
      this.performSearch(query);
    });
  }

  private async performSearch(query: string) {
    // 执行搜索逻辑
  }
}
```

### 3. distinctUntilChanged(): LiveData<T>

**作用**: 去除连续重复的值，只有当值真正发生变化时才发出新值。

**用途**:

- 防止重复渲染
- 优化性能
- 避免无效的副作用

**示例**:

```typescript
class FormService extends Service {
  readonly formData$ = new LiveData<FormData>({ name: '', email: '' });

  // 只有当表单数据真正变化时才触发验证
  readonly validatedFormData$ = this.formData$.distinctUntilChanged().map(data => ({
    ...data,
    isValid: this.validateForm(data),
    errors: this.getFormErrors(data),
  }));

  updateField(field: keyof FormData, value: string) {
    const current = this.formData$.value;
    this.formData$.next({ ...current, [field]: value });
  }

  private validateForm(data: FormData): boolean {
    return data.name.length > 0 && data.email.includes('@');
  }

  private getFormErrors(data: FormData): string[] {
    const errors: string[] = [];
    if (!data.name) errors.push('姓名不能为空');
    if (!data.email.includes('@')) errors.push('邮箱格式不正确');
    return errors;
  }
}

// 自定义比较函数的 distinctUntilChanged
class UserListService extends Service {
  readonly users$ = new LiveData<User[]>([]);

  // 只有当用户列表的长度或ID发生变化时才更新
  readonly distinctUsers$ = this.users$.distinctUntilChanged((prev, curr) => {
    if (prev.length !== curr.length) return false;
    return prev.every((user, index) => user.id === curr[index].id);
  });
}
```

### 4. throttleTime(duration: number): LiveData<T>

**作用**: 限制 LiveData 发出值的频率，在指定时间间隔内最多发出一次值。

**用途**:

- 防抖和节流
- 性能优化
- 限制 API 调用频率

**示例**:

```typescript
class SearchService extends Service {
  readonly searchInput$ = new LiveData<string>('');

  // 搜索输入防抖，500ms 内最多触发一次搜索
  readonly throttledSearch$ = this.searchInput$.throttleTime(500);

  constructor() {
    super();

    // 监听节流后的搜索输入
    this.throttledSearch$.subscribe(query => {
      if (query.length > 2) {
        this.performSearch(query);
      }
    });
  }

  updateSearchInput(value: string) {
    this.searchInput$.next(value);
  }

  private async performSearch(query: string) {
    // 执行搜索 API 调用
  }
}

class ScrollService extends Service {
  readonly scrollPosition$ = new LiveData<number>(0);

  // 滚动位置节流，避免过于频繁的更新
  readonly throttledScrollPosition$ = this.scrollPosition$.throttleTime(100);

  constructor() {
    super();

    // 监听滚动事件
    window.addEventListener('scroll', () => {
      this.scrollPosition$.next(window.scrollY);
    });
  }
}

// 在组件中使用
function SearchComponent() {
  const searchService = useService(SearchService);
  const [inputValue, setInputValue] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    // 每次输入都会更新，但搜索会被节流
    searchService.updateSearchInput(value);
  };

  return (
    <input
      type="text"
      value={inputValue}
      onChange={handleInputChange}
      placeholder="搜索..."
    />
  );
}
```

### 5. static from<T>(observable: Observable<T>): LiveData<T>

**作用**: 将 RxJS Observable 转换为 LiveData。

**用途**:

- 集成现有的 RxJS 代码
- 利用 RxJS 的丰富操作符
- 从外部数据源创建 LiveData

**示例**:

```typescript
import { interval, fromEvent, combineLatest } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

class TimerService extends Service {
  // 从 RxJS interval 创建 LiveData
  readonly timer$ = LiveData.from(interval(1000).pipe(map(count => new Date().toLocaleTimeString())));
}

class WebSocketService extends Service {
  private socket = new WebSocket('ws://localhost:8080');

  // 从 WebSocket 事件创建 LiveData
  readonly messages$ = LiveData.from(fromEvent<MessageEvent>(this.socket, 'message').pipe(map(event => JSON.parse(event.data))));

  readonly connectionStatus$ = LiveData.from(combineLatest([fromEvent(this.socket, 'open').pipe(map(() => 'connected')), fromEvent(this.socket, 'close').pipe(map(() => 'disconnected')), fromEvent(this.socket, 'error').pipe(map(() => 'error'))]).pipe(startWith('connecting')));
}

class GeolocationService extends Service {
  // 从浏览器 API 创建 LiveData
  readonly position$ = LiveData.from(
    new Observable<GeolocationPosition>(subscriber => {
      const watchId = navigator.geolocation.watchPosition(
        position => subscriber.next(position),
        error => subscriber.error(error),
        { enableHighAccuracy: true }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    })
  );

  readonly coordinates$ = this.position$.map(pos => ({
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
  }));
}
```

### 6. static computed<T>(fn: () => T, deps: LiveData<any>[]): LiveData<T>

**作用**: 创建一个计算属性 LiveData，当依赖的 LiveData 发生变化时自动重新计算。

**用途**:

- 复杂的派生状态
- 多个数据源的组合
- 自动化的计算逻辑

**示例**:

```typescript
class ShoppingCartService extends Service {
  readonly items$ = new LiveData<CartItem[]>([]);
  readonly discountRate$ = new LiveData<number>(0);
  readonly taxRate$ = new LiveData<number>(0.1);

  // 计算购物车总价
  readonly subtotal$ = LiveData.computed(
    () => {
      const items = this.items$.value;
      return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    },
    [this.items$]
  );

  // 计算折扣金额
  readonly discountAmount$ = LiveData.computed(
    () => {
      const subtotal = this.subtotal$.value;
      const discountRate = this.discountRate$.value;
      return subtotal * discountRate;
    },
    [this.subtotal$, this.discountRate$]
  );

  // 计算税费
  readonly taxAmount$ = LiveData.computed(
    () => {
      const subtotal = this.subtotal$.value;
      const discountAmount = this.discountAmount$.value;
      const taxRate = this.taxRate$.value;
      return (subtotal - discountAmount) * taxRate;
    },
    [this.subtotal$, this.discountAmount$, this.taxRate$]
  );

  // 计算最终总价
  readonly total$ = LiveData.computed(
    () => {
      const subtotal = this.subtotal$.value;
      const discountAmount = this.discountAmount$.value;
      const taxAmount = this.taxAmount$.value;
      return subtotal - discountAmount + taxAmount;
    },
    [this.subtotal$, this.discountAmount$, this.taxAmount$]
  );
}

class UserProfileService extends Service {
  readonly user$ = new LiveData<User | null>(null);
  readonly preferences$ = new LiveData<UserPreferences | null>(null);
  readonly permissions$ = new LiveData<Permission[]>([]);

  // 计算用户的完整配置信息
  readonly userConfig$ = LiveData.computed(
    () => {
      const user = this.user$.value;
      const preferences = this.preferences$.value;
      const permissions = this.permissions$.value;

      if (!user) return null;

      return {
        id: user.id,
        name: user.name,
        theme: preferences?.theme || 'light',
        language: preferences?.language || 'zh-CN',
        canEdit: permissions.some(p => p.action === 'edit'),
        canDelete: permissions.some(p => p.action === 'delete'),
        canAdmin: permissions.some(p => p.action === 'admin')
      };
    },
    [this.user$, this.preferences$, this.permissions$]
  );
}

// 在组件中使用
function ShoppingCartComponent() {
  const cartService = useService(ShoppingCartService);
  const items = useLiveData(cartService.items$);
  const subtotal = useLiveData(cartService.subtotal$);
  const discountAmount = useLiveData(cartService.discountAmount$);
  const taxAmount = useLiveData(cartService.taxAmount$);
  const total = useLiveData(cartService.total$);

  return (
    <div className="shopping-cart">
      <div className="items">
        {items.map(item => (
          <CartItemComponent key={item.id} item={item} />
        ))}
      </div>

      <div className="summary">
        <div>小计: ¥{subtotal.toFixed(2)}</div>
        <div>折扣: -¥{discountAmount.toFixed(2)}</div>
        <div>税费: ¥{taxAmount.toFixed(2)}</div>
        <div className="total">总计: ¥{total.toFixed(2)}</div>
      </div>
    </div>
  );
}
```

### 方法组合使用示例

```typescript
class AdvancedDataService extends Service {
  readonly rawData$ = new LiveData<RawData[]>([]);
  readonly searchQuery$ = new LiveData<string>('');
  readonly sortOrder$ = new LiveData<'asc' | 'desc'>('asc');

  // 组合使用多个方法
  readonly processedData$ = LiveData.computed(() => {
    const data = this.rawData$.value;
    const query = this.searchQuery$.value;
    const order = this.sortOrder$.value;

    return data
      .filter(item => query === '' || item.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => {
        const comparison = a.name.localeCompare(b.name);
        return order === 'asc' ? comparison : -comparison;
      });
  }, [this.rawData$, this.searchQuery$, this.sortOrder$])
    .distinctUntilChanged() // 避免重复计算
    .throttleTime(100); // 限制更新频率

  // 派生状态
  readonly isEmpty$ = this.processedData$.map(data => data.length === 0);
  readonly count$ = this.processedData$.map(data => data.length);
}
```

### 总结

LiveData + useLiveData 提供了一套完整的响应式状态管理解决方案，具有以下优势：

1. **类型安全**: 完整的 TypeScript 支持和类型推导
2. **性能优化**: 基于 React 18 useSyncExternalStore 的高效更新机制
3. **内存管理**: 自动的订阅管理和资源清理
4. **开发体验**: 简洁的 API 和强大的调试支持
5. **架构一致性**: 与 AFFiNE Framework 深度集成
6. **丰富的操作符**: 提供 map、filter、distinctUntilChanged、throttleTime 等实用方法
7. **灵活的数据源**: 支持从 RxJS Observable 创建和计算属性

通过遵循本节的指导和最佳实践，您可以充分利用 LiveData 和 useLiveData 构建高性能、可维护的 React 应用程序。
