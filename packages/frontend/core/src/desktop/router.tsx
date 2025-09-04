// 导入Sentry的路由包装器，用于错误监控
import { wrapCreateBrowserRouterV6 } from '@sentry/react';
import { useEffect, useState } from 'react';
import type { RouteObject } from 'react-router-dom';
import {
  createBrowserRouter as reactRouterCreateBrowserRouter,
  redirect,
  useNavigate,
} from 'react-router-dom';

// 导入错误边界组件，用于捕获和显示路由错误
import { AffineErrorComponent } from '../components/affine/affine-error-boundary/affine-error-fallback';
// 导入导航上下文，提供全局导航功能
import { NavigateContext } from '../components/hooks/use-navigate-helper';
// 导入根组件包装器
import { RootWrapper } from './pages/root';

/**
 * 根路由组件 - 应用程序的顶层路由容器
 * 负责初始化路由状态并提供导航上下文
 */
export function RootRouter() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // 确保路由器准备就绪的hack方法
    setReady(true);
  }, []);

  return (
    ready && (
      <NavigateContext.Provider value={navigate}>
        <RootWrapper />
      </NavigateContext.Provider>
    )
  );
}

/**
 * 顶层路由配置 - 定义应用程序的所有主要路由
 * 使用懒加载优化性能，只在需要时加载对应的页面组件
 */
