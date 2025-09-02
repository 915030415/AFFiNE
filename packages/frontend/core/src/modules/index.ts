import { configureQuotaModule } from '@affine/core/modules/quota';
import { type Framework } from '@toeverything/infra';

import {
  configureAIButtonModule,
  configureAIDraftModule,
  configureAINetworkSearchModule,
  configureAIPlaygroundModule,
  configureAIReasoningModule,
  configureAIToolsConfigModule,
} from './ai-button';
import { configureAppSidebarModule } from './app-sidebar';
import { configAtMenuConfigModule } from './at-menu-config';
import { configureBlobManagementModule } from './blob-management';
import { configureCloudModule } from './cloud';
import { configureCollectionModule } from './collection';
import { configureCollectionRulesModule } from './collection-rules';
import { configureCommentModule } from './comment';
import { configureWorkspaceDBModule } from './db';
import { configureDialogModule } from './dialogs';
import { configureDndModule } from './dnd';
import { configureDocModule } from './doc';
import { configureDocDisplayMetaModule } from './doc-display-meta';
import { configureDocInfoModule } from './doc-info';
import { configureDocLinksModule } from './doc-link';
import { configureDocSummaryModule } from './doc-summary';
import { configureDocsSearchModule } from './docs-search';
import { configureEditorModule } from './editor';
import { configureEditorSettingModule } from './editor-setting';
import { configureFavoriteModule } from './favorite';
import { configureFeatureFlagModule } from './feature-flag';
import { configureGlobalContextModule } from './global-context';
import { configureI18nModule } from './i18n';
import { configureImportClipperModule } from './import-clipper';
import { configureImportTemplateModule } from './import-template';
import { configureIntegrationModule } from './integration';
import { configureJournalModule } from './journal';
import { configureLifecycleModule } from './lifecycle';
import { configureMediaModule } from './media';
import { configureNavigationModule } from './navigation';
import { configureNavigationPanelModule } from './navigation-panel';
import { configureNotificationModule } from './notification';
import { configureOpenInApp } from './open-in-app';
import { configureOrganizeModule } from './organize';
import { configurePDFModule } from './pdf';
import { configurePeekViewModule } from './peek-view';
import { configurePermissionsModule } from './permissions';
import { configureQuickSearchModule } from './quicksearch';
import { configSearchMenuModule } from './search-menu';
import { configureShareDocsModule } from './share-doc';
import { configureShareSettingModule } from './share-setting';
import {
  configureCommonGlobalStorageImpls,
  configureStorageModule,
} from './storage';
import { configureSystemFontFamilyModule } from './system-font-family';
import { configureTagModule } from './tag';
import { configureTelemetryModule } from './telemetry';
import { configureTemplateDocModule } from './template-doc';
import { configureAppThemeModule } from './theme';
import { configureThemeEditorModule } from './theme-editor';
import { configureUrlModule } from './url';
import { configureUserspaceModule } from './userspace';
import { configureWorkspaceModule } from './workspace';
import { configureIndexerEmbeddingModule } from './workspace-indexer-embedding';
import { configureWorkspacePropertyModule } from './workspace-property';

/**
 * 配置所有通用模块
 * 这个函数负责初始化和配置 AFFiNE 应用程序的所有核心模块
 * @param framework - 框架实例，用于注册和管理各个模块
 */
