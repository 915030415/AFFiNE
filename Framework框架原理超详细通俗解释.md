# Framework 和 FrameworkRoot 原理超详细通俗解释

## 🎯 开篇：用生活中的例子理解框架

想象你要开一家餐厅，你需要：

- 👨‍🍳 **厨师**（Service）- 负责做菜
- 🥘 **菜品**（Entity）- 具体的食物
- 🏪 **餐厅区域**（Scope）- 不同的用餐区域
- 📦 **仓库**（Store）- 存放食材

**Framework** 就像餐厅的**管理系统**，它知道：

- 每个厨师会做什么菜
- 每道菜需要什么食材
- 哪个区域需要什么服务

**FrameworkRoot** 就像餐厅的**总经理**，负责协调整个餐厅的运营。

---

## 🏭 一、依赖注入："我要什么，你给我什么"

### 🤔 什么是依赖注入？

**传统方式**（自己动手）：

```typescript
// ❌ 厨师自己去买食材
class 厨师 {
  constructor() {
    this.刀具 = new 刀具(); // 自己买刀
    this.食材 = new 食材(); // 自己买菜
    this.调料 = new 调料(); // 自己买调料
  }

  做菜() {
    // 用自己买的东西做菜
  }
}
```

**依赖注入方式**（别人准备好给你）：

```typescript
// ✅ 餐厅给厨师准备好一切
class 厨师 {
  constructor(刀具, 食材, 调料) {
    // 餐厅准备好给我
    this.刀具 = 刀具;
    this.食材 = 食材;
    this.调料 = 调料;
  }

  做菜() {
    // 直接用餐厅准备的东西做菜
  }
}
```

### 🏗️ Framework 的"准备系统"

```typescript
// Framework 内部的"物品清单"
class Framework {
  private 物品清单 = new Map<
    string, // 区域名称："厨房"、"大厅"、"包间"
    Map<
      string, // 物品名称："厨师"、"服务员"、"收银员"
      Map<
        string, // 规格："新手"、"熟练"、"大师"
        Function // 制作方法：怎么"培训"出这个员工
      >
    >
  >();
}
```

**图解**：

```
📋 Framework 物品清单
├── 🏠 厨房区域
│   ├── 👨‍🍳 厨师
│   │   ├── 🟢 新手厨师 → 制作方法1
│   │   ├── 🟡 熟练厨师 → 制作方法2
│   │   └── 🔴 大师厨师 → 制作方法3
│   └── 🔪 刀具
│       └── 🟢 普通刀具 → 制作方法4
├── 🏛️ 大厅区域
│   └── 👩‍💼 服务员
│       └── 🟢 普通服务员 → 制作方法5
└── 🏪 包间区域
    └── 👨‍💼 管家
        └── 🟢 专属管家 → 制作方法6
```

### 🎯 依赖解析："智能配菜系统"

```typescript
class FrameworkProvider {
  // 就像餐厅的"配菜系统"
  get<T>(我要什么: 物品类型): T {
    // 1. 🔍 先看看仓库有没有现成的
    if (this.仓库.has(我要什么)) {
      console.log('仓库有现成的，直接给你！');
      return this.仓库.get(我要什么);
    }

    // 2. 🔄 检查会不会出现"死循环"
    // 比如：做宫保鸡丁需要鸡肉，但鸡肉又需要宫保鸡丁？这不对！
    if (this.正在准备中.has(我要什么)) {
      throw new Error('出现死循环了！');
    }

    // 3. 🏭 开始准备
    this.正在准备中.add(我要什么);

    try {
      // 4. 📋 找到制作方法
      const 制作方法 = this.找制作方法(我要什么);

      // 5. 🔧 按方法制作
      const 成品 = 制作方法(this);

      // 6. 📦 放入仓库，下次直接用
      this.仓库.set(我要什么, 成品);

      console.log('制作完成，放入仓库！');
      return 成品;
    } finally {
      this.正在准备中.delete(我要什么);
    }
  }
}
```

**实际例子**：

