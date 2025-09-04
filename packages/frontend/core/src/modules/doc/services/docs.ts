// 导入调试日志工具，用于记录和调试 DocsService 的运行状态
import { DebugLogger } from '@affine/debug';
// 导入不可达错误类型，用于标识理论上不应该发生的错误情况
import { Unreachable } from '@affine/env/constant';
// 导入 ID 替换中间件，用于在文档复制过程中替换块的 ID
import { replaceIdMiddleware } from '@blocksuite/affine/shared/adapters';
// 导入 AFFiNE 文本属性类型定义，用于定义富文本的样式和属性
import type { AffineTextAttributes } from '@blocksuite/affine/shared/types';
// 导入 Delta 插入操作类型，用于定义文本编辑器中的插入操作
import type { DeltaInsert } from '@blocksuite/affine/store';
// 导入 BlockSuite 核心类：Slice（文档片段）、Text（文本对象）、Transformer（转换器）
import { Slice, Text, Transformer } from '@blocksuite/affine/store';
// 导入基础设施：ObjectPool（对象池）和 Service（服务基类）
import { ObjectPool, Service } from '@toeverything/infra';
// 导入 RxJS 操作符：combineLatest（合并多个流）和 map（映射转换）
import { combineLatest, map } from 'rxjs';

// 导入文档初始化函数，用于根据属性初始化新创建的文档
import { initDocFromProps } from '../../../blocksuite/initialization';
// 导入获取 AFFiNE 工作空间模式的函数，用于定义文档的结构和行为
import { getAFFiNEWorkspaceSchema } from '../../workspace';
// 导入文档实体类型定义
import type { Doc } from '../entities/doc';
// 导入文档记录列表实体，用于管理所有文档的记录
import { DocRecordList } from '../entities/record-list';
// 导入文档事件：DocCreated（文档已创建）和 DocInitialized（文档已初始化）
import { DocCreated, DocInitialized } from '../events';
// 导入文档创建中间件类型，用于在文档创建前后执行自定义逻辑
import type { DocCreateMiddleware } from '../providers/doc-create-middleware';
// 导入文档作用域，用于管理单个文档的生命周期和依赖注入
import { DocScope } from '../scopes/doc';
// 导入文档属性存储类型，用于管理文档的自定义属性
import type { DocPropertiesStore } from '../stores/doc-properties';
// 导入文档存储类型，用于管理文档的持久化和同步
import type { DocsStore } from '../stores/docs';
// 导入文档创建选项类型，定义创建文档时可配置的参数
import type { DocCreateOptions } from '../types';
// 导入文档服务，用于管理单个文档的操作
import { DocService } from './doc';

// 创建专用于 DocsService 的调试日志记录器，用于跟踪服务运行状态
const logger = new DebugLogger('DocsService');

// DocsService 类：继承自 Service 基类，负责管理所有文档的核心业务逻辑
export class DocsService extends Service {
  // 文档记录列表实体：管理工作空间中所有文档的元数据和状态
  list = this.framework.createEntity(DocRecordList);

  // 文档对象池：缓存已打开的文档实例，提高性能并管理内存使用
  // 键为文档ID（string），值为文档实例（Doc）
  pool = new ObjectPool<string, Doc>({
    // 当文档从对象池中删除时的清理回调函数
    onDelete(obj) {
      // 释放文档作用域，清理相关资源和事件监听器
      obj.scope.dispose();
    },
  });

  /**
   * 获取指定属性的所有属性值，主要用于搜索功能
   *
   * 结果可能包含回收站中的文档或已删除的文档
   * 不会包含旧版属性数据（如旧的 journal 属性）
   */
  propertyValues$(propertyKey: string) {
    // 合并两个数据流：文档ID列表和指定属性的所有值
    return combineLatest([
      // 监听所有文档ID的变化
      this.store.watchDocIds(),
      // 监听指定属性键的所有属性值变化
      this.docPropertiesStore.watchPropertyAllValues(propertyKey),
    ]).pipe(
      // 将两个数据流的结果映射为统一的 Map 结构
      map(([docIds, propertyValues]) => {
        // 创建结果映射：文档ID -> 属性值（可能为 undefined）
        const result = new Map<string, string | undefined>();
        // 遍历所有文档ID
        for (const docId of docIds) {
          // 为每个文档ID设置对应的属性值（如果存在）
          result.set(docId, propertyValues.get(docId));
        }
        // 返回完整的文档ID到属性值的映射
        return result;
      })
    );
  }

