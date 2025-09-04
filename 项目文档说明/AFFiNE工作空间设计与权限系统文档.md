# AFFiNE 工作空间设计与权限系统文档

## 1. 概述

AFFiNE 采用基于角色的访问控制(RBAC)模型，实现了工作空间级别和文档级别的双层权限管理系统。系统支持本地工作空间和云端工作空间两种类型，并针对团队协作场景提供了完整的权限管理功能。

## 2. 工作空间基础架构

### 2.1 工作空间模型

```typescript
// 工作空间核心属性
interface Workspace {
  id: string; // 工作空间唯一标识
  public: boolean; // 是否公开
  createdAt: DateTime; // 创建时间
  name?: string; // 工作空间名称
  avatarKey?: string; // 头像标识

  // 功能开关
  enableAi: boolean; // AI功能
  enableUrlPreview: boolean; // URL预览
  enableDocEmbedding: boolean; // 文档嵌入

  // 索引相关
  indexed: boolean; // 是否已索引
  lastCheckEmbeddings: DateTime; // 最后检查嵌入时间
}
```

### 2.2 数据库表结构

#### 核心表

1. **Workspace表** - 存储工作空间基本信息
2. **WorkspaceUserRole表** - 用户在工作空间中的角色
3. **WorkspaceDoc表** - 文档元数据
4. **WorkspaceDocUserRole表** - 用户在特定文档中的角色
5. **WorkspaceFeature表** - 工作空间功能特性

#### 关键字段说明

```sql
-- 工作空间用户角色表
CREATE TABLE WorkspaceUserRole (
  workspaceId VARCHAR,           -- 工作空间ID
  userId VARCHAR,                -- 用户ID
  type SMALLINT,                 -- 角色类型(WorkspaceRole枚举)
  status WorkspaceMemberStatus,  -- 成员状态
  source WorkspaceMemberSource,  -- 邀请来源
  inviterId VARCHAR,             -- 邀请人ID
  createdAt TIMESTAMPTZ,
  updatedAt TIMESTAMPTZ
);

-- 文档用户角色表
CREATE TABLE WorkspaceDocUserRole (
  workspaceId VARCHAR,           -- 工作空间ID
  docId VARCHAR,                 -- 文档ID
  userId VARCHAR,                -- 用户ID
  type SMALLINT,                 -- 角色类型(DocRole枚举)
  createdAt TIMESTAMPTZ
);
```

## 3. 权限系统设计

### 3.1 双层权限模型

AFFiNE 实现了工作空间级别和文档级别的双层权限控制：

```
工作空间权限 (WorkspaceRole)
├── External (-99)     # 外部用户
├── Collaborator (1)   # 协作者
├── Admin (10)         # 管理员
└── Owner (99)         # 所有者

文档权限 (DocRole)
├── None (-32768)      # 无权限
├── External (0)       # 外部访问
├── Reader (10)        # 读者
├── Commenter (15)     # 评论者
├── Editor (20)        # 编辑者
├── Manager (30)       # 管理者
└── Owner (99)         # 所有者
```

### 3.2 工作空间权限详解

#### 权限动作定义

```typescript
const WorkspaceActions = {
  // 基础权限
  'Workspace.Read': '读取工作空间',
  'Workspace.Sync': '同步数据',
  'Workspace.CreateDoc': '创建文档',
  'Workspace.Delete': '删除工作空间',
  'Workspace.TransferOwner': '转移所有权',

  // 组织管理
  'Workspace.Organize.Read': '读取组织结构',

  // 用户管理
  'Workspace.Users.Read': '查看用户列表',
  'Workspace.Users.Manage': '管理用户',

  // 管理员管理
  'Workspace.Administrators.Manage': '管理管理员',

  // 属性管理
  'Workspace.Properties.Read': '读取属性',
  'Workspace.Properties.Create': '创建属性',
  'Workspace.Properties.Update': '更新属性',
  'Workspace.Properties.Delete': '删除属性',

  // 设置管理
  'Workspace.Settings.Read': '读取设置',
  'Workspace.Settings.Update': '更新设置',

  // 文件管理
  'Workspace.Blobs.Read': '读取文件',
  'Workspace.Blobs.List': '列出文件',
  'Workspace.Blobs.Write': '写入文件',

  // 高级功能
  'Workspace.Copilot': 'AI助手功能',
  'Workspace.Payment.Manage': '付费管理',
};
```

