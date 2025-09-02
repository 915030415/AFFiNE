// 导入 AFFiNE 应用的核心上下文组件，提供全局状态管理
import { AffineContext } from '@affine/core/components/context';
// 导入应用容器组件，用于桌面版应用的主要布局容器
import { AppContainer } from '@affine/core/desktop/components/app-container';
// 导入路由配置，定义应用的页面路由规则
import { router } from '@affine/core/desktop/router';
// 导入通用模块配置函数，用于初始化框架的基础模块
import { configureCommonModules } from '@affine/core/modules';
// 导入国际化提供者组件，用于多语言支持
import { I18nProvider } from '@affine/core/modules/i18n';
// 导入生命周期服务，管理应用的启动、聚焦等生命周期事件
import { LifecycleService } from '@affine/core/modules/lifecycle';
// 导入本地存储配置和 NBStore 提供者，用于数据存储管理
import {
  configureLocalStorageStateStorageImpls,
  NbstoreProvider,
} from '@affine/core/modules/storage';
// 导入弹窗窗口提供者，用于处理新窗口打开逻辑
import { PopupWindowProvider } from '@affine/core/modules/url';
// 导入浏览器工作台模块配置，用于浏览器环境的工作台功能
import { configureBrowserWorkbenchModule } from '@affine/core/modules/workbench';
// 导入浏览器工作空间配置，用于不同类型工作空间的支持
import { configureBrowserWorkspaceFlavours } from '@affine/core/modules/workspace-engine';
// 导入 Emotion CSS-in-JS 缓存创建工具，用于样式缓存优化
import createEmotionCache from '@affine/core/utils/create-emotion-cache';
// 导入 Worker URL 获取工具，用于获取 Web Worker 的 URL
import { getWorkerUrl } from '@affine/env/worker';
// 导入存储管理客户端，用于与 NBStore Worker 通信
import { StoreManagerClient } from '@affine/nbstore/worker/client';
// 导入 Emotion 的缓存提供者组件，用于 CSS-in-JS 样式缓存
import { CacheProvider } from '@emotion/react';
// 导入框架核心组件，用于依赖注入和模块管理
import { Framework, FrameworkRoot, getCurrentStore } from '@toeverything/infra';
// 导入操作客户端，用于与 Worker 进行通信
import { OpClient } from '@toeverything/infra/op';
// 导入 React Suspense 组件，用于异步组件的加载状态处理
import { Suspense } from 'react';
// 导入 React Router 的路由提供者组件，用于单页应用路由管理
import { RouterProvider } from 'react-router-dom';

// 创建 Emotion CSS-in-JS 缓存实例，用于优化样式渲染性能
const cache = createEmotionCache();

// 声明存储管理客户端变量，用于管理数据存储操作
let storeManagerClient: StoreManagerClient;

// 获取 NBStore Worker 的 URL，用于创建数据存储 Worker
const workerUrl = getWorkerUrl('nbstore');

// 检查浏览器是否支持 SharedWorker 且未被禁用
if (
  window.SharedWorker &&
  localStorage.getItem('disableSharedWorker') !== 'true'
) {
  // 创建共享 Worker，可以在多个标签页间共享数据
  const worker = new SharedWorker(workerUrl, {
    name: 'affine-shared-worker',
  });
  // 使用 SharedWorker 的端口创建存储管理客户端
  storeManagerClient = new StoreManagerClient(new OpClient(worker.port));
} else {
  // 如果不支持 SharedWorker，则使用普通的 Worker
  const worker = new Worker(workerUrl);
  // 使用普通 Worker 创建存储管理客户端
  storeManagerClient = new StoreManagerClient(new OpClient(worker));
}
// 监听页面卸载事件，在页面关闭前清理存储管理客户端资源
window.addEventListener('beforeunload', () => {
  storeManagerClient.dispose();
});
// 监听窗口获得焦点事件，恢复存储管理客户端的活动状态
window.addEventListener('focus', () => {
  storeManagerClient.resume();
});
// 监听点击事件，确保用户交互时存储管理客户端处于活动状态
window.addEventListener('click', () => {
  storeManagerClient.resume();
});
// 监听窗口失去焦点事件，暂停存储管理客户端以节省资源
window.addEventListener('blur', () => {
  storeManagerClient.pause();
});