  /**
   * 获取所有文档的创建日期流，主要用于搜索功能
   * @returns 监听所有文档创建日期变化的 Observable
   */
  allDocsCreatedDate$() {
    return this.store.watchAllDocCreateDate();
  }

  /**
   * 获取所有文档的更新日期流，主要用于搜索功能
   * @returns 监听所有文档更新日期变化的 Observable
   */
  allDocsUpdatedDate$() {
    return this.store.watchAllDocUpdatedDate();
  }

  /**
   * 获取所有文档的标签ID流
   * @returns 监听所有文档标签ID变化的 Observable
   */
  allDocsTagIds$() {
    return this.store.watchAllDocTagIds();
  }

  /**
   * 获取所有文档ID流
   * @returns 监听所有文档ID变化的 Observable
   */
  allDocIds$() {
    return this.store.watchDocIds();
  }

  /**
   * 获取所有非回收站文档ID流
   * @returns 监听所有非回收站文档ID变化的 Observable
   */
  allNonTrashDocIds$() {
    return this.store.watchNonTrashDocIds();
  }

  /**
   * 获取所有回收站文档ID流
   * @returns 监听所有回收站文档ID变化的 Observable
   */
  allTrashDocIds$() {
    return this.store.watchTrashDocIds();
  }

  /**
   * 获取所有文档标题流
   * @returns 监听所有文档标题变化的 Observable
   */
  allDocTitle$() {
    return this.store.watchAllDocTitle();
  }

  /**
   * DocsService 构造函数
   * @param store 文档存储服务，负责底层文档数据管理
   * @param docPropertiesStore 文档属性存储服务，管理文档的自定义属性
   * @param docCreateMiddlewares 文档创建中间件数组，用于扩展文档创建流程
   */
  constructor(
    private readonly store: DocsStore,
    private readonly docPropertiesStore: DocPropertiesStore,
    private readonly docCreateMiddlewares: DocCreateMiddleware[]
  ) {
    // 调用父类 Service 的构造函数
    super();
  }

  /**
   * 检查指定文档是否已加载到对象池中
   * @param docId 要检查的文档ID
   * @returns 如果文档已加载，返回文档实例和释放函数；否则返回 null
   */
  loaded(docId: string) {
    // 从对象池中查找已存在的文档实例
    const exists = this.pool.get(docId);
    if (exists) {
      // 如果找到，返回文档对象和释放函数
      return { doc: exists.obj, release: exists.release };
    }
    // 如果未找到，返回 null
    return null;
  }

  /**
   * 打开指定文档，返回文档实例和释放函数
   * @param docId 要打开的文档ID
   * @returns 包含文档实例和释放函数的对象
   */
  open(docId: string) {
    // 从文档记录列表中获取文档记录
    const docRecord = this.list.doc$(docId).value;
    if (!docRecord) {
      throw new Error('Doc record not found');
    }
    // 从存储中获取 BlockSuite 文档实例
    const blockSuiteDoc = this.store.getBlockSuiteDoc(docId);
    if (!blockSuiteDoc) {
      throw new Error('Doc not found');
    }

    // 检查对象池中是否已存在该文档实例
    const exists = this.pool.get(docId);
    if (exists) {
      // 如果已存在，直接返回缓存的实例和释放函数
      return { doc: exists.obj, release: exists.release };
    }

    // 创建新的文档作用域，传入必要的依赖
    const docScope = this.framework.createScope(DocScope, {
      docId,
      blockSuiteDoc,
      record: docRecord,
    });

    // 尝试加载 BlockSuite 文档数据
    try {
      blockSuiteDoc.load();
    } catch (e) {
      // 记录加载失败的错误信息
      logger.error('Failed to load doc', {
        docId,
        error: e,
      });
    }

    // 从文档作用域中获取文档服务实例
    const doc = docScope.get(DocService).doc;

    // 发出文档初始化完成事件
    doc.scope.emitEvent(DocInitialized, doc);

    // 将文档实例放入对象池中进行缓存管理
    const { obj, release } = this.pool.put(docId, doc);

    // 返回文档实例和释放函数
    return { doc: obj, release };
  }

