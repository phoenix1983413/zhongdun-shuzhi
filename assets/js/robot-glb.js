/* ==========================================================================
   中盾数智 · 首页 3D 机器人加载器
   --------------------------------------------------------------------------
   用 Three.js + GLTFLoader 替换原有 canvas 2D 线框机器人
   ========================================================================== */
(function () {
  "use strict";

  var container = document.getElementById("robot3d");
  if (!container) container = document.getElementById("fxRobot");
  if (!container) return;

  // 如果设备不支持 WebGL，静默失败，不影响其余动效
  var testCanvas = document.createElement("canvas");
  var gl = testCanvas.getContext("webgl") || testCanvas.getContext("experimental-webgl");
  if (!gl) {
    container.style.display = "none";
    return;
  }

  // Three.js r125（examples/js/ 非 ESM 加载器稳定可用）
  var SCRIPT = "https://cdn.jsdelivr.net/npm/three@0.125.0/build/three.min.js";
  var LOADER = "https://cdn.jsdelivr.net/npm/three@0.125.0/examples/js/loaders/GLTFLoader.js";

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = url;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // 顺序加载：先 THREE，再 GLTFLoader（后者依赖前者挂到全局）
  loadScript(SCRIPT).then(function () {
    return loadScript(LOADER);
  }).then(function () {
    initRobot();
  }).catch(function (err) {
    console.warn("[RobotGLB] Three.js 加载失败，回退到 canvas 2D:", err);
    // 不隐藏容器，让 hero-tech.js 继续用 2D 绘制
  });

  function initRobot() {
    // 标记 3D 已加载，CSS 会隐藏 #fxRobot
    var holoContainer = container.closest(".hero__visual");
    if (holoContainer) holoContainer.classList.add("robot-glb-loaded");

    // ---- 场景 ----
    var scene = new THREE.Scene();

    // 相机：透视，略俯视，确保模型完整居中
    var camera = new THREE.PerspectiveCamera(45, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 1000);
    camera.position.set(0, -1.0, 5.5); // 相机降到模型下方
    camera.lookAt(0, 0.5, 0); // 往上看，模型在画面中更靠下

    // 渲染器：透明背景，与深色背景融合
    var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);

    // 灯光 - 增强科技感
    var ambient = new THREE.AmbientLight(0x404060, 0.8);
    scene.add(ambient);

    var key = new THREE.DirectionalLight(0x22d3ee, 2.2);
    key.position.set(3, 5, 5);
    scene.add(key);

    var fill = new THREE.DirectionalLight(0x0066cc, 1.2);
    fill.position.set(-4, 2, -2);
    scene.add(fill);

    var rim = new THREE.DirectionalLight(0xffffff, 0.6);
    rim.position.set(0, 1, -3);
    scene.add(rim);

    // 底部补光：增强全息底座光晕
    var bottomLight = new THREE.PointLight(0x22d3ee, 1.5, 6);
    bottomLight.position.set(0, -4.5, 0); // 跟随模型下沉
    scene.add(bottomLight);

    // ---- 地面反射光圈（装饰）----
    var ringGeo = new THREE.RingGeometry(0.9, 1.0, 64);
    var ringMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
    var ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -4.0; // 模型底部下方
    scene.add(ring);

    // ---- 全息扫描环（增强版：多层光效 + 动态光点）----
    // 主扫描环 - 更粗更亮
    var scanRingGeo = new THREE.TorusGeometry(1.35, 0.025, 8, 80);
    var scanRingMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0 });
    var scanRing = new THREE.Mesh(scanRingGeo, scanRingMat);
    scanRing.rotation.x = Math.PI / 2;
    scene.add(scanRing);

    // 副扫描环 - 更大更淡，营造扩散感
    var scanRing2Geo = new THREE.TorusGeometry(1.55, 0.012, 8, 80);
    var scanRing2Mat = new THREE.MeshBasicMaterial({ color: 0x00aaff, transparent: true, opacity: 0 });
    var scanRing2 = new THREE.Mesh(scanRing2Geo, scanRing2Mat);
    scanRing2.rotation.x = Math.PI / 2;
    scene.add(scanRing2);

    // 扫描光点 - 跟随扫描环移动的高亮粒子
    var scanDotGeo = new THREE.SphereGeometry(0.04, 8, 8);
    var scanDotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    var scanDot = new THREE.Mesh(scanDotGeo, scanDotMat);
    scene.add(scanDot);

    // 垂直数据流线 - 增强科技感
    var dataLinesGroup = new THREE.Group();
    var lineCount = 6;
    for (var i = 0; i < lineCount; i++) {
      var angle = (i / lineCount) * Math.PI * 2;
      var lineGeo = new THREE.CylinderGeometry(0.003, 0.003, 3.5, 4);
      var lineMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.15 });
      var line = new THREE.Mesh(lineGeo, lineMat);
      line.position.x = Math.cos(angle) * 1.4;
      line.position.z = Math.sin(angle) * 1.4;
      line.position.y = 0.5;
      dataLinesGroup.add(line);
    }
    scene.add(dataLinesGroup);

    // ---- 加载 GLB ----
    var loader = new THREE.GLTFLoader();
    var modelUrl = "assets/models/robot-3d.glb";

    loader.load(
      modelUrl,
      function (gltf) {
        var model = gltf.scene;

        // 自动缩放：把模型高度归一到约 3.2 单位（比原来大 1/3）
        var box = new THREE.Box3().setFromObject(model);
        var size = box.getSize(new THREE.Vector3());
        var maxDim = Math.max(size.x, size.y, size.z);
        var targetHeight = 3.2;
        var scale = maxDim > 0 ? targetHeight / maxDim : 1;
        model.scale.setScalar(scale);

        // 居中：底部对齐到 y=-3.5，整体大幅下沉
        box.setFromObject(model);
        var center = box.getCenter(new THREE.Vector3());
        model.position.x = -center.x;
        model.position.z = -center.z;
        model.position.y = -box.min.y - 3.5; // 底部对齐后再下沉 3.5 单位

        scene.add(model);

        // 入场动画：从略下方浮起到最终位置
        var finalY = model.position.y; // 记录最终位置
        model.position.y -= 0.3;
        model.scale.setScalar(scale * 0.95);
        animateIn(model, scale, finalY);
      },
      function (xhr) {
        if (xhr.lengthComputable) {
          var pct = Math.round((xhr.loaded / xhr.total) * 100);
          console.log("[RobotGLB] 加载进度:", pct + "%");
        }
      },
      function (err) {
        console.error("[RobotGLB] 加载失败:", err);
      }
    );

    var modelRef = null;
    var targetScale = 1;
    var targetY = 0;
    var animatingIn = true;

    function animateIn(model, finalScale, finalY) {
      modelRef = model;
      targetScale = finalScale;
      targetY = finalY;
      animatingIn = true;
    }

    // ---- 渲染循环 ----
    function render() {
      requestAnimationFrame(render);

      if (modelRef) {
        // 入场缓动 - 回到加载后的最终位置
        if (animatingIn) {
          modelRef.position.y += (targetY - modelRef.position.y) * 0.06;
          var s = modelRef.scale.x;
          var ns = s + (targetScale - s) * 0.06;
          modelRef.scale.setScalar(ns);
          if (Math.abs(modelRef.position.y - targetY) < 0.001 && Math.abs(ns - targetScale) < 0.001) {
            animatingIn = false;
          }
        }

        // 缓慢自转
        modelRef.rotation.y += 0.004;
      }

      // ---- 全息扫描环动画（增强版 + 呼吸光效）----
      var scanProg = (Date.now() * 0.00006) % 1; // 加快扫描速度
      var scanY = -3.5 + scanProg * 3.5; // 从模型底部(-3.5)扫到顶部(0)
      
      // 主扫描环：更亮更明显
      var mainAlpha = Math.sin(scanProg * Math.PI) * 0.7;
      scanRing.position.y = scanY;
      scanRing.material.opacity = mainAlpha;
      scanRing.scale.setScalar(1 + Math.sin(scanProg * Math.PI) * 0.08); // 扫描时微微膨胀

      // 副扫描环：延迟扩散
      var scanProg2 = ((Date.now() * 0.00006 - 0.05) % 1);
      if (scanProg2 < 0) scanProg2 += 1;
      var scanY2 = -3.5 + scanProg2 * 3.5; // 同步调整范围
      var ring2Alpha = Math.sin(scanProg2 * Math.PI) * 0.3;
      scanRing2.position.y = scanY2;
      scanRing2.material.opacity = ring2Alpha;
      scanRing2.scale.setScalar(1 + Math.sin(scanProg2 * Math.PI) * 0.12);

      // 扫描光点：高亮白点，增强科技感
      scanDot.position.y = scanY;
      scanDot.material.opacity = mainAlpha;

      // 垂直数据流线：整体透明度随扫描节奏呼吸
      var breathe = (Math.sin(Date.now() * 0.001) + 1) * 0.5; // 0~1
      dataLinesGroup.children.forEach(function (line) {
        line.material.opacity = 0.08 + breathe * 0.12;
      });

      // 底部补光强度随扫描变化
      bottomLight.intensity = 1.2 + Math.sin(scanProg * Math.PI) * 0.8;

      // 环境光呼吸效果 - 增强整体光影动态感
      var ambientBreathe = 0.6 + Math.sin(Date.now() * 0.0008) * 0.2; // 0.4~0.8
      ambient.intensity = ambientBreathe;

      // 主光源强度随扫描微调 - 增强科技感
      key.intensity = 1.8 + Math.sin(scanProg * Math.PI) * 0.6;

      renderer.render(scene, camera);
    }
    render();

    // ---- 响应式 ----
    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        var w = container.clientWidth;
        var h = Math.max(1, container.clientHeight);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }, 180);
    });
  }
})();