// 配置 React Router 的未来特性标志，启用 v7 版本的 startTransition 功能
// 这有助于提升路由切换时的用户体验，避免阻塞 UI 更新
const future = {
  v7_startTransition: true,
} as const;

// 创建框架实例，用于管理整个应用的依赖注入和模块系统
const framework = new Framework();

// 配置通用模块，包括基础的服务和功能模块
configureCommonModules(framework);

// 配置浏览器工作台模块，提供浏览器环境下的工作台功能
configureBrowserWorkbenchModule(framework);

// 配置本地存储状态存储实现，用于数据持久化
configureLocalStorageStateStorageImpls(framework);

// 配置浏览器工作空间类型，支持不同类型的工作空间（本地、云端等）
configureBrowserWorkspaceFlavours(framework);

// 实现 NBStore 提供者，将存储操作委托给存储管理客户端
// 这样可以通过 Worker 来处理数据存储，避免阻塞主线程
framework.impl(NbstoreProvider, {
  openStore(key, options) {
    return storeManagerClient.open(key, options);
  },
});
// 实现弹窗窗口提供者，用于安全地打开新窗口
framework.impl(PopupWindowProvider, {
  open: (target: string) => {
    // 解析目标 URL
    const targetUrl = new URL(target);

    let url: string;
    // 如果是同源 URL，可以直接打开，安全性较高
    if (targetUrl.origin === location.origin) {
      url = target;
    } else {
      // 对于跨域 URL，通过重定向代理来打开，增加安全性
      const redirectProxy = location.origin + '/redirect-proxy';
      const search = new URLSearchParams({
        redirect_uri: target,
      });

      url = `${redirectProxy}?${search.toString()}`;
    }
    // 在新窗口中打开 URL，使用安全的窗口选项
    window.open(url, '_blank', 'popup noreferrer noopener');
  },
});
// 获取框架提供者实例，用于访问注册的服务和模块
const frameworkProvider = framework.provider();

// 设置应用生命周期事件监听，并触发应用启动事件
// 监听窗口获得焦点事件，通知生命周期服务应用重新获得焦点
window.addEventListener('focus', () => {
  frameworkProvider.get(LifecycleService).applicationFocus();
});
// 触发应用启动事件，标记应用已经开始运行
frameworkProvider.get(LifecycleService).applicationStart();

// 导出主应用组件，这是整个 AFFiNE 应用的根组件
export function App() {
  return (
    // Suspense 组件用于处理异步组件的加载状态，提供更好的用户体验
    <Suspense>
      {/* FrameworkRoot 提供依赖注入框架的上下文，使子组件可以访问注册的服务 */}
      <FrameworkRoot framework={frameworkProvider}>
        {/* CacheProvider 提供 Emotion CSS-in-JS 的缓存上下文，优化样式渲染性能 */}
        <CacheProvider value={cache}>
          {/* I18nProvider 提供国际化上下文，支持多语言功能 */}
          <I18nProvider>
            {/* AffineContext 提供 AFFiNE 应用的全局状态上下文，包含当前存储实例 */}
            <AffineContext store={getCurrentStore()}>
              {/* RouterProvider 提供路由功能，管理单页应用的页面导航 */}
              <RouterProvider
                fallbackElement={<AppContainer fallback />} // 路由加载时的回退组件
                router={router} // 应用的路由配置
                future={future} // React Router 的未来特性配置
              />
            </AffineContext>
          </I18nProvider>
        </CacheProvider>
      </FrameworkRoot>
    </Suspense>
  );
}
