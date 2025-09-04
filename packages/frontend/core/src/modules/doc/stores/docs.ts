/**
 * AFFiNE 文档存储管理模块
 *
 * 本文件定义了 DocsStore 类，是 AFFiNE 框架中负责文档数据管理的核心组件。
 *
 * 主要功能包括：
 * 1. 文档生命周期管理：创建、获取、删除文档
 * 2. 文档元数据管理：标题、标签、创建时间、更新时间等
 * 3. 响应式数据监听：实时监听文档数据变化
 * 4. 垃圾箱功能：管理已删除文档的状态
 * 5. BlockSuite 集成：与 AFFiNE 编辑器框架的深度集成
 * 6. 文档同步状态：监听文档的加载和同步状态
 * 7. 文档属性管理：主要模式设置、优先级加载等
 *
 * 技术特点：
 * - 基于 Yjs CRDT 实现实时协作
 * - 使用 RxJS 提供响应式数据流
 * - 支持高性能的索引缓存优化
 * - 集成 AFFiNE 框架的依赖注入系统
 *
 * @author AFFiNE Team
 * @since 2024
 */

// 导入文档模式类型定义，用于设置文档的主要显示模式（页面模式或白板模式）
import type { DocMode } from '@blocksuite/affine/model';
// 导入文档元数据类型定义，包含文档的基本信息如标题、创建时间、标签等
import type { DocMeta } from '@blocksuite/affine/store';
// 导入框架基础设施中的核心组件
import {
  Store, // Store 基类，提供数据存储的基础功能
  yjsGetPath, // 用于获取 Yjs 文档中指定路径的数据
  yjsObserve, // 用于监听 Yjs 数据变化的响应式工具
  yjsObserveDeep, // 用于深度监听 Yjs 数据变化（包括嵌套对象）
  yjsObservePath, // 用于监听 Yjs 文档中指定路径的数据变化
} from '@toeverything/infra';
// 导入 nanoid 库，用于生成唯一的文档 ID
import { nanoid } from 'nanoid';
// 导入 RxJS 操作符，用于处理响应式数据流
import { distinctUntilChanged, map, switchMap } from 'rxjs';
// 导入 Yjs 的核心数据结构和事务处理功能
import { Array as YArray, Map as YMap, transact } from 'yjs';

// 导入工作空间服务类型，提供工作空间级别的操作
import type { WorkspaceService } from '../../workspace';
// 导入文档属性存储类型，管理文档的自定义属性
import type { DocPropertiesStore } from './doc-properties';

/**
 * DocsStore 类 - 文档数据存储管理器
 *
 * 继承自 Store 基类，专门负责管理文档相关的数据操作，包括：
 * - 文档的创建、获取和元数据管理
 * - 文档列表的响应式监听
 * - 文档状态（回收站、标签等）的管理
 * - 与 BlockSuite 文档系统的集成
 */
export class DocsStore extends Store {
  /**
   * DocsStore 构造函数
   *
   * @param workspaceService 工作空间服务实例，提供对工作空间级别数据和操作的访问
   * @param docPropertiesStore 文档属性存储实例，管理文档的自定义属性和配置
   */
  constructor(
    private readonly workspaceService: WorkspaceService, // 注入工作空间服务，用于访问工作空间的文档集合和根文档
    private readonly docPropertiesStore: DocPropertiesStore // 注入文档属性存储，用于管理文档的扩展属性
  ) {
    super(); // 调用父类 Store 的构造函数，初始化基础存储功能
  }

  /**
   * 获取指定 ID 的 BlockSuite 文档实例
   *
   * BlockSuite 是 AFFiNE 的核心编辑器框架，每个文档都有对应的 BlockSuite 实例
   * 用于处理文档的编辑、渲染和数据管理
   *
   * @param id 文档的唯一标识符
   * @returns BlockSuite 文档的 Store 实例，如果文档不存在则返回 null
   */
  getBlockSuiteDoc(id: string) {
    return (
      this.workspaceService.workspace.docCollection // 从工作空间服务获取文档集合
        .getDoc(id) // 根据 ID 获取文档实例
        ?.getStore({ id }) ?? null // 获取文档的 Store 实例，如果文档不存在则返回 null
    );
  }

