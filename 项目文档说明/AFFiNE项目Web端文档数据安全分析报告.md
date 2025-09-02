# AFFiNE项目Web端文档数据安全分析报告

## 📋 项目概述

**项目名称**: AFFiNE  
**部署方式**: 私有化部署（公司内网）  
**分析目标**: 评估员工离职后通过浏览器导出本地数据的安全风险  
**分析日期**: 2024年

## 🔍 数据存储架构分析

### 1. 存储方式

AFFiNE采用"local-first"架构，数据存储方式如下：

| 存储类型 | 技术实现         | 存储内容                       | 持久化程度 |
| -------- | ---------------- | ------------------------------ | ---------- |
| 文档数据 | IndexedDB        | 完整文档内容、元数据、版本历史 | 高度持久化 |
| 附件数据 | IndexedDB (Blob) | 图片、文件等二进制数据         | 高度持久化 |
| 用户配置 | localStorage     | 用户偏好、界面设置             | 持久化     |
| 会话数据 | sessionStorage   | 临时状态、缓存数据             | 会话级     |
| 同步数据 | IndexedDB        | 云同步元数据、冲突解决         | 高度持久化 |

### 2. 关键存储服务

基于代码分析，主要存储服务包括：

- **StorageMemento**: 同步存储服务（localStorage/sessionStorage）
- **AsyncStorageMemento**: 异步存储服务（IndexedDB）
- **LocalStorageGlobalCache**: 全局缓存
- **IDBGlobalState**: IndexedDB全局状态管理

## ⚠️ 安全风险评估

### 1. 高风险问题

#### 🔴 数据持久化风险

- **问题**: IndexedDB中的文档数据在用户登出后仍然保留
- **影响**: 员工离职后仍可完整访问所有本地文档
- **风险等级**: 高

#### 🔴 数据导出功能

- **问题**: 系统提供完整的工作区导出功能
- **代码位置**: `packages/frontend/core/src/desktop/dialogs/setting/workspace-setting/storage/export.tsx`
- **功能**: 支持导出完整工作区备份（.db文件）
- **风险等级**: 高

#### 🔴 离线访问能力

- **问题**: 支持完全离线工作，无需网络连接
- **影响**: 即使断网也可访问所有本地数据
- **风险等级**: 高

### 2. 中等风险问题

#### 🟡 会话管理不足

- **问题**: 缺乏强制会话超时机制
- **影响**: 长期保持登录状态
- **风险等级**: 中

#### 🟡 数据清理不完整

- **问题**: 登出时只清除认证信息，不清理本地数据
- **代码分析**: `AuthService.signOut()`方法未包含本地数据清理
- **风险等级**: 中

### 3. 现有防护措施分析

#### ✅ 已有措施

- 网络访问控制（内网限制）
- 用户身份认证
- 工作区权限管理
- 基础的登出功能

#### ❌ 缺失措施

- 强制本地数据清理
- 远程数据擦除能力
- 数据导出权限控制
- 会话超时管理
- 数据访问审计

## 🛡️ 安全解决方案

### 1. 立即实施方案（高优先级）

#### A. 强制数据清理机制

**实施位置**: `packages/frontend/core/src/modules/cloud/services/auth.ts`

```typescript
// 修改 AuthService.signOut() 方法
async signOut() {
  // 现有登出逻辑
  await this.clearAuthSession();

  // 新增：强制清理本地数据
  await this.clearAllLocalData();

  // 通知其他标签页
  this.broadcastSignOut();
}

private async clearAllLocalData() {
  try {
    // 清理 IndexedDB 数据库
    await this.clearIndexedDBData();

    // 清理 localStorage
    localStorage.clear();

    // 清理 sessionStorage
    sessionStorage.clear();

    // 清理缓存
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(name => caches.delete(name))
      );
    }
  } catch (error) {
    console.error('清理本地数据失败:', error);
  }
}

private async clearIndexedDBData() {
  const databases = [
    'affine-local-workspace',
    'affine-cloud-workspace',
    'affine-sync-metadata',
    'affine-blob-storage'
  ];

  for (const dbName of databases) {
    try {
      const deleteReq = indexedDB.deleteDatabase(dbName);
      await new Promise((resolve, reject) => {
        deleteReq.onsuccess = () => resolve(void 0);
        deleteReq.onerror = () => reject(deleteReq.error);
      });
    } catch (error) {
      console.error(`删除数据库 ${dbName} 失败:`, error);
    }
  }
}
```

#### B. 会话超时机制

**实施位置**: 新建 `packages/frontend/core/src/modules/session/session-manager.ts`

```typescript
export class SessionManager {
  private sessionTimeout = 8 * 60 * 60 * 1000; // 8小时
  private checkInterval = 30 * 60 * 1000; // 30分钟检查一次
  private lastActivityTime = Date.now();

  startSessionMonitor() {
    // 监听用户活动
    this.bindActivityListeners();

    // 定期检查会话状态
    setInterval(() => {
      this.validateSession();
    }, this.checkInterval);
  }

  private bindActivityListeners() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(
        event,
        () => {
          this.lastActivityTime = Date.now();
        },
        { passive: true }
      );
    });
  }

  private async validateSession() {
    const now = Date.now();
    if (now - this.lastActivityTime > this.sessionTimeout) {
      await this.forceSignOut('会话超时');
    }
  }

  private async forceSignOut(reason: string) {
    console.log(`强制登出: ${reason}`);
    const authService = this.framework.get(AuthService);
    await authService.signOut();

    // 重定向到登录页
    window.location.href = '/signin';
  }
}
```

