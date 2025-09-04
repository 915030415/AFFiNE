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

### 5. 存储 (Store)

Store 是 AFFiNE Framework 中的数据存储和状态管理核心，负责管理应用程序的状态数据、提供响应式数据访问接口，并与服务层协同工作。Store 基于 RxJS 构建，提供了强大的响应式数据流能力。

#### Store 的核心特性

##### 1. 响应式状态管理

```typescript
// Store 基类提供响应式状态管理能力
export class UserStore extends Store {
  // 用户信息的响应式数据
  user$ = new LiveData<User | null>(null);

  // 用户列表的响应式数据
  userList$ = new LiveData<User[]>([]);

  // 加载状态
  loading$ = new LiveData<boolean>(false);

  // 获取当前用户信息
  getCurrentUser(): User | null {
    return this.user$.value;
  }

  // 更新用户信息
  updateUser(user: User) {
    this.user$.next(user);
  }
}
```

##### 2. 计算属性和派生状态

```typescript
export class DocumentStore extends Store {
  documents$ = new LiveData<Document[]>([]);
  selectedDocumentId$ = new LiveData<string | null>(null);

  // 派生状态：当前选中的文档
  selectedDocument$ = LiveData.computed(() => {
    const documents = this.documents$.value;
    const selectedId = this.selectedDocumentId$.value;
    return documents.find(doc => doc.id === selectedId) || null;
  });

  // 派生状态：文档数量
  documentCount$ = LiveData.computed(() => {
    return this.documents$.value.length;
  });
}
```

##### 3. 异步数据处理

```typescript
export class ApiStore extends Store {
  private apiService = this.framework.get(ApiService);

  // 异步加载用户数据
  async loadUsers(): Promise<User[]> {
    this.loading$.next(true);

    try {
      const users = await this.apiService.fetchUsers();
      this.userList$.next(users);
      return users;
    } catch (error) {
      this.error$.next(error);
      throw error;
    } finally {
      this.loading$.next(false);
    }
  }

  // 响应式数据流处理
  setupUserStream() {
    // 监听用户变化并自动保存
    this.user$
      .pipe(
        debounceTime(1000),
        filter(user => user !== null),
        switchMap(user => this.apiService.saveUser(user))
      )
      .subscribe({
        next: savedUser => console.log('用户已保存', savedUser),
        error: error => console.error('保存失败', error),
      });
  }
}
```

#### Store 与其他概念的关系

##### 1. Store 与 Service 的协作

```typescript
// Service 处理业务逻辑
export class UserService extends Service {
  constructor(
    private userStore = this.framework.get(UserStore),
    private apiService = this.framework.get(ApiService)
  ) {
    super();
  }

  // 业务方法：登录用户
  async loginUser(credentials: LoginCredentials) {
    const user = await this.apiService.login(credentials);
    // 更新 Store 中的状态
    this.userStore.updateUser(user);
    return user;
  }
}

// Store 管理状态数据
export class UserStore extends Store {
  user$ = new LiveData<User | null>(null);

  updateUser(user: User) {
    this.user$.next(user);
  }

  clearUser() {
    this.user$.next(null);
  }
}
```

##### 2. Store 与 Entity 的结合

```typescript
// Entity 定义数据结构和行为
export class Document extends Entity {
  constructor(
    public id: string,
    public title: string,
    public content: string,
    public createdAt: Date
  ) {
    super();
  }

  updateTitle(newTitle: string) {
    this.title = newTitle;
    this.markAsModified();
  }
}

// Store 管理 Entity 集合
export class DocumentStore extends Store {
  documents$ = new LiveData<Document[]>([]);

  addDocument(document: Document) {
    const currentDocs = this.documents$.value;
    this.documents$.next([...currentDocs, document]);
  }

  updateDocument(id: string, updates: Partial<Document>) {
    const currentDocs = this.documents$.value;
    const updatedDocs = currentDocs.map(doc => (doc.id === id ? { ...doc, ...updates } : doc));
    this.documents$.next(updatedDocs);
  }
}
```

##### 3. Store 与 LiveData 的深度集成

```typescript
export class WorkspaceStore extends Store {
  // 基础响应式数据
  workspaces$ = new LiveData<Workspace[]>([]);
  currentWorkspaceId$ = new LiveData<string | null>(null);

  // 组合响应式数据
  currentWorkspace$ = LiveData.computed(() => {
    const workspaces = this.workspaces$.value;
    const currentId = this.currentWorkspaceId$.value;
    return workspaces.find(ws => ws.id === currentId);
  });

  // 过滤和转换数据
  activeWorkspaces$ = LiveData.computed(() => {
    return this.workspaces$.value.filter(ws => ws.status === 'active');
  });

  // 复杂的数据流处理
  setupWorkspaceSync() {
    // 当工作区变化时自动同步
    this.currentWorkspace$
      .pipe(
        filter(workspace => workspace !== null),
        switchMap(workspace => this.syncWorkspace(workspace)),
        catchError(error => {
          console.error('工作区同步失败', error);
          return EMPTY;
        })
      )
      .subscribe();
  }
}
```