  /**
   * 获取 BlockSuite 文档集合实例
   *
   * 文档集合是管理工作空间内所有文档的容器，提供文档的创建、删除、查询等功能
   *
   * @returns BlockSuite 文档集合实例
   */
  getBlocksuiteCollection() {
    return this.workspaceService.workspace.docCollection; // 返回工作空间的文档集合实例
  }

  /**
   * 创建新文档
   *
   * 在 AFFiNE 中，文档的元数据存储在工作空间的根 Yjs 文档中的 'meta.pages' 路径下
   * 每个文档都有基本的元数据：ID、标题、创建时间、标签等
   *
   * @param docId 可选的文档 ID，如果不提供则自动生成
   */
  createDoc(docId?: string) {
    const id = docId ?? nanoid(); // 如果没有提供 docId，则使用 nanoid 生成唯一 ID

    // 使用 Yjs 事务确保数据的原子性操作
    transact(
      this.workspaceService.workspace.rootYDoc, // 在工作空间的根 Yjs 文档中执行事务
      () => {
        // 获取存储所有文档元数据的 YArray
        const docs = this.workspaceService.workspace.rootYDoc
          .getMap('meta') // 获取 'meta' 映射
          .get('pages'); // 获取 'pages' 数组，存储所有文档的元数据

        // 检查 docs 是否存在且为 YArray 类型
        if (!docs || !(docs instanceof YArray)) {
          return; // 如果不存在或类型不正确，直接返回
        }

        // 向文档数组中添加新文档的元数据
        docs.push([
          new YMap([
            // 创建新的 YMap 存储文档元数据
            ['id', id], // 文档唯一标识符
            ['title', ''], // 文档标题，初始为空字符串
            ['createDate', Date.now()], // 文档创建时间戳
            ['tags', new YArray()], // 文档标签数组，初始为空
          ]),
        ]);
      },
      { force: true } // 强制执行事务，即使在只读模式下也会执行
    );

    return id; // 返回创建的文档 ID
  }

  /**
   * 监听所有文档 ID 的变化
   *
   * 这是一个响应式方法，返回一个 Observable，当文档列表发生变化时会自动更新
   * 用于实时获取工作空间中所有文档的 ID 列表
   *
   * @returns Observable<string[]> 包含所有文档 ID 的响应式流
   */
  watchDocIds() {
    return yjsGetPath(
      // 获取 Yjs 文档中指定路径的数据
      this.workspaceService.workspace.rootYDoc.getMap('meta'), // 获取根文档的 'meta' 映射
      'pages' // 指定路径为 'pages'，存储所有文档元数据
    ).pipe(
      switchMap(yjsObserve), // 切换到监听模式，当数据变化时发出新值
      map(meta => {
        // 转换数据格式
        if (meta instanceof YArray) {
          // 检查数据是否为 YArray 类型
          return meta.map(v => v.get('id') as string); // 提取每个文档的 ID
        } else {
          return []; // 如果数据格式不正确，返回空数组
        }
      })
    );
  }

  /**
   * 监听所有文档的更新时间变化
   *
   * 使用通配符路径 '*.updatedDate' 监听所有文档的 updatedDate 字段变化
   * 当任何文档的更新时间发生变化时，都会触发新的数据流
   *
   * @returns Observable<Array<{id: string, updatedDate: number | undefined}>>
   *          包含文档 ID 和更新时间的响应式流
   */
  watchAllDocUpdatedDate() {
    return yjsGetPath(
      // 获取 Yjs 文档中指定路径的数据
      this.workspaceService.workspace.rootYDoc.getMap('meta'), // 获取根文档的 'meta' 映射
      'pages' // 指定路径为 'pages'，存储所有文档元数据
    ).pipe(
      switchMap(pages => yjsObservePath(pages, '*.updatedDate')), // 使用通配符监听所有文档的 updatedDate 字段
      map(pages => {
        // 转换数据格式
        if (pages instanceof YArray) {
          // 检查数据是否为 YArray 类型
          return pages.map(v => ({
            // 映射每个文档的 ID 和更新时间
            id: v.get('id') as string, // 文档 ID
            updatedDate: v.get('updatedDate') as number | undefined, // 文档更新时间戳
          }));
        } else {
          return []; // 如果数据格式不正确，返回空数组
        }
      })
    );
  }

