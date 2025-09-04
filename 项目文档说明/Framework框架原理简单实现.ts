/**
 * AFFiNE Framework Mini版本 - 核心原理实现
 * 包含：服务、实体、作用域、仓库、LiveData、React集成等
 *
 * ================================
 * useSyncExternalStore 详解
 * ================================
 *
 * useSyncExternalStore 是 React 18 引入的一个 Hook，专门用于订阅外部数据源。
 * 它解决了在并发渲染模式下，外部状态管理库与 React 的同步问题。
 *
 * 核心作用：
 * 1. 安全地订阅外部数据源（如 Redux、Zustand、自定义状态管理等）
 * 2. 确保在并发渲染中数据的一致性
 * 3. 避免 "tearing" 现象（同一次渲染中看到不同版本的数据）
 * 4. 提供 SSR（服务端渲染）支持
 *
 * 基本语法：
 * ```typescript
 * const value = useSyncExternalStore(
 *   subscribe,    // 订阅函数：(callback) => unsubscribe
 *   getSnapshot,  // 获取当前值的函数：() => value
 *   getServerSnapshot? // 可选：SSR时获取服务端快照
 * );
 * ```
 *
 * 参数详解：
 * - subscribe: 接收一个回调函数，当外部数据变化时调用该回调
 *   返回一个取消订阅的函数
 * - getSnapshot: 返回当前数据的快照，React 用它来检测数据是否变化
 * - getServerSnapshot: 可选，用于 SSR，返回服务端的初始数据
 *
 * 使用示例：
 * ```typescript
 * // 1. 简单的外部状态
 * class ExternalStore {
 *   private value = 0;
 *   private listeners = new Set<() => void>();
 *
 *   subscribe = (callback: () => void) => {
 *     this.listeners.add(callback);
 *     return () => this.listeners.delete(callback);
 *   };
 *
 *   getSnapshot = () => this.value;
 *
 *   setValue = (newValue: number) => {
 *     this.value = newValue;
 *     this.listeners.forEach(callback => callback());
 *   };
 * }
 *
 * // 2. 在组件中使用
 * function MyComponent() {
 *   const store = useMemo(() => new ExternalStore(), []);
 *   const value = useSyncExternalStore(
 *     store.subscribe,
 *     store.getSnapshot
 *   );
 *
 *   return <div>Value: {value}</div>;
 * }
 * ```
 *
 * 在本框架中的应用：
 * - LiveData 类实现了 subscribe 和 getSnapshot 方法
 * - useLiveData Hook 内部使用 useSyncExternalStore
 * - 确保响应式数据在 React 并发模式下的安全性
 *
 * 优势：
 * 1. 并发安全：避免在 Suspense、时间切片等场景下的数据不一致
 * 2. 性能优化：只有在数据真正变化时才触发重渲染
 * 3. 标准化：React 官方推荐的外部状态订阅方式
 * 4. 向后兼容：在不支持并发特性的 React 版本中降级为普通订阅
 */

import React, {
  Component,
  createContext,
  ReactNode,
  useContext,
  useSyncExternalStore,
} from 'react';

// ================================
// 1. 基础类型定义
// ================================

// 服务构造函数类型
type ServiceConstructor<T = any> = new (...args: any[]) => T;

// 依赖注入标识符
type ServiceIdentifier<T = any> = ServiceConstructor<T> | string | symbol;

// 服务配置
interface ServiceConfig {
  singleton?: boolean; // 是否单例
  deps?: ServiceIdentifier[]; // 依赖项
}

// ================================
// 2. LiveData - 响应式数据核心
// ================================

/**
 * LiveData: 基于观察者模式的响应式数据容器
 * 核心原理：
 * 1. 维护订阅者列表
 * 2. 数据变更时通知所有订阅者
 * 3. 与React的useSyncExternalStore集成
 */
class LiveData<T> {
  private _value: T;
  private _listeners = new Set<() => void>();
  private _version = 0; // 用于优化，避免不必要的更新

  constructor(initialValue: T) {
    this._value = initialValue;
  }

  // 获取当前值
  get value(): T {
    return this._value;
  }

  // 设置新值并通知订阅者
  set value(newValue: T) {
    if (this._value !== newValue) {
      this._value = newValue;
      this._version++;
      this._notifyListeners();
    }
  }

