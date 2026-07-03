# 始终显示顶部导航栏（SillyTavern / 云酒馆扩展）

按**设备类型**修正云酒馆布局：

- **电脑**（有鼠标）→ 强制回到桌面布局：顶部导航栏始终显示，抽屉为侧边浮层，不占满全屏。
- **手机**（触摸屏）→ 不介入，保留移动端默认的全屏布局。

用 `@media (hover: hover) and (pointer: fine)` 判断设备，而非屏幕宽度——
因为云酒馆在 PC 上可能把宽屏误报成窄屏，导致宽度断点失效。

## 安装

**方式 A：安装扩展（填链接）**
酒馆 → `扩展` → `安装扩展`，粘贴本仓库的 Git 地址。

**方式 B：手动放文件**
把整个文件夹放到：
- 新版：`data/<用户名>/extensions/always-show-navbar/`
- 旧版：`public/scripts/extensions/third-party/always-show-navbar/`

然后刷新页面，在 `扩展` 面板能看到「始终显示顶部导航栏」即成功。

## 微调

抽屉宽度默认 `500px`，如某个面板宽度不合适，改 `style.css` 里的 `.drawer-content` 宽度即可。