  /**
   * 监听所有文档的标签变化
   *
   * 使用通配符路径 '*.tags' 监听所有文档的标签字段变化
   * 标签数据可能是 YArray 类型（Yjs 数组）或普通数组，需要进行类型检查和转换
   *
   * @returns Observable<Array<{id: string, tags: string[]}>>
   *          包含文档 ID 和标签数组的响应式流
   */
  watchAllDocTagIds() {
    return yjsGetPath(
      // 获取 Yjs 文档中指定路径的数据
      this.workspaceService.workspace.rootYDoc.getMap('meta'), // 获取根文档的 'meta' 映射
      'pages' // 指定路径为 'pages'，存储所有文档元数据
    ).pipe(
      switchMap(pages => yjsObservePath(pages, '*.tags')), // 使用通配符监听所有文档的 tags 字段
      map(pages => {
        // 转换数据格式
        if (pages instanceof YArray) {
          // 检查数据是否为 YArray 类型
          return pages.map(v => ({
            // 映射每个文档的 ID 和标签
            id: v.get('id') as string, // 文档 ID
            tags: (() => {
              // 处理标签数据的立即执行函数
              const tags = v.get('tags'); // 获取标签数据
              if (tags instanceof YArray) {
                // 如果是 YArray 类型
                return tags.toJSON() as string[]; // 转换为普通 JavaScript 数组
              }
              return (tags ?? []) as string[]; // 如果不是 YArray，直接返回或返回空数组
            })(),
          }));
        } else {
          return []; // 如果数据格式不正确，返回空数组
        }
      })
    );
  }

  /**
   * 监听所有文档的创建时间变化
   *
   * 使用通配符路径 '*.createDate' 监听所有文档的创建时间字段变化
   * 创建时间通常在文档创建时设置，后续不会改变
   *
   * @returns Observable<Array<{id: string, createDate: number}>>
   *          包含文档 ID 和创建时间戳的响应式流
   */
  watchAllDocCreateDate() {
    return yjsGetPath(
      // 获取 Yjs 文档中指定路径的数据
      this.workspaceService.workspace.rootYDoc.getMap('meta'), // 获取根文档的 'meta' 映射
      'pages' // 指定路径为 'pages'，存储所有文档元数据
    ).pipe(
      switchMap(pages => yjsObservePath(pages, '*.createDate')), // 使用通配符监听所有文档的 createDate 字段
      map(pages => {
        // 转换数据格式
        if (pages instanceof YArray) {
          // 检查数据是否为 YArray 类型
          return pages.map(v => ({
            // 映射每个文档的 ID 和创建时间
            id: v.get('id') as string, // 文档 ID
            createDate: (v.get('createDate') ?? 0) as number, // 文档创建时间戳，默认为 0
          }));
        } else {
          return []; // 如果数据格式不正确，返回空数组
        }
      })
    );
  }

  /**
   * 监听所有文档的标题变化
   *
   * 使用通配符路径 '*.title' 监听所有文档的标题字段变化
   * 文档标题是用户可编辑的，会频繁发生变化
   *
   * @returns Observable<Array<{id: string, title: string}>>
   *          包含文档 ID 和标题的响应式流
   */
  watchAllDocTitle() {
    return yjsGetPath(
      // 获取 Yjs 文档中指定路径的数据
      this.workspaceService.workspace.rootYDoc.getMap('meta'), // 获取根文档的 'meta' 映射
      'pages' // 指定路径为 'pages'，存储所有文档元数据
    ).pipe(
      switchMap(pages => yjsObservePath(pages, '*.title')), // 使用通配符监听所有文档的 title 字段
      map(pages => {
        // 转换数据格式
        if (pages instanceof YArray) {
          // 检查数据是否为 YArray 类型
          return pages.map(v => ({
            // 映射每个文档的 ID 和标题
            id: v.get('id') as string, // 文档 ID
            title: (v.get('title') ?? '') as string, // 文档标题，默认为空字符串
          }));
        } else {
          return []; // 如果数据格式不正确，返回空数组
        }
      })
    );
  }