#### Store 的最佳实践

##### 1. 单一职责原则

```typescript
// ✅ 好的做法：每个 Store 负责特定领域的数据
export class UserStore extends Store {
  // 只管理用户相关数据
  user$ = new LiveData<User | null>(null);
  userPreferences$ = new LiveData<UserPreferences>({});
}

export class DocumentStore extends Store {
  // 只管理文档相关数据
  documents$ = new LiveData<Document[]>([]);
  selectedDocumentId$ = new LiveData<string | null>(null);
}

// ❌ 避免：一个 Store 管理过多不相关的数据
export class MegaStore extends Store {
  user$ = new LiveData<User | null>(null);
  documents$ = new LiveData<Document[]>([]);
  settings$ = new LiveData<Settings>({});
  notifications$ = new LiveData<Notification[]>([]);
  // ... 太多不相关的状态
}
```

##### 2. 不可变数据更新

```typescript
export class TodoStore extends Store {
  todos$ = new LiveData<Todo[]>([]);

  // ✅ 好的做法：创建新数组，保持不可变性
  addTodo(todo: Todo) {
    const currentTodos = this.todos$.value;
    this.todos$.next([...currentTodos, todo]);
  }

  updateTodo(id: string, updates: Partial<Todo>) {
    const currentTodos = this.todos$.value;
    const updatedTodos = currentTodos.map(todo => (todo.id === id ? { ...todo, ...updates } : todo));
    this.todos$.next(updatedTodos);
  }

  // ❌ 避免：直接修改原数组
  addTodoBad(todo: Todo) {
    const currentTodos = this.todos$.value;
    currentTodos.push(todo); // 直接修改原数组
    this.todos$.next(currentTodos); // 可能不会触发更新
  }
}
```

##### 3. 错误处理和加载状态

```typescript
export class DataStore extends Store {
  data$ = new LiveData<any[]>([]);
  loading$ = new LiveData<boolean>(false);
  error$ = new LiveData<Error | null>(null);

  async loadData() {
    this.loading$.next(true);
    this.error$.next(null);

    try {
      const data = await this.apiService.fetchData();
      this.data$.next(data);
    } catch (error) {
      this.error$.next(error as Error);
    } finally {
      this.loading$.next(false);
    }
  }

  // 组合加载状态的便捷方法
  get isLoading(): boolean {
    return this.loading$.value;
  }

  get hasError(): boolean {
    return this.error$.value !== null;
  }
}
```

##### 4. Store 的生命周期管理

```typescript
export class SessionStore extends Store {
  private subscriptions: Subscription[] = [];

  constructor() {
    super();
    this.setupSubscriptions();
  }

  private setupSubscriptions() {
    // 设置自动保存
    const autoSave = this.sessionData$
      .pipe(
        debounceTime(5000),
        switchMap(data => this.saveSession(data))
      )
      .subscribe();

    this.subscriptions.push(autoSave);
  }

  // 清理资源
  dispose() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
    super.dispose();
  }
}
```

#### 在 React 组件中使用 Store

```typescript
// 使用 useStore Hook
const UserProfile: React.FC = () => {
  const userStore = useStore(UserStore);
  const user = useLiveData(userStore.user$);
  const loading = useLiveData(userStore.loading$);

  if (loading) {
    return <div>加载中...</div>;
  }

  if (!user) {
    return <div>未登录</div>;
  }

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
};

// 使用多个 Store
const DocumentEditor: React.FC = () => {
  const documentStore = useStore(DocumentStore);
  const userStore = useStore(UserStore);

  const selectedDocument = useLiveData(documentStore.selectedDocument$);
  const user = useLiveData(userStore.user$);

  const handleSave = () => {
    if (selectedDocument && user) {
      documentStore.saveDocument(selectedDocument.id, user.id);
    }
  };

  return (
    <div>
      {selectedDocument && (
        <>
          <h2>{selectedDocument.title}</h2>
          <button onClick={handleSave}>保存</button>
        </>
      )}
    </div>
  );
};
```

#### Store 的高级特性

##### 1. Store 组合和模块化

```typescript
// 基础 Store
export class BaseDocumentStore extends Store {
  documents$ = new LiveData<Document[]>([]);

  protected addDocument(document: Document) {
    const current = this.documents$.value;
    this.documents$.next([...current, document]);
  }
}

// 扩展 Store
export class CollaborativeDocumentStore extends BaseDocumentStore {
  collaborators$ = new LiveData<User[]>([]);

  addCollaborator(user: User) {
    const current = this.collaborators$.value;
    this.collaborators$.next([...current, user]);
  }

  // 重写父类方法
  protected addDocument(document: Document) {
    super.addDocument(document);
    // 添加协作相关逻辑
    this.notifyCollaborators(document);
  }
}
```