  // 订阅数据变更
  subscribe(listener: () => void): () => void {
    this._listeners.add(listener);
    // 返回取消订阅函数
    return () => {
      this._listeners.delete(listener);
    };
  }

  // 获取快照（用于React的useSyncExternalStore）
  getSnapshot = (): T => {
    return this._value;
  };

  // 通知所有订阅者
  private _notifyListeners(): void {
    this._listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('LiveData listener error:', error);
      }
    });
  }

  // 映射转换
  map<U>(mapper: (value: T) => U): LiveData<U> {
    const mapped = new LiveData(mapper(this._value));
    this.subscribe(() => {
      mapped.value = mapper(this._value);
    });
    return mapped;
  }

  // 过滤
  filter(predicate: (value: T) => boolean): LiveData<T | undefined> {
    const filtered = new LiveData<T | undefined>(
      predicate(this._value) ? this._value : undefined
    );
    this.subscribe(() => {
      filtered.value = predicate(this._value) ? this._value : undefined;
    });
    return filtered;
  }
}

// ================================
// 3. 依赖注入容器 (IoC Container)
// ================================

/**
 * 依赖注入容器核心原理：
 * 1. 服务注册：将服务构造函数和配置存储在容器中
 * 2. 依赖解析：递归解析服务的依赖关系
 * 3. 实例管理：根据配置决定是否复用实例（单例模式）
 * 4. 循环依赖检测：防止无限递归
 */
class DIContainer {
  private _services = new Map<ServiceIdentifier, ServiceConfig>();
  private _instances = new Map<ServiceIdentifier, any>();
  private _resolving = new Set<ServiceIdentifier>(); // 用于检测循环依赖

  /**
   * 注册服务
   * @param identifier 服务标识符
   * @param constructor 服务构造函数
   * @param config 服务配置
   */
  register<T>(
    identifier: ServiceIdentifier<T>,
    constructor: ServiceConstructor<T>,
    config: ServiceConfig = {}
  ): void {
    this._services.set(identifier, {
      singleton: true, // 默认单例
      ...config,
      constructor,
    } as any);
  }

  /**
   * 解析服务实例
   * 核心依赖注入逻辑
   */
  resolve<T>(identifier: ServiceIdentifier<T>): T {
    // 检测循环依赖
    if (this._resolving.has(identifier)) {
      throw new Error(`Circular dependency detected: ${String(identifier)}`);
    }

    const config = this._services.get(identifier);
    if (!config) {
      throw new Error(`Service not registered: ${String(identifier)}`);
    }

    // 如果是单例且已存在实例，直接返回
    if (config.singleton && this._instances.has(identifier)) {
      return this._instances.get(identifier);
    }

    // 标记正在解析，用于循环依赖检测
    this._resolving.add(identifier);

    try {
      // 解析依赖
      const deps = config.deps || [];
      const resolvedDeps = deps.map(dep => this.resolve(dep));

      // 创建实例
      const Constructor = (config as any).constructor;
      const instance = new Constructor(...resolvedDeps);

      // 如果是单例，缓存实例
      if (config.singleton) {
        this._instances.set(identifier, instance);
      }

      return instance;
    } finally {
      // 清除解析标记
      this._resolving.delete(identifier);
    }
  }

  /**
   * 检查服务是否已注册
   */
  has(identifier: ServiceIdentifier): boolean {
    return this._services.has(identifier);
  }

  /**
   * 清理容器（用于测试或重置）
   */
  clear(): void {
    this._services.clear();
    this._instances.clear();
    this._resolving.clear();
  }

  /**
   * 创建子容器（继承父容器的服务）
   */
  createChild(): DIContainer {
    const child = new DIContainer();
    // 复制父容器的服务注册信息
    this._services.forEach((config, identifier) => {
      child._services.set(identifier, config);
    });
    return child;
  }
}

// ================================
// 4. 作用域 (Scope) - 服务生命周期管理
// ================================

/**
 * 作用域核心原理：
 * 1. 每个作用域拥有独立的依赖注入容器
 * 2. 作用域可以形成层级关系（父子关系）
 * 3. 子作用域可以访问父作用域的服务
 * 4. 作用域销毁时，清理所有相关资源
 */
