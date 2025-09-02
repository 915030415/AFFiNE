# AFFiNE Framework Web端 React 使用指南

## 概述

AFFiNE Framework 是一个基于依赖注入（DI）和作用域管理的现代前端框架，专为大型 React 应用程序设计。本文档将详细介绍如何在 Web 端结合 React 使用 Framework 库，包括作用域、服务、实体和响应式数据的实际应用。

## 核心概念

### 1. 作用域 (Scope)

作用域用于管理服务的生命周期和依赖关系，提供隔离的服务容器。

### 2. 服务 (Service)

服务是业务逻辑的载体，通过依赖注入进行管理。

### 3. 实体 (Entity)

实体代表业务对象，通常包含数据和相关操作。

### 4. 响应式数据 (LiveData)

基于 RxJS 的响应式数据系统，支持自动更新和订阅。

## 完整使用示例

### 1. 定义实体类

```typescript
// entities/UserEntity.ts
import { Entity } from '@toeverything/infra';
import { LiveData } from '@toeverything/infra';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export class UserEntity extends Entity {
  public readonly id: string;
  public readonly profile$ = new LiveData<UserProfile | null>(null);
  public readonly isLoading$ = new LiveData<boolean>(false);
  public readonly error$ = new LiveData<string | null>(null);

  constructor(id: string) {
    super();
    this.id = id;
  }

  // 更新用户资料
  updateProfile(profile: Partial<UserProfile>) {
    const current = this.profile$.value;
    if (current) {
      this.profile$.next({ ...current, ...profile });
    }
  }

  // 设置加载状态
  setLoading(loading: boolean) {
    this.isLoading$.next(loading);
  }

  // 设置错误信息
  setError(error: string | null) {
    this.error$.next(error);
  }
}
```

### 2. 定义服务类

```typescript
// services/UserService.ts
import { Service } from '@toeverything/infra';
import { LiveData } from '@toeverything/infra';
import { UserEntity, UserProfile } from '../entities/UserEntity';

export class UserService extends Service {
  private users = new Map<string, UserEntity>();
  public readonly currentUser$ = new LiveData<UserEntity | null>(null);
  public readonly userList$ = new LiveData<UserEntity[]>([]);

  // 获取或创建用户实体
  getUser(id: string): UserEntity {
    if (!this.users.has(id)) {
      const user = new UserEntity(id);
      this.users.set(id, user);
      this.updateUserList();
    }
    return this.users.get(id)!;
  }

  // 设置当前用户
  setCurrentUser(userId: string) {
    const user = this.getUser(userId);
    this.currentUser$.next(user);
  }

  // 从服务器加载用户数据
  async loadUserProfile(userId: string): Promise<UserProfile> {
    const user = this.getUser(userId);
    user.setLoading(true);
    user.setError(null);

    try {
      // 模拟 API 调用
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) {
        throw new Error('Failed to load user profile');
      }

      const profile: UserProfile = await response.json();
      user.profile$.next(profile);
      user.setLoading(false);

      return profile;
    } catch (error) {
      user.setError(error instanceof Error ? error.message : 'Unknown error');
      user.setLoading(false);
      throw error;
    }
  }

  // 更新用户资料
  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<void> {
    const user = this.getUser(userId);
    user.setLoading(true);

    try {
      // 模拟 API 调用
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update user profile');
      }

      const updatedProfile: UserProfile = await response.json();
      user.profile$.next(updatedProfile);
      user.setLoading(false);
    } catch (error) {
      user.setError(error instanceof Error ? error.message : 'Update failed');
      user.setLoading(false);
      throw error;
    }
  }

  // 删除用户
  removeUser(userId: string) {
    this.users.delete(userId);
    this.updateUserList();

    // 如果删除的是当前用户，清空当前用户
    if (this.currentUser$.value?.id === userId) {
      this.currentUser$.next(null);
    }
  }

  private updateUserList() {
    this.userList$.next(Array.from(this.users.values()));
  }
}
```

### 3. 定义作用域

```typescript
// scopes/UserScope.ts
import { Scope } from '@toeverything/infra';
import { UserService } from '../services/UserService';

export class UserScope extends Scope {
  static readonly id = 'UserScope';

  protected configure() {
    // 注册用户服务
    this.add(UserService);

    // 可以注册其他相关服务
    // this.add(UserPreferencesService);
    // this.add(UserNotificationService);
  }
}
```

### 4. React 组件集成