  /**
   * 监听非垃圾箱文档 ID 的变化
   *
   * 通过监听所有文档的 'trash' 字段，过滤出未被删除的文档
   * 当文档的垃圾箱状态发生变化时，会自动更新非垃圾箱文档列表
   *
   * @returns Observable<string[]> 包含所有非垃圾箱文档 ID 的响应式流
   */
  watchNonTrashDocIds() {
    return yjsGetPath(
      // 获取 Yjs 文档中指定路径的数据
      this.workspaceService.workspace.rootYDoc.getMap('meta'), // 获取根文档的 'meta' 映射
      'pages' // 指定路径为 'pages'，存储所有文档元数据
    ).pipe(
      switchMap(pages => yjsObservePath(pages, '*.trash')), // 使用通配符监听所有文档的 trash 字段
      map(meta => {
        // 转换数据格式
        if (meta instanceof YArray) {
          // 检查数据是否为 YArray 类型
          return meta
            .map(v => (v.get('trash') ? null : v.get('id'))) // 如果文档在垃圾箱中则返回 null，否则返回文档 ID
            .filter(Boolean) as string[]; // 过滤掉 null 值，只保留有效的文档 ID
        } else {
          return []; // 如果数据格式不正确，返回空数组
        }
      })
    );
  }

  /**
   * 监听垃圾箱文档 ID 的变化
   *
   * 通过监听所有文档的 'trash' 字段，过滤出被删除到垃圾箱的文档
   * 当文档被移入或移出垃圾箱时，会自动更新垃圾箱文档列表
   *
   * @returns Observable<string[]> 包含所有垃圾箱文档 ID 的响应式流
   */
  watchTrashDocIds() {
    return yjsGetPath(
      // 获取 Yjs 文档中指定路径的数据
      this.workspaceService.workspace.rootYDoc.getMap('meta'), // 获取根文档的 'meta' 映射
      'pages' // 指定路径为 'pages'，存储所有文档元数据
    ).pipe(
      switchMap(pages => yjsObservePath(pages, '*.trash')), // 使用通配符监听所有文档的 trash 字段
      map(meta => {
        // 转换数据格式
        if (meta instanceof YArray) {
          // 检查数据是否为 YArray 类型
          return meta
            .map(v => (v.get('trash') ? v.get('id') : null)) // 如果文档在垃圾箱中则返回文档 ID，否则返回 null
            .filter(Boolean) as string[]; // 过滤掉 null 值，只保留垃圾箱中的文档 ID
        } else {
          return []; // 如果数据格式不正确，返回空数组
        }
      })
    );
  }

  /**
   * 监听指定文档的元数据变化
   *
   * 这是一个高性能的单文档监听方法，包含以下优化：
   * 1. 使用索引缓存避免重复查找
   * 2. 使用 for-of 循环提高遍历性能
   * 3. 使用深度监听确保嵌套属性变化也能被捕获
   *
   * @param id 要监听的文档 ID
   * @returns Observable<Partial<DocMeta>> 包含文档元数据的响应式流
   */
  watchDocMeta(id: string) {
    let docMetaIndexCache = -1; // 缓存文档在数组中的索引，避免重复查找
    return yjsGetPath(
      // 获取 Yjs 文档中指定路径的数据
      this.workspaceService.workspace.rootYDoc.getMap('meta'), // 获取根文档的 'meta' 映射
      'pages' // 指定路径为 'pages'，存储所有文档元数据
    ).pipe(
      switchMap(yjsObserve), // 监听文档数组的变化
      map(meta => {
        // 查找指定 ID 的文档
        if (meta instanceof YArray) {
          // 检查数据是否为 YArray 类型
          // 首先尝试使用缓存的索引快速查找
          if (docMetaIndexCache >= 0) {
            const doc = meta.get(docMetaIndexCache); // 从缓存索引获取文档
            if (doc && doc.get('id') === id) {
              // 验证文档 ID 是否匹配
              return doc as YMap<any>; // 返回找到的文档
            }
          }

          // 如果缓存失效，则遍历整个数组查找文档
          // meta is YArray, `for-of` is faster then `for`
          let i = 0; // 索引计数器
          for (const doc of meta) {
            // 使用 for-of 循环遍历（性能更好）
            if (doc && doc.get('id') === id) {
              // 检查文档 ID 是否匹配
              docMetaIndexCache = i; // 更新缓存索引
              return doc as YMap<any>; // 返回找到的文档
            }
            i++; // 递增索引
          }
          return null; // 未找到指定文档
        } else {
          return null; // 数据格式不正确
        }
      }),
      switchMap(yjsObserveDeep), // 深度监听文档元数据的所有嵌套属性变化
      map(meta => {
        // 转换数据格式
        if (meta instanceof YMap) {
          // 检查数据是否为 YMap 类型
          return meta.toJSON() as Partial<DocMeta>; // 转换为普通 JavaScript 对象
        } else {
          return {}; // 如果数据不存在，返回空对象
        }
      })
    );
  }