#### 角色权限映射

```typescript
const WorkspaceRolePermissions = {
  [WorkspaceRole.External]: ['Workspace.Read', 'Workspace.Organize.Read', 'Workspace.Properties.Read', 'Workspace.Blobs.Read'],

  [WorkspaceRole.Collaborator]: [
    // 继承External的所有权限
    ...External,
    'Workspace.Sync',
    'Workspace.CreateDoc',
    'Workspace.Users.Read',
    'Workspace.Settings.Read',
    'Workspace.Blobs.Write',
    'Workspace.Blobs.List',
    'Workspace.Copilot',
  ],

  [WorkspaceRole.Admin]: [
    // 继承Collaborator的所有权限
    ...Collaborator,
    'Workspace.Users.Manage',
    'Workspace.Settings.Update',
    'Workspace.Properties.Create',
    'Workspace.Properties.Update',
    'Workspace.Properties.Delete',
  ],

  [WorkspaceRole.Owner]: [
    // 继承Admin的所有权限
    ...Admin,
    'Workspace.Delete',
    'Workspace.Administrators.Manage',
    'Workspace.TransferOwner',
    'Workspace.Payment.Manage',
  ],
};
```

### 3.3 文档权限详解

#### 权限动作定义

```typescript
const DocActions = {
  // 基础操作
  'Doc.Read': '读取文档',
  'Doc.Copy': '复制文档',
  'Doc.Duplicate': '复制文档',
  'Doc.Update': '编辑文档',

  // 生命周期管理
  'Doc.Trash': '移至回收站',
  'Doc.Restore': '从回收站恢复',
  'Doc.Delete': '永久删除',

  // 发布和分享
  'Doc.Publish': '发布文档',
  'Doc.TransferOwner': '转移所有权',

  // 属性管理
  'Doc.Properties.Read': '读取属性',
  'Doc.Properties.Update': '更新属性',

  // 用户管理
  'Doc.Users.Read': '查看用户权限',
  'Doc.Users.Manage': '管理用户权限',

  // 评论系统
  'Doc.Comments.Read': '读取评论',
  'Doc.Comments.Create': '创建评论',
  'Doc.Comments.Update': '更新评论',
  'Doc.Comments.Delete': '删除评论',
  'Doc.Comments.Resolve': '解决评论',
};
```

#### 角色权限映射

```typescript
const DocRolePermissions = {
  [DocRole.External]: ['Doc.Read', 'Doc.Copy', 'Doc.Properties.Read', 'Doc.Comments.Read'],

  [DocRole.Reader]: [...External, 'Doc.Users.Read', 'Doc.Duplicate'],

  [DocRole.Commenter]: [...Reader, 'Doc.Comments.Create'],

  [DocRole.Editor]: [...Reader, ...Commenter, 'Doc.Trash', 'Doc.Restore', 'Doc.Delete', 'Doc.Properties.Update', 'Doc.Update', 'Doc.Comments.Resolve', 'Doc.Comments.Delete'],

  [DocRole.Manager]: [...Editor, 'Doc.Publish', 'Doc.Users.Manage'],

  [DocRole.Owner]: [...Manager, 'Doc.TransferOwner'],
};
```

### 3.4 权限继承和修正机制

工作空间角色会影响用户在文档中的最终权限：

```typescript
function fixupDocRole(workspaceRole: WorkspaceRole | null, docRole: DocRole | null): DocRole | null {
  switch (workspaceRole) {
    case WorkspaceRole.External:
      // 外部用户最多只能获得Editor权限
      return Math.min(DocRole.Editor, docRole);

    case WorkspaceRole.Owner:
      // 工作空间所有者自动获得文档所有者权限
      return DocRole.Owner;

    case WorkspaceRole.Admin:
      // 工作空间管理员至少获得文档管理者权限
      return Math.max(DocRole.Manager, docRole);

    default:
      return docRole;
  }
}
```

## 4. 成员状态管理

### 4.1 成员状态枚举

```typescript
enum WorkspaceMemberStatus {
  Pending = 'Pending', // 等待受邀者接受邀请
  UnderReview = 'UnderReview', // 等待管理员审核链接邀请
  AllocatingSeat = 'AllocatingSeat', // 团队工作空间临时状态
  NeedMoreSeat = 'NeedMoreSeat', // 座位不足
  Accepted = 'Accepted', // 已激活的工作空间成员
}

enum WorkspaceMemberSource {
  Email = 'Email', // 邮件邀请
  Link = 'Link', // 链接邀请
}
```