  /**
   * 创建新文档
   * @param options 文档创建选项配置
   * @returns 创建的文档记录实例
   */
  createDoc(options: DocCreateOptions = {}) {
    // 执行所有文档创建中间件的 beforeCreate 钩子
    // 允许中间件在文档创建前修改创建选项
    for (const middleware of this.docCreateMiddlewares) {
      options = middleware.beforeCreate
        ? middleware.beforeCreate(options)
        : options;
    }

    // 在存储层创建新文档，返回文档ID
    const id = this.store.createDoc(options.id);

    // docStore 实际上是 BlockSuite Store 实例 ，它是通过 AFFiNE 的依赖注入系统，从 WorkspaceService → Workspace → WorkspaceImpl → Doc → Store 这样的层次结构中获取的，用于管理具体文档的块数据和编辑状态。 ？？？
    // 返回的是文档Store
    const docStore = this.store.getBlockSuiteDoc(id);

    console.log('1111', docStore);

    if (!docStore) {
      throw new Error('Failed to create doc');
    }

    // 如果未跳过初始化，则根据提供的属性初始化文档内容
    if (options.skipInit !== true) {
      initDocFromProps(docStore, options.docProps, options);
    }

    // 从文档记录列表中获取新创建的文档记录
    // docRecord 文档实体
    const docRecord = this.list.doc$(id).value;
    console.log(1111, docRecord);
    if (!docRecord) {
      throw new Unreachable();
    }

    // 如果指定了主要模式，设置文档的主要模式（页面或画板）
    if (options.primaryMode) {
      docRecord.setPrimaryMode(options.primaryMode);
    }

    // 如果标记为模板文档，设置模板属性
    if (options.isTemplate) {
      docRecord.setProperty('isTemplate', true);
    }

    // 执行所有文档创建中间件的 afterCreate 钩子
    // 允许中间件在文档创建后执行额外的处理逻辑
    for (const middleware of this.docCreateMiddlewares) {
      middleware.afterCreate?.(docRecord, options);
    }

    // 设置文档的创建时间和更新时间为当前时间戳
    docRecord.setCreatedAt(Date.now());
    docRecord.setUpdatedAt(Date.now());

    // 发出文档创建完成事件，通知其他组件
    this.eventBus.emit(DocCreated, {
      doc: docRecord,
      docCreateOptions: options,
    });

    // 返回创建的文档记录实例
    return docRecord;
  }

  /**
   * 向指定文档添加链接文档引用
   * @param targetDocId 目标文档ID（要添加链接的文档）
   * @param linkedDocId 被链接的文档ID
   */
  async addLinkedDoc(targetDocId: string, linkedDocId: string) {
    // 打开目标文档并获取释放函数
    const { doc, release } = this.open(targetDocId);
    // 添加高优先级加载，确保文档内容完全加载
    const disposePriorityLoad = doc.addPriorityLoad(10);
    // 等待文档同步完成，确保数据一致性
    await doc.waitForSyncReady();
    // 释放优先级加载资源
    disposePriorityLoad();

    // 创建包含链接引用的文本对象
    const text = new Text([
      {
        insert: ' ', // 插入空格字符
        attributes: {
          reference: {
            type: 'LinkedPage', // 引用类型：链接页面
            pageId: linkedDocId, // 被链接的文档ID
          },
        },
      },
    ] as DeltaInsert<AffineTextAttributes>[]);

    // 获取文档中的第一个笔记块（note block）
    const [frame] = doc.blockSuiteDoc.getBlocksByFlavour('affine:note');
    // 如果找到笔记块，则在其中添加包含链接的段落块
    frame &&
      doc.blockSuiteDoc.addBlock(
        'affine:paragraph' as never, // TODO(eyhn): fix type
        { text }, // 包含链接引用的文本内容
        frame.id // 添加到笔记块中
      );

    // 释放文档资源
    release();
  }

  /**
   * 修改文档标题
   * @param docId 要修改标题的文档ID
   * @param newTitle 新的文档标题
   */
  async changeDocTitle(docId: string, newTitle: string) {
    // 打开指定文档并获取释放函数
    const { doc, release } = this.open(docId);
    // 添加高优先级加载，确保文档内容完全加载
    const disposePriorityLoad = doc.addPriorityLoad(10);
    // 等待文档同步完成，确保数据一致性
    await doc.waitForSyncReady();
    // 释放优先级加载资源
    disposePriorityLoad();
    // 调用文档实例的标题修改方法
    doc.changeDocTitle(newTitle);
    // 释放文档资源
    release();
  }