```typescript
// 🍳 定义一个厨师服务
class 厨师Service extends Service {
  constructor(private 刀具Service: 刀具Service) {
    super();
  }

  做宫保鸡丁() {
    const 刀 = this.刀具Service.get锋利刀具();
    return '用' + 刀 + '做出美味的宫保鸡丁';
  }
}

// 🔪 定义刀具服务
class 刀具Service extends Service {
  get锋利刀具() {
    return '锋利的菜刀';
  }
}

// 📝 注册到Framework
const framework = new Framework();
framework
  .service(刀具Service) // 先注册刀具
  .service(厨师Service, [刀具Service]); // 再注册厨师，告诉它需要刀具

// 🏭 使用
const provider = framework.provider();
const 厨师 = provider.get(厨师Service); // Framework自动给厨师准备好刀具
const 菜品 = 厨师.做宫保鸡丁(); // 厨师可以直接做菜了
console.log(菜品); // "用锋利的菜刀做出美味的宫保鸡丁"
```

---

## 🏢 二、模块化："各司其职，井然有序"

### 🎭 角色分工

Framework 把餐厅里的所有东西分成4大类：

```typescript
// 1. 👨‍🍳 Service（服务员工）- 会干活的人
class 厨师Service extends Service {
  做菜() {
    return '美味佳肴';
  }
}

class 服务员Service extends Service {
  上菜() {
    return '菜已上桌';
  }
}

// 2. 🥘 Entity（实体物品）- 具体的东西
class 菜品Entity extends Entity {
  constructor(
    public 名称: string,
    public 价格: number
  ) {
    super();
  }
}

// 3. 🏪 Scope（区域范围）- 不同的工作区域
class 厨房Scope extends Scope {
  constructor(public 厨房编号: string) {
    super();
  }
}

// 4. 📦 Store（仓库存储）- 存放数据的地方
class 菜单Store extends Store {
  private 菜品列表: 菜品Entity[] = [];

  添加菜品(菜品: 菜品Entity) {
    this.菜品列表.push(菜品);
  }
}
```

### 📋 注册和使用流程

```typescript
// 🏗️ 第一步：搭建餐厅框架
const 餐厅Framework = new Framework();

// 📝 第二步：注册所有角色和物品
餐厅Framework
  .service(厨师Service) // 注册厨师
  .service(服务员Service) // 注册服务员
  .entity(菜品Entity) // 注册菜品
  .scope(厨房Scope) // 注册厨房区域
  .store(菜单Store); // 注册菜单仓库

// 🏭 第三步：开始营业
const 餐厅Provider = 餐厅Framework.provider();

// 🎯 第四步：需要什么就要什么
const 厨师 = 餐厅Provider.get(厨师Service); // 要一个厨师
const 服务员 = 餐厅Provider.get(服务员Service); // 要一个服务员
const 菜单 = 餐厅Provider.get(菜单Store); // 要菜单仓库

// 🍽️ 第五步：开始工作
const 菜 = 厨师.做菜();
const 结果 = 服务员.上菜();
console.log(菜, 结果); // "美味佳肴 菜已上桌"
```

**模块化的好处**：

```
🧩 职责分离：
   厨师只管做菜 ✅
   服务员只管上菜 ✅
   收银员只管收钱 ✅

🔄 可替换：
   想换个厨师？只换厨师Service ✅
   想换个收银系统？只换收银Service ✅

🧪 好测试：
   可以用"假厨师"来测试服务员 ✅
   可以用"假收银"来测试整个流程 ✅
```

---

## 🏰 三、作用域隔离："楼层管理，各不干扰"

### 🏢 餐厅楼层结构

想象一个3层的餐厅：

```
🏢 整栋餐厅大楼（Root Scope）
├── 🏬 1楼：快餐区（FastFood Scope）
│   ├── 🏪 A区：汉堡专区（Burger Scope）
│   │   ├── 👨‍🍳 汉堡厨师
│   │   └── 🍔 汉堡菜单
│   └── 🏪 B区：披萨专区（Pizza Scope）
│       ├── 👨‍🍳 披萨厨师
│       └── 🍕 披萨菜单
├── 🏬 2楼：正餐区（Restaurant Scope）
│   ├── 🏪 包间1（Room1 Scope）
│   │   ├── 👨‍🍳 专属厨师
│   │   └── 🍽️ 高级菜单
│   └── 🏪 包间2（Room2 Scope）
│       ├── 👨‍🍳 专属厨师
│       └── 🍽️ 高级菜单
└── 🏬 3楼：管理层（Admin Scope）
    ├── 👨‍💼 总经理
    └── 📊 财务系统
```

### 🔍 作用域查找："向上找老板"

