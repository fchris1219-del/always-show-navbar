// 始终显示顶部导航栏
// CSS(style.css) 已经能覆盖大多数情况；但如果酒馆是用 JS 给元素加内联
// style="display:none" 来隐藏导航栏，纯 CSS 未必压得住内联 !important。
// 这里用 MutationObserver 兜底：一旦发现导航栏被内联样式隐藏，就把它清掉。

(function () {
    'use strict';

    // 只在 PC（有鼠标、能悬停）上兜底；手机保留云酒馆默认的移动端布局。
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        return;
    }

    const SELECTORS = ['#top-bar', '#top-settings-holder'];

    function forceVisible(el) {
        if (!el) return;
        const s = el.style;
        // 清掉可能被写进内联样式的隐藏属性
        if (s.display === 'none') s.removeProperty('display');
        if (s.visibility === 'hidden') s.removeProperty('visibility');
        if (s.opacity === '0') s.removeProperty('opacity');
    }

    function fixAll() {
        for (const sel of SELECTORS) {
            forceVisible(document.querySelector(sel));
        }
    }

    function start() {
        fixAll();

        // 监听导航栏元素的内联 style 变化，被隐藏就立刻恢复
        const observer = new MutationObserver(fixAll);
        for (const sel of SELECTORS) {
            const el = document.querySelector(sel);
            if (el) {
                observer.observe(el, {
                    attributes: true,
                    attributeFilter: ['style', 'class'],
                });
            }
        }

        // 窗口尺寸变化时（触发媒体查询的场景）再兜一次
        window.addEventListener('resize', fixAll);

        console.log('[始终显示顶部导航栏] 已启用');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
