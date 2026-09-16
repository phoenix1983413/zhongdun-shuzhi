# 北京中盾数智科技有限公司 · 官方网站

静态多页站点，零依赖、零构建步骤，托管于 GitHub Pages。

**线上地址：** https://phoenix1983413.github.io/zhongdun-shuzhi/

---

## 一、上线前必改（3 项）

### 1. 联系方式是占位符

`contact.html` 里有两处占位，必须替换为真实信息，否则访客找不到你们：

| 位置 | 当前占位 | 说明 |
|---|---|---|
| 业务咨询邮箱 | `contact@your-domain.com` | HTML 中带 `<!-- TODO -->` 注释标记，共出现 2 处（正文 + 表单 `data-mailto`） |
| 联系电话 | `010-0000 0000` | 同页面，含 `tel:` 链接 |

全站替换命令（在 `zhongdun-shuzhi-site/` 目录下执行）：

```bash
# 把 NEW_EMAIL / NEW_PHONE 换成真实值
grep -rl "contact@your-domain.com" . --include="*.html" | xargs sed -i '' 's/contact@your-domain.com/NEW_EMAIL/g'
grep -rl "010-0000 0000" . --include="*.html" | xargs sed -i '' 's/010-0000 0000/NEW_PHONE/g'
```

> 表单是纯静态的：提交后在访客本地唤起邮件客户端，站点不保存任何数据。
> 若要改成真正提交到后端，把 `contact.html` 中 `<form>` 的 `data-mailto` 换成表单服务端点（如 Formspree）并调整 `assets/js/site.js` 中的提交分支即可。

### 2. 域名与 canonical

站内 `canonical`、`og:url`、`og:image`、`sitemap.xml`、`robots.txt` 目前写的是 GitHub Pages 的默认域名。
如果绑定自定义域名（如 `www.zhongdun-shuzhi.com`），需要全量替换：

```bash
grep -rl "https://phoenix1983413.github.io/zhongdun-shuzhi/" . \
  | xargs sed -i '' 's|https://phoenix1983413.github.io/zhongdun-shuzhi/|https://你的域名/|g'
```

注意 `404.html` 用的是绝对路径 `/zhongdun-shuzhi/...`，换域名后需一并改成 `/`。绑定自定义域名时还要在仓库根目录加 `CNAME` 文件。

### 3. ICP 备案

上线前请确认域名备案状态。备案号拿到后加到页脚 `footer__bottom` 的 `<p>` 里，并链接到 `https://beian.miit.gov.cn/`。

---

## 二、内容来源与需要你确认的部分

网站文案**不是凭空写的**，分两类：

### A. 来自公开工商登记信息（可直接使用）

- 企业全称、统一社会信用代码 `91110400MAKEPTA056`、法定代表人杨波、注册资本 500 万元、成立日期 2026-05-19、登记机关、注册地址、行业分类（基础软件开发 6511）、经营范围
- 全资股东：北京中盾领御机器人有限公司（2026-07-10 股权变更后）
- 集团成员企业 3 家
- 母公司中盾领御机器人的成立日期、法定代表人、经营范围

### B. 基于经营范围推导的表述（**建议你逐条核对**）

这些内容方向来自营业执照经营范围，表述方式是我组织的，需要你确认真实性：

| 页面 | 内容 | 确认要点 |
|---|---|---|
| 首页 / 业务页 | 三大业务板块的划分方式 | 是否与实际业务重心一致 |
| 业务页 | 四类应用场景（智能制造 / 公共服务 / 教育文体 / 特种作业） | 是否都在做，或只做其中一两类 |
| 业务页 | 交付周期"单场景试点 4–12 周"、交付内容、验收口径 | 是否与实际做法相符 |
| 关于页 | 使命 / 愿景 / 价值观 | 是否与公司实际主张一致 |
| 联系页 | 招聘三个方向 | 是否确实在招 |
| 全站 | "集团协同""软硬一体交付"的表述 | 母子公司之间的实际协同方式 |

**我没有编造数据。** 全站没有出现"服务过 XX 家客户""XX 年行业经验""专利 XX 项"这类无法核实的内容——公司 2026 年成立，写这些不成立。

### C. 新闻动态

`news.html` 的 6 条内容全部是**已发生的事实**（注册设立、母公司设立、股权变更），外加 2 条标注为"进行中"的业务进展。没有把计划写成新闻。后续按实际情况追加即可。

---

## 三、本地预览

静态站，任意 HTTP 服务皆可：

```bash
cd zhongdun-shuzhi-site
python3 -m http.server 8138
# 打开 http://127.0.0.1:8138/
```

> `file://` 直接打开也能看，但建议用本地服务，行为更接近线上。

---

## 四、部署到 GitHub Pages

已部署完成。如需重新部署或换仓库：