```typescript
class FrameworkProvider {
  找服务(我要什么: string, 当前楼层: string[]) {
    // 🔍 先在当前楼层找
    let 服务 = this.在楼层找(我要什么, 当前楼层);
    if (服务) {
      console.log(`在${当前楼层.join('→')}找到了${我要什么}`);
      return 服务;
    }

    // 📈 没找到？去上一层找
    if (当前楼层.length > 0) {
      const 上一层 = 当前楼层.slice(0, -1); // 去掉最后一层
      console.log(`当前层没有，去${上一层.join('→')}找`);
      return this.找服务(我要什么, 上一层);
    }

    // 😵 都没找到
    throw new Error(`整栋楼都没有${我要什么}！`);
  }
}
```

**实际例子**：

```typescript
// 🏪 包间1的顾客要"收银服务"
当前位置: ["整栋楼", "2楼正餐区", "包间1"]

查找过程：
1. 🔍 在"包间1"找收银服务 → ❌ 没有
2. 📈 去"2楼正餐区"找 → ❌ 没有
3. 📈 去"整栋楼"找 → ✅ 找到了！总收银台

结果：包间1的顾客可以用总收银台结账
```

### 🚫 隔离效果："各管各的"

```typescript
// 🏪 包间1和包间2是隔离的
class 包间Scope extends Scope {
  constructor(public 房间号: string) {
    super();
  }
}

// 📝 创建两个包间
const 包间1 = provider.createScope(包间Scope, { 房间号: '001' });
const 包间2 = provider.createScope(包间Scope, { 房间号: '002' });

// 🍽️ 每个包间有自己的专属服务
const 包间1厨师 = 包间1.get(厨师Service); // 包间1的厨师
const 包间2厨师 = 包间2.get(厨师Service); // 包间2的厨师

// ✅ 它们是不同的厨师！
console.log(包间1厨师 === 包间2厨师); // false

// 🔄 但都可以用总收银台
const 包间1收银 = 包间1.get(收银Service); // 总收银台
const 包间2收银 = 包间2.get(收银Service); // 总收银台

// ✅ 它们是同一个收银台！
console.log(包间1收银 === 包间2收银); // true
```

**隔离的好处**：

```
🏠 私有空间：
   包间1的订单不会影响包间2 ✅
   每个包间有自己的专属服务 ✅

🔄 共享资源：
   都可以用同一个收银台 ✅
   都可以用同一个总厨房 ✅

💾 自动清理：
   包间关闭时，专属服务自动清理 ✅
   不会影响其他包间 ✅
```

---

## 🌐 四、与React结合："餐厅的广播系统"

### 📻 Context："餐厅广播"

想象餐厅有一个广播系统，可以把消息传递到每个角落：

```typescript
// 📻 创建餐厅广播频道
const 餐厅广播Context = React.createContext<FrameworkProvider>();

// 📡 FrameworkRoot：总广播站
export const FrameworkRoot = ({ framework, children }) => {
  return (
    <餐厅广播Context.Provider value={framework}>
      {/* 所有子组件都能听到广播 */}
      {children}
    </餐厅广播Context.Provider>
  );
};

// 📻 FrameworkScope：分广播站
export const FrameworkScope = ({ scope, children }) => {
  const 上级广播 = useContext(餐厅广播Context);

  // 🔄 创建新的广播站，可以转播上级消息
  const 本级广播 = useMemo(() => {
    return new FrameworkStackProvider([scope.framework, 上级广播]);
  }, [scope, 上级广播]);

  return (
    <餐厅广播Context.Provider value={本级广播}>
      {children}
    </餐厅广播Context.Provider>
  );
};
```

### 🎣 Hook："呼叫服务"

```typescript
// 🎣 useService："我要叫个服务员"
export function useService<T>(我要什么服务: 服务类型<T>): T {
  const 广播站 = useContext(餐厅广播Context);
  return 广播站.get(我要什么服务);  // 通过广播叫服务
}

// 使用例子
function 顾客组件() {
  // 🔔 "请给我安排一个服务员"
  const 服务员 = useService(服务员Service);

  // 🔔 "请给我安排一个厨师"
  const 厨师 = useService(厨师Service);

  const 点菜 = () => {
    const 菜 = 厨师.做菜();
    服务员.上菜(菜);
  };

  return (
    <div>
      <button onClick={点菜}>点菜</button>
    </div>
  );
}
```