class Scope {
  private _container: DIContainer;
  private _parent?: Scope;
  private _children = new Set<Scope>();
  private _disposed = false;

  constructor(parent?: Scope) {
    this._parent = parent;
    this._container = parent
      ? parent._container.createChild()
      : new DIContainer();

    if (parent) {
      parent._children.add(this);
    }
  }

  /**
   * 注册服务到当前作用域
   */
  register<T>(
    identifier: ServiceIdentifier<T>,
    constructor: ServiceConstructor<T>,
    config?: ServiceConfig
  ): void {
    if (this._disposed) {
      throw new Error('Cannot register service on disposed scope');
    }
    this._container.register(identifier, constructor, config);
  }

  /**
   * 从当前作用域解析服务
   * 如果当前作用域没有，会向上查找父作用域
   */
  resolve<T>(identifier: ServiceIdentifier<T>): T {
    if (this._disposed) {
      throw new Error('Cannot resolve service from disposed scope');
    }

    try {
      return this._container.resolve(identifier);
    } catch (error) {
      // 如果当前作用域解析失败，尝试父作用域
      if (this._parent) {
        return this._parent.resolve(identifier);
      }
      throw error;
    }
  }

  /**
   * 创建子作用域
   */
  createChild(): Scope {
    if (this._disposed) {
      throw new Error('Cannot create child scope from disposed scope');
    }
    return new Scope(this);
  }

  /**
   * 销毁作用域
   * 清理所有资源，包括子作用域
   */
  dispose(): void {
    if (this._disposed) return;

    this._disposed = true;

    // 销毁所有子作用域
    this._children.forEach(child => child.dispose());
    this._children.clear();

    // 从父作用域中移除
    if (this._parent) {
      this._parent._children.delete(this);
    }

    // 清理容器
    this._container.clear();
  }

  /**
   * 检查作用域是否已销毁
   */
  get disposed(): boolean {
    return this._disposed;
  }
}

// ================================
// 5. 实体 (Entity) - 业务对象基类
// ================================

/**
 * 实体基类
 * 提供响应式属性管理和生命周期钩子
 */
abstract class Entity {
  private _liveDataMap = new Map<string, LiveData<any>>();
  private _disposed = false;

  /**
   * 创建响应式属性
   */
  protected createLiveData<T>(key: string, initialValue: T): LiveData<T> {
    if (this._liveDataMap.has(key)) {
      return this._liveDataMap.get(key)!;
    }

    const liveData = new LiveData(initialValue);
    this._liveDataMap.set(key, liveData);
    return liveData;
  }

  /**
   * 获取响应式属性
   */
  protected getLiveData<T>(key: string): LiveData<T> | undefined {
    return this._liveDataMap.get(key);
  }

  /**
   * 销毁实体
   */
  dispose(): void {
    if (this._disposed) return;

    this._disposed = true;
    this._liveDataMap.clear();
    this.onDispose();
  }

  /**
   * 销毁钩子，子类可重写
   */
  protected onDispose(): void {
    // 子类可重写此方法进行清理
  }

  get disposed(): boolean {
    return this._disposed;
  }
}

// ================================
// 6. 服务 (Service) - 业务逻辑容器
// ================================

/**
 * 服务基类
 * 提供依赖注入和生命周期管理
 */
abstract class Service {
  private _disposed = false;

  /**
   * 初始化钩子，在依赖注入完成后调用
   */
  protected onInit(): void {
    // 子类可重写此方法进行初始化
  }

  /**
   * 销毁服务
   */
  dispose(): void {
    if (this._disposed) return;

    this._disposed = true;
    this.onDispose();
  }

  /**
   * 销毁钩子，子类可重写
   */
  protected onDispose(): void {
    // 子类可重写此方法进行清理
  }

  get disposed(): boolean {
    return this._disposed;
  }
}

// ================================
// 7. Framework - 框架核心入口类
// ================================

/**
 * Framework 核心类
 * 框架的主入口，负责：
 * 1. 管理根作用域
 * 2. 提供服务注册的便捷方法
 * 3. 框架的初始化和销毁
 * 4. 全局配置管理
 */
