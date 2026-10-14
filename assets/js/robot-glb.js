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

  // ---- Three.js CDN（动态加载，避免阻塞首屏）----
  var SCRIPT = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js";
  var LOADER = "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/js/loaders/GLTFLoader.js";

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = url;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  Promise.all([loadScript(SCRIPT), loadScript(LOADER)]).then(function () {
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

    // 相机：透视，略俯视
    var camera = new THREE.PerspectiveCamera(45, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 1000);
    camera.position.set(0, 1.2, 4.5);
    camera.lookAt(0, 0.5, 0);

    // 渲染器：透明背景，与深色背景融合
    var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // ---- 灯光 ----
    var ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    var key = new THREE.DirectionalLight(0x22d3ee, 1.8);
    key.position.set(3, 5, 5);
    scene.add(key);

    var fill = new THREE.DirectionalLight(0x0066cc, 0.9);
    fill.position.set(-4, 2, -2);
    scene.add(fill);

    var rim = new THREE.DirectionalLight(0xffffff, 0.4);
    rim.position.set(0, 1, -3);
    scene.add(rim);

    // ---- 地面反射光圈（装饰）----
    var ringGeo = new THREE.RingGeometry(0.9, 1.0, 64);
    var ringMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
    var ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -1.2;
    scene.add(ring);

    // ---- 加载 GLB ----
    var loader = new THREE.GLTFLoader();
    var modelUrl = "assets/models/robot-3d.glb";

    loader.load(
      modelUrl,
      function (gltf) {
        var model = gltf.scene;

        // 自动缩放：把模型高度归一到约 2.4 单位
        var box = new THREE.Box3().setFromObject(model);
        var size = box.getSize(new THREE.Vector3());
        var maxDim = Math.max(size.x, size.y, size.z);
        var targetHeight = 2.4;
        var scale = maxDim > 0 ? targetHeight / maxDim : 1;
        model.scale.setScalar(scale);

        // 居中：底部对齐到 y=0
        box.setFromObject(model);
        var center = box.getCenter(new THREE.Vector3());
        model.position.x = -center.x;
        model.position.z = -center.z;
        model.position.y = -box.min.y;

        scene.add(model);

        // 入场动画：从略下方浮起
        model.position.y -= 0.3;
        model.scale.setScalar(scale * 0.95);
        animateIn(model, scale);
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
    var animatingIn = true;

    function animateIn(model, finalScale) {
      modelRef = model;
      targetScale = finalScale;
      animatingIn = true;
    }

    // ---- 渲染循环 ----
    function render() {
      requestAnimationFrame(render);

      if (modelRef) {
        // 入场缓动
        if (animatingIn) {
          modelRef.position.y += (0 - modelRef.position.y) * 0.06;
          var s = modelRef.scale.x;
          var ns = s + (targetScale - s) * 0.06;
          modelRef.scale.setScalar(ns);
          if (Math.abs(modelRef.position.y) < 0.001 && Math.abs(ns - targetScale) < 0.001) {
            animatingIn = false;
          }
        }

        // 缓慢自转
        modelRef.rotation.y += 0.004;
      }

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
