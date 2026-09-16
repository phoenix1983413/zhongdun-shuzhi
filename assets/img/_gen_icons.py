#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
中盾数智 官网图标 / 分享图生成脚本

用法：
    python3 _gen_icons.py

产物（assets/img/）：
    favicon-32.png        浏览器标签页图标
    apple-touch-icon.png  iOS 添加到主屏幕（180）
    icon-192.png          安卓 / manifest
    icon-512.png          安卓启动图 / manifest
    og-cover.png          社交分享预览图 1200x630

依赖：Pillow
    pip install Pillow

说明：标识图形与 assets/img/mark.svg 保持一致 —— 盾形 + 三点智能节点。
     盾形曲线为 SVG 中三次贝塞尔曲线按 t=0.2 步长采样后的折线近似。
"""

import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFilter, ImageFont
except ImportError:
    sys.exit("缺少 Pillow，请先执行： pip install Pillow")

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = HERE if os.path.basename(HERE) == "img" else os.path.join(HERE, "assets", "img")

# ---------------------------------------------------------------- 配色
BLUE_TOP = (0, 113, 227)
BLUE_BOTTOM = (0, 88, 176)
WHITE = (255, 255, 255)
INK = (29, 29, 31)
BLUE_FLAT = (0, 102, 204)

SS = 4  # 超采样倍数，用于抗锯齿

# ---------------------------------------------------------------- 盾形轮廓（viewBox 48）
SHIELD_RIGHT = [
    (24.0, 3.2),
    (41.5, 9.4),
    (41.5, 23.2),
    (40.66, 29.44),
    (38.28, 34.71),
    (34.57, 39.00),
    (29.74, 42.30),
    (24.0, 44.6),
]
SHIELD = SHIELD_RIGHT + [(48.0 - x, y) for (x, y) in reversed(SHIELD_RIGHT[1:-1])]

# 内部节点：三角 + 中心点
NODES = [(24.0, 17.0, 3.8), (15.5, 32.0, 3.8), (32.5, 32.0, 3.8)]
CENTER = (24.0, 26.6, 2.6)
EDGES = [((24.0, 17.0), (15.5, 32.0)), ((24.0, 17.0), (32.5, 32.0)), ((15.5, 32.0), (32.5, 32.0))]


def vertical_gradient(size, top, bottom):
    """生成纵向渐变图层。"""
    grad = Image.new("RGB", (1, size), top)
    px = grad.load()
    for y in range(size):
        t = y / max(size - 1, 1)
        px[0, y] = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    return grad.resize((size, size), Image.BILINEAR)


def shield_mask(size):
    """盾形 alpha 蒙版（单通道 L）。"""
    m = Image.new("L", (size * SS, size * SS), 0)
    d = ImageDraw.Draw(m)
    pts = [((x / 48.0) * size * SS, (y / 48.0) * size * SS) for (x, y) in SHIELD]
    d.polygon(pts, fill=255)
    return m.resize((size, size), Image.LANCZOS)


def draw_mark(size):
    """绘制标识：盾形渐变底 + 白色节点网络。返回 RGBA。"""
    base = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # 盾形做一层轻微投影，避免纯平
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sm = shield_mask(size)
    shadow.putalpha(sm.point(lambda v: int(v * 0.30)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(size * 0.045))
    base.alpha_composite(shadow, (0, int(size * 0.03)))

    # 盾形本体：渐变
    body = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    grad = vertical_gradient(size, BLUE_TOP, BLUE_BOTTOM).convert("RGBA")
    body.paste(grad, (0, 0))
    body.putalpha(shield_mask(size))
    base.alpha_composite(body)

    # 内部网络 + 节点
    layer = Image.new("RGBA", (size * SS, size * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    k = size * SS / 48.0
    w = max(int(2.2 * k), 1)

    for (p, q) in EDGES:
        d.line(
            [p[0] * k, p[1] * k, q[0] * k, q[1] * k],
            fill=(255, 255, 255, 235),
            width=w,
            joint="curve",
        )
    for (cx, cy, r) in NODES:
        d.ellipse(
            [(cx - r) * k, (cy - r) * k, (cx + r) * k, (cy + r) * k],
            fill=(255, 255, 255, 255),
        )
    cx, cy, r = CENTER
    d.ellipse(
        [(cx - r) * k, (cy - r) * k, (cx + r) * k, (cy + r) * k],
        fill=(255, 255, 255, 200),
    )

    layer = layer.resize((size, size), Image.LANCZOS)
    # 只保留落在盾形内的部分
    mask = shield_mask(size)
    layer.putalpha(
        Image.composite(layer.getchannel("A"), Image.new("L", (size, size), 0), mask)
    )
    base.alpha_composite(layer)
    return base


# ---------------------------------------------------------------- 中文字体
CJK_CANDIDATES = [
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/STHeiti Medium.ttc",
    "/System/Library/Fonts/Supplemental/Songti.ttc",
    "/Library/Fonts/Arial Unicode.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
]


def load_font(px, bold=False):
    for path in CJK_CANDIDATES:
        if not os.path.exists(path):
            continue
        for idx in ([6, 3, 1, 0] if bold else [4, 7, 2, 0]):
            try:
                return ImageFont.truetype(path, px, index=idx)
            except Exception:
                continue
    return None


def save(img, name):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    img.save(path, optimize=True)
    print("  %-22s %s" % (name, "%dx%d" % img.size))


def main():
    print("生成标识 / 图标 …")
    save(draw_mark(32), "favicon-32.png")
    save(draw_mark(180), "apple-touch-icon.png")
    save(draw_mark(192), "icon-192.png")
    save(draw_mark(512), "icon-512.png")

    # ---------------- 社交分享图 1200x630 ----------------
    W, H = 1200, 630
    og = Image.new("RGB", (W, H), (0, 0, 0))
    d = ImageDraw.Draw(og)

    # 背景细网格
    for x in range(0, W, 60):
        d.line([(x, 0), (x, H)], fill=(20, 20, 22))
    for y in range(0, H, 60):
        d.line([(0, y), (W, y)], fill=(20, 20, 22))

    mark = draw_mark(96)
    og.paste(mark, (80, 80), mark)

    f_title = load_font(78, bold=True)
    f_sub = load_font(34)
    f_tag = load_font(27)

    if f_title is None:
        print("  !! 未找到中文字体，og-cover 将回退为无文字版本")

    if f_title:
        d.text((80, 224), "中盾数智", font=f_title, fill=(255, 255, 255))
    if f_sub:
        d.text((84, 336), "北京中盾数智科技有限公司", font=f_sub, fill=(161, 161, 166))
    if f_tag:
        d.text(
            (84, 400),
            "人工智能软件  ·  具身智能系统集成  ·  数据与算力服务",
            font=f_tag,
            fill=(210, 210, 215),
        )

    # 底部强调色条
    d.rectangle([80, 470, 80 + 132, 470 + 5], fill=BLUE_FLAT)
    if f_tag:
        d.text((84, 500), "ZHONGDUN DIGITAL INTELLIGENCE", font=load_font(21), fill=(122, 122, 122))

    save(og, "og-cover.png")


if __name__ == "__main__":
    main()