##### 2. Store 间通信

```typescript
export class NotificationStore extends Store {
  notifications$ = new LiveData<Notification[]>([]);

  addNotification(notification: Notification) {
    const current = this.notifications$.value;
    this.notifications$.next([...current, notification]);
  }
}

export class DocumentStore extends Store {
  constructor(private notificationStore = this.framework.get(NotificationStore)) {
    super();
  }

  async saveDocument(document: Document) {
    try {
      await this.apiService.saveDocument(document);
      // 通知其他 Store
      this.notificationStore.addNotification({
        type: 'success',
        message: '文档保存成功',
      });
    } catch (error) {
      this.notificationStore.addNotification({
        type: 'error',
        message: '文档保存失败',
      });
    }
  }
}
```

Store 是 AFFiNE Framework 中连接数据层和视图层的重要桥梁，它提供了强大的响应式状态管理能力，与 Service、Entity 和 LiveData 协同工作，构建了完整的数据流架构。通过合理使用 Store，可以实现清晰的数据管理、高效的状态更新和良好的组件解耦。

## 作用域 (Scope) 详细解释

### 什么是作用域？

作用域（Scope）是 AFFiNE Framework 中的核心概念，它就像一个**服务容器**或**依赖注入容器**，负责管理一组相关服务的生命周期、依赖关系和访问权限。

可以把作用域想象成：

- 🏢 **办公楼的楼层**：每个楼层有自己的部门和员工
- 📦 **工具箱**：不同的工具箱装着不同用途的工具
- 🎯 **功能模块**：将相关的业务逻辑组织在一起

### 作用域的核心作用

#### 1. 服务隔离

```typescript
// 用户管理作用域
export class UserScope extends Scope {
  static readonly id = 'UserScope';

  protected configure() {
    this.add(UserService); // 用户服务
    this.add(AuthService); // 认证服务
    this.add(ProfileService); // 个人资料服务
  }
}

// 文档编辑作用域
export class EditorScope extends Scope {
  static readonly id = 'EditorScope';

  protected configure() {
    this.add(EditorService); // 编辑器服务
    this.add(DocumentService); // 文档服务
    this.add(CollabService); // 协作服务
  }
}
```

#### 2. 生命周期管理

```typescript
// 页面级作用域 - 页面销毁时自动清理
export class PageScope extends Scope {
  static readonly id = 'PageScope';

  protected configure() {
    this.add(PageStateService); // 页面状态（临时）
    this.add(FormService); // 表单服务（临时）
  }
}

// 应用级作用域 - 应用运行期间持续存在
export class AppScope extends Scope {
  static readonly id = 'AppScope';

  protected configure() {
    this.add(ConfigService); // 配置服务（全局）
    this.add(ThemeService); // 主题服务（全局）
  }
}
```

#### 3. 依赖注入管理

```typescript
export class BusinessScope extends Scope {
  static readonly id = 'BusinessScope';

  protected configure() {
    // 基础服务
    this.add(ApiService);
    this.add(CacheService);

    // 依赖基础服务的业务服务
    this.add(UserService, [ApiService, CacheService]);
    this.add(OrderService, [ApiService, UserService]);
  }
}
```

### 作用域的层级结构

```typescript
// 根作用域（全局）
const framework = new Framework();
framework.addScope(AppScope);     // 应用级服务

// React 组件树中的作用域层级
<FrameworkRoot framework={framework}>
  {/* 应用级作用域 */}
  <FrameworkScope scope={UserScope}>
    {/* 用户管理作用域 */}
    <UserManagement />

    <FrameworkScope scope={EditorScope}>
      {/* 编辑器作用域（继承用户作用域） */}
      <DocumentEditor />

      <FrameworkScope scope={PageScope}>
        {/* 页面级作用域（继承上级所有作用域） */}
        <EditPage />
      </FrameworkScope>


    </FrameworkScope>


  </FrameworkScope>


</FrameworkRoot>
```

### 作用域的使用方法

#### 1. 定义作用域

```typescript
// scopes/WorkspaceScope.ts
import { Scope } from '@toeverything/infra';
import { WorkspaceService } from '../services/WorkspaceService';
import { DocumentService } from '../services/DocumentService';
import { CollaborationService } from '../services/CollaborationService';

export class WorkspaceScope extends Scope {
  static readonly id = 'WorkspaceScope';

  protected configure() {
    // 注册核心服务
    this.add(WorkspaceService);
    this.add(DocumentService);

    // 注册依赖其他服务的服务
    this.add(CollaborationService, [WorkspaceService, DocumentService]);
  }
}
```

#### 2. 注册到 Framework

```typescript
// main.tsx
import { Framework } from '@toeverything/infra';
import { WorkspaceScope } from './scopes/WorkspaceScope';

const framework = new Framework();
framework.addScope(WorkspaceScope);
```