```typescript
// components/UserProfile.tsx
import React from 'react';
import { useLiveData, useService } from '@toeverything/infra/react';
import { UserService } from '../services/UserService';
import { UserEntity } from '../entities/UserEntity';

interface UserProfileProps {
  userId: string;
}

export const UserProfile: React.FC<UserProfileProps> = ({ userId }) => {
  const userService = useService(UserService);
  const user = React.useMemo(() => userService.getUser(userId), [userService, userId]);

  // 使用响应式数据
  const profile = useLiveData(user.profile$);
  const isLoading = useLiveData(user.isLoading$);
  const error = useLiveData(user.error$);

  // 加载用户数据
  React.useEffect(() => {
    if (!profile) {
      userService.loadUserProfile(userId).catch(console.error);
    }
  }, [userService, userId, profile]);

  // 处理表单提交
  const handleUpdateProfile = async (updates: Partial<typeof profile>) => {
    try {
      await userService.updateUserProfile(userId, updates);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  if (isLoading) {
    return <div className="loading">Loading user profile...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!profile) {
    return <div className="no-data">No user data available</div>;
  }

  return (
    <div className="user-profile">
      <div className="avatar">
        {profile.avatar ? (
          <img src={profile.avatar} alt={profile.name} />
        ) : (
          <div className="avatar-placeholder">{profile.name.charAt(0)}</div>
        )}
      </div>

      <div className="profile-info">
        <h2>{profile.name}</h2>
        <p>{profile.email}</p>

        <button
          onClick={() => handleUpdateProfile({ name: 'Updated Name' })}
          disabled={isLoading}
        >
          Update Name
        </button>
      </div>
    </div>
  );
};
```

### 5. 用户列表组件

```typescript
// components/UserList.tsx
import React from 'react';
import { useLiveData, useService } from '@toeverything/infra/react';
import { UserService } from '../services/UserService';
import { UserProfile } from './UserProfile';

export const UserList: React.FC = () => {
  const userService = useService(UserService);
  const userList = useLiveData(userService.userList$);
  const currentUser = useLiveData(userService.currentUser$);

  const handleSelectUser = (userId: string) => {
    userService.setCurrentUser(userId);
  };

  const handleCreateUser = () => {
    const newUserId = `user-${Date.now()}`;
    const user = userService.getUser(newUserId);
    user.profile$.next({
      id: newUserId,
      name: `User ${newUserId}`,
      email: `${newUserId}@example.com`
    });
    userService.setCurrentUser(newUserId);
  };

  return (
    <div className="user-list-container">
      <div className="user-list">
        <h3>Users ({userList.length})</h3>

        <button onClick={handleCreateUser}>
          Create New User
        </button>

        <ul>
          {userList.map(user => {
            const profile = useLiveData(user.profile$);
            return (
              <li
                key={user.id}
                className={currentUser?.id === user.id ? 'active' : ''}
                onClick={() => handleSelectUser(user.id)}
              >
                {profile?.name || user.id}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="user-detail">
        {currentUser ? (
          <UserProfile userId={currentUser.id} />
        ) : (
          <div>Select a user to view profile</div>
        )}
      </div>
    </div>
  );
};
```

### 6. 应用程序根组件

```typescript
// App.tsx
import React from 'react';
import { FrameworkRoot, FrameworkScope } from '@toeverything/infra/react';
import { Framework } from '@toeverything/infra';
import { UserScope } from './scopes/UserScope';
import { UserList } from './components/UserList';

// 创建 Framework 实例
const framework = new Framework();
framework.addScope(UserScope);

export const App: React.FC = () => {
  return (
    <FrameworkRoot framework={framework}>
      <FrameworkScope scope={UserScope}>
        <div className="app">
          <header>
            <h1>AFFiNE Framework User Management Demo</h1>
          </header>

          <main>
            <UserList />
          </main>
        </div>
      </FrameworkScope>
    </FrameworkRoot>
  );
};
```

### 7. 高级用法：组合多个服务

```typescript
// services/NotificationService.ts
import { Service } from '@toeverything/infra';
import { LiveData } from '@toeverything/infra';
import { UserService } from './UserService';

export interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
}

export class NotificationService extends Service {
  public readonly notifications$ = new LiveData<Notification[]>([]);

  constructor(private userService: UserService) {
    super();
    this.setupUserNotifications();
  }

  private setupUserNotifications() {
    // 监听用户变化并发送通知
    this.userService.currentUser$.subscribe(user => {
      if (user) {
        this.addNotification({
          id: `user-${Date.now()}`,
          message: `Switched to user: ${user.id}`,
          type: 'info',
          timestamp: new Date(),
        });
      }
    });
  }

  addNotification(notification: Notification) {
    const current = this.notifications$.value;
    this.notifications$.next([...current, notification]);

    // 自动清除通知
    setTimeout(() => {
      this.removeNotification(notification.id);
    }, 5000);
  }

  removeNotification(id: string) {
    const current = this.notifications$.value;
    this.notifications$.next(current.filter(n => n.id !== id));
  }
}
```

## Framework 库使用方法

### 基础设置

#### 1. 安装依赖

```bash
npm install @toeverything/infra
# 或
yarn add @toeverything/infra
```

#### 2. 创建 Framework 实例