  /**
   * 复制文档
   * @param sourceDocId 源文档ID
   * @param _targetDocId 可选的目标文档ID，如果不提供则创建新文档
   * @returns 目标文档ID
   */
  async duplicate(sourceDocId: string, _targetDocId?: string) {
    // 确定目标文档ID：使用提供的ID或创建新文档
    const targetDocId = _targetDocId ?? this.createDoc().id;

    // 检查源文档是否已被删除到回收站
    if (this.list.doc$(sourceDocId).value?.trash$.value) {
      // 如果源文档已删除，发出警告并返回目标文档ID
      console.warn(
        `Template doc(id: ${sourceDocId}) is removed, skip duplicate`
      );
      return targetDocId;
    }

    // 打开源文档和目标文档，获取文档实例和释放函数
    const { release: sourceRelease, doc: sourceDoc } = this.open(sourceDocId);
    const { release: targetRelease, doc: targetDoc } = this.open(targetDocId);
    // 等待源文档同步完成，确保数据完整性
    await sourceDoc.waitForSyncReady();

    // 复制文档内容
    try {
      // 获取源文档和目标文档的 BlockSuite 实例
      const sourceBsDoc = this.store.getBlockSuiteDoc(sourceDocId);
      const targetBsDoc = this.store.getBlockSuiteDoc(targetDocId);
      if (!sourceBsDoc) throw new Error('Source doc not found');
      if (!targetBsDoc) throw new Error('Target doc not found');

      // 清空目标文档的所有内容（包括画板和笔记）
      targetBsDoc.root?.children.forEach(child =>
        targetBsDoc.deleteBlock(child)
      );

      // 获取 BlockSuite 集合实例
      const collection = this.store.getBlocksuiteCollection();
      // 创建文档转换器，用于处理文档内容的复制和转换
      const transformer = new Transformer({
        // 使用 AFFiNE 工作空间的模式定义
        schema: getAFFiNEWorkspaceSchema(),
        // 配置二进制数据（如图片、文件）的同步处理
        blobCRUD: collection.blobSync,
        // 配置文档的增删改查操作
        docCRUD: {
          // 创建新文档的回调函数
          create: (id: string) => {
            // 使用服务创建新文档
            this.createDoc({ id });
            // 获取文档存储实例
            const store = collection.getDoc(id)?.getStore({ id });
            if (!store) {
              throw new Error('Failed to create doc');
            }
            return store;
          },
          // 获取文档的回调函数
          get: (id: string) => collection.getDoc(id)?.getStore({ id }) ?? null,
          // 删除文档的回调函数
          delete: (id: string) => collection.removeDoc(id),
        },
        // 配置中间件：替换ID中间件确保复制的文档有独立的ID体系
        middlewares: [replaceIdMiddleware(collection.idGenerator)],
      });
      // 从源文档的所有子块创建切片对象
      const slice = Slice.fromModels(sourceBsDoc, [
        ...(sourceBsDoc.root?.children ?? []),
      ]);
      // 将切片转换为快照格式
      const snapshot = transformer.sliceToSnapshot(slice);
      if (!snapshot) {
        throw new Error('Failed to create snapshot');
      }
      // 将快照应用到目标文档中，完成内容复制
      await transformer.snapshotToSlice(
        snapshot,
        targetBsDoc,
        targetBsDoc.root?.id
      );
    } catch (e) {
      // 记录文档复制失败的错误信息
      logger.error('Failed to duplicate doc', {
        sourceDocId,
        targetDocId,
        originalTargetDocId: _targetDocId,
        error: e,
      });
    } finally {
      // 无论成功或失败，都要释放文档资源
      sourceRelease();
      targetRelease();
    }

    // 复制文档元数据
    targetDoc.record.setMeta({
      // 复制源文档的标签信息
      tags: sourceDoc.meta$.value.tags,
    });

    // 复制并修改文档标题
    const originalTitle = sourceDoc.title$.value;
    // 匹配标题末尾的数字后缀，如 "文档名(1)"
    const lastDigitRegex = /\((\d+)\)$/;
    const match = originalTitle.match(lastDigitRegex);
    // 如果已有数字后缀则递增，否则从1开始
    const newNumber = match ? parseInt(match[1], 10) + 1 : 1;
    // 生成新的标题，移除旧的数字后缀并添加新的
    const newPageTitle =
      originalTitle.replace(lastDigitRegex, '') + `(${newNumber})`;
    // 设置目标文档的新标题
    targetDoc.changeDocTitle(newPageTitle);

    // 复制文档属性
    const properties = sourceDoc.getProperties();
    // 定义需要移除的属性（这些属性不应该被复制）
    const removedProperties = ['id', 'isTemplate', 'journal'];
    // 从属性对象中移除不需要复制的属性
    removedProperties.forEach(key => {
      delete properties[key];
    });
    // 将过滤后的属性应用到目标文档
    targetDoc.updateProperties(properties);

    // 返回目标文档ID
    return targetDocId;
  }

