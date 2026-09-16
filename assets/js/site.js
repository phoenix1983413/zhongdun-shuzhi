/* ==========================================================================
   中盾数智 · 官网交互
   无依赖，渐进增强：即使脚本失效，内容与导航依然可读可用。
   ========================================================================== */
(function () {
  "use strict";

  var onReady = function (fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  };

  onReady(function () {
    /* ---------------- 移动端导航抽屉 ---------------- */
    var toggle = document.querySelector(".nav__toggle");
    var drawer = document.getElementById("navDrawer");

    if (toggle && drawer) {
      var setOpen = function (open) {
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        drawer.classList.toggle("is-open", open);
        toggle.setAttribute(
          "aria-label",
          open ? "关闭导航菜单" : "打开导航菜单"
        );
      };

      toggle.addEventListener("click", function () {
        setOpen(toggle.getAttribute("aria-expanded") !== "true");
      });

      // 点击抽屉内链接后收起
      drawer.addEventListener("click", function (e) {
        if (e.target.closest("a")) setOpen(false);
      });

      // Esc 关闭
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") setOpen(false);
      });

      // 回到桌面宽度时复位
      var mq = window.matchMedia("(min-width: 821px)");
      var onMq = function (ev) {
        if (ev.matches) setOpen(false);
      };
      if (mq.addEventListener) mq.addEventListener("change", onMq);
      else if (mq.addListener) mq.addListener(onMq);
    }

    /* ---------------- 滚动出现动画 ---------------- */
    var reveals = document.querySelectorAll(".reveal");
    var reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reveals.length) {
      if (reduce || !("IntersectionObserver" in window)) {
        Array.prototype.forEach.call(reveals, function (el) {
          el.classList.add("is-in");
        });
      } else {
        var io = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) {
                entry.target.classList.add("is-in");
                io.unobserve(entry.target);
              }
            });
          },
          { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
        );
        Array.prototype.forEach.call(reveals, function (el) {
          io.observe(el);
        });
      }
    }

    /* ---------------- 新闻分类筛选 ---------------- */
    var filterWrap = document.querySelector("[data-filters]");
    if (filterWrap) {
      var items = document.querySelectorAll("[data-news-item]");
      var empty = document.getElementById("newsEmpty");

      filterWrap.addEventListener("click", function (e) {
        var btn = e.target.closest(".filter-btn");
        if (!btn) return;

        var cat = btn.getAttribute("data-filter");

        Array.prototype.forEach.call(
          filterWrap.querySelectorAll(".filter-btn"),
          function (b) {
            b.setAttribute(
              "aria-pressed",
              b === btn ? "true" : "false"
            );
          }
        );

        var shown = 0;
        Array.prototype.forEach.call(items, function (item) {
          var match = cat === "all" || item.getAttribute("data-cat") === cat;
          item.hidden = !match;
          if (match) shown++;
        });

        if (empty) empty.hidden = shown !== 0;
      });
    }

    /* ---------------- 联系表单（静态站：本地校验 + 邮件兜底） ---------------- */
    var form = document.getElementById("contactForm");
    if (form) {
      var status = document.getElementById("formStatus");

      form.addEventListener("submit", function (e) {
        e.preventDefault();

        var name = (form.elements.name.value || "").trim();
        var org = (form.elements.org.value || "").trim();
        var contact = (form.elements.contact.value || "").trim();
        var intent = (form.elements.intent.value || "").trim();
        var message = (form.elements.message.value || "").trim();

        if (!name || !contact || !message) {
          showStatus(
            "请把「称呼」「联系方式」和「需求描述」填写完整，我们再联系您。",
            false
          );
          return;
        }

        // 静态站点没有后端：把内容整理成一封邮件，交给访客本地邮件客户端发送。
        // 若已接入表单服务（如 Formspree），把下方 action 换成服务端点即可。
        var to = form.getAttribute("data-mailto") || "";
        var body =
          "称呼：" + name + "\n" +
          "单位：" + (org || "—") + "\n" +
          "联系方式：" + contact + "\n" +
          "合作方向：" + (intent || "—") + "\n\n" +
          "需求描述：\n" + message + "\n";

        var href =
          "mailto:" + to +
          "?subject=" + encodeURIComponent("【官网咨询】" + (intent || "业务合作")) +
          "&body=" + encodeURIComponent(body);

        showStatus(
          "已为您生成邮件草稿，正在唤起本机邮件客户端……若未自动打开，请直接发送至 " +
            to + "。",
          true
        );

        window.setTimeout(function () {
          window.location.href = href;
        }, 600);
      });

      form.addEventListener("reset", function () {
        if (status) status.classList.remove("is-shown");
      });

      function showStatus(text, ok) {
        if (!status) return;
        status.textContent = text;
        status.classList.add("is-shown");
        status.classList.toggle("is-ok", !!ok);
        status.setAttribute("role", "status");
      }
    }

    /* ---------------- 页脚年份 ---------------- */
    Array.prototype.forEach.call(
      document.querySelectorAll("[data-year]"),
      function (el) {
        el.textContent = String(new Date().getFullYear());
      }
    );
  });
})();