#### 3. 在 React 中使用

```typescript
// App.tsx
import { FrameworkRoot, FrameworkScope } from '@toeverything/infra/react';

export const App = () => {
  return (
    <FrameworkRoot framework={framework}>
      <FrameworkScope scope={WorkspaceScope}>
        <WorkspaceView />
      </FrameworkScope>
    </FrameworkRoot>
  );
};

// WorkspaceView.tsx
import { useService } from '@toeverything/infra/react';
import { WorkspaceService } from '../services/WorkspaceService';

export const WorkspaceView = () => {
  // 自动从当前作用域获取服务实例
  const workspaceService = useService(WorkspaceService);

  // 使用服务...
};
```

### 使用作用域 vs 不使用作用域的对比

#### 🚫 不使用作用域的传统方式

```typescript
// ❌ 传统方式：全局单例 + 手动管理

// 全局服务实例
const userService = new UserService();
const documentService = new DocumentService();
const editorService = new EditorService();

// 手动管理依赖
editorService.setDocumentService(documentService);
documentService.setUserService(userService);

// React 组件中使用
const DocumentEditor = () => {
  // 直接引用全局实例
  const handleSave = () => {
    editorService.save();
  };

  return <button onClick={handleSave}>保存</button>;
};

// 问题：
// 1. 全局污染：所有服务都是全局的
// 2. 难以测试：无法轻易替换服务实例
// 3. 内存泄漏：服务实例永远不会被销毁
// 4. 依赖混乱：手动管理依赖关系容易出错
// 5. 不支持多实例：无法在不同上下文中使用不同配置
```

#### ✅ 使用作用域的 Framework 方式

```typescript
// ✅ Framework 方式：作用域管理 + 自动依赖注入

// 定义作用域
export class EditorScope extends Scope {
  static readonly id = 'EditorScope';

  protected configure() {
    this.add(UserService);
    this.add(DocumentService, [UserService]);     // 自动注入 UserService
    this.add(EditorService, [DocumentService]);   // 自动注入 DocumentService
  }
}

// React 组件中使用
const DocumentEditor = () => {
  // 从当前作用域自动获取服务实例
  const editorService = useService(EditorService);

  const handleSave = () => {
    editorService.save();
  };

  return <button onClick={handleSave}>保存</button>;
};

// 应用结构
<FrameworkRoot framework={framework}>
  <FrameworkScope scope={EditorScope}>
    <DocumentEditor />  {/* 这里的服务实例是隔离的 */}
  </FrameworkScope>

  <FrameworkScope scope={EditorScope}>
    <AnotherEditor />   {/* 这里是另一个独立的服务实例 */}
  </FrameworkScope>
</FrameworkRoot>

// 优势：
// 1. 作用域隔离：不同作用域的服务实例互不影响
// 2. 自动依赖注入：Framework 自动管理依赖关系
// 3. 生命周期管理：作用域销毁时自动清理服务
// 4. 易于测试：可以轻易替换服务实现
// 5. 支持多实例：不同作用域可以有不同的服务配置
```

### 实际应用场景对比

#### 场景1：多工作区应用

```typescript
// 🚫 不使用作用域
// 所有工作区共享同一个服务实例，数据会互相污染
const workspaceService = new WorkspaceService();

// 切换工作区时需要手动清理数据
const switchWorkspace = (workspaceId: string) => {
  workspaceService.clearData();  // 手动清理
  workspaceService.loadWorkspace(workspaceId);
};

// ✅ 使用作用域
// 每个工作区有独立的服务实例和数据
<FrameworkScope scope={WorkspaceScope} key={workspaceId}>
  <WorkspaceView workspaceId={workspaceId} />
</FrameworkScope>

// 切换工作区时自动创建新的作用域，旧作用域自动销毁
```

#### 场景2：模态框和弹窗

```typescript
// 🚫 不使用作用域
// 模态框的状态可能影响主页面
const modalService = new ModalService();
const formService = new FormService();

// 关闭模态框时需要手动清理状态
const closeModal = () => {
  modalService.reset();
  formService.clearForm();
  setModalVisible(false);
};

// ✅ 使用作用域
// 模态框有独立的作用域，关闭时自动清理
{isModalVisible && (
  <FrameworkScope scope={ModalScope}>
    <Modal onClose={() => setModalVisible(false)}>
      <FormComponent />  {/* 独立的表单状态 */}
    </Modal>
  </FrameworkScope>
)}
```

#### 场景3：页面级状态管理

```typescript
// 🚫 不使用作用域
// 页面状态可能泄漏到其他页面
const pageStateService = new PageStateService();

// 路由切换时需要手动清理
const navigate = (path: string) => {
  pageStateService.cleanup();  // 手动清理
  router.push(path);
};

// ✅ 使用作用域
// 每个页面有独立的状态作用域
const PageComponent = () => {
  return (
    <FrameworkScope scope={PageScope}>
      <PageContent />  {/* 页面级状态自动隔离 */}
    </FrameworkScope>
  );
};
```