export function configureCommonModules(framework: Framework) {
  // 国际化模块 - 处理多语言支持和本地化
  configureI18nModule(framework);

  // 工作空间模块 - 管理工作空间的创建、切换和基本操作
  configureWorkspaceModule(framework);

  // 文档模块 - 处理文档的核心功能，如创建、编辑、保存等
  configureDocModule(framework);

  // 工作空间数据库模块 - 管理工作空间的数据存储和数据库操作
  configureWorkspaceDBModule(framework);

  // 存储模块 - 处理数据持久化，包括本地存储和云端存储
  configureStorageModule(framework);

  // 全局上下文模块 - 管理应用程序的全局状态和上下文信息
  configureGlobalContextModule(framework);

  // 生命周期模块 - 管理应用程序和组件的生命周期事件
  configureLifecycleModule(framework);

  // 功能标志模块 - 控制功能的开启和关闭，支持A/B测试和渐进式发布
  configureFeatureFlagModule(framework);

  // 集合模块 - 管理文档集合和分组功能
  configureCollectionModule(framework);

  // 导航模块 - 处理应用程序内的路由和导航逻辑
  configureNavigationModule(framework);

  // 标签模块 - 管理文档标签系统，支持标签的创建、编辑和过滤
  configureTagModule(framework);

  // 云服务模块 - 处理与云端服务的集成和同步
  configureCloudModule(framework);

  // 配额模块 - 管理用户的存储配额和使用限制
  configureQuotaModule(framework);

  // 权限模块 - 处理用户权限和访问控制
  configurePermissionsModule(framework);

  // 文档分享模块 - 管理文档的分享功能和权限设置
  configureShareDocsModule(framework);

  // 分享设置模块 - 配置分享相关的设置和选项
  configureShareSettingModule(framework);

  // 遥测模块 - 收集应用程序使用数据和性能指标
  configureTelemetryModule(framework);

  // PDF模块 - 处理PDF文档的查看、编辑和导出功能
  configurePDFModule(framework);

  // 预览视图模块 - 提供文档的快速预览功能
  configurePeekViewModule(framework);

  // 文档显示元数据模块 - 管理文档的显示信息和元数据
  configureDocDisplayMetaModule(framework);

  // 快速搜索模块 - 提供全局快速搜索功能
  configureQuickSearchModule(framework);

  // 文档搜索模块 - 专门处理文档内容的搜索功能
  configureDocsSearchModule(framework);

  // 文档链接模块 - 管理文档之间的链接关系
  configureDocLinksModule(framework);

  // 组织模块 - 处理文档的组织和结构化管理
  configureOrganizeModule(framework);

  // 收藏模块 - 管理用户的收藏文档和书签功能
  configureFavoriteModule(framework);

  // 导航面板模块 - 管理侧边导航面板的显示和交互
  configureNavigationPanelModule(framework);

  // 主题编辑器模块 - 提供主题自定义和编辑功能
  configureThemeEditorModule(framework);

  // 编辑器模块 - 核心的文档编辑器功能
  configureEditorModule(framework);

  // 系统字体模块 - 管理系统字体的选择和应用
  configureSystemFontFamilyModule(framework);

  // 编辑器设置模块 - 配置编辑器的各种设置选项
  configureEditorSettingModule(framework);

  // 导入模板模块 - 处理模板的导入和应用功能
  configureImportTemplateModule(framework);

  // 用户空间模块 - 管理用户的个人空间和设置
  configureUserspaceModule(framework);

  // 应用侧边栏模块 - 管理主应用的侧边栏功能
  configureAppSidebarModule(framework);

  // 日记模块 - 提供日记和日程管理功能
  configureJournalModule(framework);

  // URL模块 - 处理URL路由和地址管理
  configureUrlModule(framework);

  // 应用主题模块 - 管理应用程序的主题系统
  configureAppThemeModule(framework);

  // 对话框模块 - 管理各种对话框和弹窗组件
  configureDialogModule(framework);

  // 文档信息模块 - 显示和管理文档的详细信息
  configureDocInfoModule(framework);

  // 在应用中打开模块 - 处理外部链接在应用中的打开逻辑
  configureOpenInApp(framework);

  // @菜单配置模块 - 配置@符号触发的菜单功能
  configAtMenuConfigModule(framework);

  // 搜索菜单配置模块 - 配置搜索相关的菜单选项
  configSearchMenuModule(framework);

  // 拖拽模块 - 处理拖拽操作和交互
  configureDndModule(framework);

  // 通用全局存储实现模块 - 提供全局存储的具体实现
  configureCommonGlobalStorageImpls(framework);

  // AI网络搜索模块 - 集成AI驱动的网络搜索功能
  configureAINetworkSearchModule(framework);

  // AI推理模块 - 提供AI推理和智能分析功能
  configureAIReasoningModule(framework);

  // AI游乐场模块 - AI功能的实验和测试环境
  configureAIPlaygroundModule(framework);

  // AI按钮模块 - 管理AI相关的按钮和快捷操作
  configureAIButtonModule(framework);

  // AI草稿模块 - 处理AI辅助的草稿生成功能
  configureAIDraftModule(framework);

  // AI工具配置模块 - 配置各种AI工具和设置
  configureAIToolsConfigModule(framework);

  // 模板文档模块 - 管理文档模板的创建和使用
  configureTemplateDocModule(framework);

  // Blob管理模块 - 处理二进制大对象的存储和管理
  configureBlobManagementModule(framework);

  // 媒体模块 - 处理图片、视频等媒体文件的管理
  configureMediaModule(framework);

  // 导入剪贴板模块 - 处理剪贴板内容的导入功能
  configureImportClipperModule(framework);

  // 通知模块 - 管理应用程序的通知系统
  configureNotificationModule(framework);

  // 集成模块 - 处理与第三方服务的集成
  configureIntegrationModule(framework);

  // 工作空间属性模块 - 管理工作空间的属性和配置
  configureWorkspacePropertyModule(framework);

  // 集合规则模块 - 定义和管理集合的自动化规则
  configureCollectionRulesModule(framework);

  // 索引器嵌入模块 - 处理文档内容的索引和嵌入向量
  configureIndexerEmbeddingModule(framework);

  // 评论模块 - 管理文档的评论和协作功能
  configureCommentModule(framework);

  // 文档摘要模块 - 生成和管理文档摘要
  configureDocSummaryModule(framework);
}