### 🏗️ 完整的餐厅运营流程

```typescript
// 🏢 第一步：搭建餐厅
function 餐厅App() {
  // 🏗️ 创建餐厅管理系统
  const 餐厅系统 = useMemo(() => {
    return new Framework()
      .service(厨师Service)
      .service(服务员Service)
      .service(收银Service)
      .scope(包间Scope);
  }, []);

  const 餐厅管理者 = 餐厅系统.provider();

  return (
    <FrameworkRoot framework={餐厅管理者}>
      <餐厅大厅 />
    </FrameworkRoot>
  );
}

// 🏛️ 第二步：餐厅大厅
function 餐厅大厅() {
  return (
    <div>
      <h1>欢迎来到AFFiNE餐厅</h1>
      <包间区域 />
    </div>
  );
}

// 🏪 第三步：包间区域
function 包间区域() {
  // 🔔 "给我安排一个包间"
  const 包间管理 = useService(包间管理Service);
  const 包间 = 包间管理.创建包间('豪华包间001');

  return (
    <FrameworkScope scope={包间}>
      <包间内部 />
    </FrameworkScope>
  );
}

// 🍽️ 第四步：包间内部
function 包间内部() {
  // 🎣 在包间里呼叫服务（自动获得专属服务）
  const 专属厨师 = useService(厨师Service);     // 包间专属厨师
  const 专属服务员 = useService(服务员Service);   // 包间专属服务员
  const 总收银台 = useService(收银Service);      // 餐厅总收银台

  const [菜品, set菜品] = useState('');

  const 点菜 = () => {
    const 新菜 = 专属厨师.做菜('宫保鸡丁');
    专属服务员.上菜(新菜);
    set菜品(新菜);
  };

  const 结账 = () => {
    总收银台.结账(100);
    alert('结账成功！');
  };

  return (
    <div>
      <h2>豪华包间001</h2>
      <p>当前菜品：{菜品}</p>
      <button onClick={点菜}>点菜</button>
      <button onClick={结账}>结账</button>
    </div>
  );
}
```

### 🔄 数据流向图

```
📡 数据流向：

1. 用户点击"点菜"按钮
   ↓
2. 包间内部组件通过useService获取专属厨师
   ↓
3. FrameworkScope提供包间级别的服务
   ↓
4. 如果包间没有，向上查找到FrameworkRoot
   ↓
5. FrameworkRoot提供全局服务
   ↓
6. 厨师做菜，服务员上菜
   ↓
7. 界面更新显示菜品
```

---

## 🎯 五、核心优势总结

### 🔧 依赖注入的魔法

**传统方式**：

```typescript
// ❌ 每个组件都要自己准备依赖
function 用户页面() {
  const 数据库 = new 数据库();           // 自己连数据库
  const 用户服务 = new 用户服务(数据库);   // 自己创建服务
  const 用户 = 用户服务.获取用户();
  return <div>{用户.姓名}</div>;
}
```

**Framework方式**：

```typescript
// ✅ Framework自动准备好一切
function 用户页面() {
  const 用户服务 = useService(用户Service);  // 自动获得配置好的服务
  const 用户 = 用户服务.获取用户();
  return <div>{用户.姓名}</div>;
}
```

### 🧩 模块化的威力

```
🔄 想换数据库？
   只需要：framework.service(用户Service, [新数据库Service])
   其他代码：完全不用改 ✅

🧪 想测试功能？
   只需要：framework.service(用户Service, [假数据库Service])
   测试环境：完全隔离 ✅

📦 想添加功能？
   只需要：framework.service(新功能Service)
   现有功能：完全不影响 ✅
```

### 🏰 作用域隔离的安全

```
🏠 多用户隔离：
   用户A的数据 ≠ 用户B的数据 ✅
   用户A的操作 ≠ 用户B的操作 ✅

💾 内存管理：
   页面关闭 → 自动清理资源 ✅
   防止内存泄漏 ✅

🔒 安全边界：
   子作用域看不到其他子作用域 ✅
   数据不会串 ✅
```

---

## 🚀 六、实战应用场景

### 场景1：多工作区应用