class Framework {
  private _rootScope: Scope;
  private _initialized = false;
  private _disposed = false;

  constructor() {
    this._rootScope = new Scope();
  }

  /**
   * 注册服务到根作用域
   * @param identifier 服务标识符
   * @param constructor 服务构造函数
   * @param config 服务配置
   */
  register<T>(
    identifier: ServiceIdentifier<T>,
    constructor: ServiceConstructor<T>,
    config?: ServiceConfig
  ): Framework {
    if (this._disposed) {
      throw new Error('Cannot register service on disposed framework');
    }

    this._rootScope.register(identifier, constructor, config);
    return this; // 支持链式调用
  }

  /**
   * 批量注册服务
   * @param services 服务配置数组
   */
  registerServices(
    services: Array<{
      identifier: ServiceIdentifier;
      constructor: ServiceConstructor;
      config?: ServiceConfig;
    }>
  ): Framework {
    services.forEach(({ identifier, constructor, config }) => {
      this.register(identifier, constructor, config);
    });
    return this;
  }

  /**
   * 初始化框架
   * 可以在这里执行一些全局初始化逻辑
   */
  async initialize(): Promise<void> {
    if (this._initialized) {
      console.warn('Framework already initialized');
      return;
    }

    if (this._disposed) {
      throw new Error('Cannot initialize disposed framework');
    }

    try {
      // 这里可以添加框架级别的初始化逻辑
      // 比如：预加载关键服务、设置全局错误处理等

      this._initialized = true;
      console.log('Framework initialized successfully');
    } catch (error) {
      console.error('Framework initialization failed:', error);
      throw error;
    }
  }

  /**
   * 获取根作用域
   * 主要用于React集成
   */
  get rootScope(): Scope {
    return this._rootScope;
  }

  /**
   * 从根作用域解析服务
   * @param identifier 服务标识符
   */
  resolve<T>(identifier: ServiceIdentifier<T>): T {
    if (this._disposed) {
      throw new Error('Cannot resolve service from disposed framework');
    }
    return this._rootScope.resolve(identifier);
  }

  /**
   * 创建子作用域
   */
  createScope(): Scope {
    if (this._disposed) {
      throw new Error('Cannot create scope from disposed framework');
    }
    return this._rootScope.createChild();
  }

  /**
   * 销毁框架
   * 清理所有资源
   */
  dispose(): void {
    if (this._disposed) return;

    this._disposed = true;
    this._initialized = false;

    // 销毁根作用域（会级联销毁所有子作用域）
    this._rootScope.dispose();

    console.log('Framework disposed');
  }

  /**
   * 检查框架状态
   */
  get initialized(): boolean {
    return this._initialized;
  }

  get disposed(): boolean {
    return this._disposed;
  }

  /**
   * 静态工厂方法：创建并初始化框架实例
   */
  static async create(): Promise<Framework> {
    const framework = new Framework();
    await framework.initialize();
    return framework;
  }

  /**
   * 静态工厂方法：创建预配置的框架实例
   * @param configurator 配置函数
   */
  static async createWithConfig(
    configurator: (framework: Framework) => void | Promise<void>
  ): Promise<Framework> {
    const framework = new Framework();

    // 执行配置
    await configurator(framework);

    // 初始化
    await framework.initialize();

    return framework;
  }
}

// ================================
// 8. React 集成
// ================================

// 作用域上下文
const ScopeContext = createContext<Scope | null>(null);

/**
 * FrameworkRoot - 根作用域提供者
 */
interface FrameworkRootProps {
  children: ReactNode;
  scope?: Scope;
}

function FrameworkRoot({ children, scope }: FrameworkRootProps) {
  const rootScope = scope || new Scope();

  return React.createElement(
    ScopeContext.Provider,
    { value: rootScope },
    children
  );
}

/**
 * FrameworkScope - 子作用域提供者
 */
interface FrameworkScopeProps {
  children: ReactNode;
  onScopeCreate?: (scope: Scope) => void;
}

class FrameworkScope extends Component<FrameworkScopeProps> {
  private scope: Scope | null = null;

  static contextType = ScopeContext;
  declare context: Scope | null;