  /**
   * 从模板文档复制创建新文档
   * @param sourceDocId 源模板文档ID
   * @param _targetDocId 可选的目标文档ID，如果不提供则创建新文档
   * @returns 新创建的文档ID
   */
  async duplicateFromTemplate(sourceDocId: string, _targetDocId?: string) {
    // 确定目标文档ID：使用提供的ID或创建新文档
    const targetDocId = _targetDocId ?? this.createDoc().id;

    // 检查源模板文档是否已被删除到回收站
    if (this.list.doc$(sourceDocId).value?.trash$.value) {
      // 如果模板文档已删除，发出警告并返回目标文档ID
      console.warn(
        `Template doc(id: ${sourceDocId}) is removed, skip duplicate`
      );
      return targetDocId;
    }

    // 打开源模板文档和目标文档，获取文档实例和释放函数
    const { release: sourceRelease, doc: sourceDoc } = this.open(sourceDocId);
    const { release: targetRelease, doc: targetDoc } = this.open(targetDocId);
    // 等待源文档同步完成，确保模板内容完整
    await sourceDoc.waitForSyncReady();

    // 复制模板文档内容
    try {
      // 获取源模板文档和目标文档的 BlockSuite 实例
      const sourceBsDoc = this.store.getBlockSuiteDoc(sourceDocId);
      const targetBsDoc = this.store.getBlockSuiteDoc(targetDocId);
      if (!sourceBsDoc) throw new Error('Source doc not found');
      if (!targetBsDoc) throw new Error('Target doc not found');

      // 清空目标文档的所有内容（包括画板和笔记）
      targetBsDoc.root?.children.forEach(child =>
        targetBsDoc.deleteBlock(child)
      );

      const collection = this.store.getBlocksuiteCollection();
      const transformer = new Transformer({
        schema: getAFFiNEWorkspaceSchema(),
        blobCRUD: collection.blobSync,
        docCRUD: {
          create: (id: string) => {
            this.createDoc({ id });
            const store = collection.getDoc(id)?.getStore({ id });
            if (!store) {
              throw new Error('Failed to create doc');
            }
            return store;
          },
          get: (id: string) => collection.getDoc(id)?.getStore({ id }) ?? null,
          delete: (id: string) => collection.removeDoc(id),
        },
        middlewares: [replaceIdMiddleware(collection.idGenerator)],
      });
      const slice = Slice.fromModels(sourceBsDoc, [
        ...(sourceBsDoc.root?.children ?? []),
      ]);
      const snapshot = transformer.sliceToSnapshot(slice);
      if (!snapshot) {
        throw new Error('Failed to create snapshot');
      }
      await transformer.snapshotToSlice(
        snapshot,
        targetBsDoc,
        targetBsDoc.root?.id
      );
    } catch (e) {
      // 记录模板文档复制失败的错误信息
      logger.error('Failed to duplicate doc', {
        sourceDocId,
        targetDocId,
        originalTargetDocId: _targetDocId,
        error: e,
      });
    } finally {
      // 无论成功或失败，都要释放文档资源
      sourceRelease();
      targetRelease();
    }

    // 复制模板文档的属性（不包括模板特有属性）
    const properties = sourceDoc.getProperties();
    // 定义需要移除的属性：ID、模板标识、日记属性
    const removedProperties = ['id', 'isTemplate', 'journal'];
    // 从属性对象中移除模板特有的属性
    removedProperties.forEach(key => {
      delete properties[key];
    });
    // 将过滤后的属性应用到目标文档
    targetDoc.updateProperties(properties);

    // 返回新创建的文档ID
    return targetDocId;
  }
}