### 作用域的最佳实践

#### 1. 作用域层级设计

```typescript
// 推荐的作用域层级
AppScope          // 应用级：配置、主题、全局状态
├── UserScope     // 用户级：认证、权限、用户偏好
│   ├── WorkspaceScope    // 工作区级：工作区数据、设置
│   │   ├── DocumentScope // 文档级：文档数据、编辑状态
│   │   └── PageScope     // 页面级：临时状态、表单数据
│   └── SettingsScope     // 设置页面：设置数据、临时状态
└── GuestScope    // 访客级：有限功能、临时数据
```

#### 2. 服务注册原则

```typescript
export class ExampleScope extends Scope {
  protected configure() {
    // ✅ 按功能分组注册
    // 数据层服务
    this.add(ApiService);
    this.add(CacheService);

    // 业务层服务
    this.add(UserService, [ApiService]);
    this.add(DocumentService, [ApiService, CacheService]);

    // 表现层服务
    this.add(UIStateService);
    this.add(NotificationService, [UIStateService]);
  }
}
```

#### 3. 作用域生命周期管理

```typescript
// 长期作用域：应用运行期间持续存在
export class AppScope extends Scope {
  static readonly id = 'AppScope';
  // 全局配置、主题、认证状态等
}

// 中期作用域：功能模块级别
export class FeatureScope extends Scope {
  static readonly id = 'FeatureScope';
  // 功能相关的服务和状态
}

// 短期作用域：页面或组件级别
export class ComponentScope extends Scope {
  static readonly id = 'ComponentScope';
  // 临时状态、表单数据、UI 状态等
}
```

### 作用域生命周期管理的底层原理

#### 为什么作用域可以管理服务的生命周期？

作用域能够管理服务生命周期的核心原理在于 **React 组件树的生命周期与作用域实例的绑定**。让我们深入了解这个机制：

##### 1. React Context + 作用域实例绑定

```typescript
// FrameworkScope 组件的简化实现原理
export const FrameworkScope: React.FC<{ scope: ScopeConstructor; children: React.ReactNode }> = ({
  scope: ScopeClass,
  children
}) => {
  // 🔑 关键：每个 FrameworkScope 组件都会创建独立的作用域实例
  const scopeInstance = React.useMemo(() => {
    const instance = new ScopeClass();
    instance.configure(); // 注册服务
    return instance;
  }, [ScopeClass]);

  // 🧹 清理机制：组件卸载时自动销毁作用域
  React.useEffect(() => {
    return () => {
      // 组件销毁时，作用域实例也被销毁
      scopeInstance.dispose(); // 清理所有服务实例
    };
  }, [scopeInstance]);

  // 通过 Context 向下传递作用域实例
  return (
    <ScopeContext.Provider value={scopeInstance}>
      {children}
    </ScopeContext.Provider>
  );
};
```

##### 2. 服务实例与作用域的生命周期绑定

```typescript
// 作用域内部的服务管理机制
export class Scope {
  private serviceInstances = new Map<ServiceConstructor, any>();
  private disposables: (() => void)[] = [];

  // 获取服务实例（懒加载 + 单例模式）
  get<T>(ServiceClass: ServiceConstructor<T>): T {
    if (!this.serviceInstances.has(ServiceClass)) {
      // 🏭 工厂模式：按需创建服务实例
      const instance = new ServiceClass();

      // 🔗 绑定生命周期：服务实例与作用域绑定
      this.serviceInstances.set(ServiceClass, instance);

      // 📝 注册清理函数
      if (instance.dispose) {
        this.disposables.push(() => instance.dispose());
      }
    }

    return this.serviceInstances.get(ServiceClass);
  }

  // 🧹 作用域销毁时的清理机制
  dispose() {
    // 1. 清理所有服务实例
    this.disposables.forEach(dispose => dispose());

    // 2. 清空服务实例映射
    this.serviceInstances.clear();

    // 3. 清空清理函数列表
    this.disposables.length = 0;

    console.log('🗑️ 作用域已销毁，所有服务实例已清理');
  }
}
```

##### 3. 页面/组件销毁 → 服务销毁的完整流程

```typescript
// 实际应用场景演示
const App = () => {
  const [currentPage, setCurrentPage] = useState('home');

  return (
    <FrameworkRoot framework={framework}>
      {currentPage === 'home' && (
        // 🏠 首页作用域
        <FrameworkScope scope={HomePageScope}>
          <HomePage />
        </FrameworkScope>
      )}

      {currentPage === 'editor' && (
        // 📝 编辑器作用域
        <FrameworkScope scope={EditorPageScope}>
          <EditorPage />
        </FrameworkScope>
      )}

      <button onClick={() => setCurrentPage('editor')}>
        切换到编辑器
      </button>
    </FrameworkRoot>
  );
};

// 🔄 页面切换时的生命周期流程：
// 1. 用户点击"切换到编辑器"
// 2. currentPage 状态改变为 'editor'
// 3. React 卸载 HomePageScope 组件
// 4. HomePageScope 的 useEffect 清理函数执行
// 5. homePageScopeInstance.dispose() 被调用
// 6. HomePageScope 中的所有服务实例被清理
// 7. React 挂载 EditorPageScope 组件
// 8. 创建新的 editorPageScopeInstance
// 9. EditorPageScope 中的服务按需创建
```