### 4.2 邀请流程

1. **邮件邀请**：管理员直接邀请用户，状态为Pending
2. **链接邀请**：用户通过邀请链接加入，状态为UnderReview
3. **审核通过**：管理员审核后状态变为Accepted
4. **座位管理**：团队工作空间需要检查座位数量

## 5. GraphQL API 设计

### 5.1 权限查询接口

```graphql
# 查询工作空间权限
query getWorkspaceRolePermissions($id: String!) {
  workspaceRolePermissions(id: $id) {
    role
    permissions {
      Workspace_Administrators_Manage
      Workspace_Blobs_List
      Workspace_Blobs_Read
      Workspace_Blobs_Write
      Workspace_Copilot
      Workspace_CreateDoc
      Workspace_Delete
      Workspace_Organize_Read
      Workspace_Payment_Manage
      Workspace_Properties_Create
      Workspace_Properties_Delete
      Workspace_Properties_Read
      Workspace_Properties_Update
      Workspace_Read
      Workspace_Settings_Read
      Workspace_Settings_Update
      Workspace_Sync
      Workspace_TransferOwner
      Workspace_Users_Manage
      Workspace_Users_Read
    }
  }
}

# 查询文档权限
query getDocRolePermissions($workspaceId: String!, $docId: String!) {
  workspace(id: $workspaceId) {
    doc(docId: $docId) {
      permissions {
        Doc_Copy
        Doc_Delete
        Doc_Duplicate
        Doc_Properties_Read
        Doc_Properties_Update
        Doc_Publish
        Doc_Read
        Doc_Restore
        Doc_TransferOwner
        Doc_Trash
        Doc_Update
        Doc_Users_Manage
        Doc_Users_Read
        Doc_Comments_Create
        Doc_Comments_Delete
        Doc_Comments_Read
        Doc_Comments_Resolve
      }
    }
  }
}
```

### 5.2 权限数据结构

```typescript
// 工作空间权限返回结构
interface WorkspacePermissions {
  Workspace_Administrators_Manage: boolean;
  Workspace_Blobs_List: boolean;
  Workspace_Blobs_Read: boolean;
  Workspace_Blobs_Write: boolean;
  Workspace_Copilot: boolean;
  Workspace_CreateDoc: boolean;
  Workspace_Delete: boolean;
  Workspace_Organize_Read: boolean;
  Workspace_Payment_Manage: boolean;
  Workspace_Properties_Create: boolean;
  Workspace_Properties_Delete: boolean;
  Workspace_Properties_Read: boolean;
  Workspace_Properties_Update: boolean;
  Workspace_Read: boolean;
  Workspace_Settings_Read: boolean;
  Workspace_Settings_Update: boolean;
  Workspace_Sync: boolean;
  Workspace_TransferOwner: boolean;
  Workspace_Users_Manage: boolean;
  Workspace_Users_Read: boolean;
}

// 文档权限返回结构
interface DocPermissions {
  Doc_Copy: boolean;
  Doc_Delete: boolean;
  Doc_Duplicate: boolean;
  Doc_Properties_Read: boolean;
  Doc_Properties_Update: boolean;
  Doc_Publish: boolean;
  Doc_Read: boolean;
  Doc_Restore: boolean;
  Doc_TransferOwner: boolean;
  Doc_Trash: boolean;
  Doc_Update: boolean;
  Doc_Users_Manage: boolean;
  Doc_Users_Read: boolean;
  Doc_Comments_Create: boolean;
  Doc_Comments_Delete: boolean;
  Doc_Comments_Read: boolean;
  Doc_Comments_Resolve: boolean;
}
```

## 6. 前端权限管理

### 6.1 权限服务架构

```typescript
// 权限服务
class WorkspacePermissionService {
  permission = this.framework.createEntity(WorkspacePermission);

  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly workspacesService: WorkspacesService,
    private readonly store: WorkspacePermissionStore
  ) {}

  async leaveWorkspace() {
    await this.store.leaveWorkspace(this.workspaceService.workspace.id);
    this.workspacesService.list.revalidate();
  }
}

// 权限实体
class WorkspacePermission extends Entity {
  // 权限检查和管理逻辑
}

// 权限存储
class WorkspacePermissionStore {
  // 权限数据缓存和同步
}
```