  /**
   * 监听文档列表的同步状态
   *
   * 监听工作空间文档的同步状态，当所有文档都同步完成时返回 true
   * 用于确保文档列表已经完全加载并同步
   *
   * @returns Observable<boolean> 文档列表是否已同步完成的响应式流
   */
  watchDocListReady() {
    return this.workspaceService.workspace.engine.doc // 获取文档引擎
      .docState$(this.workspaceService.workspace.id) // 监听工作空间的文档状态
      .pipe(map(state => state.synced)); // 提取同步状态
  }

  /**
   * 设置文档元数据
   *
   * 直接更新指定文档的元数据，如标题、标签、创建时间等
   * 这是一个同步操作，会立即更新文档的元数据
   *
   * @param id 文档 ID
   * @param meta 要更新的元数据（部分更新）
   */
  setDocMeta(id: string, meta: Partial<DocMeta>) {
    this.workspaceService.workspace.docCollection.meta.setDocMeta(id, meta); // 调用文档集合的元数据设置方法
  }

  /**
   * 设置文档的主要模式
   *
   * 设置文档的主要显示模式（如页面模式、白板模式等）
   * 这个设置存储在文档属性中，而不是基本元数据中
   *
   * @param id 文档 ID
   * @param mode 文档模式
   */
  setDocPrimaryModeSetting(id: string, mode: DocMode) {
    return this.docPropertiesStore.updateDocProperties(id, {
      // 通过文档属性存储更新
      primaryMode: mode, // 设置主要模式
    });
  }

  /**
   * 获取文档的主要模式设置
   *
   * 同步获取指定文档的主要显示模式
   *
   * @param id 文档 ID
   * @returns 文档的主要模式，如果未设置则返回 undefined
   */
  getDocPrimaryModeSetting(id: string) {
    return this.docPropertiesStore.getDocProperties(id)?.primaryMode; // 从文档属性中获取主要模式
  }

  /**
   * 监听文档主要模式设置的变化
   *
   * 响应式监听指定文档的主要模式变化
   * 使用 distinctUntilChanged 确保只在模式真正改变时才发出新值
   *
   * @param id 文档 ID
   * @returns Observable<DocMode | undefined> 文档主要模式的响应式流
   */
  watchDocPrimaryModeSetting(id: string) {
    return this.docPropertiesStore.watchDocProperties(id).pipe(
      // 监听文档属性变化
      map(config => config?.primaryMode), // 提取主要模式
      distinctUntilChanged((p, c) => p === c) // 只在模式真正改变时发出新值
    );
  }

  /**
   * 等待文档加载完成
   *
   * 异步等待指定文档完全加载完成
   * 用于确保在操作文档之前，文档已经完全加载
   *
   * @param id 文档 ID
   * @returns Promise 文档加载完成的 Promise
   */
  waitForDocLoadReady(id: string) {
    return this.workspaceService.workspace.engine.doc.waitForDocLoaded(id); // 调用文档引擎的等待加载方法
  }

  /**
   * 添加文档优先加载
   *
   * 为指定文档设置加载优先级，优先级高的文档会优先加载
   * 用于优化用户体验，确保重要文档优先加载
   *
   * @param id 文档 ID
   * @param priority 优先级数值，数值越高优先级越高
   */
  addPriorityLoad(id: string, priority: number) {
    return this.workspaceService.workspace.engine.doc.addPriority(id, priority); // 调用文档引擎的优先级设置方法
  }
}
