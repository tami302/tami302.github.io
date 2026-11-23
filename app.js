/**
 * ============================================================
 * 高密度微缩 ASCII 天体引擎 & 黑白交替交互系统（app.js）
 * 核心升级：
 * 1. initLunarCanvas()   — 6.5px 超高密度真实月海/环形山半弦月 + 620 颗细腻消散粒子（离屏缓存稳锁 60fps）
 * 2. initTearEdges()     — 高密度 4px 像素 + 7px 微缩 ASCII 有机波形溶解过渡带
 * 3. initBentoVisuals()  — 5.8px 大画幅局部裁切特写（卡西尼真环缝土星 / 黑洞吸积盘 / 脉冲星磁层）
 * 4. initNebulaCanvas()  — 7px 高密度深空银河星云与暗尘裂带
 * ============================================================
 */

(function () {
  "use strict";

  var data = window.PORTFOLIO_DATA;
  if (!data) {
    console.error("Missing PORTFOLIO_DATA. Make sure data.js loads before app.js.");
    return;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  var reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- 确定性 2D 噪声与 4x4 有序 Bayer 抖动矩阵 ----------
  function hash2(x, y) {
    var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  }

  function valueNoise2D(x, y) {
    var ix = Math.floor(x);
    var iy = Math.floor(y);
    var fx = x - ix;
    var fy = y - iy;
    var ux = fx * fx * (3 - 2 * fx);
    var uy = fy * fy * (3 - 2 * fy);

    var a = hash2(ix, iy);
    var b = hash2(ix + 1, iy);
    var c = hash2(ix, iy + 1);
    var d = hash2(ix + 1, iy + 1);

    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }

  function fbm(x, y, octaves) {
    var v = 0;
    var amp = 0.5;
    var freq = 1;
    var count = octaves || 3;
    for (var i = 0; i < count; i++) {
      v += amp * valueNoise2D(x * freq, y * freq);
      freq *= 2.03;
      amp *= 0.5;
    }
    return v;
  }

  var BAYER4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];

  // 高精细 16 级 ASCII 灰度阶梯（从极轻尘埃到致密实心）
  var FINE_RAMP = " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
  var CLEAN_RAMP = " .·:-=+*#%@";

  function rampChar(lum, fine) {
    var r = fine ? FINE_RAMP : CLEAN_RAMP;
    var idx = Math.max(0, Math.min(r.length - 1, Math.floor(lum * (r.length - 1))));
    return r[idx];
  }

  // ---------- Toast ----------
  var toastTimer = null;
  function showToast(msg) {
    var t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("is-visible");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      t.classList.remove("is-visible");
    }, 2200);
  }

  // ---------- 1. 渲染基础数据 ----------
  function renderProfile() {
    var p = data.profile;
    document.title = p.handle + " — Systems in the Quiet";

    $("dock-handle").textContent = p.handle;
    $("hero-kicker").textContent =
      p.location.toUpperCase() + " · " + p.coords + " · " + p.school.toUpperCase();
    $("hero-lead").textContent = p.headlineLead;
    $("hero-rest").textContent = p.headlineRest;
    $("hero-bio").textContent = p.bio;

    var tickerTrack = $("dock-ticker");
    if (tickerTrack) {
      tickerTrack.innerHTML = "";
      tickerTrack.appendChild(el("span", "", p.ticker));
      tickerTrack.appendChild(el("span", "", p.ticker));
    }

    $("works-count").textContent = String(data.projects.length).padStart(2, "0");

    $("receipt-handle").textContent = p.handle;
    $("receipt-school").textContent = p.school.toUpperCase();
    $("receipt-coords").textContent = p.location.toUpperCase() + " · " + p.coords;
    $("contact-email").textContent = p.email;
    $("footer-copy").textContent =
      "© " + new Date().getFullYear() + " " + p.handle + " · BUILT IN VANILLA HTML / CSS / CANVAS";

    var ghLink = $("contact-github");
    var ghLabel = $("contact-github-label");
    if (p.github && p.github.url) {
      ghLink.href = p.github.url;
      ghLabel.textContent = p.github.label || p.github.url;
    } else if (ghLink) {
      ghLink.hidden = true;
    }

    var aboutWrap = $("about-copy");
    aboutWrap.innerHTML = "";
    data.about.forEach(function (para) {
      aboutWrap.appendChild(el("p", "", para));
    });
  }

  // ---------- 2. 渲染 Bento 展板 DOM（大画幅局部特写视口） ----------
  var bentoItems = [];
  var renderCelestialStage = null;
  var triggerSolarFlare = null;

  // 通用加密终端字符解码波（Kinetic Character Scramble）
  var SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/:+*";
  function scrambleText(node, targetText, durationMs) {
    if (!node || reduceMotion) {
      if (node && targetText !== undefined) node.textContent = targetText;
      return;
    }
    var finalStr = targetText !== undefined ? targetText : node.textContent;
    var dur = durationMs || 420;
    var start = performance.now();
    var token = (node.__scrambleToken || 0) + 1;
    node.__scrambleToken = token;

    function frame(now) {
      if (node.__scrambleToken !== token) return;
      var p = Math.min(1, (now - start) / dur);
      var locked = Math.floor(p * finalStr.length);
      var out = "";
      for (var i = 0; i < finalStr.length; i++) {
        var ch = finalStr[i];
        if (i < locked || ch === " " || ch === "," || ch === "." || ch === "·" || ch === "/") {
          out += ch;
        } else {
          out += SCRAMBLE_CHARS[(i * 7 + Math.floor(now / 28)) % SCRAMBLE_CHARS.length];
        }
      }
      node.textContent = out;
      if (p < 1) {
        requestAnimationFrame(frame);
      } else {
        node.textContent = finalStr;
      }
    }

    requestAnimationFrame(frame);
  }

  function renderWorks() {
    var grid = $("works-grid");
    grid.innerHTML = "";
    bentoItems = [];

    data.projects.forEach(function (proj, idx) {
      var card = el("button", "bento-card");
      card.type = "button";
      card.setAttribute("role", "listitem");
      card.setAttribute("aria-label", "Open dossier: " + proj.eyebrow);

      // 外围离散白色像素场 Canvas
      var bgCanvas = el("canvas", "bento-card__bg-canvas");
      bgCanvas.setAttribute("aria-hidden", "true");
      card.appendChild(bgCanvas);

      var inner = el("div", "bento-card__inner");
      inner.appendChild(el("span", "crosshair crosshair--tl", "+"));
      inner.appendChild(el("span", "crosshair crosshair--br", "+"));

      var topMeta = el("div", "bento-card__top-meta");
      topMeta.appendChild(el("span", "", proj.code + " / " + proj.year));
      topMeta.appendChild(el("span", "", proj.status));
      inner.appendChild(topMeta);

      // 大画幅局部特写高密度微缩 ASCII 视口
      var viewport = el("div", "bento-card__viewport");
      var motifCanvas = el("canvas", "bento-card__motif");
      motifCanvas.setAttribute("aria-hidden", "true");
      viewport.appendChild(motifCanvas);
      inner.appendChild(viewport);

      var copy = el("div", "bento-card__copy");
      var upper = el("div", "");
      upper.appendChild(el("p", "bento-card__eyebrow", proj.eyebrow));

      var stmt = el("p", "bento-card__statement");
      stmt.appendChild(el("span", "tone-bright", proj.lead + " "));
      stmt.appendChild(el("span", "tone-muted", proj.rest));
      upper.appendChild(stmt);
      copy.appendChild(upper);

      var foot = el("div", "bento-card__footer");
      foot.appendChild(el("span", "", proj.stack.slice(0, 2).join(" · ").toUpperCase()));
      foot.appendChild(el("span", "bento-card__open", "DOSSIER →"));
      copy.appendChild(foot);

      inner.appendChild(copy);
      card.appendChild(inner);

      card.addEventListener("click", function () {
        openStage(idx);
      });

      grid.appendChild(card);

      var record = {
        idx: idx,
        proj: proj,
        card: card,
        viewportEl: viewport,
        bgCanvas: bgCanvas,
        motifCanvas: motifCanvas,
        kind: proj.motif,
        seed: idx * 37 + 11,
        hovered: false,
      };
      bentoItems.push(record);

      card.addEventListener("pointerenter", function () {
        record.hovered = true;
      });
      card.addEventListener("pointerleave", function () {
        record.hovered = false;
      });
    });
  }

  // ---------- 3. 渲染 Now 点线表 & Stack ----------
  function renderNowAndStack() {
    var ledger = $("now-ledger");
    ledger.innerHTML = "";

    data.now.forEach(function (item) {
      var row = el("div", "ledger-row");
      row.appendChild(el("span", "ledger-row__code", item.code));
      row.appendChild(el("span", "ledger-row__area", item.area));

      var desc = el("div", "ledger-row__desc");
      desc.appendChild(el("span", "", item.text));
      desc.appendChild(el("span", "ledger-row__dots"));
      row.appendChild(desc);

      row.appendChild(el("span", "ledger-row__state", item.state));
      ledger.appendChild(row);
    });

    var matrix = $("stack-matrix");
    matrix.innerHTML = "";
    data.stack.forEach(function (col) {
      var box = el("div", "stack-col");
      box.appendChild(el("h3", "stack-col__title", col.group));
      var items = el("div", "stack-col__items");
      col.items.forEach(function (t) {
        items.appendChild(el("span", "stack-tag", t));
      });
      box.appendChild(items);
      matrix.appendChild(box);
    });
  }

  // ============================================================
  // 4. 首屏真照片级 3D 球面天平动（Libration）ASCII 半弦月
  //    将天文实拍级半弦月 144x144 纹理包覆到真 3D 球面上：
  //    鼠标移动驱动 ±22° 真实球面 3D 旋转（含双线性采样与无穿帮边缘暗化），
  //    同时叠加右缘 560 颗实时风化粒子消散与深空星尘三维视差。
  // ============================================================
  function initLunarCanvas() {
    var canvas = $("moon-canvas");
    var section = $("lunar");
    var telemetryEl = $("moon-telemetry");
    var texData = window.MOON_SPHERE_TEX;
    if (!canvas || !section || !texData) return;

    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 解码 144x144 RLE 压缩球面纹理为极速 Float32Array 查找表
    var texSize = texData.size;
    var texBuf = new Float32Array(texSize * texSize);
    (function decodeRLE() {
      var rle = texData.rle;
      var out = 0;
      var len = rle.length;
      for (var i = 0; i < len && out < texBuf.length; i++) {
        var c = rle[i];
        if (c === "~") {
          var semi = rle.indexOf(";", i + 1);
          var count = parseInt(rle.slice(i + 1, semi), 10);
          out += count;
          i = semi;
        } else {
          texBuf[out++] = parseInt(c, 36) / 35;
        }
      }
    })();

    // 双线性插值采样 144x144 月球照片纹理（转动丝滑无闪烁）
    function sampleMoonTex(u, v) {
      var fx = (u * 0.5 + 0.5) * (texSize - 1);
      var fy = (v * 0.5 + 0.5) * (texSize - 1);
      if (fx < 0 || fx >= texSize - 1 || fy < 0 || fy >= texSize - 1) return 0;
      var ix = fx | 0;
      var iy = fy | 0;
      var tx = fx - ix;
      var ty = fy - iy;
      var row0 = iy * texSize + ix;
      var row1 = row0 + texSize;
      var a = texBuf[row0] + (texBuf[row0 + 1] - texBuf[row0]) * tx;
      var b = texBuf[row1] + (texBuf[row1 + 1] - texBuf[row1]) * tx;
      return a + (b - a) * ty;
    }

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var width = 0;
    var height = 0;
    var moonBuffer = document.createElement("canvas");
    var moonGeom = { cx: 0, cy: 0, R: 0 };
    var edgeEmitters = [];

    var stars = [];
    var particles = [];
    var maxParticles = 560;
    var pointer = { active: false, x: 0, y: 0, down: false };
    var disperseBoost = 0;

    // 3D 球面天平动（Libration）姿态角（阻尼跟随鼠标，范围锁定 ±22° 防背面穿帮）
    var yaw = 0;
    var pitch = 0;
    var targetYaw = 0;
    var targetPitch = 0;

    // 按当前 3D (yaw, pitch) 角度重绘离屏高精度 ASCII 半弦月球体
    function bakeMoonSphere(curYaw, curPitch) {
      if (
        moonBuffer.width !== Math.floor(width * dpr) ||
        moonBuffer.height !== Math.floor(height * dpr)
      ) {
        moonBuffer.width = Math.floor(width * dpr);
        moonBuffer.height = Math.floor(height * dpr);
      }
      var bctx = moonBuffer.getContext("2d");
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bctx.clearRect(0, 0, width, height);

      var cx = moonGeom.cx;
      var cy = moonGeom.cy;
      var R = moonGeom.R;
      var cellW = 4.6;
      var cellH = 6.4;

      bctx.font = '6.4px "JetBrains Mono", "Cascadia Mono", Consolas, monospace';
      bctx.textBaseline = "middle";
      bctx.textAlign = "center";

      // 逆旋转矩阵系数：将观察空间球面点 (sx, sy, sz) 逆转回原正交月球照片坐标系
      var cyw = Math.cos(-curYaw);
      var syw = Math.sin(-curYaw);
      var cpt = Math.cos(-curPitch);
      var spt = Math.sin(-curPitch);

      var y0 = Math.max(0, Math.floor((cy - R) / cellH) * cellH);
      var y1 = Math.min(height, cy + R);
      var x0 = Math.max(0, Math.floor((cx - R) / cellW) * cellW);
      var x1 = Math.min(width, cx + R);

      edgeEmitters = [];

      for (var y = y0; y <= y1; y += cellH) {
        var sy = (y - cy) / R;
        var sy2 = sy * sy;
        if (sy2 >= 1.0) continue;
        var maxSx = Math.sqrt(1.0 - sy2);
        var rowMinX = Math.max(x0, Math.floor((cx - maxSx * R) / cellW) * cellW);
        var rowMaxX = Math.min(x1, cx + maxSx * R);

        for (var x = rowMinX; x <= rowMaxX; x += cellW) {
          var sx = (x - cx) / R;
          var r2 = sx * sx + sy2;
          if (r2 >= 1.0) continue;

          var sz = Math.sqrt(1.0 - r2);

          // 先绕 X 轴逆转 -pitch，再绕 Y 轴逆转 -yaw
          var y1r = sy * cpt - sz * spt;
          var z1r = sy * spt + sz * cpt;
          var px0 = sx * cyw + z1r * syw;
          var pz0 = -sx * syw + z1r * cyw;

          // 背面防穿帮：转到原图正面可见半球之外时自然融入深空阴影
          if (pz0 <= 0.03) continue;

          var lum = sampleMoonTex(px0, y1r);
          if (lum < 0.04) continue;

          // 极边缘临边立体暗化，强化真实 3D 球面转角感
          if (pz0 < 0.28) {
            lum *= pz0 / 0.28;
          }

          // 仅在当前屏幕最右侧亮弧边缘施加克制粒子风化剥蚀，并更新粒子发射器坐标
          var edgeDist = maxSx - sx;
          if (sx > 0.28 && edgeDist < 0.14) {
            edgeEmitters.push({ x: x, y: y, lum: lum });
            var eFrac = 1 - edgeDist / 0.14;
            var erodeN = fbm(px0 * 7.2 + 2.1, y1r * 7.2 + 4.3, 2);
            if (eFrac * 0.85 > erodeN + 0.16) continue;
            lum *= 1 - eFrac * 0.28;
          }

          var ch = rampChar(Math.min(1, lum), true);
          if (ch === " ") continue;
          var alpha = 0.14 + lum * 0.86;
          bctx.fillStyle = "rgba(244, 243, 238, " + alpha.toFixed(2) + ")";
          bctx.fillText(ch, x, y);
        }
      }
    }

    function spawnParticle(burst) {
      var em =
        edgeEmitters.length > 0
          ? edgeEmitters[Math.floor(Math.random() * edgeEmitters.length)]
          : { x: moonGeom.cx + moonGeom.R * 0.85, y: moonGeom.cy, lum: 0.78 };

      var speed = (burst ? 1.45 : 0.28) + Math.random() * (burst ? 2.0 : 0.72);
      var drift = -0.24 + (Math.random() - 0.5) * 0.78;

      return {
        x: em.x + (Math.random() - 0.5) * 4,
        y: em.y + (Math.random() - 0.5) * 4,
        vx: Math.cos(drift) * speed,
        vy: Math.sin(drift) * speed - 0.06,
        life: 0,
        maxLife: 75 + Math.random() * 165,
        seed: Math.random() * 12,
        baseLum: Math.max(0.35, em.lum),
      };
    }

    function setupScene() {
      var rect = section.getBoundingClientRect();
      width = Math.max(320, Math.floor(rect.width));
      height = Math.max(540, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var isNarrow = width < 860;
      moonGeom.R = isNarrow
        ? Math.min(width * 0.36, height * 0.24)
        : Math.min(width * 0.27, height * 0.39);
      moonGeom.cx = isNarrow ? width * 0.62 : width * 0.64;
      moonGeom.cy = isNarrow ? height * 0.29 : height * 0.49;

      bakeMoonSphere(yaw, pitch);

      // 深空微缩星点（带深度系数，产生 3D 远景视差）
      stars = [];
      var starCount = Math.floor((width * height) / 9500);
      for (var s = 0; s < starCount; s++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          depth: 0.3 + Math.random() * 0.9,
          phase: Math.random() * Math.PI * 2,
          ch: Math.random() > 0.88 ? "+" : ".",
        });
      }

      // 初始化精细风化粒子
      particles = [];
      for (var p = 0; p < maxParticles; p++) {
        var pt = spawnParticle(false);
        pt.life = Math.random() * pt.maxLife;
        pt.x += pt.vx * pt.life;
        pt.y += pt.vy * pt.life;
        particles.push(pt);
      }
    }

    setupScene();
    window.addEventListener("resize", setupScene);

    section.addEventListener("pointermove", function (e) {
      var rect = section.getBoundingClientRect();
      pointer.active = true;
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;

      // 鼠标位置映射为 ±22° 水平天平动 + ±18° 垂直俯仰天平动
      var nx = Math.max(-1, Math.min(1, (pointer.x / rect.width) * 2 - 1));
      var ny = Math.max(-1, Math.min(1, (pointer.y / rect.height) * 2 - 1));
      targetYaw = nx * 0.39;
      targetPitch = -ny * 0.32;
    });

    section.addEventListener("pointerleave", function () {
      pointer.active = false;
      pointer.down = false;
      targetYaw = 0;
      targetPitch = 0;
    });

    var shockwaves = []; // 太阳风 ASCII 圆形冲击波队列
    var charge = 0;      // 按住蓄力进度 0..1

    function fireSolarFlare(ox, oy, power) {
      var fx = ox !== undefined ? ox : moonGeom.cx + moonGeom.R * 0.35;
      var fy = oy !== undefined ? oy : moonGeom.cy;
      var amp = power || 1;
      shockwaves.push({
        x: fx,
        y: fy,
        r: 18,
        maxR: Math.max(width, height) * (0.55 + amp * 0.35),
        speed: 8.5 + amp * 5.5,
        alpha: 0.95,
      });
      // 冲击波把大量粒子呈放射状炸向深空
      for (var p = 0; p < particles.length; p++) {
        var pt = particles[p];
        var dx = pt.x - fx;
        var dy = pt.y - fy;
        var dist = Math.hypot(dx, dy) + 1;
        var kick = Math.min(9, (420 / dist) * (0.7 + amp * 0.9));
        pt.vx = (dx / dist) * kick + (Math.random() - 0.5) * 1.2;
        pt.vy = (dy / dist) * kick + (Math.random() - 0.5) * 1.2;
      }
      var extra = Math.floor(45 + amp * 65);
      for (var b = 0; b < extra; b++) {
        var np = spawnParticle(true);
        var ang = Math.random() * Math.PI * 2;
        var spd = 2.4 + Math.random() * (3.2 + amp * 2.6);
        np.x = fx + Math.cos(ang) * 12;
        np.y = fy + Math.sin(ang) * 12;
        np.vx = Math.cos(ang) * spd;
        np.vy = Math.sin(ang) * spd;
        particles.push(np);
      }
      if (particles.length > maxParticles + 220) {
        particles.splice(0, particles.length - (maxParticles + 220));
      }
    }

    // 暴露给开场动画与全局命令面板调用
    triggerSolarFlare = fireSolarFlare;

    section.addEventListener("pointerdown", function (e) {
      if (e.target.closest("a, button")) return;
      pointer.down = true;
      charge = 0.08;
    });

    window.addEventListener("pointerup", function () {
      if (pointer.down) {
        var burstPower = Math.max(0.45, charge);
        fireSolarFlare(pointer.x, pointer.y, burstPower);
      }
      pointer.down = false;
      charge = 0;
    });

    var t = 0;
    var isVisible = true;
    var rafId = null;

    function drawFrame() {
      ctx.clearRect(0, 0, width, height);

      if (!reduceMotion) {
        t += 0.014;
        disperseBoost += ((pointer.down ? 1 : 0) - disperseBoost) * 0.09;
        if (pointer.down) {
          charge = Math.min(1, charge + 0.024);
        }

        // 仅在 3D 球面天平动角度变化时重绘离屏月球（停稳后零重绘省电）
        var dYaw = targetYaw - yaw;
        var dPitch = targetPitch - pitch;
        if (Math.abs(dYaw) > 0.0008 || Math.abs(dPitch) > 0.0008) {
          yaw += dYaw * 0.12;
          pitch += dPitch * 0.12;
          bakeMoonSphere(yaw, pitch);
        }
      }

      // 1. 深空星尘（叠加随鼠标天平动的轻微三维远景视差）
      ctx.font = '7px "JetBrains Mono", "Cascadia Mono", Consolas, monospace';
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      for (var s = 0; s < stars.length; s++) {
        var st = stars[s];
        var tw = 0.12 + 0.22 * (0.5 + 0.5 * Math.sin(t * 1.5 + st.phase));
        var sxp = st.x - yaw * 26 * st.depth;
        var syp = st.y + pitch * 18 * st.depth;
        ctx.fillStyle = "rgba(244, 243, 238, " + tw.toFixed(2) + ")";
        ctx.fillText(st.ch, sxp, syp);
      }

      // 2. 贴上当前 3D 视角的照片级月球本体
      ctx.drawImage(moonBuffer, 0, 0, width, height);

      // 3. 实时风化飘散的微缩 ASCII 粒子（长按形成万有引力旋涡吸入，松手冲击波爆发）
      ctx.font = '7.5px "JetBrains Mono", "Cascadia Mono", Consolas, monospace';
      for (var i = 0; i < particles.length; i++) {
        var pt = particles[i];
        if (!reduceMotion) {
          pt.life += 1 + disperseBoost * 0.9;
          var swirl = Math.sin(t * 1.8 + pt.seed + pt.y * 0.02) * 0.1;
          // 柔和阻尼让爆发后的粒子自然回归慢速漂移
          pt.vx *= 0.988;
          pt.vy *= 0.988;
          pt.x += pt.vx + swirl;
          pt.y += pt.vy;

          if (pointer.active) {
            var pdx = pt.x - pointer.x;
            var pdy = pt.y - pointer.y;
            var pd = Math.hypot(pdx, pdy);
            if (pointer.down && pd < 260 && pd > 6) {
              // 长按：强引力旋涡向鼠标坍缩聚拢
              var pull = (1 - pd / 260) * (1.2 + charge * 2.4);
              pt.x -= (pdx / pd) * pull + (pdy / pd) * pull * 0.45;
              pt.y -= (pdy / pd) * pull - (pdx / pd) * pull * 0.45;
            } else if (!pointer.down && pd < 115 && pd > 0.1) {
              // 平时划过：太阳风轻柔吹散
              var push = (1 - pd / 115) * 1.55;
              pt.x += (pdx / pd) * push;
              pt.y += (pdy / pd) * push;
            }
          }

          if (pt.life >= pt.maxLife || pt.x > width + 36 || pt.x < -36 || pt.y < -36 || pt.y > height + 36) {
            if (i >= maxParticles) {
              particles.splice(i, 1);
              i--;
              continue;
            }
            particles[i] = spawnParticle(false);
            continue;
          }
        }

        var prog = pt.life / pt.maxLife;
        var fade = Math.sin(Math.min(1, prog * 5) * (Math.PI / 2)) * (1 - prog);
        var lum = Math.max(0.05, (1 - prog) * (pt.baseLum || 0.78));
        var ch = rampChar(lum, false);
        var alpha = Math.max(0.04, fade * 0.9);

        var gx = Math.round(pt.x / 3) * 3;
        var gy = Math.round(pt.y / 3) * 3;
        ctx.fillStyle = "rgba(244, 243, 238, " + alpha.toFixed(2) + ")";
        ctx.fillText(ch, gx, gy);
      }

      // 4. 长按蓄力引力坍缩 ASCII 环
      if (pointer.down && pointer.active) {
        var ringR = Math.max(18, 76 * (1 - charge * 0.68));
        var dots = 24;
        ctx.font = '8px "JetBrains Mono", "Cascadia Mono", Consolas, monospace';
        ctx.fillStyle = "rgba(244, 243, 238, " + (0.45 + charge * 0.5).toFixed(2) + ")";
        for (var d = 0; d < dots; d++) {
          var da = (d / dots) * Math.PI * 2 + t * (2.5 + charge * 5);
          ctx.fillText(
            d % 3 === 0 ? "+" : ":",
            pointer.x + Math.cos(da) * ringR,
            pointer.y + Math.sin(da) * ringR
          );
        }
        ctx.fillText(
          "[" + String(Math.round(charge * 100)).padStart(3, "0") + "%]",
          pointer.x,
          pointer.y - ringR - 12
        );
      }

      // 5. 松手后横扫首屏的太阳风 ASCII 圆形冲击波
      for (var wIdx = shockwaves.length - 1; wIdx >= 0; wIdx--) {
        var sw = shockwaves[wIdx];
        sw.r += sw.speed;
        sw.speed *= 0.975;
        sw.alpha = Math.max(0, 1 - sw.r / sw.maxR);
        if (sw.alpha <= 0.02) {
          shockwaves.splice(wIdx, 1);
          continue;
        }
        var count = Math.max(28, Math.floor((sw.r * Math.PI * 2) / 14));
        var waveChar = sw.alpha > 0.62 ? "#" : sw.alpha > 0.32 ? "+" : ".";
        ctx.font = '8px "JetBrains Mono", "Cascadia Mono", Consolas, monospace';
        ctx.fillStyle = "rgba(244, 243, 238, " + (sw.alpha * 0.78).toFixed(2) + ")";
        for (var k = 0; k < count; k++) {
          var a = (k / count) * Math.PI * 2;
          ctx.fillText(waveChar, sw.x + Math.cos(a) * sw.r, sw.y + Math.sin(a) * sw.r);
        }
      }

      if (telemetryEl) {
        var yd = Math.round((yaw * 180) / Math.PI);
        var pd2 = Math.round((pitch * 180) / Math.PI);
        telemetryEl.textContent = pointer.down
          ? "GRAVITY WELL CHARGING · " + Math.round(charge * 100) + "% · RELEASE FOR SOLAR FLARE"
          : "LUNAR LIBRATION · YAW " +
            (yd >= 0 ? "+" : "") +
            yd +
            "°  PITCH " +
            (pd2 >= 0 ? "+" : "") +
            pd2 +
            "° · 3D PHOTO-SPHERE";
      }
    }

    function tick() {
      if (!isVisible) {
        rafId = null;
        return;
      }
      drawFrame();
      rafId = window.requestAnimationFrame(tick);
    }

    if (reduceMotion) {
      drawFrame();
    } else {
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
          isVisible = entries[0].isIntersecting;
          if (isVisible && !rafId) tick();
        });
        io.observe(section);
      }
      tick();
    }
  }

  // ============================================================
  // 5. 丝滑高密度黑白字符与像素溶解过渡带（initTearEdges）
  //    足够小（4px 像素 + 7.5px 微缩字符）、足够密（数千单元）、平滑波形概率场
  // ============================================================
  function initTearEdges() {
    var DARK = "#0b0b0b";
    var LIGHT = "#f4f3ee";
    var MICRO_TOKENS = [
      "PHASE:0.46",
      "RA 14h29m",
      "DEC -12.4",
      "MARE",
      "CRON",
      "NODE:24",
      "DITHER",
      "STRICT",
      "MEMORY",
      "E2E",
      "FPS:60",
      "TONGJI",
      "RAW",
      "SYNC",
      "ORBIT",
    ];
    var GLYPHS = ".:-=+*#%01/\\|";

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var edges = document.querySelectorAll(".tear-edge");

    function renderEdge(edge, edgeIdx) {
      var canvas = edge.querySelector(".tear-edge__canvas");
      if (!canvas) return;

      var rect = edge.getBoundingClientRect();
      var w = Math.max(320, Math.floor(rect.width));
      var h = Math.max(100, Math.floor(rect.height));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);

      var ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var isD2L = (edge.getAttribute("data-tear") || "").indexOf("d2l") === 0;
      var topCol = isD2L ? DARK : LIGHT;
      var botCol = isD2L ? LIGHT : DARK;
      var seed = (edgeIdx + 1) * 53.7;

      // 先铺底部颜色
      ctx.fillStyle = botCol;
      ctx.fillRect(0, 0, w, h);

      // 逐 4px 超细密网格做有机地形 + 4x4 有序 Bayer 抖动像素溶解
      var px = 4;
      var cols = Math.ceil(w / px);
      var rows = Math.ceil(h / px);

      ctx.fillStyle = topCol;
      for (var r = 0; r < rows; r++) {
        var ny = r / (rows - 1); // 0 顶部 -> 1 底部
        for (var c = 0; c < cols; c++) {
          var nx = (c * px) / 280;
          // 多频平滑有机波浪地平线，杜绝平直生硬感
          var wave =
            (fbm(nx + seed, ny * 1.4 + seed * 0.3, 3) - 0.5) * 0.42 +
            Math.sin(nx * 2.1 + seed) * 0.08;

          // Sigmoid 丝滑过渡曲线（顶部 100% 实色 -> 中间细腻沙粒咬合 -> 底部 0%）
          var t = (ny + wave - 0.5) * 6.4;
          var probTop = 1 / (1 + Math.exp(t));

          // 有序 Bayer 抖动 + 轻微高频微噪，让颗粒既精致又自然
          var bayer = (BAYER4[r & 3][c & 3] + 0.5) / 16;
          var jitter = (hash2(c + seed, r * 1.7) - 0.5) * 0.24;

          if (probTop > bayer + jitter) {
            ctx.fillRect(c * px, r * px, px, px);
          }
        }
      }

      // 在丝滑像素溶解中段，撒入极细微（7.5px）的高密度单字符与零星微缩终端词，还原印刷字符溶解肌理
      ctx.font = '7.5px "JetBrains Mono", "Cascadia Mono", Consolas, monospace';
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";

      // 细密单字符星点（每隔 ~14px 沿中带有机分布）
      for (var sx = 8; sx < w - 8; sx += 14) {
        for (var k = 0; k < 2; k++) {
          var rx = hash2(sx + k * 91, seed);
          var ry = hash2(sx * 0.7 + k * 37, seed + 12);
          if (rx < 0.38) continue;

          var cy = h * (0.2 + ry * 0.6);
          var isTopInk = ry > 0.5;
          ctx.fillStyle = isTopInk
            ? isD2L
              ? "rgba(11, 11, 11, 0.52)"
              : "rgba(244, 243, 238, 0.52)"
            : isD2L
            ? "rgba(244, 243, 238, 0.55)"
            : "rgba(11, 11, 11, 0.55)";

          var g = GLYPHS[Math.floor(hash2(sx, cy) * GLYPHS.length)];
          ctx.fillText(g, sx + (rx - 0.5) * 6, cy);
        }
      }

      // 极克制地嵌几枚 7.5px 微缩反色代码碎词（小而精，不抢戏、不笨重）
      var tokenStep = Math.max(92, Math.floor(w / 14));
      for (var tx = 24; tx < w - 70; tx += tokenStep) {
        var r1 = hash2(tx, seed + 3.1);
        var r2 = hash2(tx * 1.3, seed + 8.7);
        if (r1 < 0.28) continue;

        var label = MICRO_TOKENS[Math.floor(r2 * MICRO_TOKENS.length)];
        var tw = ctx.measureText(label).width + 6;
        var ty = h * (0.3 + r1 * 0.4);
        var darkPill = r2 > 0.5;

        ctx.fillStyle = darkPill ? DARK : LIGHT;
        ctx.fillRect(tx, ty - 5.5, tw, 11);
        ctx.fillStyle = darkPill ? "rgba(244, 243, 238, 0.78)" : "rgba(11, 11, 11, 0.76)";
        ctx.fillText(label, tx + 3, ty + 0.5);
      }
    }

    function drawAll() {
      edges.forEach(renderEdge);
    }

    drawAll();
    window.addEventListener("resize", drawAll);
  }

  // ============================================================
  // 6. 作品集大画幅局部特写：5.8px 超高密度微缩 ASCII 天体渲染引擎
  //    - rings (003): 土星主球体在左侧裁切 + 右侧纵深穿透的真实卡西尼/恩克多环缝土星环！
  //    - orbit (001): 黑洞事件视界与引力透镜发光吸积盘局部特写
  //    - pulsar (002): 脉冲星相对论双极喷流与偶极磁力线环局部特写
  // ============================================================
  function initBentoVisuals() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    // 6A. 外围白色离散微像素点阵边框（更小更精致：5px 像素颗粒）
    function drawOuterPixels(item) {
      var canvas = item.bgCanvas;
      var rect = item.card.getBoundingClientRect();
      var w = Math.max(220, Math.floor(rect.width));
      var h = Math.max(360, Math.floor(rect.height));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);

      var ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      var size = 5;
      var gap = 7;
      for (var py = 4; py < h - 4; py += gap) {
        for (var px = 4; px < w - 4; px += gap) {
          var nx = px / w;
          var ny = py / h;
          // 仅在最外边缘呈现精细颗粒像素群
          if (nx > 0.08 && nx < 0.92 && ny > 0.06 && ny < 0.94) continue;
          var n = fbm(nx * 8.5 + item.seed, ny * 8.5 + item.seed * 0.4, 2);
          if (n > 0.56) {
            var a = Math.min(0.95, 0.3 + (n - 0.56) * 2.2);
            ctx.fillStyle = "rgba(247, 246, 242, " + a.toFixed(2) + ")";
            ctx.fillRect(px, py, size, size);
          }
        }
      }
    }

    // 6B. 实时 3D 轨道相机土星光线追踪器（随鼠标平滑改变 yaw / pitch，真实物理近大远小 + 双向环影）
    function sampleSaturnRing(r) {
      if (r < 1.24 || r > 2.74) return 0;
      var ripples =
        0.58 +
        0.22 * Math.sin(r * 66) +
        0.13 * Math.cos(r * 148) +
        0.08 * Math.sin(r * 260);
      if (r < 1.5) return ((r - 1.24) / 0.26) * 0.3 * ripples; // C 环薄纱
      if (r < 1.98) {
        var bVal = 0.62 + 0.34 * ripples;
        if (Math.abs(r - 1.66) < 0.016) bVal *= 0.46;
        if (Math.abs(r - 1.83) < 0.014) bVal *= 0.54;
        return bVal; // B 环致密主环
      }
      if (r < 2.11) return 0.012; // 卡西尼环缝（Cassini Division）
      if (r < 2.54) {
        var aVal = 0.46 + 0.3 * ripples;
        if (Math.abs(r - 2.39) < 0.02) return 0.018; // 恩克环缝（Encke Gap）
        return aVal; // A 环
      }
      if (r > 2.63 && r < 2.69) return 0.4; // F 环游丝
      return 0;
    }

    var SATURN_SUN = (function () {
      var sx = -0.58, sy = 0.38, sz = 0.72;
      var sl = Math.hypot(sx, sy, sz);
      return [sx / sl, sy / sl, sz / sl];
    })();

    function renderSaturnOrbit(ctx, w, h, yaw, pitch, bgStars, isHovered, spin) {
      var spT = spin || 0;
      ctx.clearRect(0, 0, w, h);

      // 背景稀疏深空微尘
      ctx.font = '6px "JetBrains Mono", "Cascadia Mono", Consolas, monospace';
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(244, 243, 238, 0.2)";
      for (var s = 0; s < bgStars.length; s++) {
        ctx.fillText(".", bgStars[s].x, bgStars[s].y);
      }

      // 轨道相机：土星中心在原点 (0, 0, 0)，赤道环在 y = 0 水平面，相机绕球面轨道旋转
      var dist = 5.35;
      var focal = 2.18; // 天文中长焦：舒展自然，告别鱼眼牛角包畸变，同时保持清晰近大远小
      var cp = Math.cos(pitch);
      var sp = Math.sin(pitch);
      var cy = Math.cos(yaw);
      var sy = Math.sin(yaw);

      var camX = dist * cp * sy;
      var camY = dist * sp;
      var camZ = dist * cp * cy;

      // 视线略偏右侧 (+0.45)，让土星主球体自然落在左偏中，右侧舒展呈现多层土星环
      var targetX = 0.42 * cy;
      var targetZ = -0.42 * sy;
      var fx = targetX - camX;
      var fy = -camY;
      var fz = targetZ - camZ;
      var fLen = Math.hypot(fx, fy, fz);
      fx /= fLen;
      fy /= fLen;
      fz /= fLen;

      // 相机自带 -14° 艺术斜切滚转角
      var up0x = -0.24, up0y = 0.97, up0z = 0;
      // right = normalize(cross(fwd, up0))
      var rx = fy * up0z - fz * up0y;
      var ry = fz * up0x - fx * up0z;
      var rz = fx * up0y - fy * up0x;
      var rLen = Math.hypot(rx, ry, rz);
      rx /= rLen;
      ry /= rLen;
      rz /= rLen;

      // trueUp = cross(right, fwd)
      var ux = ry * fz - rz * fy;
      var uy = rz * fx - rx * fz;
      var uz = rx * fy - ry * fx;

      var cellW = 4.6;
      var cellH = 6.4;
      ctx.font = '6.2px "JetBrains Mono", "Cascadia Mono", Consolas, monospace';

      var aspect = w / h;
      var invFlat = 1 / 0.9; // 土星 10% 极轴压扁
      var oYs = camY * invFlat;
      var qc = camX * camX + oYs * oYs + camZ * camZ - 1.0;

      var sunX = SATURN_SUN[0];
      var sunY = SATURN_SUN[1];
      var sunZ = SATURN_SUN[2];

      for (var y = cellH * 0.5; y < h - 14; y += cellH) {
        var ny = (0.5 - y / h) * 2.0;
        for (var x = cellW * 0.5; x < w; x += cellW) {
          var nx = (x / w - 0.5) * 2.0 * aspect;

          // 发射世界空间射线 D
          var dx = fx * focal + rx * nx + ux * ny;
          var dy = fy * focal + ry * nx + uy * ny;
          var dz = fz * focal + rz * nx + uz * ny;
          var dLen = Math.hypot(dx, dy, dz);
          dx /= dLen;
          dy /= dLen;
          dz /= dLen;

          // 1) 光线与原点扁球体求交
          var dYs = dy * invFlat;
          var qa = dx * dx + dYs * dYs + dz * dz;
          var qb = 2 * (camX * dx + oYs * dYs + camZ * dz);
          var disc = qb * qb - 4 * qa * qc;
          var tSphere = Infinity;
          if (disc >= 0) {
            var t0 = (-qb - Math.sqrt(disc)) / (2 * qa);
            if (t0 > 0) tSphere = t0;
          }

          // 2) 光线与 y = 0 水平土星环平面求交
          var tRing = Infinity;
          var ringDens = 0;
          var rpx = 0, rpz = 0;
          if (Math.abs(dy) > 1e-4) {
            var tr = -camY / dy;
            if (tr > 0) {
              rpx = camX + tr * dx;
              rpz = camZ + tr * dz;
              var rRad = Math.hypot(rpx, rpz);
              ringDens = sampleSaturnRing(rRad);
              if (ringDens > 0.06) tRing = tr;
            }
          }

          if (tSphere === Infinity && tRing === Infinity) continue;

          var lum = 0;
          var alpha = 0;

          if (tRing < tSphere) {
            // 命中土星环：计算土星本体投在后环上的真实阴影 + 开普勒差速冰晶轨道流转
            var shadowR = 1.0;
            var sB = 2 * (rpx * sunX + rpz * sunZ);
            var sC = rpx * rpx + rpz * rpz - 0.96;
            var sDisc = sB * sB - 4 * sC;
            if (sDisc >= 0 && (-sB - Math.sqrt(sDisc)) * 0.5 > 0) {
              shadowR = 0.2;
            }
            var rRadNow = Math.hypot(rpx, rpz);
            var ringPhi = Math.atan2(rpz, rpx);
            // 开普勒定律：内环转得比外环快，绘出细微流动的冰粒亮弧与暗纹
            var kepler = spT * (1.8 / Math.pow(Math.max(1.2, rRadNow), 1.5));
            var iceShimmer =
              0.86 +
              0.14 * Math.sin(ringPhi * 3 - kepler * 2.2 + rRadNow * 10) +
              0.09 * Math.cos(ringPhi * 7 - kepler * 3.1);
            var depthCue = Math.max(0.48, Math.min(1.06, dist / tRing));
            lum = Math.min(0.96, ringDens * 0.88 * iceShimmer * shadowR * depthCue);
            alpha = 0.18 + lum * 0.78;
          } else {
            // 命中土星主球体：丝滑大气云带（含缓慢自转微纹理）+ 真实球面光照 + 物理精确弧形环影
            var px3 = camX + tSphere * dx;
            var py3 = camY + tSphere * dy;
            var pz3 = camZ + tSphere * dz;
            var lat = py3 * invFlat;
            var lon = Math.atan2(pz3, px3) - spT * 0.55;

            // 扁球体真实法线
            var nrmX = px3;
            var nrmY = py3 * invFlat * invFlat;
            var nrmZ = pz3;
            var nrmL = Math.hypot(nrmX, nrmY, nrmZ);
            var ndotl = Math.max(0, (nrmX * sunX + nrmY * sunY + nrmZ * sunZ) / nrmL);

            // 温润细腻的土星纬向云带 + 缓慢旋转的大气风暴涡纹
            var bands =
              0.79 +
              0.14 * Math.sin(lat * 21) +
              0.07 * Math.cos(lat * 44) +
              0.05 * Math.sin(lon * 4 + lat * 12);

            // 阴影射线：从球面沿 sun 方向查 y = 0 环面，投射精确物理环影
            var ringSh = 1.0;
            if (Math.abs(sunY) > 1e-4) {
              var ts = -py3 / sunY;
              if (ts > 0) {
                var rr = Math.hypot(px3 + ts * sunX, pz3 + ts * sunZ);
                var rd = sampleSaturnRing(rr);
                if (rd > 0.08) ringSh = Math.max(0.24, 1 - rd * 0.78);
              }
            }

            lum = (0.09 + Math.pow(ndotl, 0.68) * 0.91) * bands * ringSh;
            alpha = 0.22 + lum * 0.78;
          }

          var ch = rampChar(Math.min(1, lum), true);
          if (ch === " ") continue;
          ctx.fillStyle = "rgba(244, 243, 238, " + Math.min(0.98, alpha).toFixed(2) + ")";
          ctx.fillText(ch, x, y);
        }
      }

      // 底部极细微交互轨道读数
      ctx.font = '8px "JetBrains Mono", "Cascadia Mono", Consolas, monospace';
      ctx.textAlign = "left";
      ctx.fillStyle = isHovered ? "rgba(244, 243, 238, 0.78)" : "rgba(244, 243, 238, 0.44)";
      var yawDeg = Math.round((yaw * 180) / Math.PI);
      var pitchDeg = Math.round((pitch * 180) / Math.PI);
      var label = isHovered
        ? "ORBIT · YAW " + (yawDeg >= 0 ? "+" : "") + yawDeg + "°  PITCH " + (pitchDeg >= 0 ? "+" : "") + pitchDeg + "°"
        : "MOVE CURSOR TO ORBIT SATURN 3D";
      ctx.fillText(label, 12, h - 9);
    }

    // 通用 3D 轨道相机生成器（供 001 黑洞 / 002 脉冲星 / 003 土星共用）
    function buildOrbitCamera(dist, yaw, pitch, rollRad, targetRightOffset) {
      var cp = Math.cos(pitch);
      var sp = Math.sin(pitch);
      var cy = Math.cos(yaw);
      var sy = Math.sin(yaw);

      var camX = dist * cp * sy;
      var camY = dist * sp;
      var camZ = dist * cp * cy;

      var targetX = (targetRightOffset || 0) * cy;
      var targetZ = -(targetRightOffset || 0) * sy;

      var fx = targetX - camX;
      var fy = -camY;
      var fz = targetZ - camZ;
      var fLen = Math.hypot(fx, fy, fz);
      fx /= fLen;
      fy /= fLen;
      fz /= fLen;

      var up0x = Math.sin(rollRad);
      var up0y = Math.cos(rollRad);
      var up0z = 0;

      var rx = fy * up0z - fz * up0y;
      var ry = fz * up0x - fx * up0z;
      var rz = fx * up0y - fy * up0x;
      var rLen = Math.hypot(rx, ry, rz);
      rx /= rLen;
      ry /= rLen;
      rz /= rLen;

      var ux = ry * fz - rz * fy;
      var uy = rz * fx - rx * fz;
      var uz = rx * fy - ry * fx;

      return {
        camX: camX, camY: camY, camZ: camZ,
        fx: fx, fy: fy, fz: fz,
        rx: rx, ry: ry, rz: rz,
        ux: ux, uy: uy, uz: uz,
      };
    }

    function drawOrbitLabel(ctx, h, yaw, pitch, isHovered, idleHint) {
      ctx.font = '8px "JetBrains Mono", "Cascadia Mono", Consolas, monospace';
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = isHovered ? "rgba(244, 243, 238, 0.78)" : "rgba(244, 243, 238, 0.44)";
      var yawDeg = Math.round((yaw * 180) / Math.PI);
      var pitchDeg = Math.round((pitch * 180) / Math.PI);
      var label = isHovered
        ? "ORBIT · YAW " + (yawDeg >= 0 ? "+" : "") + yawDeg + "°  PITCH " + (pitchDeg >= 0 ? "+" : "") + pitchDeg + "°"
        : idleHint;
      ctx.fillText(label, 12, h - 9);
    }

    // 6C. 001 黑洞事件视界 & 引力透镜吸积盘（持续旋涡奔涌 + 实时随鼠标 3D 轨道旋转）
    function renderBlackHoleOrbit(ctx, w, h, yaw, pitch, bgStars, isHovered, spin) {
      var spT = spin || 0;
      ctx.clearRect(0, 0, w, h);

      ctx.font = '6px "JetBrains Mono", "Cascadia Mono", Consolas, monospace';
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(244, 243, 238, 0.2)";
      for (var s = 0; s < bgStars.length; s++) {
        ctx.fillText(".", bgStars[s].x, bgStars[s].y);
      }

      var dist = 6.4;
      var focal = 2.15;
      var cam = buildOrbitCamera(dist, yaw, pitch, -0.22, 0.35);

      var cellW = 4.6;
      var cellH = 6.4;
      ctx.font = '6.2px "JetBrains Mono", "Cascadia Mono", Consolas, monospace';

      var aspect = w / h;
      var bhR = 1.02; // 事件视界阴影半径
      // 越接近平视，背面引力透镜双拱效应越强；俯视时平滑过渡为完整旋涡盘
      var edgeOnFactor = Math.max(0.18, 1 - Math.abs(Math.sin(pitch)) * 1.15);

      for (var y = cellH * 0.5; y < h - 14; y += cellH) {
        var ny = (0.5 - y / h) * 2.0;
        for (var x = cellW * 0.5; x < w; x += cellW) {
          var nx = (x / w - 0.5) * 2.0 * aspect;

          var dx = cam.fx * focal + cam.rx * nx + cam.ux * ny;
          var dy = cam.fy * focal + cam.ry * nx + cam.uy * ny;
          var dz = cam.fz * focal + cam.rz * nx + cam.uz * ny;
          var dLen = Math.hypot(dx, dy, dz);
          dx /= dLen;
          dy /= dLen;
          dz /= dLen;

          // 射线到黑洞原点的最近距离（冲击参数 b）与最近点深度 tClose
          var tClose = -(cam.camX * dx + cam.camY * dy + cam.camZ * dz);
          var cx = cam.camX + tClose * dx;
          var cy = cam.camY + tClose * dy;
          var cz = cam.camZ + tClose * dz;
          var b = Math.hypot(cx, cy, cz);

          // 射线与 y = 0 主吸积盘平面求交
          var tDisk = Infinity;
          var diskLum = 0;
          if (Math.abs(dy) > 1e-4) {
            var td = -cam.camY / dy;
            if (td > 0) {
              var px = cam.camX + td * dx;
              var pz = cam.camZ + td * dz;
              var r = Math.hypot(px, pz);
              if (r > 1.32 && r < 4.55) {
                tDisk = td;
                var phi = Math.atan2(pz, px);
                var radialFade =
                  Math.sin(Math.min(1, (r - 1.32) / 0.45) * (Math.PI / 2)) *
                  Math.exp(-(r - 1.45) * 0.56);
                // 螺旋吸积流丝缕：内圈高速顺时针旋涡旋转（开普勒差速）
                var rotPhi = phi - spT * (1.85 / Math.sqrt(r));
                var spiral =
                  0.52 +
                  0.32 * Math.sin(rotPhi * 2 + r * 3.8) +
                  0.22 * Math.cos(rotPhi * 5 - r * 7.2);
                // 相对论多普勒增亮：顺时针切向速度 (-pz/r, 0, px/r) 朝向相机一侧更耀眼
                var vx = -pz / r;
                var vz = px / r;
                var approach = -(vx * dx + vz * dz);
                var doppler = 0.72 + Math.max(-0.34, Math.min(0.52, approach * 0.48));
                diskLum = radialFade * spiral * doppler * 1.35;
              }
            }
          }

          var lum = 0;
          // 1) 若前侧吸积盘在事件视界之前命中，直接照亮（前盘压过黑洞阴影）
          var frontDiskHit = tDisk < tClose && diskLum > 0.08;
          if (frontDiskHit) {
            lum = diskLum;
          } else if (b < bhR) {
            // 漆黑事件视界阴影（无任何光逃逸）
            continue;
          } else {
            // 2) 视界外的后侧主吸积盘
            if (diskLum > 0.08) lum = Math.max(lum, diskLum * 0.92);

            // 3) 锐利闭合光子环（Photon Ring）
            var photon = Math.exp(-Math.pow((b - (bhR + 0.07)) / 0.075, 2)) * 1.05;
            lum = Math.max(lum, photon);

            // 4) 引力透镜弯折的背面吸积盘上下拱弧（纹理随吸积盘同步流动）
            if (b > bhR + 0.04 && b < 2.35) {
              var lensBand = Math.exp(-Math.pow((b - 1.32) / 0.36, 2));
              var screenUp = Math.abs(cy) / (b + 0.001);
              var lensedAng = Math.atan2(cy, cx);
              var lensedStreak = 0.65 + 0.35 * Math.sin(lensedAng * 7 + b * 11 - spT * 2.1);
              var lensedLum = lensBand * (0.35 + 0.65 * screenUp) * edgeOnFactor * lensedStreak * 0.96;
              lum = Math.max(lum, lensedLum);
            }
          }

          if (lum < 0.08) continue;
          lum = Math.min(1, lum);
          var ch = rampChar(lum, true);
          if (ch === " ") continue;
          ctx.fillStyle = "rgba(244, 243, 238, " + (0.16 + lum * 0.84).toFixed(2) + ")";
          ctx.fillText(ch, x, y);
        }
      }

      drawOrbitLabel(ctx, h, yaw, pitch, isHovered, "MOVE CURSOR TO ORBIT BLACK HOLE 3D");
    }

    // 6D. 002 脉冲星相对论双极喷流 & 真 3D 偶极磁层笼（持续高速自转喷射 + 实时随鼠标 3D 轨道旋转）
    function renderPulsarOrbit(ctx, w, h, yaw, pitch, bgStars, isHovered, spin) {
      var spT = spin || 0;
      ctx.clearRect(0, 0, w, h);

      ctx.font = '6px "JetBrains Mono", "Cascadia Mono", Consolas, monospace';
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(244, 243, 238, 0.2)";
      for (var s = 0; s < bgStars.length; s++) {
        ctx.fillText(".", bgStars[s].x, bgStars[s].y);
      }

      var dist = 5.5;
      var focal = 2.05;
      // 自带 -36° 艺术滚转斜切角，让双极喷流默认对角劈开黑框
      var cam = buildOrbitCamera(dist, yaw, pitch, -0.62, 0.08);

      var cellW = 4.6;
      var cellH = 6.4;
      ctx.font = '6.2px "JetBrains Mono", "Cascadia Mono", Consolas, monospace';

      var aspect = w / h;
      // 沿射线在原点附近取 5 个深度切片做真 3D 体积偶极磁力线积分，极快且立体感极强
      var sliceOffsets = [-1.4, -0.7, 0, 0.7, 1.4];

      for (var y = cellH * 0.5; y < h - 14; y += cellH) {
        var ny = (0.5 - y / h) * 2.0;
        for (var x = cellW * 0.5; x < w; x += cellW) {
          var nx = (x / w - 0.5) * 2.0 * aspect;

          var dx = cam.fx * focal + cam.rx * nx + cam.ux * ny;
          var dy = cam.fy * focal + cam.ry * nx + cam.uy * ny;
          var dz = cam.fz * focal + cam.rz * nx + cam.uz * ny;
          var dLen = Math.hypot(dx, dy, dz);
          dx /= dLen;
          dy /= dLen;
          dz /= dLen;

          var tClose = -(cam.camX * dx + cam.camY * dy + cam.camZ * dz);
          var c0x = cam.camX + tClose * dx;
          var c0y = cam.camY + tClose * dy;
          var c0z = cam.camZ + tClose * dz;
          var r0 = Math.hypot(c0x, c0y, c0z);

          var lum = 0;

          // 1) 耀眼中子星致密光核
          if (r0 < 0.36) {
            lum = Math.max(lum, Math.exp(-r0 * r0 * 24) * 1.15);
          }

          // 2) 3D 准直相对论双极喷流（沿世界 Y 轴正负喷射，计算射线到 Y 轴的精确 3D 最短距离）
          var horiz2 = dx * dx + dz * dz;
          if (horiz2 > 1e-5) {
            var tAxis = -(cam.camX * dx + cam.camZ * dz) / horiz2;
            if (tAxis > 0) {
              var ax = cam.camX + tAxis * dx;
              var ay = cam.camY + tAxis * dy;
              var az = cam.camZ + tAxis * dz;
              var dAxis = Math.hypot(ax, az);
              var absY = Math.abs(ay);
              var jetR = 0.055 + absY * 0.105;
              if (dAxis < jetR * 2.5 && absY < 3.6) {
                var profile = Math.exp(-Math.pow(dAxis / jetR, 2));
                var knots = 0.65 + 0.35 * Math.sin(absY * 11 - spT * 4.8);
                var decay = Math.exp(-absY * 0.34);
                lum = Math.max(lum, profile * knots * decay * 1.08);
              }
            }
          }

          // 3) 真 3D 偶极磁层笼（8 片经向磁力线扇叶 r = L * sin²θ 绕磁轴持续三维自转）
          for (var si = 0; si < sliceOffsets.length; si++) {
            var tS = tClose + sliceOffsets[si];
            if (tS <= 0.2) continue;
            var px = cam.camX + tS * dx;
            var py = cam.camY + tS * dy;
            var pz = cam.camZ + tS * dz;
            var rr = Math.hypot(px, py, pz);
            if (rr < 0.28 || rr > 2.8) continue;

            var rho = Math.hypot(px, pz); // 到 Y 磁轴的柱半径
            var sinTheta = rho / rr;
            if (sinTheta < 0.22) continue;

            var L = rr / (sinTheta * sinTheta);
            if (L < 0.85 || L > 4.2) continue;

            // 8 片立体经向扇叶持续绕磁轴自转 + 嵌套壳层波纹
            var azim = Math.atan2(pz, px) - spT * 1.05;
            var lobeMask = Math.pow(0.5 + 0.5 * Math.cos(azim * 4), 5);
            var shellMask = Math.pow(0.5 + 0.5 * Math.cos(L * 9.5), 7);
            var depthWeight = Math.max(0.4, Math.min(1.1, dist / tS));
            var fieldLum = lobeMask * shellMask * Math.exp(-rr * 0.45) * depthWeight * 0.92;
            if (fieldLum > lum) lum = fieldLum;
          }

          if (lum < 0.08) continue;
          lum = Math.min(1, lum);
          var ch = rampChar(lum, true);
          if (ch === " ") continue;
          ctx.fillStyle = "rgba(244, 243, 238, " + (0.16 + lum * 0.84).toFixed(2) + ")";
          ctx.fillText(ch, x, y);
        }
      }

      drawOrbitLabel(ctx, h, yaw, pitch, isHovered, "MOVE CURSOR TO ORBIT PULSAR 3D");
    }

    // 统一路由三张卡片与全屏大展台的实时 3D 轨道渲染（支持持续动态自转 + 鼠标视角变换）
    function renderCard3D(item, ctx, w, h) {
      var spin = item.spin || 0;
      if (item.kind === "rings") {
        renderSaturnOrbit(ctx, w, h, item.yaw, item.pitch, item.stars || [], item.hovered, spin);
      } else if (item.kind === "orbit") {
        renderBlackHoleOrbit(ctx, w, h, item.yaw, item.pitch, item.stars || [], item.hovered, spin);
      } else {
        renderPulsarOrbit(ctx, w, h, item.yaw, item.pitch, item.stars || [], item.hovered, spin);
      }
    }

    // 暴露给全屏沉浸式展台复用（零重复代码）
    renderCelestialStage = renderCard3D;

    // 6E. 初始化全部 3 张实时 3D 轨道天体卡片（默认静置渲染一帧，零后台耗电）
    function bakeMotif(item) {
      var canvas = item.motifCanvas;
      var rect = canvas.getBoundingClientRect();
      var w = Math.max(240, Math.floor(rect.width));
      var h = Math.max(220, Math.floor(rect.height));

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);

      item.stars = [];
      for (var ss = 0; ss < 52; ss++) {
        item.stars.push({
          x: hash2(ss + item.seed, 1.3) * w,
          y: hash2(ss + item.seed, 4.9) * h,
        });
      }

      if (item.yaw === undefined) {
        if (item.kind === "rings") {
          item.baseYaw = -0.34;
          item.basePitch = 0.28;
        } else if (item.kind === "orbit") {
          item.baseYaw = -0.22;
          item.basePitch = 0.22;
        } else {
          item.baseYaw = 0.28;
          item.basePitch = 0.18;
        }
        item.yaw = item.baseYaw;
        item.pitch = item.basePitch;
        item.targetYaw = item.baseYaw;
        item.targetPitch = item.basePitch;
      }

      var ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderCard3D(item, ctx, w, h);
    }

    // 给全部 3 张 Bento 天体卡片绑定鼠标实时 3D 轨道视角控制
    bentoItems.forEach(function (item) {
      item.card.addEventListener("pointermove", function (e) {
        var rect = item.motifCanvas.getBoundingClientRect();
        var nx = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1));
        var ny = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height) * 2 - 1));
        item.targetYaw = item.baseYaw + nx * 1.15;
        item.targetPitch = Math.max(-0.22, Math.min(0.82, item.basePitch - ny * 0.48));
      });
      item.card.addEventListener("pointerleave", function () {
        item.targetYaw = item.baseYaw;
        item.targetPitch = item.basePitch;
      });
    });

    function rebuildAllBento() {
      bentoItems.forEach(function (item) {
        drawOuterPixels(item);
        bakeMotif(item);
      });
    }

    rebuildAllBento();
    window.addEventListener("resize", rebuildAllBento);

    // 统一 3D 动态旋转 + 鼠标视角追踪循环（滚出视口或全屏展台开启时自动休眠省电）
    var worksSec = $("works");
    var visible = true;
    var rafId = null;
    var lastFrameTime = 0;

    function tickCards3D(now) {
      if (!visible) {
        rafId = null;
        return;
      }

      var ts = now || performance.now();
      if (!lastFrameTime) lastFrameTime = ts;
      var dt = Math.min(0.06, Math.max(0.008, (ts - lastFrameTime) / 1000));

      // 只要全屏项目展台盖住画面，暂停背后 3 张小卡重绘
      if (!stageState.open) {
        var anyInteractive = bentoItems.some(function (it) {
          return (
            it.hovered ||
            Math.abs(it.targetYaw - it.yaw) > 0.003 ||
            Math.abs(it.targetPitch - it.pitch) > 0.003
          );
        });
        // 鼠标交互时满血 60fps；无人操作巡航自转时稳锁 ~30fps 丝滑省电
        var minInterval = anyInteractive ? 15 : 33;
        if (ts - lastFrameTime >= minInterval) {
          lastFrameTime = ts;
          bentoItems.forEach(function (item, idx) {
            item.spin = (item.spin || 0) + dt;
            // 未悬停时叠加一道极柔和的自主视角巡航；鼠标划入立刻平滑交由鼠标精准掌控
            var desiredYaw = item.hovered
              ? item.targetYaw
              : item.baseYaw + Math.sin(item.spin * 0.42 + idx * 2.1) * 0.2;
            var desiredPitch = item.hovered
              ? item.targetPitch
              : item.basePitch + Math.cos(item.spin * 0.34 + idx * 1.4) * 0.06;

            item.yaw += (desiredYaw - item.yaw) * (item.hovered ? 0.15 : 0.08);
            item.pitch += (desiredPitch - item.pitch) * (item.hovered ? 0.15 : 0.08);
            item.lastHoverState = item.hovered;

            var canvas = item.motifCanvas;
            var w = canvas.width / dpr;
            var h = canvas.height / dpr;
            var ctx = canvas.getContext("2d");
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            renderCard3D(item, ctx, w, h);
          });
        }
      }

      rafId = window.requestAnimationFrame(tickCards3D);
    }

    if (!reduceMotion) {
      if ("IntersectionObserver" in window && worksSec) {
        var io = new IntersectionObserver(function (entries) {
          visible = entries[0].isIntersecting;
          if (visible && !rafId) tickCards3D();
        });
        io.observe(worksSec);
      }
      tickCards3D();
    }
  }

  // ============================================================
  // 7. 全屏超高密度 7px ASCII 银河星云与暗尘裂带（离屏缓存 + 动态星团）
  // ============================================================
  function initNebulaCanvas() {
    var canvas = $("nebula-canvas");
    var section = $("nebula");
    if (!canvas || !section) return;

    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var buffer = document.createElement("canvas");
    var width = 0;
    var height = 0;
    var clusterStars = [];
    var pointer = { active: false, x: 0, y: 0 };

    function bakeNebula() {
      var rect = section.getBoundingClientRect();
      width = Math.max(320, Math.floor(rect.width));
      height = Math.max(440, Math.floor(rect.height));

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      buffer.width = Math.floor(width * dpr);
      buffer.height = Math.floor(height * dpr);

      var bctx = buffer.getContext("2d");
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bctx.clearRect(0, 0, width, height);

      var stepX = 6.2;
      var stepY = 9.2;
      bctx.font = '7px "JetBrains Mono", "Cascadia Mono", Consolas, monospace';
      bctx.textBaseline = "middle";
      bctx.textAlign = "center";

      clusterStars = [];

      for (var y = stepY * 0.5; y < height; y += stepY) {
        var ny = y / height;
        for (var x = stepX * 0.5; x < width; x += stepX) {
          var nx = x / width;

          // 斜向银河主带 + 暗尘裂带（Dark Dust Rift 撕开中间层次，像真实银河长曝光）
          var spine = 0.82 - nx * 0.58 + Math.sin(nx * 4.2 + 0.6) * 0.08;
          var distToSpine = Math.abs(ny - spine);
          var envelope = Math.exp(-distToSpine * distToSpine * 13);

          var warp = (fbm(nx * 3.1 + 1.4, ny * 3.1 + 4.2, 3) - 0.5) * 0.28;
          var clouds = fbm(nx * 4.8 + warp, ny * 4.2 - warp, 4);
          var fineFilaments = valueNoise2D(nx * 16, ny * 14);

          // 暗尘带切割
          var dustRift =
            Math.exp(-Math.pow((ny - spine + warp * 0.35) / 0.055, 2)) *
            (clouds > 0.45 ? 0.55 : 0.15);

          var density = Math.max(0, envelope * (clouds * 0.92 + fineFilaments * 0.28) - dustRift);
          if (density < 0.16) continue;

          var clamped = Math.min(1, density * 1.15);
          var ch = rampChar(clamped, false);
          if (ch === " ") continue;

          var alpha = 0.06 + clamped * 0.34;
          bctx.fillStyle = "rgba(244, 243, 238, " + alpha.toFixed(2) + ")";
          bctx.fillText(ch, x, y);

          if (clamped > 0.68 && hash2(x * 1.1, y * 1.7) > 0.965) {
            clusterStars.push({ x: x, y: y, phase: hash2(x, y) * 6.28 });
          }
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.drawImage(buffer, 0, 0, width, height);
    }

    bakeNebula();
    window.addEventListener("resize", bakeNebula);

    section.addEventListener("pointermove", function (e) {
      var rect = section.getBoundingClientRect();
      pointer.active = true;
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
    });

    section.addEventListener("pointerleave", function () {
      pointer.active = false;
    });

    var t = 0;
    var isVisible = false;
    var rafId = null;

    function drawNebulaLive() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(buffer, 0, 0, width, height);

      if (!reduceMotion) t += 0.025;

      // 星团亮星微闪 + 鼠标星座连线网（Constellation Web）
      ctx.font = '7.5px "JetBrains Mono", "Cascadia Mono", Consolas, monospace';
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";

      var nearStars = [];
      for (var i = 0; i < clusterStars.length; i++) {
        var st = clusterStars[i];
        var driftX = st.x + Math.sin(t * 0.35 + st.phase) * 4;
        var driftY = st.y + Math.cos(t * 0.28 + st.phase) * 3;
        var pulse = 0.22 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t + st.phase), 3);
        ctx.fillStyle = "rgba(255, 255, 255, " + pulse.toFixed(2) + ")";
        ctx.fillText(pulse > 0.65 ? "+" : "*", driftX, driftY);

        if (pointer.active) {
          var distM = Math.hypot(driftX - pointer.x, driftY - pointer.y);
          if (distM < 175) {
            nearStars.push({ x: driftX, y: driftY, d: distM });
          }
        }
      }

      // 在鼠标附近的亮星间拉出 0.7px 精密星座连线，像亲手在漆黑夜空点亮星图
      if (pointer.active && nearStars.length > 0) {
        nearStars.sort(function (a, b) {
          return a.d - b.d;
        });
        var pick = nearStars.slice(0, 7);
        ctx.lineWidth = 0.7;
        for (var p = 0; p < pick.length; p++) {
          var a1 = (1 - pick[p].d / 175) * 0.42;
          ctx.strokeStyle = "rgba(244, 243, 238, " + a1.toFixed(2) + ")";
          ctx.beginPath();
          ctx.moveTo(pointer.x, pointer.y);
          ctx.lineTo(pick[p].x, pick[p].y);
          ctx.stroke();

          if (p + 1 < pick.length) {
            var segD = Math.hypot(pick[p].x - pick[p + 1].x, pick[p].y - pick[p + 1].y);
            if (segD < 150) {
              ctx.strokeStyle = "rgba(244, 243, 238, " + (a1 * 0.65).toFixed(2) + ")";
              ctx.beginPath();
              ctx.moveTo(pick[p].x, pick[p].y);
              ctx.lineTo(pick[p + 1].x, pick[p + 1].y);
              ctx.stroke();
            }
          }
        }
      }
    }

    function tick() {
      if (!isVisible) {
        rafId = null;
        return;
      }
      drawNebulaLive();
      rafId = window.requestAnimationFrame(tick);
    }

    if (!reduceMotion && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        isVisible = entries[0].isIntersecting;
        if (isVisible && !rafId) tick();
      });
      io.observe(section);
    }
  }

  // ---------- 8. 悬浮菜单盒 & Minimap ----------
  function initDockAndMinimap() {
    var toggle = $("dock-toggle");
    var menu = $("dock-menu");

    function setMenu(open) {
      menu.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "−" : "+";
    }

    toggle.addEventListener("click", function () {
      setMenu(menu.hidden);
    });

    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function (e) {
        var href = a.getAttribute("href");
        if (href && href.charAt(0) === "#" && goToSceneById(href.slice(1))) {
          e.preventDefault();
        }
        setMenu(false);
      });
    });

    document.addEventListener("click", function (e) {
      if (!menu.hidden && !e.target.closest("#nav-dock")) {
        setMenu(false);
      }
    });

    var minimap = $("minimap");
    var lens = $("minimap-lens");
    if (minimap && lens) {
      minimap.querySelectorAll("[data-jump]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var sel = btn.getAttribute("data-jump");
          if (sel && sel.charAt(0) === "#") {
            goToSceneById(sel.slice(1));
          }
        });
      });

      function updateLens() {
        var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        var ratio = maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;
        var trackH = minimap.clientHeight - lens.offsetHeight - 6;
        lens.style.top = (3 + ratio * Math.max(0, trackH)).toFixed(1) + "px";
      }

      window.addEventListener("scroll", updateLens, { passive: true });
      window.addEventListener("resize", updateLens);
      updateLens();
    }
  }

  // ---------- 9. 全屏沉浸式项目展台（FLIP 放大左移 + 实时 3D 视口 + 逐行终端打字） ----------
  var stageEl = $("dossier-stage");
  var stageBackdrop = $("stage-backdrop");
  var stageVisualWrap = $("stage-visual-wrap");
  var stageCanvas = $("stage-canvas");
  var stageDossier = $("stage-dossier");
  var stageCloseBtn = $("stage-close");
  var stagePrevBtn = $("stage-prev");
  var stageNextBtn = $("stage-next");

  var stageState = {
    open: false,
    idx: 0,
    rafId: null,
    typingRunId: 0,
    typingActive: false,
    skipNow: null,
    dpr: Math.min(window.devicePixelRatio || 1, 2),
    view: {
      kind: "orbit",
      yaw: -0.22,
      pitch: 0.22,
      baseYaw: -0.22,
      basePitch: 0.22,
      targetYaw: -0.22,
      targetPitch: 0.22,
      hovered: false,
      lastHoverState: false,
      stars: [],
    },
  };

  function resizeStageCanvas() {
    if (!stageCanvas || !stageVisualWrap || !stageState.open) return;
    var rect = stageVisualWrap.getBoundingClientRect();
    var w = Math.max(260, Math.floor(rect.width));
    var h = Math.max(240, Math.floor(rect.height));
    stageCanvas.width = Math.floor(w * stageState.dpr);
    stageCanvas.height = Math.floor(h * stageState.dpr);

    stageState.view.stars = [];
    for (var s = 0; s < 86; s++) {
      stageState.view.stars.push({
        x: hash2(s + stageState.idx * 41, 2.7) * w,
        y: hash2(s + stageState.idx * 41, 8.3) * h,
      });
    }

    drawStageFrame();
  }

  function drawStageFrame() {
    if (!renderCelestialStage || !stageCanvas) return;
    var w = stageCanvas.width / stageState.dpr;
    var h = stageCanvas.height / stageState.dpr;
    if (w < 10 || h < 10) return;
    var ctx = stageCanvas.getContext("2d");
    ctx.setTransform(stageState.dpr, 0, 0, stageState.dpr, 0, 0);
    renderCelestialStage(stageState.view, ctx, w, h);
  }

  var lastStageTime = 0;

  function tickStage3D(now) {
    if (!stageState.open) {
      stageState.rafId = null;
      lastStageTime = 0;
      return;
    }
    var ts = now || performance.now();
    if (!lastStageTime) lastStageTime = ts;
    var v = stageState.view;
    var interactive =
      v.hovered ||
      Math.abs(v.targetYaw - v.yaw) > 0.003 ||
      Math.abs(v.targetPitch - v.pitch) > 0.003;
    var interval = interactive ? 16 : 30;

    if (ts - lastStageTime >= interval) {
      var dt = Math.min(0.06, (ts - lastStageTime) / 1000);
      lastStageTime = ts;
      v.spin = (v.spin || 0) + dt;
      var desiredYaw = v.hovered ? v.targetYaw : v.baseYaw + Math.sin(v.spin * 0.36) * 0.18;
      var desiredPitch = v.hovered ? v.targetPitch : v.basePitch + Math.cos(v.spin * 0.28) * 0.05;
      v.yaw += (desiredYaw - v.yaw) * (v.hovered ? 0.14 : 0.07);
      v.pitch += (desiredPitch - v.pitch) * (v.hovered ? 0.14 : 0.07);
      v.lastHoverState = v.hovered;
      drawStageFrame();
    }

    stageState.rafId = window.requestAnimationFrame(tickStage3D);
  }

  // 右侧终端逐行打字引擎（行云流水、可随时点击瞬间全量展开、切项/关闭安全中止）
  function startStageTypewriter(proj) {
    stageState.typingRunId += 1;
    var runId = stageState.typingRunId;
    stageState.typingActive = true;

    $("stage-code").textContent = proj.code + " · " + proj.year;
    $("stage-status").textContent = proj.status;

    var eyebrowEl = $("stage-eyebrow");
    var titleEl = $("stage-title");
    var specsEl = $("stage-specs");
    var problemSec = $("stage-sec-problem");
    var archSec = $("stage-sec-arch");
    var outcomeSec = $("stage-sec-outcome");
    var stackSec = $("stage-sec-stack");
    var problemEl = $("stage-problem");
    var archEl = $("stage-arch");
    var outcomeEl = $("stage-outcome");
    var stackEl = $("stage-stack");

    // 重置清空所有区块状态
    eyebrowEl.textContent = "";
    titleEl.textContent = "";
    problemEl.textContent = "";
    outcomeEl.textContent = "";
    specsEl.innerHTML = "";
    archEl.innerHTML = "";
    stackEl.innerHTML = "";

    [problemSec, archSec, outcomeSec, stackSec].forEach(function (sec) {
      sec.classList.remove("is-shown");
    });

    // 预构建 DOM 行容器（保证排版不跳动，再逐行打字点亮）
    var specRows = [];
    proj.specs.forEach(function (s) {
      var row = el("div", "stage-spec");
      var dt = el("dt", "", s.k);
      var dd = el("dd", "", "");
      row.appendChild(dt);
      row.appendChild(dd);
      specsEl.appendChild(row);
      specRows.push({ row: row, dd: dd, text: s.v });
    });

    var archLis = [];
    proj.architecture.forEach(function (step) {
      var li = el("li", "", "");
      archEl.appendChild(li);
      archLis.push({ el: li, text: step });
    });

    var stackLis = [];
    proj.stack.forEach(function (t) {
      var li = el("li", "", t);
      stackEl.appendChild(li);
      stackLis.push(li);
    });

    stageDossier.scrollTop = 0;

    // 排好逐行打字任务队列
    var tasks = [
      { el: eyebrowEl, text: proj.eyebrow.toUpperCase(), chunk: 2, delay: 14 },
      { el: titleEl, text: proj.lead + " " + proj.rest, chunk: 3, delay: 14 },
    ];

    specRows.forEach(function (item) {
      tasks.push({
        el: item.dd,
        text: item.text,
        chunk: 3,
        delay: 12,
        before: function () {
          item.row.classList.add("is-shown");
        },
      });
    });

    tasks.push({
      el: problemEl,
      text: proj.problem,
      chunk: 5,
      delay: 12,
      before: function () {
        problemSec.classList.add("is-shown");
      },
    });

    archLis.forEach(function (item, idx) {
      tasks.push({
        el: item.el,
        text: item.text,
        chunk: 5,
        delay: 12,
        before:
          idx === 0
            ? function () {
                archSec.classList.add("is-shown");
              }
            : null,
      });
    });

    tasks.push({
      el: outcomeEl,
      text: proj.outcome,
      chunk: 5,
      delay: 12,
      before: function () {
        outcomeSec.classList.add("is-shown");
      },
    });

    var activeTypingEl = null;

    function finishAllImmediately() {
      if (runId !== stageState.typingRunId) return;
      stageState.typingRunId += 1;
      stageState.typingActive = false;
      stageState.skipNow = null;
      if (activeTypingEl) {
        activeTypingEl.classList.remove("is-typing");
        activeTypingEl = null;
      }
      eyebrowEl.textContent = proj.eyebrow.toUpperCase();
      titleEl.textContent = proj.lead + " " + proj.rest;
      specRows.forEach(function (item) {
        item.row.classList.add("is-shown");
        item.dd.textContent = item.text;
      });
      problemSec.classList.add("is-shown");
      problemEl.textContent = proj.problem;
      archSec.classList.add("is-shown");
      archLis.forEach(function (item) {
        item.el.textContent = item.text;
      });
      outcomeSec.classList.add("is-shown");
      outcomeEl.textContent = proj.outcome;
      stackSec.classList.add("is-shown");
      stackLis.forEach(function (li) {
        li.classList.add("is-shown");
      });
    }

    stageState.skipNow = finishAllImmediately;

    if (reduceMotion) {
      finishAllImmediately();
      return;
    }

    var taskIndex = 0;

    function runNextTask() {
      if (runId !== stageState.typingRunId) return;

      if (activeTypingEl) {
        activeTypingEl.classList.remove("is-typing");
        activeTypingEl = null;
      }

      if (taskIndex >= tasks.length) {
        // 最后将技术标签极速依次闪现
        stackSec.classList.add("is-shown");
        stackLis.forEach(function (li, i) {
          setTimeout(function () {
            if (runId === stageState.typingRunId) li.classList.add("is-shown");
          }, i * 55);
        });
        stageState.typingActive = false;
        stageState.skipNow = null;
        return;
      }

      var task = tasks[taskIndex++];
      if (task.before) task.before();

      var pos = 0;
      var full = task.text;
      activeTypingEl = task.el;
      activeTypingEl.classList.add("is-typing");

      function stepChar() {
        if (runId !== stageState.typingRunId) return;
        pos = Math.min(full.length, pos + task.chunk);
        task.el.textContent = full.slice(0, pos);
        if (pos < full.length) {
          setTimeout(stepChar, task.delay);
        } else {
          setTimeout(runNextTask, 45);
        }
      }

      stepChar();
    }

    // 留 240ms 让左侧 3D 天体先飞入放大半程，再无缝启动右侧终端逐行打字
    setTimeout(runNextTask, 240);
  }

  function openStage(idx, fromSwitch) {
    var record = bentoItems[idx];
    if (!record) return;

    var proj = record.proj;
    stageState.idx = idx;

    // 承接卡片当前的 3D 视角角度与旋转相位，丝滑放大不跳变
    var v = stageState.view;
    v.kind = record.kind;
    v.spin = record.spin || 0;
    v.baseYaw = record.baseYaw !== undefined ? record.baseYaw : -0.3;
    v.basePitch = record.basePitch !== undefined ? record.basePitch : 0.24;
    v.yaw = record.yaw !== undefined ? record.yaw : v.baseYaw;
    v.pitch = record.pitch !== undefined ? record.pitch : v.basePitch;
    v.targetYaw = v.yaw;
    v.targetPitch = v.pitch;
    v.hovered = false;
    v.lastHoverState = false;

    if (fromSwitch && stageState.open) {
      // 在沉浸展台内切换上/下一个项目：轻微脉冲微缩再回弹
      stageVisualWrap.style.transition = "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)";
      stageVisualWrap.style.transform = "scale(0.96)";
      resizeStageCanvas();
      requestAnimationFrame(function () {
        stageVisualWrap.style.transform = "none";
      });
      startStageTypewriter(proj);
      return;
    }

    // 记录原卡片视口精确位置，用于 FLIP 缩放放大平移
    var srcRect = record.viewportEl ? record.viewportEl.getBoundingClientRect() : null;

    stageEl.hidden = false;
    stageEl.setAttribute("aria-hidden", "false");
    document.body.classList.add("drawer-open");
    stageState.open = true;

    // 先测左侧目标大框最终坐标，并渲染高清大画幅 3D 天体
    stageVisualWrap.style.transition = "none";
    stageVisualWrap.style.transform = "none";
    resizeStageCanvas();
    var dstRect = stageVisualWrap.getBoundingClientRect();

    // FLIP 第一步：瞬间缩回原卡片位置与大小
    if (srcRect && !reduceMotion && dstRect.width > 0 && dstRect.height > 0) {
      var dx = srcRect.left - dstRect.left;
      var dy = srcRect.top - dstRect.top;
      var sx = srcRect.width / dstRect.width;
      var sy = srcRect.height / dstRect.height;
      stageVisualWrap.style.transform =
        "translate(" + dx.toFixed(1) + "px, " + dy.toFixed(1) + "px) scale(" + sx.toFixed(4) + ", " + sy.toFixed(4) + ")";
      void stageVisualWrap.offsetWidth;
    }

    // FLIP 第二步：丝滑缩放放大并平移到画面左侧 + 淡入纯黑影院幕布与右侧终端
    requestAnimationFrame(function () {
      stageVisualWrap.style.transition = "transform 560ms cubic-bezier(0.22, 1, 0.36, 1)";
      stageVisualWrap.style.transform = "none";
      stageEl.classList.add("is-open");
    });

    startStageTypewriter(proj);

    if (!reduceMotion && !stageState.rafId) {
      tickStage3D();
    }
    stageCloseBtn.focus();
  }

  function closeStage() {
    if (!stageState.open) return;

    stageState.typingRunId += 1;
    stageState.typingActive = false;
    stageState.skipNow = null;
    stageState.open = false;

    var record = bentoItems[stageState.idx];
    var srcRect = record && record.viewportEl ? record.viewportEl.getBoundingClientRect() : null;
    var dstRect = stageVisualWrap.getBoundingClientRect();

    // 反向 FLIP：天体大框平滑缩回原卡片位置，同时幕布与右侧文字淡出
    if (srcRect && !reduceMotion && dstRect.width > 0 && dstRect.height > 0) {
      var dx = srcRect.left - dstRect.left;
      var dy = srcRect.top - dstRect.top;
      var sx = srcRect.width / dstRect.width;
      var sy = srcRect.height / dstRect.height;
      stageVisualWrap.style.transition = "transform 360ms cubic-bezier(0.22, 1, 0.36, 1)";
      stageVisualWrap.style.transform =
        "translate(" + dx.toFixed(1) + "px, " + dy.toFixed(1) + "px) scale(" + sx.toFixed(4) + ", " + sy.toFixed(4) + ")";
    }

    stageEl.classList.remove("is-open");
    stageEl.setAttribute("aria-hidden", "true");
    document.body.classList.remove("drawer-open");

    setTimeout(function () {
      if (!stageState.open) {
        stageEl.hidden = true;
        stageVisualWrap.style.transition = "none";
        stageVisualWrap.style.transform = "none";
      }
    }, 380);

    if (record && record.card && typeof record.card.focus === "function") {
      record.card.focus();
    }
  }

  // 左侧大舞台同样支持鼠标实时 3D 环绕盘玩天体
  stageVisualWrap.addEventListener("pointerenter", function () {
    stageState.view.hovered = true;
  });
  stageVisualWrap.addEventListener("pointermove", function (e) {
    var rect = stageCanvas.getBoundingClientRect();
    var nx = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1));
    var ny = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height) * 2 - 1));
    stageState.view.targetYaw = stageState.view.baseYaw + nx * 1.25;
    stageState.view.targetPitch = Math.max(-0.24, Math.min(0.84, stageState.view.basePitch - ny * 0.5));
  });
  stageVisualWrap.addEventListener("pointerleave", function () {
    stageState.view.hovered = false;
    stageState.view.targetYaw = stageState.view.baseYaw;
    stageState.view.targetPitch = stageState.view.basePitch;
  });

  // 打字过程中点一下右侧文字区立刻全量展开（防急性子等待）
  stageDossier.addEventListener("click", function () {
    if (stageState.typingActive && stageState.skipNow) {
      stageState.skipNow();
    }
  });

  stageCloseBtn.addEventListener("click", closeStage);
  stageBackdrop.addEventListener("click", closeStage);
  stagePrevBtn.addEventListener("click", function () {
    var nextIdx = (stageState.idx - 1 + bentoItems.length) % bentoItems.length;
    openStage(nextIdx, true);
  });
  stageNextBtn.addEventListener("click", function () {
    var nextIdx = (stageState.idx + 1) % bentoItems.length;
    openStage(nextIdx, true);
  });

  window.addEventListener("resize", function () {
    if (stageState.open) resizeStageCanvas();
  });

  document.addEventListener("keydown", function (e) {
    if (!stageState.open) return;
    if (e.key === "Escape") {
      closeStage();
    } else if (e.key === "ArrowLeft") {
      openStage((stageState.idx - 1 + bentoItems.length) % bentoItems.length, true);
    } else if (e.key === "ArrowRight") {
      openStage((stageState.idx + 1) % bentoItems.length, true);
    }
  });

  // ---------- 10. 邮箱一键复制 ----------
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (ok) resolve();
        else reject(new Error("copy failed"));
      } catch (err) {
        document.body.removeChild(ta);
        reject(err);
      }
    });
  }

  function bindActions() {
    function handleCopy() {
      var email = data.profile.email;
      copyText(email)
        .then(function () {
          showToast("COPIED: " + email);
        })
        .catch(function () {
          showToast("EMAIL: " + email);
        });
    }

    $("hero-copy-email").addEventListener("click", handleCopy);
    $("copy-email-btn").addEventListener("click", handleCopy);

    // 站内快捷按钮全部统一走非线性物理快切
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      if (a.closest("#dock-menu")) return;
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("href").slice(1);
        if (id && goToSceneById(id)) {
          e.preventDefault();
        }
      });
    });

    $("back-to-top").addEventListener("click", function () {
      goToSceneById("lunar");
    });
  }

  // ---------- 11. 幕间非线性物理快切引擎（Expo-Out 快起慢刹 + 防触控板连跳） ----------
  var sceneDefs = [
    { id: "lunar", label: "00 / 03 · LUNAR", light: false },
    { id: "works", label: "01 / 03 · WORKS", light: true },
    { id: "nebula", label: "02 / 03 · NEBULA", light: false },
    { id: "contact", label: "03 / 03 · CONTACT", light: true },
  ];

  var sceneState = {
    current: 0,
    animating: false,
    rafId: null,
    lockUntil: 0,
  };

  function getSceneEl(idx) {
    return sceneDefs[idx] ? $(sceneDefs[idx].id) : null;
  }

  function getSceneTargetY(idx) {
    var sec = getSceneEl(idx);
    if (!sec) return 0;
    var maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (idx === 0) return 0;
    if (idx === sceneDefs.length - 1) return Math.min(sec.offsetTop, maxScroll);
    return Math.min(sec.offsetTop, maxScroll);
  }

  function syncSceneHUD(idx) {
    sceneState.current = idx;
    var def = sceneDefs[idx];
    var hud = $("scene-hud");
    var readout = $("scene-readout");
    var prevBtn = $("scene-prev");
    var nextBtn = $("scene-next");
    if (!hud || !def) return;

    readout.textContent = def.label;
    hud.classList.toggle("scene-hud--light", !!def.light);
    if (prevBtn) prevBtn.disabled = idx <= 0;
    if (nextBtn) nextBtn.disabled = idx >= sceneDefs.length - 1;
  }

  function detectClosestScene() {
    var y = window.scrollY + window.innerHeight * 0.42;
    var best = 0;
    for (var i = 0; i < sceneDefs.length; i++) {
      var elSec = getSceneEl(i);
      if (elSec && elSec.offsetTop <= y) best = i;
    }
    return best;
  }

  function goToScene(targetIdx) {
    targetIdx = Math.max(0, Math.min(sceneDefs.length - 1, targetIdx));
    var targetY = getSceneTargetY(targetIdx);
    var prevIdx = sceneState.current;
    var goingDown = targetIdx >= prevIdx;

    if (sceneState.rafId) {
      cancelAnimationFrame(sceneState.rafId);
      sceneState.rafId = null;
    }

    // 清除所有幕的临时入场/退场类
    sceneDefs.forEach(function (d) {
      var s = $(d.id);
      if (s) s.classList.remove("is-departing", "is-entering-down", "is-entering-up");
    });

    syncSceneHUD(targetIdx);

    if (reduceMotion) {
      window.scrollTo(0, targetY);
      return true;
    }

    var startY = window.scrollY;
    var delta = targetY - startY;
    if (Math.abs(delta) < 2) return true;

    // 触发旧幕微退 + 新幕错峰入场协同动效
    var prevSec = getSceneEl(prevIdx);
    var nextSec = getSceneEl(targetIdx);
    if (prevSec && prevIdx !== targetIdx) prevSec.classList.add("is-departing");
    if (nextSec && prevIdx !== targetIdx) {
      void nextSec.offsetWidth;
      nextSec.classList.add(goingDown ? "is-entering-down" : "is-entering-up");
    }

    var duration = 660; // 快起慢刹总时长
    var startTime = performance.now();
    sceneState.animating = true;
    sceneState.lockUntil = startTime + 740; // 吃掉触控板惯性尾波，防一滑连跳两幕

    // 非线性强张力 Expo-Out：前 22% 时间疾驰过 80% 路程，后程磁吸丝滑刹停 + 速度感弹性微倾斜
    function easeOutExpo(t) {
      return t >= 1 ? 1 : 1 - Math.pow(2, -10.5 * t);
    }

    var skewTargets = Array.prototype.slice.call(
      document.querySelectorAll(".bento-grid, .ledger, .stack-matrix")
    );
    var lastScrollY = startY;

    if (nextSec && prevIdx !== targetIdx) {
      var kicker = nextSec.querySelector(".mono-kicker, .hero__kicker");
      if (kicker) {
        if (!kicker.dataset.orig) kicker.dataset.orig = kicker.textContent;
        setTimeout(function () {
          scrambleText(kicker, kicker.dataset.orig, 300);
        }, 140);
      }
    }

    function step(now) {
      var elapsed = now - startTime;
      var t = Math.min(1, elapsed / duration);
      var eased = easeOutExpo(t);
      var nextY = Math.round(startY + delta * eased);
      var vel = nextY - lastScrollY;
      lastScrollY = nextY;
      window.scrollTo(0, nextY);

      var skewDeg = Math.max(-1.6, Math.min(1.6, vel * 0.018));
      skewTargets.forEach(function (elSkew) {
        elSkew.style.transform =
          Math.abs(skewDeg) > 0.04 ? "skewY(" + skewDeg.toFixed(2) + "deg)" : "";
      });

      if (t < 1) {
        sceneState.rafId = requestAnimationFrame(step);
      } else {
        sceneState.rafId = null;
        sceneState.animating = false;
        window.scrollTo(0, targetY);
        skewTargets.forEach(function (elSkew) {
          elSkew.style.transform = "";
        });
        setTimeout(function () {
          if (prevSec) prevSec.classList.remove("is-departing");
          if (nextSec) nextSec.classList.remove("is-entering-down", "is-entering-up");
        }, 120);
      }
    }

    sceneState.rafId = requestAnimationFrame(step);
    return true;
  }

  function goToSceneById(id) {
    for (var i = 0; i < sceneDefs.length; i++) {
      if (sceneDefs[i].id === id) {
        return goToScene(i);
      }
    }
    return false;
  }

  function initCinematicScenes() {
    var prevBtn = $("scene-prev");
    var nextBtn = $("scene-next");
    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        goToScene(sceneState.current - 1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        goToScene(sceneState.current + 1);
      });
    }

    // 桌面宽屏下滚轮升级为幕间非线性快切（内容超出单屏时自动放行幕内滚动，到边缘再切幕）
    window.addEventListener(
      "wheel",
      function (e) {
        if (reduceMotion) return;
        if (window.innerWidth <= 960) return;
        if (stageState.open) return; // 全屏档案打开时不拦截
        if (e.ctrlKey || e.metaKey) return;

        var now = performance.now();
        if (sceneState.animating || now < sceneState.lockUntil) {
          e.preventDefault();
          return;
        }

        if (Math.abs(e.deltaY) < 16) return;

        var idx = detectClosestScene();
        var sec = getSceneEl(idx);
        if (!sec) return;

        var dir = e.deltaY > 0 ? 1 : -1;
        var viewTop = window.scrollY;
        var viewBot = viewTop + window.innerHeight;
        var secTop = sec.offsetTop;
        var secBot = secTop + sec.offsetHeight;
        if (idx === sceneDefs.length - 1) {
          secBot = document.documentElement.scrollHeight;
        }

        if (dir > 0 && secBot > viewBot + 24) return;
        if (dir < 0 && viewTop > secTop + 24) return;

        var nextIdx = idx + dir;
        if (nextIdx < 0 || nextIdx >= sceneDefs.length) return;

        e.preventDefault();
        goToScene(nextIdx);
      },
      { passive: false }
    );

    // 键盘方向键 / PageDown / PageUp 同样走非线性幕间快切
    document.addEventListener("keydown", function (e) {
      if (stageState.open) return;
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === "PageDown" || e.key === "ArrowDown") {
        var cur = detectClosestScene();
        if (cur < sceneDefs.length - 1) {
          e.preventDefault();
          goToScene(cur + 1);
        }
      } else if (e.key === "PageUp" || e.key === "ArrowUp") {
        var curUp = detectClosestScene();
        if (curUp > 0) {
          e.preventDefault();
          goToScene(curUp - 1);
        }
      }
    });

    // 巨型背景数字 03 深度视差 + 手动拖滚动条同步 HUD
    var giantNum = $("works-count");
    window.addEventListener(
      "scroll",
      function () {
        if (!sceneState.animating) {
          var detected = detectClosestScene();
          if (detected !== sceneState.current) syncSceneHUD(detected);
        }
        if (giantNum && !reduceMotion) {
          var wSec = $("works");
          if (wSec) {
            var rel = (window.scrollY - wSec.offsetTop) * 0.14;
            giantNum.style.transform = "translateY(" + Math.max(-42, Math.min(42, rel)).toFixed(1) + "px)";
          }
        }
      },
      { passive: true }
    );

    syncSceneHUD(detectClosestScene());
  }

  // ---------- 12. 终端表悬停解码 + 主票据按钮磁吸 ----------
  function initMicroPolish() {
    if (reduceMotion) return;

    // 终端点线清单悬停状态词解码
    document.querySelectorAll(".ledger-row").forEach(function (row) {
      var st = row.querySelector(".ledger-row__state");
      if (!st) return;
      var orig = st.textContent;
      row.addEventListener("pointerenter", function () {
        scrambleText(st, orig, 240);
      });
    });

    var hasFine = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
    if (!hasFine) return;

    // 主票据按钮磁吸牵引
    document.querySelectorAll(".ticket-btn").forEach(function (btn) {
      btn.addEventListener("pointermove", function (e) {
        var r = btn.getBoundingClientRect();
        var dx = ((e.clientX - r.left) / r.width - 0.5) * 12;
        var dy = ((e.clientY - r.top) / r.height - 0.5) * 9;
        btn.style.transform = "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px)";
      });
      btn.addEventListener("pointerleave", function () {
        btn.style.transform = "";
      });
    });
  }

  // ---------- 13. 打孔票据 3D 实体倾斜透视 + 单色纸面微光 + 精密条形码 ----------
  function initReceipt3D() {
    var receipt = document.querySelector(".receipt");
    var barcode = $("receipt-barcode");

    if (barcode) {
      barcode.innerHTML = "";
      var pattern = [2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 1, 3, 2, 1, 2, 1, 3, 1, 1, 2, 1, 4, 1, 2, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2];
      pattern.forEach(function (w, i) {
        var bar = el("span", "barcode-bar");
        bar.style.flex = w + " 1 0";
        bar.style.opacity = i % 3 === 0 ? "0.9" : "0.52";
        barcode.appendChild(bar);
      });
    }

    if (!receipt || reduceMotion) return;
    var hasFine = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
    if (!hasFine) return;

    receipt.addEventListener("pointermove", function (e) {
      var r = receipt.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width;
      var py = (e.clientY - r.top) / r.height;
      var rotY = (px - 0.5) * 11;
      var rotX = (0.5 - py) * 9;
      receipt.style.setProperty("--rx", (px * 100).toFixed(1) + "%");
      receipt.style.setProperty("--ry", (py * 100).toFixed(1) + "%");
      receipt.style.transform =
        "rotateX(" + rotX.toFixed(2) + "deg) rotateY(" + rotY.toFixed(2) + "deg) translateY(-3px)";
    });

    receipt.addEventListener("pointerleave", function () {
      receipt.style.transform = "";
    });
  }

  // ---------- 14. 独立黑白极性反相按钮（◐ INV） ----------
  function initInvertToggle() {
    var btn = $("invert-btn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var inverted = document.documentElement.classList.toggle("polarity-invert");
      btn.setAttribute("aria-pressed", String(inverted));
      showToast(inverted ? "POLARITY: INVERTED" : "POLARITY: STANDARD");
    });
  }

  // ---------- 15. 开场加密字符解码序列 ----------
  function runBootSequence() {
    if (reduceMotion) return;
    var kicker = $("hero-kicker");
    var lead = $("hero-lead");
    if (kicker) scrambleText(kicker, kicker.textContent, 520);
    if (lead) {
      setTimeout(function () {
        scrambleText(lead, lead.textContent, 680);
      }, 90);
    }
    // 首屏落定 280ms 后放出一圈柔和的开场太阳风 ASCII 脉冲环
    setTimeout(function () {
      if (triggerSolarFlare && window.scrollY < 100) {
        triggerSolarFlare(undefined, undefined, 0.55);
      }
    }, 280);
  }

  // ---------- 启动 ----------
  renderProfile();
  renderWorks();
  renderNowAndStack();
  initTearEdges();
  initDockAndMinimap();
  bindActions();
  initCinematicScenes();
  initLunarCanvas();
  initBentoVisuals();
  initNebulaCanvas();
  initMicroPolish();
  initReceipt3D();
  initInvertToggle();
  runBootSequence();
})();