### 6.2 权限检查流程

1. **获取权限**：通过GraphQL查询用户权限
2. **缓存权限**：将权限数据存储在本地store
3. **UI控制**：根据权限控制功能显示和可用性
4. **操作验证**：执行操作前进行权限验证

## 7. 团队工作空间特性

### 7.1 个人 vs 团队工作空间

| 特性     | 个人工作空间 | 团队工作空间 |
| -------- | ------------ | ------------ |
| 角色管理 | 基础角色     | 完整角色体系 |
| 成员邀请 | 有限         | 完整邀请系统 |
| 权限控制 | 简单         | 细粒度控制   |
| 付费功能 | 无           | 支持         |
| 座位管理 | 无           | 支持         |
| 审核机制 | 无           | 支持         |

### 7.2 团队工作空间独有功能

- **详细权限控制**：支持Admin角色的细粒度权限管理
- **成员邀请管理**：支持邮件和链接两种邀请方式
- **付费管理**：支持订阅和座位管理
- **审核机制**：管理员可以审核新成员加入
- **座位分配**：动态管理团队成员座位

## 8. 安全机制

### 8.1 安全原则

1. **后端验证**：所有权限检查在后端进行
2. **最小权限**：用户只获得必要的最小权限
3. **权限继承**：通过角色继承简化权限管理
4. **防护机制**：防止权限提升和越权访问

### 8.2 安全实现

```typescript
// 权限检查控制器
class WorkspaceAccessController {
  async can(resource: Resource, action: WorkspaceAction): Promise<boolean> {
    const { permissions, role } = await this.role(resource);
    const allow = permissions[action] || false;

    if (!allow) {
      this.logger.debug('Workspace access check failed', {
        action,
        resource,
        role,
        requiredRole: workspaceActionRequiredRole(action),
      });
    }

    return allow;
  }

  async assert(resource: Resource, action: WorkspaceAction): Promise<void> {
    const allow = await this.can(resource, action);
    if (!allow) {
      throw new SpaceAccessDenied({ spaceId: resource.workspaceId });
    }
  }
}
```

## 9. 工作空间创建流程

### 9.1 后端创建流程

```typescript
// 工作空间模型
class WorkspaceModel {
  @Transactional()
  async create(userId: string): Promise<Workspace> {
    // 1. 创建工作空间记录
    const workspace = await this.db.workspace.create({
      data: { public: false },
    });

    // 2. 设置创建者为所有者
    await this.models.workspaceUser.setOwner(workspace.id, userId);

    // 3. 记录日志
    this.logger.log(`Workspace created with id ${workspace.id}`);

    return workspace;
  }
}
```

### 9.2 前端创建流程

1. **用户交互**：点击"创建工作空间"按钮
2. **对话框**：显示CreateWorkspaceDialog
3. **输入信息**：工作空间名称和类型选择
4. **调用API**：通过buildShowcaseWorkspace创建
5. **初始化**：导入默认文档和设置

## 10. 设计原则总结

### 10.1 核心原则

1. **分层设计**：工作空间 + 文档的双层权限模型
2. **角色继承**：高级角色包含低级角色的所有权限
3. **权限修正**：工作空间角色影响文档权限
4. **最小权限**：用户获得完成任务的最小权限
5. **安全优先**：后端验证，前端UI控制
6. **可扩展性**：易于添加新权限和角色

### 10.2 最佳实践

- **统一接口**：通过AccessController提供统一的权限检查
- **缓存机制**：前端缓存权限数据减少网络请求
- **错误处理**：明确的权限错误提示和处理
- **日志记录**：详细的权限检查日志用于调试
- **测试覆盖**：完整的权限测试用例

## 11. 总结

AFFiNE的工作空间权限系统是一个设计精良的RBAC系统，具有以下特点：

- **完整性**：覆盖工作空间和文档两个层次的权限管理
- **灵活性**：支持个人和团队两种工作空间类型
- **安全性**：后端验证确保权限安全
- **可扩展性**：模块化设计便于功能扩展
- **用户友好**：清晰的角色定义和权限说明

该系统为AFFiNE提供了强大的协作基础，支持从个人使用到大型团队协作的各种场景。