export const topLevelRoutes = [
  {
    element: <RootRouter />,
    errorElement: <AffineErrorComponent />, // 全局错误处理组件
    children: [
      {
        path: '/', // 首页 - 应用程序入口页面
        lazy: () => import('./pages/index'),
      },
      //       /workspace/4WXx_BbOkTUGiXMl9KPch/P21KDoS5_J5YkIRrQ4aZN 中这两个ID的含义和生成方式：
      // ## ID含义
      // - 4WXx_BbOkTUGiXMl9KPch - 这是 工作空间ID (Workspace ID)
      // - P21KDoS5_J5YkIRrQ4aZN - 这是 页面/文档ID (Page/Doc ID)
      {
        path: '/workspace/:workspaceId/*', // 工作空间页面 - 主要的工作区域，包含文档编辑等功能
        lazy: () => import('./pages/workspace/index'),
      },
      {
        path: '/share/:workspaceId/:pageId', // 分享页面重定向 - 将分享链接重定向到工作空间
        loader: ({ params }) => {
          return redirect(`/workspace/${params.workspaceId}/${params.pageId}`);
        },
      },
      {
        path: '/404', // 404错误页面 - 页面未找到
        lazy: () => import('./pages/404'),
      },
      {
        path: '/expired', // 过期页面 - 显示链接或会话过期信息
        lazy: () => import('./pages/expired'),
      },
      {
        path: '/invite/:inviteId', // 邀请页面 - 处理工作空间邀请链接
        lazy: () => import('./pages/invite'),
      },
      {
        path: '/upgrade-success', // 升级成功页面 - 个人版升级成功后的确认页面
        lazy: () => import('./pages/upgrade-success'),
      },
      {
        path: '/upgrade-success/team', // 团队版升级成功页面 - 团队版升级成功后的确认页面
        lazy: () => import('./pages/upgrade-success/team'),
      },
      {
        path: '/upgrade-success/self-hosted-team', // 自托管团队版升级成功页面
        lazy: () => import('./pages/upgrade-success/self-host-team'),
      },
      {
        path: '/ai-upgrade-success', // AI功能升级成功页面 - AI服务升级成功后的确认页面
        lazy: () => import('./pages/ai-upgrade-success'),
      },
      {
        path: '/onboarding', // 用户引导页面 - 新用户入门指导
        lazy: () => import('./pages/onboarding'),
      },
      {
        path: '/redirect-proxy', // 重定向代理页面 - 处理外部链接重定向
        lazy: () => import('./pages/redirect'),
      },
      {
        path: '/subscribe', // 订阅页面 - 付费计划订阅
        lazy: () => import('./pages/subscribe'),
      },
      {
        path: '/upgrade-to-team', // 升级到团队版页面 - 团队版升级流程
        lazy: () => import('./pages/upgrade-to-team'),
      },
      {
        path: '/try-cloud', // 尝试云服务重定向 - 引导用户登录并初始化云服务
        loader: () => {
          return redirect(
            `/sign-in?redirect_uri=${encodeURIComponent('/?initCloud=true')}`
          );
        },
      },
      {
        path: '/theme-editor', // 主题编辑器页面 - 自定义应用主题
        lazy: () => import('./pages/theme-editor'),
      },
      {
        path: '/clipper/import', // 剪藏导入页面 - 从浏览器插件导入内容
        lazy: () => import('./pages/import-clipper'),
      },
      {
        path: '/template/import', // 模板导入页面 - 导入文档模板
        lazy: () => import('./pages/import-template'),
      },
      {
        path: '/template/preview', // 模板预览页面重定向 - 将模板预览重定向到工作空间
        loader: ({ request }) => {
          // 解析URL参数
          const url = new URL(request.url);
          const workspaceId = url.searchParams.get('workspaceId');
          const docId = url.searchParams.get('docId');
          const templateName = url.searchParams.get('name');
          const templateMode = url.searchParams.get('mode');
          const snapshotUrl = url.searchParams.get('snapshotUrl');

          // 重定向到工作空间并携带模板参数
          return redirect(
            `/workspace/${workspaceId}/${docId}?${new URLSearchParams({
              isTemplate: 'true',
              templateName: templateName ?? '',
              snapshotUrl: snapshotUrl ?? '',
              mode: templateMode ?? 'page',
            }).toString()}`
          );
        },
      },
      {
        path: '/auth/:authType', // 通用认证页面 - 处理各种认证类型
        lazy: () => import(/* webpackChunkName: "auth" */ './pages/auth/auth'),
      },
      {
        path: '/sign-In', // 登录页面 - 用户登录入口
        lazy: () =>
          import(/* webpackChunkName: "auth" */ './pages/auth/sign-in'),
      },
      {
        path: '/magic-link', // 魔法链接页面 - 无密码登录验证
        lazy: () =>
          import(/* webpackChunkName: "auth" */ './pages/auth/magic-link'),
      },
      {
        path: '/oauth/login', // OAuth登录页面 - 第三方登录入口
        lazy: () =>
          import(/* webpackChunkName: "auth" */ './pages/auth/oauth-login'),
      },
      {
        path: '/oauth/callback', // OAuth回调页面 - 处理第三方登录回调
        lazy: () =>
          import(/* webpackChunkName: "auth" */ './pages/auth/oauth-callback'),
      },
      // 已废弃的路由，保留用于旧客户端兼容性
      // TODO(@forehalo): 待移除
      {
        path: '/desktop-signin', // 桌面端登录页面（已废弃）
        lazy: () =>
          import(/* webpackChunkName: "auth" */ './pages/auth/oauth-login'),
      },
      // 已废弃的路由，保留用于旧客户端兼容性
      // 请使用 '/sign-in'
      // TODO(@forehalo): 待移除
      {
        path: '/signIn', // 登录页面（已废弃的路径）
        lazy: () =>
          import(/* webpackChunkName: "auth" */ './pages/auth/sign-in'),
      },
      {
        path: '/open-app/:action', // 打开应用页面 - 处理深度链接和应用启动
        lazy: () => import('./pages/open-app'),
      },
      {
        path: '*', // 通配符路由 - 捕获所有未匹配的路径，显示404页面
        lazy: () => import('./pages/404'),
      },
    ],
  },
] satisfies [RouteObject, ...RouteObject[]];

// 根据是否有Sentry发布版本来决定是否使用Sentry包装的路由器
const createBrowserRouter = wrapCreateBrowserRouterV6(
  reactRouterCreateBrowserRouter
);

/**
 * 应用程序主路由器实例
 * 在生产环境中使用Sentry包装的路由器进行错误监控
 * 在开发环境中使用原生React Router
 */
export const router = (
  window.SENTRY_RELEASE ? createBrowserRouter : reactRouterCreateBrowserRouter
)(topLevelRoutes, {
  basename: environment.subPath, // 设置应用的基础路径
  future: {
    v7_normalizeFormMethod: true, // 启用React Router v7的表单方法规范化
  },
});