#### 作用域隔离服务的实现原理

##### 1. 实例级隔离

```typescript
// 每个作用域都有独立的服务实例映射
export class DocumentEditorScope extends Scope {
  // 🔒 私有服务实例存储，与其他作用域完全隔离
  private serviceInstances = new Map();

  protected configure() {
    this.add(DocumentService);  // 文档服务
    this.add(EditorService);    // 编辑器服务
  }
}

// 多个编辑器实例的隔离演示
const MultiEditorApp = () => {
  return (
    <div>
      {/* 📄 编辑器 A - 独立的服务实例 */}
      <FrameworkScope scope={DocumentEditorScope}>
        <DocumentEditor documentId="doc-1" />
      </FrameworkScope>

      {/* 📄 编辑器 B - 完全独立的服务实例 */}
      <FrameworkScope scope={DocumentEditorScope}>
        <DocumentEditor documentId="doc-2" />
      </FrameworkScope>
    </div>
  );
};

// 🔍 隔离效果：
// - 编辑器 A 的 DocumentService 实例只管理 doc-1
// - 编辑器 B 的 DocumentService 实例只管理 doc-2
// - 两个实例的数据、状态完全独立，互不影响
```

##### 2. 内存空间隔离

```typescript
// 服务实例的内存隔离示例
export class DocumentService extends Service {
  private documentData = new Map<string, DocumentData>();
  private editHistory: EditOperation[] = [];
  private collaborators = new Set<string>();

  loadDocument(id: string) {
    // 🔒 每个作用域的 DocumentService 实例
    // 都有自己独立的 documentData、editHistory、collaborators
    // 不会与其他作用域的同类服务实例产生数据冲突
  }
}

// 内存布局示意：
// 作用域 A:
//   └── DocumentService 实例 A
//       ├── documentData: Map { "doc-1" => data1 }
//       ├── editHistory: [edit1, edit2]
//       └── collaborators: Set { "user1", "user2" }
//
// 作用域 B:
//   └── DocumentService 实例 B
//       ├── documentData: Map { "doc-2" => data2 }
//       ├── editHistory: [edit3, edit4]
//       └── collaborators: Set { "user3" }
```

##### 3. 作用域层级与服务继承

```typescript
// 作用域层级结构中的服务访问规则
const NestedScopeApp = () => {
  return (
    <FrameworkRoot framework={framework}>
      {/* 🌍 全局作用域 */}
      <FrameworkScope scope={AppScope}>

        {/* 👤 用户作用域 - 可以访问 AppScope 的服务 */}
        <FrameworkScope scope={UserScope}>

          {/* 📝 编辑器作用域 - 可以访问 UserScope 和 AppScope 的服务 */}
          <FrameworkScope scope={EditorScope}>
            <DocumentEditor />
          </FrameworkScope>

        </FrameworkScope>

      </FrameworkScope>
    </FrameworkRoot>
  );
};

// 🔍 服务查找机制（类似原型链）：
// 1. 在当前作用域查找服务
// 2. 如果找不到，向父作用域查找
// 3. 一直向上查找到根作用域
// 4. 如果都找不到，抛出错误

export class Scope {
  constructor(private parent?: Scope) {}

  get<T>(ServiceClass: ServiceConstructor<T>): T {
    // 🔍 先在当前作用域查找
    if (this.serviceInstances.has(ServiceClass)) {
      return this.serviceInstances.get(ServiceClass);
    }

    // 🔍 向父作用域查找
    if (this.parent) {
      return this.parent.get(ServiceClass);
    }

    throw new Error(`Service ${ServiceClass.name} not found in scope chain`);
  }
}
```

#### 实际应用中的生命周期管理

##### 1. 模态框场景

```typescript
const ModalExample = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setIsModalOpen(true)}>打开模态框</button>

      {/* 🪟 模态框只在需要时创建作用域 */}
      {isModalOpen && (
        <FrameworkScope scope={ModalScope}>
          <Modal onClose={() => setIsModalOpen(false)}>
            <FormComponent />  {/* 表单状态完全隔离 */}
          </Modal>
        </FrameworkScope>
      )}
    </div>
  );
};

// 🔄 生命周期：
// 打开模态框 → 创建 ModalScope → 创建表单服务
// 关闭模态框 → 销毁 ModalScope → 自动清理表单数据
```