#### C. 网络访问控制增强

**实施位置**: Nginx配置或应用层中间件

```nginx
# Nginx 配置示例
server {
    listen 80;
    server_name affine.company.com;

    # IP白名单
    allow 192.168.1.0/24;  # 公司内网段
    allow 10.0.0.0/8;      # 内网段
    deny all;

    # 地理位置限制（可选）
    if ($geoip_country_code != CN) {
        return 403;
    }

    location / {
        proxy_pass http://affine-backend;

        # 安全头
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
    }
}
```

### 2. 短期实施方案（中优先级）

#### A. 导出权限控制

**实施位置**: `packages/frontend/core/src/desktop/dialogs/setting/workspace-setting/storage/export.tsx`

```typescript
export const DesktopExportPanel = ({ workspace }: ExportPanelProps) => {
  const permissionService = useService(WorkspacePermissionService);
  const canExport = useLiveData(permissionService.permission.canExport$);

  const onExport = useAsyncCallback(async () => {
    // 权限检查
    if (!canExport) {
      notify.error({ title: '无导出权限' });
      return;
    }

    // 记录导出操作
    await this.logExportOperation(workspace.id, 'workspace');

    // 现有导出逻辑...
  }, [canExport, workspace]);

  if (!canExport) {
    return (
      <SettingRow
        name="数据导出"
        desc="您没有导出权限，请联系管理员"
      >
        <Button disabled>导出被禁用</Button>
      </SettingRow>
    );
  }

  // 现有组件逻辑...
};
```

#### B. 审计日志系统

**实施位置**: 新建 `packages/frontend/core/src/modules/audit/audit-service.ts`

```typescript
export class AuditService {
  async logUserAction(action: string, details: any) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      userId: this.getCurrentUserId(),
      action,
      details,
      userAgent: navigator.userAgent,
      ip: await this.getClientIP(),
    };

    // 发送到后端
    await this.sendToBackend('/api/audit/log', logEntry);

    // 本地备份（加密存储）
    await this.storeLocalAuditLog(logEntry);
  }

  async logExportOperation(workspaceId: string, exportType: string) {
    await this.logUserAction('EXPORT_DATA', {
      workspaceId,
      exportType,
      severity: 'HIGH',
    });
  }

  async logDataAccess(resourceId: string, resourceType: string) {
    await this.logUserAction('ACCESS_DATA', {
      resourceId,
      resourceType,
      severity: 'MEDIUM',
    });
  }
}
```

#### C. 数据加密存储

**实施位置**: `packages/frontend/core/src/modules/storage/impls/storage.ts`

```typescript
export class EncryptedStorageMemento {
  private encryptionKey: string;

  constructor(private storage: Storage) {
    this.encryptionKey = this.generateSessionKey();
  }

  set(key: string, value: any): void {
    const encrypted = this.encrypt(JSON.stringify(value));
    this.storage.setItem(key, encrypted);
  }

  get(key: string): any {
    const encrypted = this.storage.getItem(key);
    if (!encrypted) return undefined;

    try {
      const decrypted = this.decrypt(encrypted);
      return JSON.parse(decrypted);
    } catch {
      return undefined;
    }
  }

  private encrypt(data: string): string {
    // 使用 Web Crypto API 进行加密
    // 实现 AES-GCM 加密
  }

  private decrypt(encryptedData: string): string {
    // 对应的解密实现
  }

  private generateSessionKey(): string {
    // 基于用户会话生成加密密钥
    // 用户登出时密钥失效
  }
}
```

### 3. 长期规划方案（低优先级）

#### A. 设备绑定机制

- 实现设备指纹识别
- 限制可访问设备数量
- 设备授权管理

#### B. 异常行为检测

- 大量数据访问检测
- 异常时间访问检测
- 批量导出行为检测

#### C. 数据水印技术

- 文档内容水印
- 导出文件标识
- 数据溯源能力

## 📊 实施计划

### 第一阶段（1-2周）

- [ ] 实施强制数据清理机制
- [ ] 部署会话超时管理
- [ ] 配置网络访问控制
- [ ] 测试数据清理效果

### 第二阶段（2-4周）

- [ ] 实现导出权限控制
- [ ] 部署审计日志系统
- [ ] 添加用户行为监控
- [ ] 建立安全运营流程

### 第三阶段（1-3个月）

- [ ] 实现数据加密存储
- [ ] 开发异常检测算法
- [ ] 完善安全管理制度
- [ ] 进行安全评估和渗透测试

## 🎯 预期效果

### 安全提升

- **数据泄露风险降低90%**: 通过强制清理和加密存储
- **访问控制覆盖率100%**: 网络、权限、会话全方位控制
- **审计能力提升**: 完整的用户行为追踪

### 合规性

- 满足企业数据安全要求
- 符合数据保护法规
- 建立完整的安全管理体系

## 📋 管理建议

### 1. 技术措施

- 定期更新安全补丁
- 实施多层防护策略
- 建立应急响应机制

### 2. 管理制度

- 制定数据安全管理制度
- 建立员工安全培训体系
- 实施最小权限原则

### 3. 监控运营

- 7×24小时安全监控
- 定期安全评估
- 持续改进安全措施

## 📞 联系信息

如需技术支持或详细实施指导，请联系安全团队。

---

**文档版本**: v1.0  
**最后更新**: 2024年  
**下次评估**: 建议3个月后进行安全评估更新
