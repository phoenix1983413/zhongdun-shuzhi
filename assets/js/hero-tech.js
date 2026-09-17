/* ==========================================================================
   中盾数智 · 首页动效引擎
   --------------------------------------------------------------------------
   无依赖。单个 requestAnimationFrame 循环驱动两套 canvas：
     1) #fxGrid  首屏粒子网格 + 神经网络光线（含鼠标引力涟漪）
     2) #fxRobot 全息人形机器人线框（Y 轴自转 / 数据流管线 / 扫描光效）

   性能与稳健性约束（重要）：
     - 设备像素比上限 2，避免 3x 屏上无谓的 4 倍绘制量
     - 粒子数按视口面积动态计算，移动端进一步压到 40
     - 页面隐藏、首屏滚出视口、窗口不可见时整个循环停车，不空转
     - 粒子用「位移 + 位置弹簧」而非累积速度，数学上不可能发散
     - prefers-reduced-motion 时不启动任何动画
   ========================================================================== */
(function () {
  "use strict";

  var grid = document.getElementById("fxGrid");
  var robot = document.getElementById("fxRobot");
  var hero = document.querySelector(".hero");
  var nav = document.querySelector(".nav");

  /* ---------------- 导航：滚动后转半透明磨砂 ---------------- */
  if (nav) {
    var onScroll = function () {
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      nav.classList.toggle("is-scrolled", y > 24);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  if (!grid && !robot) return;

  var html = document.documentElement;
  var reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var supportsCanvas = (function () {
    try {
      return !!document.createElement("canvas").getContext("2d");
    } catch (e) {
      return false;
    }
  })();

  if (!supportsCanvas) {
    html.classList.add("no-canvas");
    return;
  }

  /* ======================================================================
     通用
     ====================================================================== */

  function ctx2d(canvas) {
    if (!canvas) return null;
    return canvas.getContext("2d", { alpha: true });
  }

  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  function fit(canvas, ctx, host) {
    var r = host.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width));
    var h = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(w * DPR);
    canvas.height = Math.round(h * DPR);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    return { w: w, h: h };
  }

  /* ======================================================================
     一、粒子网格 + 神经网络光线
     ====================================================================== */

  function Field(canvas) {
    var ctx = ctx2d(canvas);
    if (!ctx) return null;

    var W = 0,
      H = 0,
      parts = [];
    var LINK = 138, LINK2 = LINK * LINK;
    var REACH = 172, REACH2 = REACH * REACH;
    var mouse = { x: -9999, y: -9999, on: false };
    var b0 = [], b1 = [], b2 = [], b3 = [], bc = [];

    // 光标辉光贴图：预渲染一次，之后只做 drawImage，避免每帧建渐变
    var glow = (function () {
      var c = document.createElement("canvas");
      c.width = c.height = 64;
      var g = c.getContext("2d");
      var rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      rg.addColorStop(0, "rgba(34,211,238,0.55)");
      rg.addColorStop(0.45, "rgba(34,211,238,0.16)");
      rg.addColorStop(1, "rgba(34,211,238,0)");
      g.fillStyle = rg;
      g.fillRect(0, 0, 64, 64);
      return c;
    })();

    function build() {
      // 每 ~13500 平方像素一个粒子；桌面约 75 个，移动端压到 46 以内。
      // 上限是为了让成对距离检测始终停留在几千次量级，不拖帧。
      var n = Math.round((W * H) / 13500);
      n = Math.max(38, Math.min(96, n));
      if (W < 760) n = Math.min(n, 46);
      parts = [];
      for (var i = 0; i < n; i++) {
        var x = Math.random() * W,
          y = Math.random() * H;
        parts.push({
          x: x,
          y: y,
          hx: x,
          hy: y,
          vx: (Math.random() - 0.5) * 0.16,
          vy: (Math.random() - 0.5) * 0.16,
          r: Math.random() * 1.05 + 0.72,
          tw: Math.random() * Math.PI * 2,
          tws: 0.6 + Math.random() * 0.9
        });
      }
    }

    function resize() {
      var s = fit(canvas, ctx, canvas.parentNode);
      W = s.w;
      H = s.h;
      build();
    }

    function draw(t) {
      ctx.clearRect(0, 0, W, H);

      var i, p, j, q, dx, dy, d2, d;

      // --- 更新 ---
      for (i = 0; i < parts.length; i++) {
        p = parts[i];

        // 归位点缓慢漂移，边界反弹，保证长期分布均匀
        p.hx += p.vx;
        p.hy += p.vy;
        if (p.hx < 0) {
          p.hx = 0;
          p.vx = Math.abs(p.vx);
        } else if (p.hx > W) {
          p.hx = W;
          p.vx = -Math.abs(p.vx);
        }
        if (p.hy < 0) {
          p.hy = 0;
          p.vy = Math.abs(p.vy);
        } else if (p.hy > H) {
          p.hy = H;
          p.vy = -Math.abs(p.vy);
        }

        // 光标引力：直接给位移，不累积速度 —— 上限约 13px，松手即回
        p.near *= 0.9;
        if (mouse.on) {
          dx = mouse.x - p.x;
          dy = mouse.y - p.y;
          d2 = dx * dx + dy * dy;
          if (d2 < REACH2 && d2 > 1) {
            d = Math.sqrt(d2);
            var f = (1 - d / REACH) * 0.9;
            p.x += (dx / d) * f;
            p.y += (dy / d) * f;
            p.near = Math.max(p.near, 1 - d / REACH);
          }
        }

        // 位置弹簧回位
        p.x += (p.hx - p.x) * 0.07;
        p.y += (p.hy - p.y) * 0.07;
      }

      // --- 连线：按距离分桶，四桶四次描边，避免逐条 beginPath ---
      b0.length = b1.length = b2.length = b3.length = bc.length = 0;
      for (i = 0; i < parts.length; i++) {
        p = parts[i];
        for (j = i + 1; j < parts.length; j++) {
          q = parts[j];
          dx = p.x - q.x;
          if (dx > LINK || dx < -LINK) continue;
          dy = p.y - q.y;
          if (dy > LINK || dy < -LINK) continue;
          d2 = dx * dx + dy * dy;
          if (d2 > LINK2) continue;
          d = Math.sqrt(d2);
          // 扁平 push 四个数，与 stroke() 的读取方式一致；
          // 避免每帧新建几百个小数组造成 GC 抖动
          if (d < 46) b0.push(p.x, p.y, q.x, q.y);
          else if (d < 84) b1.push(p.x, p.y, q.x, q.y);
          else if (d < 114) b2.push(p.x, p.y, q.x, q.y);
          else b3.push(p.x, p.y, q.x, q.y);
        }
      }

      // 光标到近邻的青色连线
      if (mouse.on) {
        for (i = 0; i < parts.length; i++) {
          p = parts[i];
          dx = p.x - mouse.x;
          dy = p.y - mouse.y;
          d2 = dx * dx + dy * dy;
          if (d2 < 20000) bc.push(mouse.x, mouse.y, p.x, p.y);
        }
      }

      stroke(b3, "rgba(148,163,184,0.06)", 0.8);
      stroke(b2, "rgba(148,163,184,0.11)", 0.8);
      stroke(b1, "rgba(103,232,249,0.19)", 0.9);
      stroke(b0, "rgba(34,211,238,0.3)", 1);
      stroke(bc, "rgba(34,211,238,0.2)", 1);

      // --- 光标辉光 ---
      if (mouse.on) {
        ctx.globalAlpha = 0.7;
        ctx.drawImage(glow, mouse.x - 130, mouse.y - 130, 260, 260);
        ctx.globalAlpha = 1;
      }

      // --- 粒子本体：远的一遍、近的两遍 ---
      ctx.fillStyle = "rgba(203,213,225,0.46)";
      ctx.beginPath();
      for (i = 0; i < parts.length; i++) {
        p = parts[i];
        var a = 0.5 + 0.5 * Math.sin(t * 0.0011 * p.tws + p.tw);
        var r = p.r * (0.72 + 0.5 * a);
        ctx.moveTo(p.x + r, p.y);
        ctx.arc(p.x, p.y, r, 0, 6.2832);
      }
      ctx.fill();

      ctx.fillStyle = "rgba(34,211,238,0.85)";
      ctx.beginPath();
      for (i = 0; i < parts.length; i++) {
        p = parts[i];
        if (p.near < 0.04) continue;
        var rr = p.r + p.near * 1.5;
        ctx.moveTo(p.x + rr, p.y);
        ctx.arc(p.x, p.y, rr, 0, 6.2832);
      }
      ctx.fill();
    }

    function stroke(arr, color, width) {
      if (!arr.length) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (var i = 0; i < arr.length; i += 4) {
        ctx.moveTo(arr[i], arr[i + 1]);
        ctx.lineTo(arr[i + 2], arr[i + 3]);
      }
      ctx.stroke();
    }

    resize();

    return {
      resize: resize,
      draw: draw,
      setMouse: function (x, y, on) {
        mouse.x = x;
        mouse.y = y;
        mouse.on = on;
      }
    };
  }

  /* ======================================================================
     二、全息人形机器人线框
     ====================================================================== */

  function Robot(canvas) {
    var ctx = ctx2d(canvas);
    if (!ctx) return null;

    var W = 0,
      H = 0;

    /* ---- 用长方体拼装本体：工业感强于棍状骨架 ---- */
    var MODEL = [
      [0, 118, 0, 44, 52, 44], // 头
      [0, 121, 23, 30, 7, 4], // 面罩
      [0, 86, 0, 18, 14, 18], // 颈
      [0, 58, 0, 76, 58, 42], // 胸腔
      [0, 60, 22, 52, 34, 4], // 胸甲
      [0, 14, 0, 58, 32, 34], // 腹
      [0, -12, 0, 68, 22, 36], // 骨盆
      [-58, 60, 0, 26, 20, 26], // 左肩
      [-62, 26, 0, 19, 56, 21], // 左上臂
      [-66, -30, 0, 16, 52, 18], // 左小臂
      [-68, -66, 0, 15, 16, 15], // 左手
      [-22, -52, 0, 23, 56, 25], // 左大腿
      [-22, -114, 0, 20, 58, 22], // 左小腿
      [-22, -152, 9, 21, 14, 40] // 左脚
    ];

    var V = [], E = [];

    function box(cx, cy, cz, w, h, d) {
      var x0 = cx - w / 2,
        x1 = cx + w / 2,
        y0 = cy - h / 2,
        y1 = cy + h / 2,
        z0 = cz - d / 2,
        z1 = cz + d / 2,
        base = V.length;
      V.push(
        [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
        [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]
      );
      var L = [[0, 1], [1, 2], [2, 3], [3, 0]];
      var T = [[4, 5], [5, 6], [6, 7], [7, 4]];
      var S = [[0, 4], [1, 5], [2, 6], [3, 7]];
      var k;
      for (k = 0; k < 4; k++) E.push([base + L[k][0], base + L[k][1]]);
      for (k = 0; k < 4; k++) E.push([base + T[k][0], base + T[k][1]]);
      for (k = 0; k < 4; k++) E.push([base + S[k][0], base + S[k][1]]);
    }

    (function buildModel() {
      var i;
      for (i = 0; i < MODEL.length; i++) box.apply(null, MODEL[i]);
      // 右半侧镜像
      for (i = 0; i < MODEL.length; i++) {
        var b = MODEL[i];
        if (b[0] < 0) box(-b[0], b[1], b[2], b[3], b[4], b[5]);
      }
      // 胸口核心（八面体）
      var cy = 58, r = 11, bx = V.length;
      V.push([0, cy + r, 0], [0, cy - r, 0], [r, cy, 0], [-r, cy, 0], [0, cy, r], [0, cy, -r]);
      E.push([bx, bx + 2], [bx + 2, bx + 1], [bx + 1, bx + 3], [bx + 3, bx],
        [bx, bx + 4], [bx + 2, bx + 4], [bx + 1, bx + 4], [bx + 3, bx + 4],
        [bx, bx + 5], [bx + 2, bx + 5], [bx + 1, bx + 5], [bx + 3, bx + 5]);
    })();

    var VN = V.length,
      EN = E.length;

    // 数据流管线：挑若干条边让光点持续流过
    var PIPE = [];
    (function pickPipes() {
      var want = Math.min(9, EN);
      var step = Math.floor(EN / want);
      for (var i = 0; i < want; i++) {
        PIPE.push({
          e: (i * step + 5) % EN,
          ph: (i * 0.37) % 1,
          sp: 0.1 + (i % 3) * 0.045
        });
      }
    })();

    var P = []; // 每帧投影结果
    var scale = 1,
      cx = 0,
      cyc = 0;
    var scanY = 0;

    function resize() {
      var s = fit(canvas, ctx, canvas.parentNode);
      W = s.w;
      H = s.h;
      // 0.76：上下各留呼吸位，上方避开状态行、下方避开读数行与底座环
      scale = (H * 0.76) / 303;
      cx = W / 2;
      cyc = H * 0.5 - 16;
    }

    /* 环：XZ 平面圆，用于底座与全息扫描环。
       单位圆的 cos/sin 预计算一次，每帧只做乘法与投影，不再反复建数组。 */
    var RING_COS = [],
      RING_SIN = [];
    (function () {
      for (var i = 0; i <= 44; i++) {
        var a = (i / 44) * 6.2832;
        RING_COS.push(Math.cos(a));
        RING_SIN.push(Math.sin(a));
      }
    })();

    function ring(y, radius, color, width) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (var i = 0; i < RING_COS.length; i++) {
        project(RING_COS[i] * radius, y, RING_SIN[i] * radius);
        if (i === 0) ctx.moveTo(TMP[0], TMP[1]);
        else ctx.lineTo(TMP[0], TMP[1]);
      }
      ctx.stroke();
    }

    var TMP = [0, 0];
    var tiltX = 0;

    function project(x, y, z) {
      // 绕 Y 轴
      var rx = x * COS + z * SIN;
      var rz = -x * SIN + z * COS;
      // 绕 X 轴轻微俯仰（跟随光标）
      var ry = y * CTX - rz * STX;
      var rz2 = y * STX + rz * CTX;
      // 镜头偏长焦（f=780）：z 深度带来的缩放差异约 20%，
      // 头肩不会被广角拉变形，同时底座圆环还能保留一点椭圆开度。
      var f = 780;
      var s = (f / (f + rz2)) * scale;
      TMP[0] = cx + rx * s;
      TMP[1] = cyc - ry * s;
      TMP[2] = rz2;
      TMP[3] = s;
    }

    var COS = 1, SIN = 0, CTX = 1, STX = 0;

    var fb0 = [], fb1 = [], fb2 = [], fhi = [];

    function draw(t) {
      ctx.clearRect(0, 0, W, H);

      // 转台式往复，而非 360° 整圈自转。
      // 原因：转到 60° 以上时，手臂在投影里会完全落进躯干轮廓内，
      // 人形会塌成一根柱子。收在 8°~52° 之间缓慢往复，
      // 任何一帧都是可读的正面到四分之三视角，观感仍是持续转动。
      var ang = reduceMotion ? 0.52 : 0.52 + Math.sin(t * 0.0003) * 0.38;
      COS = Math.cos(ang);
      SIN = Math.sin(ang);
      CTX = Math.cos(tiltX);
      STX = Math.sin(tiltX);

      // 全息扫描：一条水平光环自下而上循环
      var prog = reduceMotion ? 0.62 : (t * 0.000055) % 1;
      var ringModelY = -168 + prog * 336;
      var bandAlpha = Math.sin(prog * Math.PI);

      // ---- 底座环 ----
      ctx.globalAlpha = 0.55;
      ring(-160, 74, "rgba(34,211,238,0.22)", 1);
      ctx.globalAlpha = 0.4;
      ring(-160, 54, "rgba(34,211,238,0.14)", 1);
      ctx.globalAlpha = 1;

      // ---- 投影全部顶点 ----
      var i;
      for (i = 0; i < VN; i++) {
        var v = V[i];
        project(v[0], v[1], v[2]);
        P[i] = [TMP[0], TMP[1], TMP[2]];
      }

      // 扫描环在屏幕上的高度
      project(0, ringModelY, 0);
      scanY = TMP[1];

      // ---- 按深度分桶，顺带挑出落在扫描带里的边 ----
      fb0.length = fb1.length = fb2.length = fhi.length = 0;
      for (i = 0; i < EN; i++) {
        var e = E[i];
        var a = P[e[0]],
          b = P[e[1]];
        if (!a || !b) continue;
        var z = (a[2] + b[2]) * 0.5;
        var my = (a[1] + b[1]) * 0.5;
        // 四个数字扁平入库，与 strokeEdges 的读取方式一致；
        // 顺带免掉每帧新建几百个小数组带来的 GC 抖动
        var dst =
          bandAlpha > 0.25 && Math.abs(my - scanY) < 22
            ? fhi
            : z < -14
            ? fb2
            : z < 14
            ? fb1
            : fb0;
        dst.push(a[0], a[1], b[0], b[1]);
      }

      function strokeEdges(arr, color, width) {
        if (!arr.length) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        for (var k = 0; k < arr.length; k += 4) {
          ctx.moveTo(arr[k], arr[k + 1]);
          ctx.lineTo(arr[k + 2], arr[k + 3]);
        }
        ctx.stroke();
      }

      // 近端再做一次粗描边当辉光，比 shadowBlur 便宜得多
      strokeEdges(fb2, "rgba(34,211,238,0.09)", 3.4);

      strokeEdges(fb0, "rgba(34,211,238,0.26)", 0.9);
      strokeEdges(fb1, "rgba(34,211,238,0.44)", 1);
      strokeEdges(fb2, "rgba(125,232,249,0.62)", 1.15);
      strokeEdges(fhi, "rgba(186,247,255,0.9)", 1.35);

      // ---- 扫描光环 ----
      if (bandAlpha > 0.02) {
        ctx.globalAlpha = bandAlpha * 0.5;
        ring(ringModelY, 76, "rgba(125,232,249,0.85)", 1.4);
        // 光幕：一条极淡的竖向渐变带，让扫描有体积
        ctx.globalAlpha = bandAlpha * 0.1;
        ctx.fillStyle = "rgba(34,211,238,1)";
        ctx.fillRect(0, scanY - 1, W, 2);
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = 1;
      }

      // ---- 数据流管线 ----
      for (i = 0; i < PIPE.length; i++) {
        var pp = PIPE[i];
        var ed = E[pp.e];
        if (!ed) continue;
        var pa = P[ed[0]],
          pb = P[ed[1]];
        if (!pa || !pb) continue;
        var head = reduceMotion ? 0.5 : (t * 0.00006 * pp.sp * 10 + pp.ph) % 1;
        for (var k = 0; k < 4; k++) {
          var tt = head - k * 0.05;
          if (tt < 0) tt += 1;
          var hx = pa[0] + (pb[0] - pa[0]) * tt;
          var hy = pa[1] + (pb[1] - pa[1]) * tt;
          ctx.fillStyle = "rgba(186,247,255," + (0.9 - k * 0.22).toFixed(2) + ")";
          ctx.beginPath();
          ctx.arc(hx, hy, 1.7 - k * 0.32, 0, 6.2832);
          ctx.fill();
        }
      }

      // ---- 胸口核心脉冲 ----
      var coreI = findCore();
      if (coreI >= 0) {
        var c = P[coreI];
        if (c) {
          var pulse = reduceMotion
            ? 0.6
            : 0.5 + 0.5 * Math.sin(t * 0.0018);
          ctx.fillStyle = "rgba(34,211,238," + (0.28 + pulse * 0.45).toFixed(2) + ")";
          ctx.beginPath();
          ctx.arc(c[0], c[1], 3 + pulse * 2.4, 0, 6.2832);
          ctx.fill();
        }
      }
    }

    var coreIdx = -1;

    function findCore() {
      if (coreIdx >= 0) return coreIdx;
      // 八面体上顶点在建模时的下标
      coreIdx = VN - 6;
      return coreIdx;
    }

    resize();
    findCore();

    return {
      resize: resize,
      draw: draw,
      tilt: function (v) {
        tiltX = v;
      }
    };
  }

  /* ======================================================================
     三、装配与循环控制
     ====================================================================== */

  var field = Field(grid);
  var holo = Robot(robot);
  var running = false,
    rafId = null;

  function frame(t) {
    if (field) field.draw(t);
    if (holo) holo.draw(t);
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduceMotion) return;
    running = true;
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // 首屏可见性：滚出视口就停车
  if ("IntersectionObserver" in window && hero) {
    new IntersectionObserver(
      function (entries) {
        if (entries[0].isIntersecting) start();
        else stop();
      },
      { threshold: 0.01 }
    ).observe(hero);
  } else {
    start();
  }

  // 切到后台标签页或最小化时停车
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else start();
  });

  window.addEventListener("pagehide", stop);
  window.addEventListener("pageshow", start);

  /* ---------------- 指针：引力涟漪 + 全息舱微倾角 ---------------- */
  var holoBox = null;

  function refreshHoloBox() {
    holoBox = robot ? robot.parentNode.getBoundingClientRect() : null;
  }

  if (hero && !reduceMotion) {
    var py = 0,
      queued = false;

    hero.addEventListener(
      "pointermove",
      function (e) {
        var r = hero.getBoundingClientRect();
        var x = e.clientX - r.left;
        var y = e.clientY - r.top;

        if (field) field.setMouse(x, y, true);

        // 只在指针靠近全息舱时才计算倾角，省掉无谓的 getBoundingClientRect
        if (holo && holoBox) {
          if (
            e.clientX > holoBox.left - 120 &&
            e.clientX < holoBox.right + 120 &&
            e.clientY > holoBox.top - 120 &&
            e.clientY < holoBox.bottom + 120
          ) {
            var hx = (e.clientX - holoBox.left) / holoBox.width - 0.5;
            holo.tilt(Math.max(-0.2, Math.min(0.2, -hx * 0.34)));
          } else {
            holo.tilt(0);
          }
        }
      },
      { passive: true }
    );

    hero.addEventListener(
      "pointerleave",
      function () {
        if (field) field.setMouse(-9999, -9999, false);
        if (holo) holo.tilt(0);
      },
      { passive: true }
    );

    // 触屏设备：不追踪光标，避免无谓重绘
    refreshHoloBox();
  }

  /* ---------------- 尺寸变化 ---------------- */
  var rt = null;
  function onResize() {
    if (rt) clearTimeout(rt);
    rt = setTimeout(function () {
      if (field) field.resize();
      if (holo) holo.resize();
      refreshHoloBox();
      if (reduceMotion) {
        // 静态模式下画布被重置，需要补画一帧，否则会是空白
        if (field) field.draw(4000);
        if (holo) holo.draw(4000);
      } else if (!running) {
        start();
      }
    }, 180);
  }

  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

  /* ---------------- 启动 ----------------
     reduced-motion 下不跑循环，但静态外观由 CSS 完整保留。 */
  if (reduceMotion) {
    if (field) field.draw(4000);
    if (holo) holo.draw(4000);
  } else {
    start();
  }
})();
