/*
 * 悬浮导航轮盘 —— 酒馆助手（SillyTavern Helper）脚本版
 *
 * 目标（唯一）：在页面上加一个可拖动的悬浮球，点击展开成轮盘，
 * 快捷触发酒馆顶部工具栏的各个图标，以及一键收起回到聊天。
 *
 * 原则：只【新增】一个自己的悬浮元素，绝不修改酒馆原有的任何 DOM / 样式。
 * 轮盘节点只是去调用顶部图标【本身】的点击事件。
 *
 * 用法：酒馆助手 → 脚本库 → 新建脚本 → 把本文件全部内容粘进去 → 启用。
 */

(function () {
    'use strict';

    // 酒馆助手脚本运行在 iframe 内，document 指向 iframe 自己，够不到酒馆主界面。
    // 所以取父窗口的 document 作为操作目标（同源 iframe 可访问）。
    var doc =
        (window.parent && window.parent !== window && window.parent.document)
            ? window.parent.document
            : document;

    // 清掉旧实例，避免脚本重载时叠加
    ['nvw-root', 'nvw-style', 'nvw-script'].forEach(function (id) {
        var e = doc.getElementById(id);
        if (e) e.remove();
    });

    // 把主逻辑作为一个 <script> 注入到父窗口真实环境里运行。
    // 这样即使酒馆助手的 iframe 被销毁重建，悬浮球依然存活、依然可用。
    var s = doc.createElement('script');
    s.id = 'nvw-script';
    s.textContent = '(' + wheelMain.toString() + ')();';
    (doc.body || doc.documentElement).appendChild(s);

    // ↓↓↓ 下面这个函数会被序列化后注入到父窗口运行，
    //     里面的 document / window 都是酒馆主界面的，不是 iframe 的。
    function wheelMain() {
        'use strict';

        var LS_KEY = 'nvw_pos_v1';
        var HOLDER_SELECTORS = ['#top-settings-holder', '#top-bar', '.drawer-container'];

        // ---- 样式（只作用于自己的 #nvw-* 命名空间）----
        var style = document.createElement('style');
        style.id = 'nvw-style';
        style.textContent = [
            '#nvw-root{position:fixed;z-index:100000;top:50%;left:auto;right:24px;width:0;height:0;touch-action:none;font-family:inherit;}',
            '#nvw-fab{position:absolute;left:-27px;top:-27px;width:54px;height:54px;border-radius:50%;background:rgba(120,130,200,.92);color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;cursor:pointer;box-shadow:0 3px 12px rgba(0,0,0,.3);user-select:none;transition:transform .15s ease,background .15s ease;}',
            '#nvw-fab:hover{background:rgba(120,130,200,1);}',
            '#nvw-root.nvw-open #nvw-fab{transform:rotate(135deg);}',
            '#nvw-root.nvw-dragging #nvw-fab{transition:none;cursor:grabbing;}',
            '#nvw-items{position:absolute;left:0;top:0;width:0;height:0;}',
            '.nvw-item{position:absolute;left:0;top:0;width:44px;height:44px;margin:-22px;border-radius:50%;background:rgba(250,250,252,.97);color:#444;display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.22);opacity:0;transform:translate(0,0) scale(.3);transition:transform .22s cubic-bezier(.34,1.4,.5,1),opacity .18s ease;pointer-events:none;}',
            '#nvw-root.nvw-open .nvw-item{opacity:1;pointer-events:auto;}',
            '.nvw-item:hover{background:rgba(120,130,200,.95);color:#fff;z-index:2;}',
            '.nvw-item .nvw-label{position:absolute;bottom:110%;left:50%;transform:translateX(-50%);white-space:nowrap;background:rgba(0,0,0,.8);color:#fff;font-size:12px;padding:2px 7px;border-radius:4px;opacity:0;pointer-events:none;transition:opacity .12s ease;}',
            '.nvw-item:hover .nvw-label{opacity:1;}',
            '.nvw-item i,.nvw-item .nvw-ico{font-size:18px;line-height:1;pointer-events:none;}'
        ].join('');
        document.head.appendChild(style);

        var root, fab, itemsBox, isOpen = false;

        // 元素是否真实可见（被精简器 display:none / 隐藏的返回 false）
        function isVisible(el) {
            if (!el) return false;
            if (el.getClientRects().length === 0) return false;
            var cs = window.getComputedStyle(el);
            return cs.visibility !== 'hidden' && cs.display !== 'none';
        }

        function collectDrawers() {
            var holder = null;
            for (var i = 0; i < HOLDER_SELECTORS.length; i++) {
                var el = document.querySelector(HOLDER_SELECTORS[i]);
                if (el && el.querySelector('.drawer, .drawer-toggle, .drawer-icon')) { holder = el; break; }
            }
            if (!holder) return [];

            var result = [], seen = [];
            var toggles = holder.querySelectorAll('.drawer-toggle, .inline-drawer-toggle, .drawer-icon');
            toggles.forEach(function (toggle) {
                var drawer = toggle.closest('.drawer') || toggle;
                if (seen.indexOf(drawer) !== -1) return;
                seen.push(drawer);

                // 尊重「酒馆菜单精简器」：被隐藏的功能不进轮盘
                if (!isVisible(drawer)) return;

                var iconEl = toggle.querySelector('[class*="fa-"]') ||
                    (String(toggle.className).indexOf('fa-') !== -1 ? toggle : null);
                var iconClass = iconEl ? iconEl.className : 'fa-solid fa-circle';

                var label = toggle.getAttribute('title') ||
                    (iconEl && iconEl.getAttribute('title')) ||
                    toggle.getAttribute('aria-label') ||
                    (toggle.textContent || '').trim() || '功能';

                result.push({ label: label, iconClass: iconClass, target: toggle });
            });
            return result;
        }

        function closeAllDrawers() {
            document.querySelectorAll('.drawer-content.openDrawer').forEach(function (content) {
                var drawer = content.closest('.drawer');
                var toggle = drawer && drawer.querySelector('.drawer-toggle, .drawer-icon');
                if (toggle) toggle.click();
            });
        }

        function buildItems() {
            itemsBox.innerHTML = '';
            var nodes = [];

            nodes.push({
                label: '回到聊天', iconClass: 'fa-solid fa-comments',
                onClick: function () { closeAllDrawers(); close(); }
            });

            collectDrawers().forEach(function (d) {
                nodes.push({
                    label: d.label, iconClass: d.iconClass,
                    onClick: function () {
                        close();
                        setTimeout(function () {
                            // 云酒馆某些面板原生不会自动收起，这里强制「开新的先关旧的」
                            var drawer = d.target.closest('.drawer');
                            var content = drawer && drawer.querySelector('.drawer-content');
                            var wasOpen = !!(content && content.classList.contains('openDrawer'));
                            closeAllDrawers();
                            // 目标原本没开 → 打开它（原本开着则视为收起，不再打开）
                            if (!wasOpen) setTimeout(function () { d.target.click(); }, 40);
                        }, 60);
                    }
                });
            });

            var rect = root.getBoundingClientRect();
            var cx = rect.left, cy = rect.top;
            var baseAngle = Math.atan2(window.innerHeight / 2 - cy, window.innerWidth / 2 - cx);
            var n = nodes.length;
            var radius = Math.min(150, 60 + n * 9);
            var spread = Math.min(Math.PI * 2, (n - 1) * 0.5 + 0.1);
            var start = baseAngle - spread / 2;

            nodes.forEach(function (node, i) {
                var angle = n === 1 ? baseAngle : start + (spread * i) / (n - 1);
                var x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;

                var el = document.createElement('div');
                el.className = 'nvw-item';
                var ico = document.createElement('i');
                ico.className = node.iconClass;
                el.appendChild(ico);
                var lbl = document.createElement('span');
                lbl.className = 'nvw-label';
                lbl.textContent = node.label;
                el.appendChild(lbl);

                el.dataset.x = x; el.dataset.y = y;
                el.style.transform = 'translate(0,0) scale(0.3)';
                el.style.transitionDelay = (i * 0.02) + 's';
                el.addEventListener('click', function (e) { e.stopPropagation(); node.onClick(); });
                itemsBox.appendChild(el);
            });
        }

        function applyOpenTransforms() {
            itemsBox.querySelectorAll('.nvw-item').forEach(function (el) {
                el.style.transform = 'translate(' + el.dataset.x + 'px,' + el.dataset.y + 'px) scale(1)';
            });
        }

        function open() {
            buildItems();
            isOpen = true;
            root.classList.add('nvw-open');
            window.requestAnimationFrame(applyOpenTransforms);
            document.addEventListener('pointerdown', onOutside, true);
            document.addEventListener('keydown', onEsc);
        }
        function close() {
            isOpen = false;
            root.classList.remove('nvw-open');
            itemsBox.querySelectorAll('.nvw-item').forEach(function (el) {
                el.style.transform = 'translate(0,0) scale(0.3)';
            });
            document.removeEventListener('pointerdown', onOutside, true);
            document.removeEventListener('keydown', onEsc);
        }
        function onOutside(e) { if (!root.contains(e.target)) close(); }
        function onEsc(e) { if (e.key === 'Escape') close(); }

        function applyPos(p) { root.style.top = p.y + 'px'; root.style.left = p.x + 'px'; root.style.right = 'auto'; }
        function loadPos() {
            try { var p = JSON.parse(localStorage.getItem(LS_KEY)); if (p && typeof p.x === 'number') applyPos(p); } catch (_) {}
        }
        function savePos() { var r = root.getBoundingClientRect(); localStorage.setItem(LS_KEY, JSON.stringify({ x: r.left, y: r.top })); }

        function setupDrag() {
            var dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
            fab.addEventListener('pointerdown', function (e) {
                dragging = true; moved = false;
                var r = root.getBoundingClientRect();
                sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
                root.classList.add('nvw-dragging');
                fab.setPointerCapture(e.pointerId);
            });
            fab.addEventListener('pointermove', function (e) {
                if (!dragging) return;
                var dx = e.clientX - sx, dy = e.clientY - sy;
                if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
                var nx = Math.max(30, Math.min(window.innerWidth - 30, ox + dx));
                var ny = Math.max(30, Math.min(window.innerHeight - 30, oy + dy));
                applyPos({ x: nx, y: ny });
            });
            fab.addEventListener('pointerup', function (e) {
                if (!dragging) return;
                dragging = false;
                root.classList.remove('nvw-dragging');
                fab.releasePointerCapture(e.pointerId);
                if (moved) savePos(); else (isOpen ? close() : open());
            });
        }

        // 构建悬浮球
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
        console.log('[导航轮盘] 已启用（酒馆助手脚本版）');
    }
})();