```typescript
import { Framework } from '@toeverything/infra';

const framework = new Framework();
```

#### 3. 注册作用域

```typescript
// 方法1: 直接添加作用域类
framework.addScope(UserScope);

// 方法2: 使用配置函数
framework.configureScope(scope => {
  scope.add(UserService);
  scope.add(NotificationService, [UserService]); // 指定依赖
});
```

#### 4. React 集成

```typescript
import { FrameworkRoot, FrameworkScope } from '@toeverything/infra/react';

// 在应用根部提供 Framework
<FrameworkRoot framework={framework}>
  <FrameworkScope scope={UserScope}>
    <YourApp />
  </FrameworkScope>
</FrameworkRoot>
```

### 核心 API

#### Framework 类

```typescript
class Framework {
  // 添加作用域
  addScope(scopeClass: ScopeClass): void;

  // 配置作用域
  configureScope(configureFn: (scope: Scope) => void): void;

  // 获取服务实例
  get<T>(serviceClass: ServiceClass<T>, scope?: ScopeClass): T;

  // 创建子作用域
  createScope(scopeClass: ScopeClass): Scope;
}
```

#### Service 基类

```typescript
abstract class Service {
  // 服务初始化（可选重写）
  protected onInit?(): void | Promise<void>;

  // 服务销毁（可选重写）
  protected onDestroy?(): void | Promise<void>;
}
```

#### Entity 基类

```typescript
abstract class Entity {
  // 实体唯一标识
  abstract readonly id: string;

  // 实体销毁
  dispose(): void;
}
```

#### LiveData 响应式数据

```typescript
class LiveData<T> {
  constructor(initialValue: T);

  // 获取当前值
  get value(): T;

  // 设置新值
  next(value: T): void;

  // 订阅变化
  subscribe(observer: (value: T) => void): Subscription;

  // 映射转换
  map<U>(fn: (value: T) => U): LiveData<U>;

  // 过滤
  filter(predicate: (value: T) => boolean): LiveData<T>;
}
```

#### React Hooks

```typescript
// 获取服务实例
function useService<T>(serviceClass: ServiceClass<T>): T;

// 订阅响应式数据
function useLiveData<T>(liveData: LiveData<T>): T;

// 获取 Framework 实例
function useFramework(): Framework;
```

### 最佳实践

#### 1. 服务设计原则

- **单一职责**: 每个服务只负责一个业务领域
- **依赖注入**: 通过构造函数注入依赖
- **响应式**: 使用 LiveData 暴露状态变化
- **异步处理**: 正确处理异步操作和错误

#### 2. 作用域管理

- **根作用域**: 全局服务（如认证、配置）
- **功能作用域**: 特定功能模块的服务
- **页面作用域**: 页面级别的临时服务

#### 3. 错误处理

```typescript
class ApiService extends Service {
  async fetchData<T>(url: string): Promise<T> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      // 统一错误处理
      this.handleError(error);
      throw error;
    }
  }

  private handleError(error: unknown) {
    console.error('API Error:', error);
    // 可以发送到错误监控服务
  }
}
```

#### 4. 性能优化

```typescript
// 使用 React.memo 优化组件渲染
const UserProfile = React.memo<UserProfileProps>(({ userId }) => {
  const userService = useService(UserService);
  const user = React.useMemo(() => userService.getUser(userId), [userService, userId]);
  const profile = useLiveData(user.profile$);

  // 组件逻辑...
});

// 使用 useMemo 缓存计算结果
const processedData = React.useMemo(() => {
  return expensiveComputation(rawData);
}, [rawData]);
```

### 调试和测试

#### 1. 开发工具

```typescript
// 开发环境下启用调试
if (process.env.NODE_ENV === 'development') {
  framework.enableDebug();
}
```

#### 2. 单元测试

```typescript
// 测试服务
describe('UserService', () => {
  let framework: Framework;
  let userService: UserService;

  beforeEach(() => {
    framework = new Framework();
    framework.addScope(UserScope);
    userService = framework.get(UserService);
  });

  it('should create user entity', () => {
    const user = userService.getUser('test-id');
    expect(user.id).toBe('test-id');
  });
});
```

## 总结

AFFiNE Framework 提供了一套完整的依赖注入和响应式数据管理解决方案，通过作用域、服务、实体和响应式数据的有机结合，能够构建出结构清晰、易于维护的大型 React 应用程序。

关键优势：

- **类型安全**: 完整的 TypeScript 支持
- **响应式**: 基于 RxJS 的响应式数据流
- **模块化**: 清晰的服务边界和依赖关系
- **可测试**: 易于进行单元测试和集成测试
- **性能优化**: 精确的更新控制和内存管理

通过遵循本文档的指导和最佳实践，您可以充分发挥 AFFiNE Framework 的强大功能，构建出高质量的 Web 应用程序。