##### 2. 路由切换场景

```typescript
const RouterExample = () => {
  const location = useLocation();

  return (
    <FrameworkRoot framework={framework}>
      {/* 🛣️ 每个路由都有独立的页面作用域 */}
      {location.pathname === '/home' && (
        <FrameworkScope scope={HomePageScope}>
          <HomePage />
        </FrameworkScope>
      )}

      {location.pathname === '/profile' && (
        <FrameworkScope scope={ProfilePageScope}>
          <ProfilePage />
        </FrameworkScope>
      )}
    </FrameworkRoot>
  );
};

// 🔄 路由切换时：
// /home → /profile
// 1. HomePageScope 被卸载，所有相关服务被清理
// 2. ProfilePageScope 被创建，按需创建新的服务实例
// 3. 页面间的状态完全隔离，无数据污染
```

##### 3. 动态组件场景

```typescript
const DynamicComponentExample = () => {
  const [components, setComponents] = useState<string[]>([]);

  const addComponent = () => {
    setComponents(prev => [...prev, `component-${Date.now()}`]);
  };

  const removeComponent = (id: string) => {
    setComponents(prev => prev.filter(c => c !== id));
  };

  return (
    <div>
      <button onClick={addComponent}>添加组件</button>

      {components.map(id => (
        <FrameworkScope key={id} scope={ComponentScope}>
          <DynamicComponent
            id={id}
            onRemove={() => removeComponent(id)}
          />
        </FrameworkScope>
      ))}
    </div>
  );
};

// 🔄 动态生命周期：
// - 每个动态组件都有独立的作用域和服务实例
// - 移除组件时，对应的作用域和服务自动清理
// - 组件间完全隔离，互不影响
```

### 总结

作用域是 AFFiNE Framework 的核心特性，它提供了：

1. **🔒 隔离性**：不同作用域的服务实例互不影响
2. **🔄 生命周期管理**：自动创建和销毁服务实例
3. **🎯 依赖注入**：自动管理服务之间的依赖关系
4. **🧪 可测试性**：易于进行单元测试和集成测试
5. **📦 模块化**：清晰的服务边界和职责划分
6. **⚡ 性能优化**：按需创建和销毁，避免内存泄漏

**生命周期管理的核心机制**：

- React 组件生命周期与作用域实例绑定
- 组件卸载时自动触发作用域清理
- 服务实例与作用域生命周期同步
- 内存自动回收，防止内存泄漏

**服务隔离的实现原理**：

- 每个作用域维护独立的服务实例映射
- 实例级内存空间完全隔离
- 作用域层级提供服务继承机制
- 支持动态创建和销毁

通过合理使用作用域，可以构建出结构清晰、易于维护、性能优良的大型 React 应用程序。

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

### Framework 的 impl 方法详解

#### 什么是 impl 方法？

`impl` 方法是 AFFiNE Framework 中用于**接口实现注册**的核心方法。它允许你为抽象接口或标识符注册具体的实现类，这是依赖注入模式中的重要概念。

#### impl 方法的作用

1. **接口与实现分离**：将抽象接口定义与具体实现分离，提高代码的可维护性
2. **多实现支持**：同一个接口可以有多个不同的实现，根据环境或配置选择
3. **依赖注入**：通过标识符注入具体实现，而不是直接依赖具体类
4. **测试友好**：在测试环境中可以轻松替换为 Mock 实现

#### 语法格式

```typescript
framework.impl<T>(identifier: Identifier<T>, implementation: any, deps?: any[]): FrameworkEditor
```

**参数说明：**

- `identifier`: 接口标识符，可以是 Symbol、字符串或接口类型
- `implementation`: 具体的实现类或实例
- `deps`: 可选的依赖项数组

#### 使用场景和示例

##### 1. 存储接口的多种实现

```typescript
// 定义存储接口
interface IStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

// 创建接口标识符
const IStorage = Symbol('IStorage');

// 本地存储实现
class LocalStorage implements IStorage {
  async get(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  }

  async set(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  }

  async delete(key: string): Promise<void> {
    localStorage.removeItem(key);
  }
}

// IndexedDB 存储实现
class IndexedDBStorage implements IStorage {
  async get(key: string): Promise<string | null> {
    // IndexedDB 实现逻辑
    return null;
  }

  async set(key: string, value: string): Promise<void> {
    // IndexedDB 实现逻辑
  }

  async delete(key: string): Promise<void> {
    // IndexedDB 实现逻辑
  }
}

// 根据环境注册不同实现
if (typeof indexedDB !== 'undefined') {
  // 浏览器环境使用 IndexedDB
  framework.impl(IStorage, IndexedDBStorage);
} else {
  // 其他环境使用 LocalStorage
  framework.impl(IStorage, LocalStorage);
}

// 在服务中使用接口
class DocumentService extends Service {
  constructor(@inject(IStorage) private storage: IStorage) {
    super();
  }

  async saveDocument(id: string, content: string): Promise<void> {
    await this.storage.set(`doc:${id}`, content);
  }

  async loadDocument(id: string): Promise<string | null> {
    return await this.storage.get(`doc:${id}`);
  }
}
```