  componentDidMount() {
    if (!this.context) {
      throw new Error('FrameworkScope must be used within FrameworkRoot');
    }

    this.scope = this.context.createChild();
    this.props.onScopeCreate?.(this.scope);
  }

  componentWillUnmount() {
    this.scope?.dispose();
  }

  render() {
    if (!this.scope) {
      return null;
    }

    return React.createElement(
      ScopeContext.Provider,
      { value: this.scope },
      this.props.children
    );
  }
}

/**
 * useService - 获取服务实例的Hook
 */
function useService<T>(identifier: ServiceIdentifier<T>): T {
  const scope = useContext(ScopeContext);

  if (!scope) {
    throw new Error(
      'useService must be used within FrameworkRoot or FrameworkScope'
    );
  }

  return scope.resolve(identifier);
}

/**
 * useLiveData - 订阅LiveData的Hook
 */
function useLiveData<T>(liveData: LiveData<T>): T {
  return useSyncExternalStore(
    liveData.subscribe.bind(liveData),
    liveData.getSnapshot.bind(liveData),
    liveData.getSnapshot.bind(liveData) // SSR支持
  );
}

// ================================
// 8. 仓库 (Repository) - 数据访问层
// ================================

/**
 * 仓库基类
 * 提供数据访问的统一接口
 */
abstract class Repository<T, K = string> extends Service {
  /**
   * 根据ID查找实体
   */
  abstract findById(id: K): Promise<T | null>;

  /**
   * 查找所有实体
   */
  abstract findAll(): Promise<T[]>;

  /**
   * 保存实体
   */
  abstract save(entity: T): Promise<T>;

  /**
   * 删除实体
   */
  abstract delete(id: K): Promise<boolean>;
}

// ================================
// 9. 使用示例
// ================================

/**
 * 示例：用户实体
 */
class User extends Entity {
  readonly id: LiveData<string>;
  readonly name: LiveData<string>;
  readonly email: LiveData<string>;

  constructor(id: string, name: string, email: string) {
    super();
    this.id = this.createLiveData('id', id);
    this.name = this.createLiveData('name', name);
    this.email = this.createLiveData('email', email);
  }

  updateName(newName: string): void {
    this.name.value = newName;
  }

  updateEmail(newEmail: string): void {
    this.email.value = newEmail;
  }
}

/**
 * 示例：用户仓库
 */
class UserRepository extends Repository<User, string> {
  private users = new Map<string, User>();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findAll(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async save(user: User): Promise<User> {
    this.users.set(user.id.value, user);
    return user;
  }

  async delete(id: string): Promise<boolean> {
    return this.users.delete(id);
  }
}

/**
 * 示例：用户服务
 */
class UserService extends Service {
  private _currentUser = new LiveData<User | null>(null);
  private _users = new LiveData<User[]>([]);

  constructor(private userRepository: UserRepository) {
    super();
  }

  get currentUser(): LiveData<User | null> {
    return this._currentUser;
  }

  get users(): LiveData<User[]> {
    return this._users;
  }

  async createUser(name: string, email: string): Promise<User> {
    const id = Math.random().toString(36).substr(2, 9);
    const user = new User(id, name, email);
    await this.userRepository.save(user);

    // 更新用户列表
    const allUsers = await this.userRepository.findAll();
    this._users.value = allUsers;

    return user;
  }

  async setCurrentUser(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    this._currentUser.value = user;
  }

