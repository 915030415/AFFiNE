# RxJS 全面使用文档手册

## 目录

1. [简介](#简介)
2. [核心概念](#核心概念)
3. [Observable 详解](#observable-详解)
4. [操作符分类详解](#操作符分类详解)
5. [Subject 详解](#subject-详解)
6. [调度器 (Schedulers)](#调度器-schedulers)
7. [错误处理](#错误处理)
8. [最佳实践](#最佳实践)
9. [性能优化](#性能优化)
10. [与框架集成](#与框架集成)
11. [实际应用示例](#实际应用示例)
12. [常见问题](#常见问题)

## 简介

RxJS (Reactive Extensions for JavaScript) 是一个使用可观察序列来编写异步和基于事件的程序的库。它提供了一种函数式编程的方法来处理异步数据流。

### 核心特点

- **响应式编程**: 以数据流为中心的编程范式
- **函数式编程**: 不可变性、纯函数、组合性
- **异步处理**: 统一处理各种异步操作
- **强大的操作符**: 丰富的数据转换和组合操作
- **错误处理**: 优雅的错误传播和处理机制
- **内存管理**: 自动的资源清理和取消订阅

### 安装

```bash
npm install rxjs
# 或
yarn add rxjs
# 或
pnpm add rxjs
```

### 基本导入

```typescript
// 导入核心类
import { Observable, Subject, BehaviorSubject, ReplaySubject } from 'rxjs';

// 导入操作符
import { map, filter, mergeMap, switchMap, catchError, retry } from 'rxjs/operators';

// 导入创建函数
import { of, from, interval, fromEvent, timer } from 'rxjs';
```

## 核心概念

### 1. Observable (可观察对象)

Observable 是 RxJS 的核心概念，代表一个可以发出多个值的数据流。

```typescript
import { Observable } from 'rxjs';

// 创建一个简单的 Observable
const observable = new Observable(subscriber => {
  subscriber.next(1);
  subscriber.next(2);
  subscriber.next(3);
  subscriber.complete();
});

// 订阅 Observable
observable.subscribe({
  next: value => console.log('接收到值:', value),
  error: err => console.error('发生错误:', err),
  complete: () => console.log('完成'),
});
```

### 2. Observer (观察者)

Observer 是一个对象，定义了如何处理 Observable 发出的值。

```typescript
const observer = {
  next: (value: any) => console.log('Next:', value),
  error: (error: any) => console.error('Error:', error),
  complete: () => console.log('Complete'),
};

observable.subscribe(observer);
```

### 3. Subscription (订阅)

Subscription 表示一个可释放的资源，通常是 Observable 的执行。

```typescript
const subscription = observable.subscribe(value => console.log(value));

// 取消订阅
subscription.unsubscribe();

// 组合多个订阅
const subscription1 = observable1.subscribe();
const subscription2 = observable2.subscribe();

subscription1.add(subscription2);
// 取消订阅时会同时取消 subscription2
subscription1.unsubscribe();
```

### 4. Operators (操作符)

操作符是纯函数，用于转换、过滤、组合 Observable。

```typescript
import { of } from 'rxjs';
import { map, filter } from 'rxjs/operators';

of(1, 2, 3, 4, 5)
  .pipe(
    filter(x => x % 2 === 0), // 过滤偶数
    map(x => x * 2) // 乘以 2
  )
  .subscribe(console.log); // 输出: 4, 8
```

## Observable 详解

### 1. 创建 Observable

#### 使用构造函数

```typescript
const customObservable = new Observable<number>(subscriber => {
  let count = 0;
  const intervalId = setInterval(() => {
    subscriber.next(count++);
    if (count > 5) {
      subscriber.complete();
      clearInterval(intervalId);
    }
  }, 1000);

  // 返回清理函数
  return () => {
    clearInterval(intervalId);
  };
});
```

#### 使用创建操作符

```typescript
import { of, from, interval, fromEvent, timer, range } from 'rxjs';

// of: 发出指定的值
of(1, 2, 3).subscribe(console.log);

// from: 从数组、Promise、迭代器等创建
from([1, 2, 3]).subscribe(console.log);
from(Promise.resolve('Hello')).subscribe(console.log);

// interval: 定时发出递增数字
interval(1000).subscribe(console.log);

// timer: 延迟后发出值
timer(2000, 1000).subscribe(console.log); // 2秒后开始，每秒发出

// range: 发出指定范围的数字
range(1, 5).subscribe(console.log); // 1, 2, 3, 4, 5

// fromEvent: 从 DOM 事件创建
const clicks = fromEvent(document, 'click');
clicks.subscribe(event => console.log('点击事件', event));
```

### 2. 热 Observable vs 冷 Observable

#### 冷 Observable

```typescript
// 冷 Observable: 每个订阅者都会获得独立的执行
const cold = new Observable(subscriber => {
  console.log('开始执行');
  subscriber.next(Math.random());
});

cold.subscribe(value => console.log('订阅者1:', value));
cold.subscribe(value => console.log('订阅者2:', value));
// 输出两个不同的随机数
```

#### 热 Observable

```typescript
import { share } from 'rxjs/operators';

// 热 Observable: 多个订阅者共享同一个执行
const hot = cold.pipe(share());

hot.subscribe(value => console.log('订阅者1:', value));
hot.subscribe(value => console.log('订阅者2:', value));
// 输出相同的随机数
```

## 操作符分类详解

### 1. 创建操作符

```typescript
import { of, from, interval, timer, range, empty, never, throwError, defer } from 'rxjs';

// empty: 立即完成的空 Observable
empty().subscribe({
  next: () => console.log('不会执行'),
  complete: () => console.log('立即完成'),
});

// never: 永不发出值也不完成
never().subscribe({
  next: () => console.log('永不执行'),
  complete: () => console.log('永不完成'),
});

// throwError: 立即发出错误
throwError('出错了').subscribe({
  error: err => console.log('错误:', err),
});

// defer: 延迟创建 Observable
const deferred = defer(() => {
  console.log('现在才创建');
  return of(1, 2, 3);
});
```

### 2. 转换操作符

#### map 系列

```typescript
import { of } from 'rxjs';
import { map, mapTo, pluck } from 'rxjs/operators';

// map: 转换每个值
of(1, 2, 3)
  .pipe(map(x => x * 2))
  .subscribe(console.log); // 2, 4, 6

// mapTo: 映射到固定值
of(1, 2, 3).pipe(mapTo('hello')).subscribe(console.log); // 'hello', 'hello', 'hello'

// pluck: 提取对象属性
of({ name: 'Alice', age: 25 }, { name: 'Bob', age: 30 }).pipe(pluck('name')).subscribe(console.log); // 'Alice', 'Bob'
```

#### 高阶操作符

```typescript
import { of, interval } from 'rxjs';
import { mergeMap, switchMap, concatMap, exhaustMap, map, take } from 'rxjs/operators';

// mergeMap: 并发处理，不取消之前的内部 Observable
of(1, 2, 3)
  .pipe(
    mergeMap(x =>
      interval(1000).pipe(
        map(i => `${x}-${i}`),
        take(3)
      )
    )
  )
  .subscribe(console.log);

// switchMap: 切换到新的内部 Observable，取消之前的
of(1, 2, 3)
  .pipe(
    switchMap(x =>
      interval(1000).pipe(
        map(i => `${x}-${i}`),
        take(3)
      )
    )
  )
  .subscribe(console.log);

// concatMap: 顺序处理，等待前一个完成
of(1, 2, 3)
  .pipe(
    concatMap(x =>
      interval(1000).pipe(
        map(i => `${x}-${i}`),
        take(2)
      )
    )
  )
  .subscribe(console.log);

// exhaustMap: 忽略新值直到当前内部 Observable 完成
of(1, 2, 3)
  .pipe(
    exhaustMap(x =>
      interval(1000).pipe(
        map(i => `${x}-${i}`),
        take(2)
      )
    )
  )
  .subscribe(console.log);
```

### 3. 过滤操作符

```typescript
import { of, interval } from 'rxjs';
import { filter, take, takeWhile, takeUntil, skip, skipWhile, skipUntil, first, last, distinct, distinctUntilChanged } from 'rxjs/operators';

// filter: 过滤值
of(1, 2, 3, 4, 5)
  .pipe(filter(x => x % 2 === 0))
  .subscribe(console.log); // 2, 4

// take: 取前 n 个值
interval(1000).pipe(take(3)).subscribe(console.log); // 0, 1, 2

// takeWhile: 取值直到条件为假
of(1, 2, 3, 4, 5)
  .pipe(takeWhile(x => x < 4))
  .subscribe(console.log); // 1, 2, 3

// skip: 跳过前 n 个值
of(1, 2, 3, 4, 5).pipe(skip(2)).subscribe(console.log); // 3, 4, 5

// distinct: 去重
of(1, 2, 2, 3, 3, 4).pipe(distinct()).subscribe(console.log); // 1, 2, 3, 4

// distinctUntilChanged: 连续重复值去重
of(1, 1, 2, 2, 3, 3).pipe(distinctUntilChanged()).subscribe(console.log); // 1, 2, 3
```

### 4. 组合操作符

```typescript
import { of, interval } from 'rxjs';
import { merge, concat, combineLatest, zip, startWith, withLatestFrom } from 'rxjs';
import { map, take } from 'rxjs/operators';

// merge: 合并多个 Observable
const obs1 = interval(1000).pipe(
  map(x => `A${x}`),
  take(3)
);
const obs2 = interval(1500).pipe(
  map(x => `B${x}`),
  take(3)
);

merge(obs1, obs2).subscribe(console.log);

// concat: 顺序连接 Observable
concat(of(1, 2), of(3, 4)).subscribe(console.log); // 1, 2, 3, 4

// combineLatest: 组合最新值
const temp = of(20, 25, 30);
const humidity = of(40, 50, 60);

combineLatest([temp, humidity])
  .pipe(map(([t, h]) => ({ temperature: t, humidity: h })))
  .subscribe(console.log);

// zip: 配对组合
zip(of(1, 2, 3), of('a', 'b', 'c')).subscribe(console.log); // [1, 'a'], [2, 'b'], [3, 'c']

// startWith: 在开始时发出指定值
of(2, 3, 4).pipe(startWith(1)).subscribe(console.log); // 1, 2, 3, 4
```

### 5. 工具操作符

```typescript
import { of, throwError } from 'rxjs';
import { tap, delay, timeout, retry, retryWhen, finalize, timeoutWith } from 'rxjs/operators';

// tap: 执行副作用，不改变数据流
of(1, 2, 3)
  .pipe(
    tap(x => console.log('处理前:', x)),
    map(x => x * 2),
    tap(x => console.log('处理后:', x))
  )
  .subscribe();

// delay: 延迟发出
of(1, 2, 3).pipe(delay(1000)).subscribe(console.log);

// timeout: 超时处理
interval(2000)
  .pipe(timeout(1000))
  .subscribe({
    next: console.log,
    error: err => console.log('超时错误'),
  });

// retry: 重试
throwError('错误')
  .pipe(retry(3))
  .subscribe({
    error: err => console.log('重试3次后仍然失败'),
  });

// finalize: 无论成功还是失败都会执行
of(1, 2, 3)
  .pipe(finalize(() => console.log('清理工作')))
  .subscribe();
```

## Subject 详解

### 1. Subject

Subject 既是 Observable 又是 Observer，可以多播给多个观察者。

```typescript
import { Subject } from 'rxjs';

const subject = new Subject<number>();

// 作为 Observable 被订阅
subject.subscribe(value => console.log('观察者A:', value));
subject.subscribe(value => console.log('观察者B:', value));

// 作为 Observer 接收值
subject.next(1); // 观察者A: 1, 观察者B: 1
subject.next(2); // 观察者A: 2, 观察者B: 2

// 将 Observable 转换为多播
const source = interval(1000);
const multicasted = source.pipe(share()); // 内部使用 Subject
```

### 2. BehaviorSubject

BehaviorSubject 保存当前值，新订阅者会立即收到当前值。

```typescript
import { BehaviorSubject } from 'rxjs';

const behaviorSubject = new BehaviorSubject<number>(0); // 初始值为 0

behaviorSubject.subscribe(value => console.log('订阅者1:', value)); // 立即输出: 订阅者1: 0

behaviorSubject.next(1);
behaviorSubject.next(2);

behaviorSubject.subscribe(value => console.log('订阅者2:', value)); // 立即输出: 订阅者2: 2

// 获取当前值
console.log('当前值:', behaviorSubject.value); // 当前值: 2
```

### 3. ReplaySubject

ReplaySubject 可以重放指定数量的历史值给新订阅者。

```typescript
import { ReplaySubject } from 'rxjs';

// 重放最后 2 个值
const replaySubject = new ReplaySubject<number>(2);

replaySubject.next(1);
replaySubject.next(2);
replaySubject.next(3);

replaySubject.subscribe(value => console.log('订阅者:', value));
// 输出: 订阅者: 2, 订阅者: 3

// 带时间窗口的重放
const timedReplay = new ReplaySubject<number>(100, 500); // 重放500ms内的值
```

### 4. AsyncSubject

AsyncSubject 只在完成时发出最后一个值。

```typescript
import { AsyncSubject } from 'rxjs';

const asyncSubject = new AsyncSubject<number>();

asyncSubject.subscribe(value => console.log('订阅者:', value));

asyncSubject.next(1);
asyncSubject.next(2);
asyncSubject.next(3);
// 此时订阅者不会收到任何值

asyncSubject.complete(); // 现在订阅者收到: 订阅者: 3
```

## 调度器 (Schedulers)

调度器控制何时启动订阅以及何时发送通知。

```typescript
import { of, asyncScheduler, asapScheduler } from 'rxjs';
import { observeOn, subscribeOn } from 'rxjs/operators';

// 异步调度器
of(1, 2, 3).pipe(observeOn(asyncScheduler)).subscribe(console.log);

console.log('同步代码');
// 输出顺序: '同步代码', 1, 2, 3

// 订阅调度器
of(1, 2, 3).pipe(subscribeOn(asyncScheduler)).subscribe(console.log);

// 自定义调度器
const customScheduler = {
  schedule(work, delay = 0) {
    return setTimeout(work, delay);
  },
};
```

## 错误处理

### 1. 基本错误处理

```typescript
import { of, throwError } from 'rxjs';
import { catchError, retry, retryWhen, delay } from 'rxjs/operators';

// catchError: 捕获错误并返回新的 Observable
throwError('出错了')
  .pipe(
    catchError(err => {
      console.log('捕获到错误:', err);
      return of('默认值');
    })
  )
  .subscribe(console.log); // 输出: '默认值'

// retry: 重试指定次数
throwError('网络错误')
  .pipe(
    retry(3),
    catchError(err => of('重试失败，使用默认值'))
  )
  .subscribe(console.log);

// retryWhen: 自定义重试逻辑
throwError('服务器错误')
  .pipe(
    retryWhen(errors =>
      errors.pipe(
        delay(1000), // 延迟1秒重试
        take(3) // 最多重试3次
      )
    ),
    catchError(err => of('最终失败'))
  )
  .subscribe(console.log);
```

### 2. 错误传播

```typescript
import { of } from 'rxjs';
import { map, catchError, mergeMap } from 'rxjs/operators';

// 错误会终止整个流
of(1, 2, 3)
  .pipe(
    map(x => {
      if (x === 2) throw new Error('x 不能为 2');
      return x * 2;
    }),
    catchError(err => {
      console.log('错误:', err.message);
      return of(0); // 返回默认值继续流
    })
  )
  .subscribe(console.log); // 输出: 2, 错误: x 不能为 2, 0

// 在内部 Observable 中处理错误
of(1, 2, 3)
  .pipe(
    mergeMap(x =>
      of(x).pipe(
        map(val => {
          if (val === 2) throw new Error('内部错误');
          return val * 2;
        }),
        catchError(err => {
          console.log('内部错误:', err.message);
          return of(0);
        })
      )
    )
  )
  .subscribe(console.log); // 输出: 2, 内部错误: 内部错误, 0, 6
```

## 最佳实践

### 1. 内存管理

```typescript
import { Component, OnDestroy } from '@angular/core';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// 使用 takeUntil 模式
class MyComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  ngOnInit() {
    // 自动取消订阅
    interval(1000).pipe(takeUntil(this.destroy$)).subscribe(console.log);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

// 手动管理订阅
class ManualSubscriptionComponent implements OnDestroy {
  private subscriptions: Subscription[] = [];

  ngOnInit() {
    const sub = interval(1000).subscribe(console.log);
    this.subscriptions.push(sub);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
```

### 2. 操作符选择

```typescript
// HTTP 请求场景
class ApiService {
  // 搜索建议 - 使用 switchMap 取消之前的请求
  searchSuggestions(query: string) {
    return this.http.get(`/api/search?q=${query}`);
  }

  getSearchResults(query$: Observable<string>) {
    return query$.pipe(
      debounceTime(300), // 防抖
      distinctUntilChanged(), // 去重
      switchMap(
        (
          query // 切换到新请求
        ) =>
          this.searchSuggestions(query).pipe(
            catchError(err => of([])) // 错误处理
          )
      )
    );
  }

  // 文件上传 - 使用 concatMap 保证顺序
  uploadFiles(files: File[]) {
    return from(files).pipe(concatMap(file => this.uploadFile(file)));
  }

  // 并发请求 - 使用 mergeMap
  loadUserData(userIds: number[]) {
    return from(userIds).pipe(
      mergeMap(id => this.getUserById(id), 3) // 最多3个并发
    );
  }
}
```

### 3. 状态管理

```typescript
// 使用 BehaviorSubject 管理应用状态
class StateService {
  private _state$ = new BehaviorSubject({
    user: null,
    loading: false,
    error: null,
  });

  state$ = this._state$.asObservable();

  // 选择器
  user$ = this.state$.pipe(map(state => state.user));
  loading$ = this.state$.pipe(map(state => state.loading));
  error$ = this.state$.pipe(map(state => state.error));

  // 状态更新
  updateState(partialState: Partial<State>) {
    const currentState = this._state$.value;
    this._state$.next({ ...currentState, ...partialState });
  }

  // 异步操作
  loadUser(id: number) {
    this.updateState({ loading: true, error: null });

    return this.http.get(`/api/users/${id}`).pipe(
      tap(user => this.updateState({ user, loading: false })),
      catchError(error => {
        this.updateState({ loading: false, error });
        return throwError(error);
      })
    );
  }
}
```

### 4. 测试

```typescript
import { TestScheduler } from 'rxjs/testing';
import { map, delay } from 'rxjs/operators';

describe('RxJS 测试', () => {
  let testScheduler: TestScheduler;

  beforeEach(() => {
    testScheduler = new TestScheduler((actual, expected) => {
      expect(actual).toEqual(expected);
    });
  });

  it('应该正确转换值', () => {
    testScheduler.run(({ cold, expectObservable }) => {
      const source$ = cold('a-b-c|', { a: 1, b: 2, c: 3 });
      const expected = '    a-b-c|';
      const result$ = source$.pipe(map(x => x * 2));

      expectObservable(result$).toBe(expected, { a: 2, b: 4, c: 6 });
    });
  });

  it('应该处理异步操作', () => {
    testScheduler.run(({ cold, expectObservable }) => {
      const source$ = cold('a-b-c|');
      const expected = '    1s a-b-c|';
      const result$ = source$.pipe(delay(1000));

      expectObservable(result$).toBe(expected);
    });
  });
});
```

## 性能优化

### 1. 避免内存泄漏

```typescript
// 错误示例 - 可能导致内存泄漏
class BadComponent {
  ngOnInit() {
    interval(1000).subscribe(console.log); // 永不取消订阅
  }
}

// 正确示例
class GoodComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  ngOnInit() {
    interval(1000).pipe(takeUntil(this.destroy$)).subscribe(console.log);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

### 2. 减少不必要的计算

```typescript
// 使用 distinctUntilChanged 避免重复计算
const expensiveCalculation$ = source$.pipe(
  distinctUntilChanged(),
  map(value => expensiveFunction(value))
);

// 使用 shareReplay 缓存结果
const cachedResult$ = source$.pipe(
  map(value => expensiveFunction(value)),
  shareReplay(1)
);
```

### 3. 控制并发

```typescript
// 限制并发数量
from(urls)
  .pipe(
    mergeMap(url => this.http.get(url), 3) // 最多3个并发请求
  )
  .subscribe();

// 使用 bufferTime 批量处理
source$
  .pipe(
    bufferTime(1000), // 每秒收集一次
    filter(buffer => buffer.length > 0),
    mergeMap(batch => this.processBatch(batch))
  )
  .subscribe();
```

## 与框架集成

### 1. Angular 集成

```typescript
// 服务中使用 RxJS
@Injectable()
export class DataService {
  private apiUrl = 'https://api.example.com';

  getData(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/data`).pipe(retry(3), catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    console.error('API 错误:', error);
    return throwError('服务暂时不可用，请稍后重试');
  }
}

// 组件中使用
@Component({
  template: `
    <div *ngIf="loading$ | async">加载中...</div>
    <div *ngIf="error$ | async as error">错误: {{ error }}</div>
    <div *ngFor="let item of data$ | async">{{ item.name }}</div>
  `,
})
export class DataComponent implements OnInit, OnDestroy {
  data$ = new BehaviorSubject<any[]>([]);
  loading$ = new BehaviorSubject<boolean>(false);
  error$ = new BehaviorSubject<string | null>(null);

  private destroy$ = new Subject<void>();

  constructor(private dataService: DataService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading$.next(true);
    this.error$.next(null);

    this.dataService
      .getData()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: data => {
          this.data$.next(data);
          this.loading$.next(false);
        },
        error: error => {
          this.error$.next(error);
          this.loading$.next(false);
        },
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

### 2. React 集成

```typescript
import { useEffect, useState } from 'react'
import { BehaviorSubject } from 'rxjs'

// 自定义 Hook
function useObservable<T>(observable: Observable<T>, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue)

  useEffect(() => {
    const subscription = observable.subscribe(setValue)
    return () => subscription.unsubscribe()
  }, [observable])

  return value
}

// 状态管理
class Store {
  private _state$ = new BehaviorSubject({ count: 0 })

  state$ = this._state$.asObservable()

  increment() {
    const current = this._state$.value
    this._state$.next({ count: current.count + 1 })
  }

  decrement() {
    const current = this._state$.value
    this._state$.next({ count: current.count - 1 })
  }
}

const store = new Store()

// React 组件
function Counter() {
  const state = useObservable(store.state$, { count: 0 })

  return (
    <div>
      <p>Count: {state.count}</p>
      <button onClick={() => store.increment()}>+</button>
      <button onClick={() => store.decrement()}>-</button>
    </div>
  )
}
```

### 3. Vue 集成

```typescript
// Vue 3 Composition API
import { ref, onUnmounted } from 'vue';
import { Observable, Subscription } from 'rxjs';

function useObservable<T>(observable: Observable<T>, initialValue: T) {
  const value = ref<T>(initialValue);
  let subscription: Subscription;

  subscription = observable.subscribe(newValue => {
    value.value = newValue;
  });

  onUnmounted(() => {
    subscription?.unsubscribe();
  });

  return value;
}

// 在组件中使用
export default {
  setup() {
    const data = useObservable(dataService.getData(), []);

    return {
      data,
    };
  },
};
```

## 实际应用示例

### 1. 实时搜索

```typescript
import { fromEvent, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, map } from 'rxjs/operators';

class SearchService {
  setupSearch(inputElement: HTMLInputElement) {
    return fromEvent(inputElement, 'input').pipe(
      map((event: Event) => (event.target as HTMLInputElement).value),
      debounceTime(300), // 防抖 300ms
      distinctUntilChanged(), // 去除重复搜索
      switchMap(query => {
        if (query.length < 2) {
          return of([]); // 查询太短返回空数组
        }

        return this.searchAPI(query).pipe(
          catchError(err => {
            console.error('搜索错误:', err);
            return of([]); // 错误时返回空数组
          })
        );
      })
    );
  }

  private searchAPI(query: string): Observable<any[]> {
    return this.http.get(`/api/search?q=${encodeURIComponent(query)}`);
  }
}

// 使用示例
const searchService = new SearchService();
const searchInput = document.getElementById('search') as HTMLInputElement;

searchService.setupSearch(searchInput).subscribe(results => {
  // 更新搜索结果 UI
  updateSearchResults(results);
});
```

### 2. 文件上传进度

```typescript
import { Subject, Observable } from 'rxjs';
import { map, scan } from 'rxjs/operators';

interface UploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
}

class FileUploadService {
  private uploadProgress$ = new Subject<UploadProgress>();

  uploadFile(file: File): Observable<UploadProgress> {
    return new Observable(subscriber => {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();

      // 上传进度
      xhr.upload.addEventListener('progress', event => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          subscriber.next({
            file,
            progress,
            status: 'uploading',
          });
        }
      });

      // 上传完成
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          subscriber.next({
            file,
            progress: 100,
            status: 'completed',
          });
          subscriber.complete();
        } else {
          subscriber.error(new Error(`上传失败: ${xhr.statusText}`));
        }
      });

      // 上传错误
      xhr.addEventListener('error', () => {
        subscriber.error(new Error('网络错误'));
      });

      xhr.open('POST', '/api/upload');
      xhr.send(formData);

      // 取消上传
      return () => {
        xhr.abort();
      };
    });
  }

  uploadMultipleFiles(files: File[]): Observable<UploadProgress[]> {
    const uploads = files.map(file => this.uploadFile(file));

    return merge(...uploads).pipe(
      scan((acc: UploadProgress[], current: UploadProgress) => {
        const index = acc.findIndex(item => item.file === current.file);
        if (index >= 0) {
          acc[index] = current;
        } else {
          acc.push(current);
        }
        return [...acc];
      }, [])
    );
  }
}
```

### 3. WebSocket 连接管理

```typescript
import { Observable, Subject, timer } from 'rxjs';
import { retryWhen, delay, takeWhile, tap, share, filter } from 'rxjs/operators';

class WebSocketService {
  private socket$: Observable<MessageEvent>;
  private messagesSubject$ = new Subject<any>();
  private messages$ = this.messagesSubject$.asObservable();

  constructor(private url: string) {
    this.socket$ = this.createWebSocketObservable();
  }

  private createWebSocketObservable(): Observable<MessageEvent> {
    return new Observable(observer => {
      const socket = new WebSocket(this.url);

      socket.onopen = () => {
        console.log('WebSocket 连接已建立');
      };

      socket.onmessage = event => {
        observer.next(event);
      };

      socket.onerror = error => {
        observer.error(error);
      };

      socket.onclose = () => {
        observer.complete();
      };

      // 清理函数
      return () => {
        socket.close();
      };
    }).pipe(
      // 自动重连
      retryWhen(errors =>
        errors.pipe(
          tap(err => console.log('WebSocket 连接错误，准备重连...', err)),
          delay(5000) // 5秒后重连
        )
      ),
      share() // 多播
    );
  }

  connect(): Observable<any> {
    return this.socket$.pipe(
      map((event: MessageEvent) => JSON.parse(event.data)),
      tap(message => this.messagesSubject$.next(message))
    );
  }

  send(message: any): void {
    // 这里需要获取当前的 WebSocket 实例
    // 实际实现中可能需要更复杂的状态管理
  }

  // 监听特定类型的消息
  onMessage(type: string): Observable<any> {
    return this.messages$.pipe(filter(message => message.type === type));
  }
}

// 使用示例
const wsService = new WebSocketService('ws://localhost:8080');

// 连接并监听消息
wsService.connect().subscribe({
  next: message => console.log('收到消息:', message),
  error: err => console.error('WebSocket 错误:', err),
  complete: () => console.log('WebSocket 连接关闭'),
});

// 监听特定类型的消息
wsService.onMessage('notification').subscribe(notification => {
  showNotification(notification.content);
});
```

### 4. 状态机实现

```typescript
import { BehaviorSubject, Observable } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';

type State = 'idle' | 'loading' | 'success' | 'error';
type Event = 'FETCH' | 'SUCCESS' | 'ERROR' | 'RESET';

interface StateMachine {
  state: State;
  data?: any;
  error?: string;
}

class DataStateMachine {
  private state$ = new BehaviorSubject<StateMachine>({
    state: 'idle',
  });

  // 状态选择器
  currentState$ = this.state$.pipe(
    map(sm => sm.state),
    distinctUntilChanged()
  );

  data$ = this.state$.pipe(
    map(sm => sm.data),
    distinctUntilChanged()
  );

  error$ = this.state$.pipe(
    map(sm => sm.error),
    distinctUntilChanged()
  );

  isLoading$ = this.currentState$.pipe(map(state => state === 'loading'));

  // 状态转换
  dispatch(event: Event, payload?: any) {
    const current = this.state$.value;
    let newState: StateMachine;

    switch (current.state) {
      case 'idle':
        if (event === 'FETCH') {
          newState = { state: 'loading' };
        } else {
          return; // 无效转换
        }
        break;

      case 'loading':
        if (event === 'SUCCESS') {
          newState = { state: 'success', data: payload };
        } else if (event === 'ERROR') {
          newState = { state: 'error', error: payload };
        } else {
          return;
        }
        break;

      case 'success':
      case 'error':
        if (event === 'FETCH') {
          newState = { state: 'loading' };
        } else if (event === 'RESET') {
          newState = { state: 'idle' };
        } else {
          return;
        }
        break;

      default:
        return;
    }

    this.state$.next(newState);
  }

  // 异步操作
  fetchData(): Observable<any> {
    this.dispatch('FETCH');

    return this.dataService.getData().pipe(
      tap(data => this.dispatch('SUCCESS', data)),
      catchError(error => {
        this.dispatch('ERROR', error.message);
        return throwError(error);
      })
    );
  }
}
```

## 常见问题

### 1. 内存泄漏

**问题**: 忘记取消订阅导致内存泄漏

```typescript
// 错误示例
class Component {
  ngOnInit() {
    interval(1000).subscribe(console.log); // 永不取消
  }
}

// 解决方案
class Component implements OnDestroy {
  private destroy$ = new Subject<void>();

  ngOnInit() {
    interval(1000).pipe(takeUntil(this.destroy$)).subscribe(console.log);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

### 2. 错误处理

**问题**: 错误没有被正确处理，导致流终止

```typescript
// 错误示例
of(1, 2, 3)
  .pipe(
    map(x => {
      if (x === 2) throw new Error('错误');
      return x;
    })
  )
  .subscribe(console.log); // 只输出 1，然后流终止

// 解决方案
of(1, 2, 3)
  .pipe(
    map(x => {
      if (x === 2) throw new Error('错误');
      return x;
    }),
    catchError(err => {
      console.error(err);
      return of(0); // 返回默认值继续流
    })
  )
  .subscribe(console.log); // 输出: 1, 0, 3
```

### 3. 操作符选择

**问题**: 选择了错误的操作符

```typescript
// 搜索场景 - 错误使用 mergeMap
searchInput$.pipe(
  mergeMap(query => searchAPI(query)) // 可能导致结果乱序
);

// 正确使用 switchMap
searchInput$.pipe(
  switchMap(query => searchAPI(query)) // 取消之前的请求
);

// 文件上传场景 - 错误使用 switchMap
files$.pipe(
  switchMap(file => uploadFile(file)) // 可能取消正在上传的文件
);

// 正确使用 concatMap
files$.pipe(
  concatMap(file => uploadFile(file)) // 按顺序上传
);
```

### 4. 冷热 Observable 混淆

**问题**: 不理解冷热 Observable 的区别

```typescript
// 冷 Observable - 每个订阅者都会重新执行
const cold$ = new Observable(subscriber => {
  console.log('执行');
  subscriber.next(Math.random());
});

cold$.subscribe(console.log); // 执行, 0.123
cold$.subscribe(console.log); // 执行, 0.456

// 热 Observable - 共享执行
const hot$ = cold$.pipe(share());

hot$.subscribe(console.log); // 执行, 0.789
hot$.subscribe(console.log); // 0.789 (相同值)
```

## 总结

RxJS 是一个强大的响应式编程库，它提供了:

### 主要优势

1. **统一的异步处理**: 无论是事件、Promise、定时器还是 HTTP 请求，都可以用统一的方式处理
2. **强大的操作符**: 丰富的操作符库支持复杂的数据转换和组合
3. **声明式编程**: 代码更易读、易维护
4. **错误处理**: 优雅的错误传播和处理机制
5. **内存管理**: 自动的资源清理和取消机制

### 适用场景

- 复杂的异步操作
- 事件处理
- 状态管理
- 实时数据流
- HTTP 请求管理
- WebSocket 连接
- 动画和 UI 交互

### 学习建议

1. **从基础概念开始**: 理解 Observable、Observer、Subscription
2. **掌握常用操作符**: map、filter、mergeMap、switchMap、catchError
3. **实践项目**: 通过实际项目加深理解
4. **关注内存管理**: 始终记得取消订阅
5. **学习最佳实践**: 参考社区的最佳实践和模式

通过合理使用 RxJS，你可以编写出更加优雅、可维护的异步代码，提升应用的性能和用户体验。