##### 2. API 客户端的环境适配

```typescript
// API 客户端接口
interface IApiClient {
  get<T>(url: string): Promise<T>;
  post<T>(url: string, data: any): Promise<T>;
}

const IApiClient = Symbol('IApiClient');

// 生产环境实现
class HttpApiClient implements IApiClient {
  async get<T>(url: string): Promise<T> {
    const response = await fetch(url);
    return response.json();
  }

  async post<T>(url: string, data: any): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  }
}

// 测试环境 Mock 实现
class MockApiClient implements IApiClient {
  private mockData = new Map<string, any>();

  async get<T>(url: string): Promise<T> {
    return this.mockData.get(url) || null;
  }

  async post<T>(url: string, data: any): Promise<T> {
    this.mockData.set(url, data);
    return data;
  }
}

// 根据环境注册实现
if (process.env.NODE_ENV === 'test') {
  framework.impl(IApiClient, MockApiClient);
} else {
  framework.impl(IApiClient, HttpApiClient);
}
```

##### 3. 插件系统实现

```typescript
// 插件接口
interface IPlugin {
  name: string;
  initialize(): Promise<void>;
  execute(context: any): Promise<any>;
}

const IPlugin = Symbol('IPlugin');

// 具体插件实现
class AIPlugin implements IPlugin {
  name = 'AI Assistant';

  async initialize(): Promise<void> {
    console.log('AI Plugin initialized');
  }

  async execute(context: any): Promise<any> {
    // AI 处理逻辑
    return { result: 'AI processed' };
  }
}

class TranslationPlugin implements IPlugin {
  name = 'Translation';

  async initialize(): Promise<void> {
    console.log('Translation Plugin initialized');
  }

  async execute(context: any): Promise<any> {
    // 翻译处理逻辑
    return { result: 'Translated' };
  }
}

// 注册多个插件实现
framework.impl(IPlugin, AIPlugin);
framework.impl(IPlugin, TranslationPlugin);

// 插件管理服务
class PluginService extends Service {
  constructor(@injectAll(IPlugin) private plugins: IPlugin[]) {
    super();
  }

  async initializeAllPlugins(): Promise<void> {
    for (const plugin of this.plugins) {
      await plugin.initialize();
    }
  }

  async executePlugin(pluginName: string, context: any): Promise<any> {
    const plugin = this.plugins.find(p => p.name === pluginName);
    if (plugin) {
      return await plugin.execute(context);
    }
    throw new Error(`Plugin ${pluginName} not found`);
  }
}
```

#### impl 方法 vs 直接注册服务的区别

| 特性         | impl 方法    | 直接注册服务   |
| ------------ | ------------ | -------------- |
| **抽象程度** | 高，基于接口 | 低，基于具体类 |
| **灵活性**   | 可替换实现   | 实现固定       |
| **测试性**   | 易于 Mock    | 需要继承或修改 |
| **解耦程度** | 完全解耦     | 紧耦合         |
| **多实现**   | 支持         | 不支持         |

```typescript
// ❌ 直接注册服务 - 紧耦合
framework.service(DocumentService, [LocalStorageService]);

// ✅ 使用 impl 方法 - 松耦合
framework.impl(IStorage, LocalStorageService);
framework.service(DocumentService, [IStorage]);
```

#### 最佳实践

1. **定义清晰的接口**：确保接口职责单一，方法签名明确
2. **使用 Symbol 标识符**：避免字符串标识符的命名冲突
3. **环境适配**：根据不同环境注册不同实现
4. **测试友好**：为测试环境提供 Mock 实现
5. **文档化**：为每个接口和实现提供清晰的文档

```typescript
// 推荐的接口定义模式
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<User>;
  delete(id: string): Promise<boolean>;
}

export const IUserRepository = Symbol('IUserRepository');

// 环境配置
export function configureUserModule(framework: Framework) {
  if (process.env.NODE_ENV === 'test') {
    framework.impl(IUserRepository, MockUserRepository);
  } else if (process.env.STORAGE_TYPE === 'memory') {
    framework.impl(IUserRepository, MemoryUserRepository);
  } else {
    framework.impl(IUserRepository, DatabaseUserRepository, [IDatabaseConnection]);
  }

  framework.service(UserService, [IUserRepository]);
}
```

### 核心 API

#### Framework 类

```typescript
class Framework {
  // 添加作用域
  addScope(scopeClass: ScopeClass): void;

  // 配置作用域
  configureScope(configureFn: (scope: Scope) => void): void;

  // 注册接口实现 (impl 方法)
  impl<T>(identifier: Identifier<T>, implementation: any, deps?: any[]): FrameworkEditor;

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