```typescript
// 🏢 每个工作区都是独立的"办公楼"
const 工作区A = provider.createScope(工作区Scope, { id: 'workspace-a' });
const 工作区B = provider.createScope(工作区Scope, { id: 'workspace-b' });

// 🔒 它们的数据完全隔离
const A的文档服务 = 工作区A.get(文档Service); // 只能看到工作区A的文档
const B的文档服务 = 工作区B.get(文档Service); // 只能看到工作区B的文档

// ✅ 但都能用同一个用户认证服务
const A的认证 = 工作区A.get(认证Service); // 全局认证服务
const B的认证 = 工作区B.get(认证Service); // 同一个认证服务
console.log(A的认证 === B的认证); // true
```

### 场景2：页面级状态管理

```typescript
// 📄 每个页面都有自己的"编辑状态"
function 文档页面({ 页面ID }) {
  // 🏗️ 为这个页面创建专属作用域
  const 页面作用域 = useService(页面管理Service).创建页面作用域(页面ID);

  return (
    <FrameworkScope scope={页面作用域}>
      <编辑器组件 />
    </FrameworkScope>
  );
}

function 编辑器组件() {
  // 🎯 获取这个页面专属的编辑服务
  const 编辑服务 = useService(编辑Service);      // 页面专属
  const 选择服务 = useService(选择Service);      // 页面专属
  const 历史服务 = useService(历史Service);      // 页面专属

  // ✅ 每个页面的编辑状态都是独立的
  // 在页面1选择文字不会影响页面2
  // 在页面1撤销操作不会影响页面2
}
```

### 场景3：开发和测试环境

```typescript
// 🏭 生产环境配置
const 生产Framework = new Framework()
  .service(数据库Service, [真实数据库]) // 连接真实数据库
  .service(支付Service, [真实支付网关]) // 连接真实支付
  .service(邮件Service, [真实邮件服务]); // 发送真实邮件

// 🧪 测试环境配置
const 测试Framework = new Framework()
  .service(数据库Service, [内存数据库]) // 使用内存数据库
  .service(支付Service, [模拟支付]) // 模拟支付成功
  .service(邮件Service, [模拟邮件]); // 不发送真实邮件

// ✅ 业务代码完全一样，只是底层服务不同
function 用户注册() {
  const 数据库 = useService(数据库Service); // 自动获得对应环境的数据库
  const 邮件 = useService(邮件Service); // 自动获得对应环境的邮件服务

  // 注册逻辑完全一样
  const 注册 = () => {
    数据库.保存用户(用户信息);
    邮件.发送欢迎邮件(用户邮箱);
  };
}
```

---

## 💡 总结：Framework的核心魔法

### 🎭 Framework = 智能管家

```
🏗️ Framework（餐厅管理系统）：
   ├── 📋 知道怎么培训每种员工
   ├── 🔍 知道每个员工需要什么工具
   ├── 🏪 知道每个区域需要什么服务
   └── 🎯 按需分配，绝不浪费

📡 FrameworkRoot（总广播站）：
   ├── 📻 把管理系统的能力传递给React
   ├── 🌐 让所有组件都能"呼叫服务"
   └── 🔄 自动处理服务的生命周期

🏪 FrameworkScope（分广播站）：
   ├── 🏠 为不同区域提供独立空间
   ├── 🔒 确保数据和状态不会串
   └── 💾 自动清理不需要的资源
```

### 🚀 三大核心能力

1. **🔧 依赖注入**："我要什么，你给我什么"

   - 不用自己准备依赖
   - 自动解决依赖关系
   - 防止循环依赖

2. **🧩 模块化**："各司其职，井然有序"

   - 职责分离，易于维护
   - 可替换，易于测试
   - 可组合，易于扩展

3. **🏰 作用域隔离**："楼层管理，各不干扰"
   - 数据隔离，防止串扰
   - 资源共享，避免浪费
   - 自动清理，防止泄漏

### 🎉 最终效果

通过Framework，我们实现了：

- 🎯 **写代码像点菜**：要什么服务直接说，Framework自动准备
- 🏗️ **架构像搭积木**：每个模块职责清晰，可以自由组合
- 🏠 **隔离像住酒店**：每个房间独立，但都能用酒店的公共服务
- 🔄 **测试像换演员**：可以用"替身演员"来测试剧本

这就是AFFiNE Framework的核心魔法！🎉

---

_通过这份文档，你应该能够理解Framework是如何让复杂的前端应用变得简单、可维护、可测试的。就像一个智能的餐厅管理系统，让每个"员工"（组件）都能专注于自己的工作，而不用担心其他复杂的协调问题。_
