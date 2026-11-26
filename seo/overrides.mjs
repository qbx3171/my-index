/**
 * 软件表字段定点覆盖表（生成层 & 选题器共用）
 *
 * 背景：software 表对公开 anon key 只开了 SELECT，后台改不动个别脏记录
 * （促销标题、含提取码的描述、1 条目的薄分类），只能在渲染/工具层定点重写。
 * 2026-11-26 从 generate.mjs 抽成独立模块：seo/tutorial-pick.mjs 判断
 * 「排期软件是否在库」时也必须看到同一套展示名，否则会把库内存在的软件
 * 误判为「不在库」（2026-11-17 Bandizip、2026-11-26 Driver Booster 均因此误报）。
 *
 * 待有后台/服务端权限时改数据库并删除这里的条目，避免两处维护不一致。
 */

// 描述重写：源描述含采集噪声（提取码）或过短，按软件公开功能重写为事实性描述
export const DESC_OVERRIDES = {
  // Keka：源描述为「一款Mac上好用又免费的文件解压缩软件软件详情：提取码：x13i」
  "mrt05wkthp9y":
    "Keka 是 macOS 平台免费好用的解压缩工具，支持 7z、Zip、Tar、Gzip 等常见压缩格式的创建与解压，也可解压 RAR 分卷压缩包，支持设置密码保护与分卷压缩，把文件拖到程序图标即可开始处理，适合日常压缩传输与接收解压场景。",
  // Driver Booster：源描述是「新设备无法正常使用？…」营销问答体
  "847f51b9ebfb78661faf5bde":
    "Driver Booster 13 Pro 是 IObit 出品的 Windows 驱动更新工具，可自动扫描显卡、声卡、网卡、主板等硬件的过时或缺失驱动并一键更新，支持驱动备份与还原、离线驱动包安装，适合系统更新后出现无声、断网、蓝屏或游戏卡顿的设备快速排查修复。",
};

// 名称重写：源名称是促销文案，会被直接当成 SERP 标题展示，属低质信号
export const NAME_OVERRIDES = {
  // 「电脑驱动更新工具 Driver Booster 13 Pro，限时 7 折特惠快入手！」
  "847f51b9ebfb78661faf5bde": "Driver Booster 13 Pro 驱动更新工具",
};

// 分类重写：原分类「驱动管理」只有这 1 条记录，生成的是 1 条目的薄分类页
export const CATEGORY_OVERRIDES = {
  "847f51b9ebfb78661faf5bde": "实用工具",
};
