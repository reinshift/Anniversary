/* 一周年 · 交互层
   - 配色随滚动连续插值（body 级变量），消除浅→深的硬边界
   - 词云分两幕：先单独居中标题，再显现完整词云
   - 日记以预渲染图片内嵌，点击不再下载 PDF
*/
(() => {
  'use strict';

  const D = window.ANNIVERSARY_DATA;
  if (!D) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const DAY = 86400000;

  /* ===== 1. 滚动配色渐变 ================================================= */

  // 停靠色：纸 → 暖灰 → 暮 → 深。相邻色之间线性插值，全程无突变。
  const STOPS = [
    { at: 0.00, canvas: [243, 236, 226], ink: [58, 40, 35], accent: [181, 108, 115] },
    { at: 0.40, canvas: [238, 228, 214], ink: [56, 38, 34], accent: [181, 108, 115] },
    { at: 0.66, canvas: [222, 206, 195], ink: [52, 34, 34], accent: [166, 96, 104] },
    { at: 0.82, canvas: [140, 100, 104], ink: [255, 248, 240], accent: [232, 196, 160] },
    { at: 1.00, canvas: [58, 23, 36], ink: [255, 248, 240], accent: [212, 168, 122] }
  ];

  const rgb = (c) => `rgb(${Math.round(c[0])} ${Math.round(c[1])} ${Math.round(c[2])})`;
  const mixRGB = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  let lastPaint = -1;
  function paint(p) {
    // 量化到 1/400：滚动 1px 就重写 6 个变量会让整屏反复失效
    const q = Math.round(p * 400);
    if (q === lastPaint) return;
    lastPaint = q;
    let i = 0;
    while (i < STOPS.length - 2 && p > STOPS[i + 1].at) i++;
    const s = STOPS[i], e = STOPS[i + 1];
    const t = clamp((p - s.at) / (e.at - s.at));
    const canvas = mixRGB(s.canvas, e.canvas, t);
    const ink = mixRGB(s.ink, e.ink, t);
    const accent = mixRGB(s.accent, e.accent, t);
    const st = document.body.style;
    st.setProperty('--canvas', rgb(canvas));
    st.setProperty('--canvas-deep', rgb(mixRGB(canvas, [40, 16, 26], 0.28)));
    st.setProperty('--ink', rgb(ink));
    st.setProperty('--ink-soft', rgb(mixRGB(ink, canvas, 0.42)));
    st.setProperty('--accent', rgb(accent));
    st.setProperty('--glow', rgb(mixRGB(accent, [255, 245, 230], 0.5)));
  }

  /* ===== 2. 词云两幕：标题独幕 → 词云全貌 ================================ */

  const cloudAct = document.querySelector('.cloud-act');

  function driveCloud() {
    if (!cloudAct) return;
    const r = cloudAct.getBoundingClientRect();
    // 完全离开视口时不再写样式
    if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
    const total = r.height - window.innerHeight;
    const p = total > 0 ? clamp(-r.top / total) : 0;
    // 0 → .34 标题单独停留；.34 → .52 交接；.52 之后词云完全呈现
    const curtain = 1 - clamp((p - 0.30) / 0.20);
    const cloud = clamp((p - 0.34) / 0.20);
    const st = cloudAct.style;
    st.setProperty('--curtain-o', curtain.toFixed(3));
    st.setProperty('--curtain-s', (1 - (1 - curtain) * 0.06).toFixed(4));
    st.setProperty('--cloud-o', cloud.toFixed(3));
    st.setProperty('--cloud-s', (0.94 + cloud * 0.06).toFixed(4));
  }

  /* ===== 3. 终章：照片汇聚 + 信笺显影 ==================================== */

  const finale = document.getElementById('forever');
  const finaleStage = document.querySelector('.finale-stage');
  const silence = document.querySelector('.finale-silence');
  const letter = document.querySelector('.letter');
  const orbit = document.getElementById('memory-orbit');
  let tokens = [];

  function buildOrbit() {
    if (!orbit || !D.photos.length) return;
    const frag = document.createDocumentFragment();
    const n = Math.min(18, D.photos.length);
    for (let i = 0; i < n; i++) {
      const ph = D.photos[i % D.photos.length];
      const img = document.createElement('img');
      img.className = 'memory-token';
      img.src = ph.sm;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      const a = (i / n) * Math.PI * 2 + 0.6;
      const rad = 30 + (i % 4) * 8;
      tokens.push({ el: img, x: Math.cos(a) * rad, y: Math.sin(a) * rad * 0.62, rot: (i % 2 ? 1 : -1) * (4 + (i % 5) * 2) });
      frag.appendChild(img);
    }
    orbit.appendChild(frag);
  }

  function driveFinale() {
    if (!finale || !finaleStage) return;
    const r = finale.getBoundingClientRect();
    if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
    const total = r.height - window.innerHeight;
    const p = total > 0 ? clamp(-r.top / total) : 0;

    if (silence) silence.style.setProperty('--silence-o', (1 - clamp(p / 0.22)).toFixed(3));
    if (letter) letter.style.setProperty('--letter-o', clamp((p - 0.58) / 0.22).toFixed(3));

    // 照片从四散到聚拢，再淡出让信笺露出
    const gather = clamp((p - 0.14) / 0.44);
    const fade = 1 - clamp((p - 0.56) / 0.18);
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const k = 1 - gather;
      t.el.style.transform =
        `translate(-50%,-50%) translate(${(t.x * k).toFixed(2)}vw,${(t.y * k).toFixed(2)}vh)` +
        ` rotate(${(t.rot * k).toFixed(2)}deg) scale(${(0.7 + gather * 0.3).toFixed(3)})`;
      t.el.style.opacity = (clamp(p / 0.14) * fade * 0.9).toFixed(3);
    }
  }

  /* ===== 4. 单一 rAF 调度（仅在需要时运行） ============================== */

  let queued = false;
  function frame() {
    queued = false;
    const doc = document.documentElement;
    paint(clamp(window.scrollY / Math.max(1, doc.scrollHeight - window.innerHeight)));
    driveCloud();
    driveFinale();
  }
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(frame);
  }

  /* ===== 5. 照片墙 ======================================================= */

  const gallery = document.getElementById('gallery');
  const dialog = document.getElementById('photo-dialog');
  const bigPhoto = document.getElementById('large-photo');
  let builtCols = 0;

  function colCount() {
    const w = window.innerWidth;
    return w < 640 ? 1 : w < 1100 ? 2 : w < 1360 ? 3 : 4;
  }

  function card(ph, i, clone) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'postcard';
    b.style.setProperty('--tilt', `${(((i * 37) % 9) - 4) * 0.28}deg`);
    b.dataset.index = String(i);
    const img = document.createElement('img');
    img.src = ph.sm;
    img.width = ph.w;
    img.height = ph.h;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = `我们的第 ${i + 1} 张照片`;
    const tag = document.createElement('small');
    tag.textContent = String(i + 1).padStart(2, '0');
    b.append(img, tag);
    if (clone) {
      b.tabIndex = -1;
      b.setAttribute('aria-hidden', 'true');
    }
    return b;
  }

  function buildGallery() {
    if (!gallery) return;
    const cols = colCount();
    if (cols === builtCols) return;
    builtCols = cols;
    gallery.style.setProperty('--cols', String(cols));
    gallery.textContent = '';
    const buckets = Array.from({ length: cols }, () => []);
    D.photos.forEach((ph, i) => buckets[i % cols].push(i));
    buckets.forEach((idx, c) => {
      const col = document.createElement('div');
      col.className = 'gallery-column';
      col.style.setProperty('--i', String(c));
      const track = document.createElement('div');
      track.className = 'gallery-track';
      // 每列速度略有差异，避免整片同步移动显得像一张图
      track.style.setProperty('--duration', `${92 + c * 13}s`);
      idx.forEach((i) => track.appendChild(card(D.photos[i], i, false)));
      if (!reduced) idx.forEach((i) => track.appendChild(card(D.photos[i], i, true)));
      col.appendChild(track);
      gallery.appendChild(col);
    });
  }

  // 相面离开视口时暂停动画 + 撤掉 will-change，避免常驻一张合成层
  if (gallery && !reduced && 'IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      const on = entries[0].isIntersecting;
      gallery.querySelectorAll('.gallery-track').forEach((t) => {
        t.style.animationPlayState = on ? 'running' : 'paused';
        t.style.willChange = on ? 'transform' : 'auto';
      });
    }, { rootMargin: '200px 0px' }).observe(gallery);
  }

  gallery?.addEventListener('click', (e) => {
    const btn = e.target.closest('.postcard');
    if (!btn || !dialog || !bigPhoto) return;
    const ph = D.photos[Number(btn.dataset.index)];
    if (!ph) return;
    bigPhoto.src = ph.lg;
    bigPhoto.alt = `放大的第 ${Number(btn.dataset.index) + 1} 张照片`;
    dialog.showModal();
  });

  document.getElementById('close-photo')?.addEventListener('click', () => dialog?.close());
  dialog?.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog?.addEventListener('close', () => { if (bigPhoto) bigPhoto.src = ''; });

  /* ===== 6. 日记时间轴（原点 2025.08.18） ================================ */

  const rail = document.getElementById('date-rail');
  const railShell = document.querySelector('.rail-shell');
  const railYears = document.getElementById('rail-years');
  const railMonths = document.getElementById('rail-months');
  const diaryDate = document.getElementById('diary-date');
  const diaryOffset = document.getElementById('diary-offset');
  const diaryPages = document.getElementById('diary-pages');
  const diaryEmpty = document.getElementById('diary-empty');
  const finaleDate = document.getElementById('finale-date');

  const diary = D.diary || [];
  const years = [...new Set(diary.map((d) => d.date.slice(0, 4)))].sort();

  // 1188 条日记若按天数等比铺开会长达两万多像素，无法翻找。
  // 时间轴按年分段：一次只铺一年，间隔随相隔天数弹性伸缩，
  // 原点 2025.08.18 在所属年份里以金色标记单独出现。
  const GAP_MIN = 18;
  const GAP_MAX = 110;
  const PAD = 48;

  let railYear = null;
  let shown = [];         // 当前年份的日记条目
  let layout = [];        // 与 shown 同序的 x
  let originX = null;     // 原点 x，仅当年份含原点时有值
  let railWidth = PAD * 2;

  const ORIGIN_YEAR = D.anniversary.slice(0, 4);

  function measure() {
    layout = [];
    originX = null;
    let x = PAD;
    for (let i = 0; i < shown.length; i++) {
      if (i > 0) {
        const gapDays = shown[i].offset - shown[i - 1].offset;
        x += Math.min(GAP_MAX, GAP_MIN + Math.sqrt(Math.max(0, gapDays)) * 7);
      }
      if (railYear === ORIGIN_YEAR && originX === null && shown[i].offset >= 0) {
        originX = i > 0 ? (layout[i - 1] + x) / 2 : x - GAP_MIN;
        x += 36; // 给原点标签留位置
      }
      layout.push(x);
    }
    if (railYear === ORIGIN_YEAR && originX === null) originX = x + GAP_MIN;
    railWidth = x + PAD;
  }

  function label(iso) { return iso.replace(/-/g, '.'); }

  function offsetText(o) {
    if (o === 0) return '就是这一天';
    return o > 0 ? `原点后 ${o} 天` : `原点前 ${-o} 天`;
  }

  function buildRail(year) {
    if (!rail || year === railYear) return;
    railYear = year;
    shown = diary.filter((d) => d.date.startsWith(year));
    measure();
    buildMonths(year);

    const frag = document.createDocumentFragment();

    if (originX !== null) {
      const o = document.createElement('div');
      o.className = 'date-tick is-origin';
      o.style.setProperty('--x', `${originX.toFixed(1)}px`);
      o.innerHTML = '<span>2025.08.18 起点</span>';
      frag.appendChild(o);
    }

    shown.forEach((it, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'date-tick';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', 'false');
      b.dataset.date = it.date;
      b.style.setProperty('--x', `${layout[i].toFixed(1)}px`);
      // 每月第一条拉高刻度，形成月份节拍
      const firstOfMonth = i === 0 || shown[i - 1].date.slice(5, 7) !== it.date.slice(5, 7);
      b.style.setProperty('--h', firstOfMonth ? '26px' : '11px');
      b.innerHTML = `<span>${it.date.slice(5).replace('-', '.')}</span>`;
      b.title = `${label(it.date)} · ${offsetText(it.offset)}`;
      frag.appendChild(b);
    });

    rail.textContent = '';
    rail.appendChild(frag);
    rail.style.width = `${railWidth.toFixed(0)}px`;
  }

  function fillLegend() {
    const after = diary.filter((d) => d.offset > 0).length;
    const before = diary.filter((d) => d.offset < 0).length;
    const el = (id) => document.getElementById(id);
    if (el('rail-after')) el('rail-after').textContent = String(after);
    if (el('rail-before')) el('rail-before').textContent = String(before);
  }

  function buildYears() {
    if (!railYears) return;
    railYears.textContent = '';
    years.forEach((y) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.year = y;
      b.textContent = y;
      railYears.appendChild(b);
    });
  }

  // 稠密年份的轴可长达数千像素，补一排月份锚点方便直达
  function buildMonths(year) {
    if (!railMonths) return;
    railMonths.textContent = '';
    const months = [...new Set(diary.filter((d) => d.date.startsWith(year)).map((d) => d.date.slice(5, 7)))];
    if (months.length < 2) return;
    months.forEach((m) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.month = `${year}-${m}`;
      b.textContent = `${Number(m)}月`;
      railMonths.appendChild(b);
    });
  }

  function centerTick(el) {
    if (!railShell || !el) return;
    const target = el.offsetLeft - railShell.clientWidth / 2;
    railShell.scrollTo({ left: Math.max(0, target), behavior: reduced ? 'auto' : 'smooth' });
  }

  let currentDate = null;

  function selectDiary(date, opts = {}) {
    const item = diary.find((d) => d.date === date);
    if (!item) return;
    currentDate = date;

    buildRail(date.slice(0, 4));

    rail?.querySelectorAll('.date-tick[data-date]').forEach((t) => {
      const on = t.dataset.date === date;
      t.classList.toggle('is-selected', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    railYears?.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.year === date.slice(0, 4));
    });
    railMonths?.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.month === date.slice(0, 7));
    });

    if (diaryDate) diaryDate.textContent = label(date);
    if (diaryOffset) diaryOffset.textContent = offsetText(item.offset);

    // 直接内嵌预渲染好的日记页图片：不请求 PDF，不触发下载
    if (diaryPages) {
      diaryPages.textContent = '';
      const shots = item.shots || [];
      shots.forEach((s, i) => {
        const img = document.createElement('img');
        img.src = s.src;
        img.width = s.w;
        img.height = s.h;
        img.decoding = 'async';
        img.loading = i === 0 ? 'eager' : 'lazy';
        img.alt = `${label(date)} 的手写日记，第 ${i + 1} 页`;
        if (img.complete) img.classList.add('is-ready');
        else img.addEventListener('load', () => img.classList.add('is-ready'), { once: true });
        diaryPages.appendChild(img);
      });
      if (diaryEmpty) diaryEmpty.hidden = shots.length > 0;
      prefetchNeighbours(date);
    }

    if (opts.center !== false) {
      centerTick(rail?.querySelector(`.date-tick[data-date="${date}"]`));
    }
  }

  // 预取相邻两天的首页，翻看时几乎无等待
  function prefetchNeighbours(date) {
    const i = diary.findIndex((d) => d.date === date);
    [i - 1, i + 1, i + 2].forEach((j) => {
      const s = diary[j]?.shots?.[0];
      if (s) { const im = new Image(); im.decoding = 'async'; im.src = s.src; }
    });
  }

  // 离原点最近的一条日记
  function nearestToOrigin() {
    let best = diary[0];
    for (const d of diary) {
      if (Math.abs(d.offset) < Math.abs(best.offset)) best = d;
    }
    return best;
  }

  rail?.addEventListener('click', (e) => {
    const t = e.target.closest('.date-tick[data-date]');
    if (t) selectDiary(t.dataset.date, { center: false });
  });

  rail?.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const i = diary.findIndex((d) => d.date === currentDate);
    const next = diary[i + (e.key === 'ArrowRight' ? 1 : -1)];
    if (!next) return;
    e.preventDefault();
    selectDiary(next.date);
    rail.querySelector(`.date-tick[data-date="${next.date}"]`)?.focus();
  });

  railYears?.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-year]');
    if (!b) return;
    const y = b.dataset.year;
    // 切到该年份时，优先选中离原点最近的那一天
    const pool = diary.filter((d) => d.date.startsWith(y));
    if (!pool.length) return;
    let hit = pool[0];
    for (const d of pool) if (Math.abs(d.offset) < Math.abs(hit.offset)) hit = d;
    selectDiary(hit.date);
  });

  railMonths?.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-month]');
    if (!b) return;
    const hit = diary.find((d) => d.date.startsWith(b.dataset.month));
    if (hit) selectDiary(hit.date);
  });

  document.getElementById('origin-button')?.addEventListener('click', () => {
    selectDiary(nearestToOrigin().date);
  });

  /* ===== 7. 启动 ========================================================= */

  if (finaleDate) {
    const d = new Date(D.anniversary + 'T00:00:00');
    finaleDate.textContent = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }

  buildGallery();
  buildYears();
  fillLegend();
  buildOrbit();
  if (diary.length) selectDiary(nearestToOrigin().date);

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { buildGallery(); schedule(); }, 180);
  });

  window.addEventListener('scroll', schedule, { passive: true });
  schedule();

  if (window.ScrollCraft?.mount) window.ScrollCraft.mount(document.body);
})();
