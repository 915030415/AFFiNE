# Jotai 全面使用文档手册

## 目录

1. [简介](#简介)
2. [核心概念](#核心概念)
3. [基础用法](#基础用法)
4. [高级特性](#高级特性)
5. [最佳实践](#最佳实践)
6. [性能优化](#性能优化)
7. [与其他库集成](#与其他库集成)
8. [常见问题](#常见问题)
9. [实际应用示例](#实际应用示例)

## 简介

Jotai 是一个现代的 React 状态管理库，采用原子化（atomic）的设计理念。它提供了一种简单、灵活且高性能的方式来管理应用状态。

### 核心特点

- **原子化设计**: 状态被分解为小的、独立的原子（atoms）
- **自下而上**: 从小的状态片段组合成复杂的状态
- **TypeScript 友好**: 完整的类型支持
- **无样板代码**: 最小化的 API 设计
- **高性能**: 精确的重新渲染控制
- **可扩展**: 丰富的工具和扩展

### 安装

```bash
npm install jotai
# 或
yarn add jotai
# 或
pnpm add jotai
```

## 核心概念

### 1. Atom（原子）

Atom 是 Jotai 的基本构建块，代表一个状态片段。

```typescript
import { atom } from 'jotai';

// 基础原子
const countAtom = atom(0);
const nameAtom = atom('John');
const isLoadingAtom = atom(false);

// 对象原子
const userAtom = atom({
  id: 1,
  name: 'John',
  email: 'john@example.com',
});

// 数组原子
const todosAtom = atom([
  { id: 1, text: 'Learn Jotai', completed: false },
  { id: 2, text: 'Build app', completed: false },
]);
```

### 2. 派生原子（Derived Atoms）

派生原子基于其他原子计算得出，类似于计算属性。

```typescript
// 只读派生原子
const doubleCountAtom = atom(get => get(countAtom) * 2);

// 可写派生原子
const uppercaseNameAtom = atom(
  get => get(nameAtom).toUpperCase(), // getter
  (get, set, newValue: string) => {
    set(nameAtom, newValue.toLowerCase());
  } // setter
);

// 复杂派生原子
const completedTodosAtom = atom(get => {
  const todos = get(todosAtom);
  return todos.filter(todo => todo.completed);
});

const todoStatsAtom = atom(get => {
  const todos = get(todosAtom);
  return {
    total: todos.length,
    completed: todos.filter(t => t.completed).length,
    pending: todos.filter(t => !t.completed).length,
  };
});
```

### 3. 异步原子

Jotai 原生支持异步操作。

```typescript
// 异步读取
const userDataAtom = atom(async get => {
  const userId = get(userIdAtom);
  const response = await fetch(`/api/users/${userId}`);
  return response.json();
});

// 异步写入
const saveUserAtom = atom(
  null, // 无初始值
  async (get, set, userData: User) => {
    set(isLoadingAtom, true);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      const savedUser = await response.json();
      set(userAtom, savedUser);
    } finally {
      set(isLoadingAtom, false);
    }
  }
);
```

## 基础用法

### 1. useAtom Hook

`useAtom` 是最基本的 Hook，类似于 `useState`。

```typescript
import { useAtom } from 'jotai'

function Counter() {
  const [count, setCount] = useAtom(countAtom)

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>
        Increment
      </button>
      <button onClick={() => setCount(0)}>
        Reset
      </button>
    </div>
  )
}
```

### 2. useAtomValue Hook

只读取原子值，不提供设置函数。

```typescript
import { useAtomValue } from 'jotai'

function TodoStats() {
  const stats = useAtomValue(todoStatsAtom)

  return (
    <div>
      <p>Total: {stats.total}</p>
      <p>Completed: {stats.completed}</p>
      <p>Pending: {stats.pending}</p>
    </div>
  )
}
```

### 3. useSetAtom Hook

只获取设置函数，不读取值。

```typescript
import { useSetAtom } from 'jotai'

function AddTodo() {
  const setTodos = useSetAtom(todosAtom)
  const [text, setText] = useState('')

  const addTodo = () => {
    if (text.trim()) {
      setTodos(prev => [
        ...prev,
        { id: Date.now(), text: text.trim(), completed: false }
      ])
      setText('')
    }
  }

  return (
    <div>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && addTodo()}
      />
      <button onClick={addTodo}>Add Todo</button>
    </div>
  )
}
```

### 4. Provider 组件

为应用提供原子存储上下文。

```typescript
import { Provider } from 'jotai'

function App() {
  return (
    <Provider>
      <TodoApp />
    </Provider>
  )
}

// 多个 Provider 实现状态隔离
function MultiInstanceApp() {
  return (
    <div>
      <Provider>
        <h2>Instance 1</h2>
        <Counter />
      </Provider>
      <Provider>
        <h2>Instance 2</h2>
        <Counter />
      </Provider>
    </div>
  )
}
```

## 高级特性

### 1. 原子家族（Atom Families）

动态创建相关的原子。

```typescript
import { atomFamily } from 'jotai/utils'

// 为每个用户 ID 创建一个原子
const userAtomFamily = atomFamily((userId: number) =>
  atom(async () => {
    const response = await fetch(`/api/users/${userId}`)
    return response.json()
  })
)

// 为每个 todo ID 创建一个原子
const todoAtomFamily = atomFamily((todoId: number) =>
  atom({
    id: todoId,
    text: '',
    completed: false
  })
)

function UserProfile({ userId }: { userId: number }) {
  const [user] = useAtom(userAtomFamily(userId))

  return <div>{user?.name}</div>
}
```

### 2. 可重置原子

```typescript
import { atomWithReset, useResetAtom, RESET } from 'jotai/utils'

const resettableCountAtom = atomWithReset(0)

function ResettableCounter() {
  const [count, setCount] = useAtom(resettableCountAtom)
  const resetCount = useResetAtom(resettableCountAtom)

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>+</button>
      <button onClick={() => setCount(RESET)}>Reset with RESET</button>
      <button onClick={resetCount}>Reset with hook</button>
    </div>
  )
}
```

### 3. 存储原子

将原子状态持久化到 localStorage。

```typescript
import { atomWithStorage } from 'jotai/utils'

const themeAtom = atomWithStorage('theme', 'light')
const userPreferencesAtom = atomWithStorage('userPrefs', {
  language: 'en',
  notifications: true
})

function ThemeToggle() {
  const [theme, setTheme] = useAtom(themeAtom)

  return (
    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      Current theme: {theme}
    </button>
  )
}
```

### 4. 原子效果

监听原子变化并执行副作用。

```typescript
import { atomWithEffect } from 'jotai-effect'

const loggerAtom = atomWithEffect((get, set) => {
  // 监听 count 变化
  const count = get(countAtom)
  console.log('Count changed to:', count)

  // 清理函数
  return () => {
    console.log('Effect cleanup')
  }
})

// 在组件中激活效果
function App() {
  useAtom(loggerAtom) // 激活效果
  return <Counter />
}
```

### 5. 原子回调

```typescript
import { atomWithCallback } from 'jotai/utils';

const callbackAtom = atomWithCallback((get, set) => {
  const count = get(countAtom);

  // 当 count 大于 10 时触发警告
  if (count > 10) {
    alert('Count is too high!');
    set(countAtom, 10);
  }
});
```

## 最佳实践

### 1. 原子组织

```typescript
// atoms/user.ts
export const userIdAtom = atom<number | null>(null);
export const userAtom = atom(async get => {
  const id = get(userIdAtom);
  if (!id) return null;
  return fetchUser(id);
});

// atoms/todos.ts
export const todosAtom = atom<Todo[]>([]);
export const todoFilterAtom = atom<'all' | 'completed' | 'pending'>('all');
export const filteredTodosAtom = atom(get => {
  const todos = get(todosAtom);
  const filter = get(todoFilterAtom);

  switch (filter) {
    case 'completed':
      return todos.filter(t => t.completed);
    case 'pending':
      return todos.filter(t => !t.completed);
    default:
      return todos;
  }
});

// atoms/index.ts
export * from './user';
export * from './todos';
```

### 2. 类型安全

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

interface Todo {
  id: number;
  text: string;
  completed: boolean;
  userId: number;
}

// 强类型原子
const userAtom = atom<User | null>(null);
const todosAtom = atom<Todo[]>([]);

// 类型安全的派生原子
const userTodosAtom = atom((get): Todo[] => {
  const user = get(userAtom);
  const todos = get(todosAtom);

  if (!user) return [];
  return todos.filter(todo => todo.userId === user.id);
});
```

### 3. 错误处理

```typescript
const userAtom = atom(async (get) => {
  try {
    const userId = get(userIdAtom)
    if (!userId) throw new Error('No user ID')

    const response = await fetch(`/api/users/${userId}`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to fetch user:', error)
    throw error // 重新抛出错误供组件处理
  }
})

// 在组件中处理错误
function UserProfile() {
  const [user, setUser] = useAtom(userAtom)

  if (user instanceof Promise) {
    return <div>Loading...</div>
  }

  if (user instanceof Error) {
    return <div>Error: {user.message}</div>
  }

  return <div>{user?.name}</div>
}
```

### 4. 条件原子

```typescript
const shouldFetchAtom = atom(false);
const conditionalDataAtom = atom(async get => {
  const shouldFetch = get(shouldFetchAtom);
  if (!shouldFetch) return null;

  const response = await fetch('/api/data');
  return response.json();
});
```

## 性能优化

### 1. 原子分割

```typescript
// 不好：大对象原子
const appStateAtom = atom({
  user: null,
  todos: [],
  settings: {},
  ui: { loading: false, error: null },
});

// 好：分割成小原子
const userAtom = atom(null);
const todosAtom = atom([]);
const settingsAtom = atom({});
const uiAtom = atom({ loading: false, error: null });
```

### 2. 选择性订阅

```typescript
const userAtom = atom({
  id: 1,
  name: 'John',
  email: 'john@example.com',
  preferences: { theme: 'light', lang: 'en' },
});

// 只订阅用户名
const userNameAtom = atom(get => get(userAtom).name);

// 只订阅主题
const themeAtom = atom(
  get => get(userAtom).preferences.theme,
  (get, set, newTheme: string) => {
    const user = get(userAtom);
    set(userAtom, {
      ...user,
      preferences: { ...user.preferences, theme: newTheme },
    });
  }
);
```

### 3. 懒加载

```typescript
const lazyDataAtom = atom(async () => {
  // 只在需要时加载
  const { heavyModule } = await import('./heavyModule');
  return heavyModule.getData();
});
```

### 4. 缓存策略

```typescript
import { atomWithCache } from 'jotai-cache';

const cachedUserAtom = atomWithCache(
  async get => {
    const userId = get(userIdAtom);
    return fetchUser(userId);
  },
  {
    ttl: 5 * 60 * 1000, // 5分钟缓存
    key: get => `user-${get(userIdAtom)}`,
  }
);
```

## 与其他库集成

### 1. React Query 集成

```typescript
import { atomsWithQuery } from 'jotai-tanstack-query'
import { queryClient } from './queryClient'

const [userQueryAtom] = atomsWithQuery((get) => ({
  queryKey: ['user', get(userIdAtom)],
  queryFn: async ({ queryKey: [, userId] }) => {
    const response = await fetch(`/api/users/${userId}`)
    return response.json()
  },
  enabled: !!get(userIdAtom)
}))

function UserProfile() {
  const [{ data: user, isLoading, error }] = useAtom(userQueryAtom)

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return <div>{user?.name}</div>
}
```

### 2. Zustand 迁移

```typescript
// Zustand store
const useStore = create(set => ({
  count: 0,
  increment: () => set(state => ({ count: state.count + 1 })),
  reset: () => set({ count: 0 }),
}));

// 迁移到 Jotai
const countAtom = atom(0);
const incrementAtom = atom(null, (get, set) => set(countAtom, get(countAtom) + 1));
const resetAtom = atom(null, (get, set) => set(countAtom, 0));
```

### 3. Redux DevTools

```typescript
import { useAtomDevtools } from 'jotai/devtools'

function DebugCounter() {
  const [count, setCount] = useAtom(countAtom)
  useAtomDevtools(countAtom, 'count')

  return (
    <div>
      <p>{count}</p>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  )
}
```

## 常见问题

### 1. 原子初始化时机

```typescript
// 问题：在组件外部使用 useAtom
// const [count] = useAtom(countAtom) // ❌ 错误

// 解决：在组件内部使用
function Counter() {
  const [count, setCount] = useAtom(countAtom) // ✅ 正确
  return <div>{count}</div>
}
```

### 2. 异步原子的 Suspense

```typescript
function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AsyncUserProfile />
    </Suspense>
  )
}

function AsyncUserProfile() {
  const user = useAtomValue(userAtom) // 异步原子
  return <div>{user.name}</div>
}
```

### 3. 原子依赖循环

```typescript
// 问题：循环依赖
const atomA = atom(get => get(atomB) + 1); // ❌
const atomB = atom(get => get(atomA) + 1); // ❌

// 解决：重新设计原子结构
const baseAtom = atom(0);
const atomA = atom(get => get(baseAtom) + 1); // ✅
const atomB = atom(get => get(baseAtom) + 2); // ✅
```

### 4. 内存泄漏预防

```typescript
// 使用 atomFamily 时注意清理
const userAtomFamily = atomFamily((userId: number) => atom(async () => fetchUser(userId)));

// 在适当时机清理
function cleanup() {
  userAtomFamily.remove(userId); // 移除不需要的原子
}
```

## 实际应用示例

### 1. 完整的 Todo 应用

```typescript
// atoms/todos.ts
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

export interface Todo {
  id: number;
  text: string;
  completed: boolean;
  createdAt: Date;
}

export const todosAtom = atomWithStorage<Todo[]>('todos', []);

export const filterAtom = atom<'all' | 'active' | 'completed'>('all');

export const filteredTodosAtom = atom(get => {
  const todos = get(todosAtom);
  const filter = get(filterAtom);

  switch (filter) {
    case 'active':
      return todos.filter(t => !t.completed);
    case 'completed':
      return todos.filter(t => t.completed);
    default:
      return todos;
  }
});

export const todoStatsAtom = atom(get => {
  const todos = get(todosAtom);
  return {
    total: todos.length,
    active: todos.filter(t => !t.completed).length,
    completed: todos.filter(t => t.completed).length,
  };
});

export const addTodoAtom = atom(null, (get, set, text: string) => {
  const todos = get(todosAtom);
  const newTodo: Todo = {
    id: Date.now(),
    text: text.trim(),
    completed: false,
    createdAt: new Date(),
  };
  set(todosAtom, [...todos, newTodo]);
});

export const toggleTodoAtom = atom(null, (get, set, id: number) => {
  const todos = get(todosAtom);
  set(
    todosAtom,
    todos.map(todo => (todo.id === id ? { ...todo, completed: !todo.completed } : todo))
  );
});

export const deleteTodoAtom = atom(null, (get, set, id: number) => {
  const todos = get(todosAtom);
  set(
    todosAtom,
    todos.filter(todo => todo.id !== id)
  );
});

export const clearCompletedAtom = atom(null, (get, set) => {
  const todos = get(todosAtom);
  set(
    todosAtom,
    todos.filter(todo => !todo.completed)
  );
});
```

```typescript
// components/TodoApp.tsx
import React, { useState } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  filteredTodosAtom,
  filterAtom,
  todoStatsAtom,
  addTodoAtom,
  toggleTodoAtom,
  deleteTodoAtom,
  clearCompletedAtom
} from '../atoms/todos'

export function TodoApp() {
  return (
    <div className="todo-app">
      <h1>Todo App</h1>
      <AddTodo />
      <TodoList />
      <TodoFooter />
    </div>
  )
}

function AddTodo() {
  const [text, setText] = useState('')
  const addTodo = useSetAtom(addTodoAtom)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (text.trim()) {
      addTodo(text)
      setText('')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What needs to be done?"
        className="new-todo"
      />
    </form>
  )
}

function TodoList() {
  const todos = useAtomValue(filteredTodosAtom)
  const toggleTodo = useSetAtom(toggleTodoAtom)
  const deleteTodo = useSetAtom(deleteTodoAtom)

  return (
    <ul className="todo-list">
      {todos.map(todo => (
        <li key={todo.id} className={todo.completed ? 'completed' : ''}>
          <div className="view">
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
            />
            <label>{todo.text}</label>
            <button
              className="destroy"
              onClick={() => deleteTodo(todo.id)}
            >
              ×
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}

function TodoFooter() {
  const [filter, setFilter] = useAtom(filterAtom)
  const stats = useAtomValue(todoStatsAtom)
  const clearCompleted = useSetAtom(clearCompletedAtom)

  if (stats.total === 0) return null

  return (
    <footer className="footer">
      <span className="todo-count">
        <strong>{stats.active}</strong> item{stats.active !== 1 ? 's' : ''} left
      </span>

      <ul className="filters">
        {(['all', 'active', 'completed'] as const).map(f => (
          <li key={f}>
            <button
              className={filter === f ? 'selected' : ''}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          </li>
        ))}
      </ul>

      {stats.completed > 0 && (
        <button
          className="clear-completed"
          onClick={clearCompleted}
        >
          Clear completed
        </button>
      )}
    </footer>
  )
}
```

### 2. 用户认证系统

```typescript
// atoms/auth.ts
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

export const tokenAtom = atomWithStorage<string | null>('auth-token', null);

export const currentUserAtom = atom<User | null>(async get => {
  const token = get(tokenAtom);
  if (!token) return null;

  try {
    const response = await fetch('/api/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user');
    }

    return await response.json();
  } catch (error) {
    // Token 可能已过期，清除它
    return null;
  }
});

export const isAuthenticatedAtom = atom(get => {
  const user = get(currentUserAtom);
  return user !== null;
});

export const isAdminAtom = atom(get => {
  const user = get(currentUserAtom);
  return user?.role === 'admin';
});

export const loginAtom = atom(null, async (get, set, credentials: { email: string; password: string }) => {
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    throw new Error('Login failed');
  }

  const { token } = await response.json();
  set(tokenAtom, token);
});

export const logoutAtom = atom(null, (get, set) => {
  set(tokenAtom, null);
});
```

### 3. 主题系统

```typescript
// atoms/theme.ts
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

export type Theme = 'light' | 'dark' | 'auto';

export const themeAtom = atomWithStorage<Theme>('theme', 'auto');

export const systemThemeAtom = atom<'light' | 'dark'>('light');

export const effectiveThemeAtom = atom(get => {
  const theme = get(themeAtom);
  const systemTheme = get(systemThemeAtom);

  return theme === 'auto' ? systemTheme : theme;
});

// 监听系统主题变化
export const themeEffectAtom = atom(null, (get, set) => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const updateSystemTheme = () => {
    set(systemThemeAtom, mediaQuery.matches ? 'dark' : 'light');
  };

  updateSystemTheme();
  mediaQuery.addEventListener('change', updateSystemTheme);

  return () => {
    mediaQuery.removeEventListener('change', updateSystemTheme);
  };
});
```

## 总结

Jotai 提供了一种现代、灵活且高性能的状态管理解决方案。其原子化的设计理念使得状态管理变得简单直观，同时保持了出色的性能和类型安全。

### 主要优势

1. **简单易用**: 最小化的 API，易于学习和使用
2. **高性能**: 精确的重新渲染控制
3. **类型安全**: 完整的 TypeScript 支持
4. **可扩展**: 丰富的工具和扩展生态
5. **灵活性**: 支持同步和异步状态
6. **可测试**: 原子可以独立测试

### 适用场景

- 中小型到大型 React 应用
- 需要精确性能控制的应用
- 复杂的异步状态管理
- 需要状态持久化的应用
- 多实例或多租户应用

通过合理使用 Jotai 的各种特性，你可以构建出高性能、可维护的 React 应用。记住始终遵循最佳实践，保持原子的小而专一，合理组织代码结构，这样才能充分发挥 Jotai 的优势。
