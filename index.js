// 悬浮导航轮盘（Nav Wheel）
//
// 一个完全独立的悬浮组件：点击悬浮球展开成轮盘，每个节点对应酒馆顶部的一个
// 功能抽屉（AI设置、API、世界书、扩展……）以及一个「回到聊天」。
//
// 关键：节点是【每次打开时实时扫描】酒馆真实的顶部图标生成的，点击节点就是
// 触发那个真实图标。因此：
//   - 不依赖顶部导航栏是否可见（隐藏的图标用 JS 依然能触发）；
//   - 自动适配「酒馆菜单精简器」等改过菜单的酒馆；
//   - 不修改任何原有元素，绝不破坏布局。

(function () {
    'use strict';

    const LS_KEY = 'nvw_pos_v1';

    // 顶部抽屉容器的候选选择器（不同酒馆/版本兜底）
    const HOLDER_SELECTORS = ['#top-settings-holder', '#top-bar', '.drawer-container'];

    let root, fab, itemsBox;
    let isOpen = false;

    // ---- 找到顶部的抽屉切换按钮列表 ----
    function collectDrawers() {
        let holder = null;
        for (const sel of HOLDER_SELECTORS) {
            const el = document.querySelector(sel);
            if (el && el.querySelector('.drawer, .drawer-toggle, .drawer-icon')) {
                holder = el;
                break;
            }
        }
        if (!holder) return [];

        const result = [];
        const seen = new Set();

        // 每个抽屉：优先用 .drawer-toggle 作为可点击目标，回退到 .drawer-icon
        const toggles = holder.querySelectorAll('.drawer-toggle, .inline-drawer-toggle, .drawer-icon');
        toggles.forEach((toggle) => {
            // 避免同一抽屉被重复收集（toggle 内可能又含 drawer-icon）
            const drawer = toggle.closest('.drawer') || toggle;
            if (seen.has(drawer)) return;
            seen.add(drawer);

            // 图标元素
            const iconEl =
                toggle.querySelector('[class*="fa-"]') ||
                (toggle.className.includes('fa-') ? toggle : null);
            const iconClass = iconEl ? iconEl.className : 'fa-solid fa-circle';

            // 标题：title / aria-label / 文本
            const label =
                toggle.getAttribute('title') ||
                (iconEl && iconEl.getAttribute('title')) ||
                toggle.getAttribute('aria-label') ||
                toggle.textContent.trim() ||
                '功能';

            result.push({ label, iconClass, target: toggle });
        });
        return result;
    }

    // ---- 关闭所有已打开的抽屉（= 回到聊天） ----
    function closeAllDrawers() {
        document.querySelectorAll('.drawer-content.openDrawer').forEach((content) => {
            const drawer = content.closest('.drawer');
            const toggle = drawer && drawer.querySelector('.drawer-toggle, .drawer-icon');
            if (toggle) toggle.click();
        });
    }

    // ---- 构建轮盘节点 ----
    function buildItems() {
        itemsBox.innerHTML = '';

        const nodes = [];

        // 第一个固定节点：回到聊天 / 关闭面板
        nodes.push({
            label: '回到聊天',
            iconClass: 'fa-solid fa-comments',
            onClick: () => { closeAllDrawers(); close(); },
        });

        // 其余：真实抽屉
        collectDrawers().forEach((d) => {
            nodes.push({
                label: d.label,
                iconClass: d.iconClass,
                onClick: () => {
                    close();
                    // 稍延迟，等轮盘关闭动画后再触发，避免误判点击外部而立刻关面板
                    setTimeout(() => d.target.click(), 60);
                },
            });
        });

        // 计算摆放：以悬浮球为圆心，朝屏幕内侧展开一个扇形
        const rect = root.getBoundingClientRect();
        const cx = rect.left, cy = rect.top;
        const baseAngle = Math.atan2(window.innerHeight / 2 - cy, window.innerWidth / 2 - cx);
        const n = nodes.length;
        const radius = Math.min(150, 60 + n * 9);
        const spread = Math.min(Math.PI * 2, (n - 1) * 0.5 + 0.1); // 弧度
        const start = baseAngle - spread / 2;

        nodes.forEach((node, i) => {
            const angle = n === 1 ? baseAngle : start + (spread * i) / (n - 1);
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            const el = document.createElement('div');
            el.className = 'nvw-item';

            const ico = document.createElement('i');
            ico.className = node.iconClass;
            el.appendChild(ico);

            const lbl = document.createElement('span');
            lbl.className = 'nvw-label';
            lbl.textContent = node.label;
            el.appendChild(lbl);

            // 展开时的目标位移（用 CSS 变量存，open 时应用）
            el.dataset.x = x;
            el.dataset.y = y;
            el.style.transform = 'translate(0,0) scale(0.3)';
            el.style.transitionDelay = (i * 0.02) + 's';

            el.addEventListener('click', (e) => {
                e.stopPropagation();
                node.onClick();
            });

            itemsBox.appendChild(el);
        });
    }

    function applyOpenTransforms() {
        itemsBox.querySelectorAll('.nvw-item').forEach((el) => {
            el.style.transform = `translate(${el.dataset.x}px, ${el.dataset.y}px) scale(1)`;
        });
    }

    function open() {
        buildItems();
        isOpen = true;
        root.classList.add('nvw-open');
        // 下一帧应用位移，触发过渡动画
        requestAnimationFrame(applyOpenTransforms);
        document.addEventListener('pointerdown', onOutside, true);
        document.addEventListener('keydown', onEsc);
    }

    function close() {
        isOpen = false;
        root.classList.remove('nvw-open');
        itemsBox.querySelectorAll('.nvw-item').forEach((el) => {
            el.style.transform = 'translate(0,0) scale(0.3)';
        });
        document.removeEventListener('pointerdown', onOutside, true);
        document.removeEventListener('keydown', onEsc);
    }

    function onOutside(e) {
        if (!root.contains(e.target)) close();
    }
    function onEsc(e) {
        if (e.key === 'Escape') close();
    }

    // ---- 位置记忆 + 拖动 ----
    function applyPos(pos) {
        root.style.top = pos.y + 'px';
        root.style.left = pos.x + 'px';
        root.style.right = 'auto';
    }
    function loadPos() {
        try {
            const p = JSON.parse(localStorage.getItem(LS_KEY));
            if (p && typeof p.x === 'number') applyPos(p);
        } catch (_) { /* 用默认位置 */ }
    }
    function savePos() {
        const r = root.getBoundingClientRect();
        localStorage.setItem(LS_KEY, JSON.stringify({ x: r.left, y: r.top }));
    }

    function setupDrag() {
        let dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;

        fab.addEventListener('pointerdown', (e) => {
            dragging = true; moved = false;
            const r = root.getBoundingClientRect();
            sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
            root.classList.add('nvw-dragging');
            fab.setPointerCapture(e.pointerId);
        });
        fab.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const dx = e.clientX - sx, dy = e.clientY - sy;
            if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
            let nx = Math.max(30, Math.min(window.innerWidth - 30, ox + dx));
            let ny = Math.max(30, Math.min(window.innerHeight - 30, oy + dy));
            applyPos({ x: nx, y: ny });
        });
        fab.addEventListener('pointerup', (e) => {
            if (!dragging) return;
            dragging = false;
            root.classList.remove('nvw-dragging');
            fab.releasePointerCapture(e.pointerId);
            if (moved) { savePos(); }
            else { isOpen ? close() : open(); }  // 没拖动 = 点击 = 开关轮盘
        });
    }

    // ---- 初始化 ----
    function init() {
        if (document.getElementById('nvw-root')) return;

        root = document.createElement('div');
        root.id = 'nvw-root';

        itemsBox = document.createElement('div');
        itemsBox.id = 'nvw-items';
        root.appendChild(itemsBox);

        fab = document.createElement('div');
        fab.id = 'nvw-fab';
        fab.title = '导航轮盘（可拖动）';
        fab.innerHTML = '<i class="fa-solid fa-compass"></i>';
        root.appendChild(fab);

        document.body.appendChild(root);
        loadPos();
        setupDrag();

        console.log('[导航轮盘] 已启用');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