  async loadUsers(): Promise<void> {
    const users = await this.userRepository.findAll();
    this._users.value = users;
  }
}

// ================================
// 10. 完整使用示例
// ================================

/**
 * 使用步骤：
 *
 * 1. 使用Framework类创建和配置框架实例
 */
async function setupFramework(): Promise<Framework> {
  // 方式1：基本创建
  const framework = new Framework();

  // 注册仓库
  framework.register('UserRepository', UserRepository);

  // 注册服务（声明依赖）
  framework.register('UserService', UserService, {
    deps: ['UserRepository'],
  });

  // 初始化框架
  await framework.initialize();

  return framework;
}

/**
 * 方式2：使用工厂方法和配置函数
 */
async function setupFrameworkWithConfig(): Promise<Framework> {
  return Framework.createWithConfig(async framework => {
    // 批量注册服务
    framework.registerServices([
      {
        identifier: 'UserRepository',
        constructor: UserRepository,
      },
      {
        identifier: 'UserService',
        constructor: UserService,
        config: { deps: ['UserRepository'] },
      },
    ]);
  });
}

/**
 * 传统方式：直接使用Scope（向后兼容）
 */
function setupFrameworkLegacy(): Scope {
  const rootScope = new Scope();

  // 注册仓库
  rootScope.register('UserRepository', UserRepository);

  // 注册服务（声明依赖）
  rootScope.register('UserService', UserService, {
    deps: ['UserRepository'],
  });

  return rootScope;
}

/**
 * 2. React组件中使用
 */
/*
function UserProfile() {
  const userService = useService('UserService');
  const currentUser = useLiveData(userService.currentUser);
  const users = useLiveData(userService.users);

  useEffect(() => {
    userService.loadUsers();
  }, [userService]);

  const handleCreateUser = async () => {
    await userService.createUser('张三', 'zhangsan@example.com');
  };

  return (
    <div>
      <h2>当前用户</h2>
      {currentUser ? (
        <div>
          <p>姓名: {useLiveData(currentUser.name)}</p>
          <p>邮箱: {useLiveData(currentUser.email)}</p>
        </div>
      ) : (
        <p>未登录</p>
      )}

      <h2>所有用户</h2>
      <ul>
        {users.map(user => (
          <li key={useLiveData(user.id)}>
            {useLiveData(user.name)} - {useLiveData(user.email)}
          </li>
        ))}
      </ul>

      <button onClick={handleCreateUser}>创建用户</button>
    </div>
  );
}

// 使用Framework类的App组件
function App() {
  const [framework, setFramework] = useState<Framework | null>(null);

  useEffect(() => {
    // 异步初始化框架
    setupFramework().then(setFramework);

    // 清理函数
    return () => {
      framework?.dispose();
    };
  }, []);

  if (!framework) {
    return <div>Loading framework...</div>;
  }

  return (
    <FrameworkRoot scope={framework.rootScope}>
      <FrameworkScope>
        <UserProfile />
      </FrameworkScope>
    </FrameworkRoot>
  );
}

// 或者使用传统方式（向后兼容）
function AppLegacy() {
  const rootScope = setupFrameworkLegacy();

  return (
    <FrameworkRoot scope={rootScope}>
      <FrameworkScope>
        <UserProfile />
      </FrameworkScope>
    </FrameworkRoot>
  );
}
*/

/**
 * 3. 高级用法：作用域隔离
 */
/*
function Modal({ children }: { children: ReactNode }) {
  return (
    <FrameworkScope onScopeCreate={(scope) => {
      // 为模态框创建独立的服务实例
      scope.register('ModalUserService', UserService, {
        deps: ['UserRepository']
      });
    }}>
      <div className="modal">
        {children}
      </div>
    </FrameworkScope>
  );
}
*/

// 导出所有核心组件
export {
  DIContainer,
  Entity,
  Framework,
  FrameworkRoot,
  FrameworkScope,
  LiveData,
  Repository,
  Scope,
  Service,
  useLiveData,
  User,
  UserRepository,
  UserService,
  useService,
};

/**
 * 总结：
 *
 * 1. 依赖注入原理：
 *    - 通过DIContainer管理服务的注册和解析
 *    - 递归解析依赖关系，支持循环依赖检测
 *    - 支持单例模式和原型模式
 *
 * 2. 响应式数据原理：
 *    - LiveData基于观察者模式实现
 *    - 与React的useSyncExternalStore集成
 *    - 支持数据变换（map、filter等）
 *
 * 3. 作用域管理原理：
 *    - 每个作用域拥有独立的服务容器
 *    - 支持层级关系，子作用域可访问父作用域服务
 *    - 自动生命周期管理，组件销毁时清理资源
 *
 * 4. React集成原理：
 *    - 通过Context传递作用域
 *    - 使用useSyncExternalStore确保并发安全
 *    - 组件级别的服务隔离
 *
 * 这个mini版本展示了AFFiNE Framework的核心设计思想：
 * - 强类型的依赖注入
 * - 响应式数据管理
 * - 灵活的作用域控制
 * - 深度的React集成
 */