```bash
export PATH="$HOME/bin:$PATH"          # gh CLI 在 ~/bin
cd zhongdun-shuzhi-site
git add -A && git commit -m "更新站点"
git push origin main
```

首次从零开始：

```bash
cd zhongdun-shuzhi-site
git init -b main
git add -A
git commit -m "初始化企业官网"
export PATH="$HOME/bin:$PATH"
gh repo create zhongdun-shuzhi --public --source=. --remote=origin --push
# 开启 Pages（main 分支根目录）
echo '{"source":{"branch":"main","path":"/"}}' | gh api -X POST /repos/<用户名>/zhongdun-shuzhi/pages --input -
```

### 部署要点

- 站点是**项目站点**，地址带子路径 `/zhongdun-shuzhi/`。除 `404.html` 外，所有页面资源引用均使用**相对路径**，所以换仓库名也能正常工作。
- `404.html` 必须用**绝对路径**——它会被任意深度的 URL 命中，相对路径会失效。换仓库名或域名时这里要改。
- `.nojekyll` 已就位，确保 `assets/img/_gen_icons.py` 这类以下划线开头的文件正常发布。
- 改完 `index.html` 等内容后，若访客仍看到旧版本，是浏览器缓存。本站在 `head` 中未做强制缓存头，GitHub Pages 默认缓存时间较短，通常刷新即可。

---

## 五、目录结构

```
zhongdun-shuzhi-site/
├── index.html              首页
├── about.html              关于我们（含工商登记信息）
├── business.html           业务与产品（四大板块，带锚点）
├── news.html               新闻动态（含分类筛选）
├── contact.html            联系我们（含表单、地址、招聘）
├── 404.html                自定义 404（绝对路径）
├── robots.txt              抓取规则 + sitemap 声明
├── sitemap.xml             站点地图
├── .nojekyll               关闭 Jekyll 处理
└── assets/
    ├── css/site.css        全站样式系统（设计令牌 + 组件 + 响应式）
    ├── js/site.js          交互：移动菜单、滚动动画、新闻筛选、表单
    └── img/
        ├── mark.svg        盾形标识（1024 内矢量，导航与页脚使用）
        ├── favicon-32.png  浏览器标签页图标
        ├── apple-touch-icon.png  iOS 主屏幕图标（180）
        ├── icon-192.png    安卓 / manifest
        ├── icon-512.png    安卓启动图
        ├── og-cover.png    社交分享预览图（1200×630）
        └── _gen_icons.py   图标生成脚本
```

---

## 六、设计规范

| 项目 | 值 |
|---|---|
| 强调色 | Action Blue `#0066CC`（深色背景上用 `#2997FF`） |
| 正文墨色 | `#1D1D1F` |
| 画布 | 白 `#FFFFFF` / 浅灰 `#F5F5F7` / 珍珠白 `#FAFAFC` / 黑 `#000000` |
| 分隔线 | `#E0E0E0`（深色区用 `rgba(255,255,255,0.14)`） |
| 字体 | 系统字体栈：SF Pro → PingFang SC → Noto Sans SC |
| 正文尺寸 | 17px / 行高 1.47 / 字距 -0.374px |
| 圆角 | 卡片 18px，按钮胶囊形 |
| 断点 | 1000px / 820px（导航折叠）/ 560px / 420px |
| 布局宽度 | 内容 1120px，栅格间距 24px |

改主题色只需改 `site.css` 顶部 `:root` 中的 `--blue` 与 `--blue-on-dark` 两个变量。

---

## 七、改图标

图标是脚本生成的，改完参数重跑即可：

```bash
cd assets/img
pip install Pillow
python3 _gen_icons.py
```

脚本里的 `SHIELD`（盾形轮廓）、`NODES`（三个节点坐标）、`BLUE_TOP`/`BLUE_BOTTOM`（渐变）都可调整。
`mark.svg` 是同一图形的手写 SVG 版本，改的时候两处要同步。

---

## 八、已验证项

上线前用 headless Chrome + CDP 实测通过：

- 6 个页面在 1440×900 与 390×844 下**均无横向溢出**，控制台**零错误**
- 导航断点：≥820px 显示水平菜单，<820px 显示汉堡按钮
- 移动抽屉展开 374px，6 个链接点击区各 54px（满足 44px 最小触控标准），`aria-expanded` 正确翻转，二次点击可收起
- 新闻筛选：全部 6 / 公司要闻 3 / 集团动态 1 / 业务进展 2
- 四张业务卡的"查看详情"分隔线位置偏差 **0px**
- 表单空提交被正确拦截并给出提示
- 页面间**全部内链与锚点可达**，图片全部加载成功
- 每页有且仅有一个 `<h1>`，SEO 必备 meta（description / canonical / og）齐备，JSON-LD 结构合法
