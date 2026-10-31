#!/usr/bin/env python3
"""
把 assets/theme/incoming/ 里用户自备的图片接入主题吉祥物随机池。

用法:
    python seo/mascot-import.py --theme doraemon        # 全部图片归入哆啦A梦池
    python seo/mascot-import.py --theme shinchan        # 全部图片归入蜡笔小新池
    python seo/mascot-import.py --theme doraemon --keep-white   # 保留原背景不抠白

处理流程: 白底转透明(可选) → 居中裁正方形 → 缩到 360px → 命名 <theme>-N.png 写入 pool/
完成后需重新推送（api-push.mjs），页面会随机抽到新图。
"""
import argparse
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INCOMING = os.path.join(ROOT, "assets", "theme", "incoming")
POOL = os.path.join(ROOT, "assets", "theme", "pool")
EXTS = (".png", ".jpg", ".jpeg", ".webp", ".bmp")
SIZE = 360
# 近似白底的判定阈值（RGB 各通道都高于该值即视为背景）
WHITE_T = 244


def white_to_alpha(im: Image.Image) -> Image.Image:
    """把与四角连通的近白像素变透明；主体内部的白色保持不变。"""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    # 用简单的洪水填充，从四角出发，避免把角色身上的白色（肚子、眼睛）抠掉
    from collections import deque

    seen = bytearray(w * h)
    dq = deque()
    for sx, sy in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        dq.append((sx, sy))
    while dq:
        x, y = dq.popleft()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        i = y * w + x
        if seen[i]:
            continue
        r, g, b, a = px[x, y]
        if not (r >= WHITE_T and g >= WHITE_T and b >= WHITE_T):
            seen[i] = 1
            continue
        seen[i] = 1
        px[x, y] = (r, g, b, 0)
        dq.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return im


def square_trim(im: Image.Image) -> Image.Image:
    """居中裁成正方形，再等比缩放到 SIZE。"""
    im = im.convert("RGBA")
    w, h = im.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    im = im.crop((left, top, left + side, top + side))
    return im.resize((SIZE, SIZE), Image.LANCZOS)


def next_index(theme: str) -> int:
    n = 0
    if not os.path.isdir(POOL):
        return 1
    for f in os.listdir(POOL):
        stem, ext = os.path.splitext(f)
        if ext.lower() == ".png" and stem.startswith(theme + "-"):
            try:
                n = max(n, int(stem.split("-")[1]))
            except (IndexError, ValueError):
                pass
    return n + 1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--theme", required=True, choices=["doraemon", "shinchan"])
    ap.add_argument("--keep-white", action="store_true", help="不做白底转透明")
    args = ap.parse_args()

    if not os.path.isdir(INCOMING):
        print(f"目录不存在: {INCOMING}")
        return 1
    files = sorted(
        f for f in os.listdir(INCOMING) if os.path.splitext(f)[1].lower() in EXTS
    )
    if not files:
        print(f"{INCOMING} 里没有图片（支持 png/jpg/jpeg/webp/bmp）")
        return 1

    os.makedirs(POOL, exist_ok=True)
    idx = next_index(args.theme)
    done = 0
    for name in files:
        src = os.path.join(INCOMING, name)
        try:
            im = Image.open(src)
        except Exception as e:  # noqa: BLE001
            print(f"跳过 {name}: 无法读取 ({e})")
            continue
        if not args.keep_white:
            im = white_to_alpha(im)
        im = square_trim(im)
        dst_name = f"{args.theme}-{idx}.png"
        dst = os.path.join(POOL, dst_name)
        im.save(dst, optimize=True)
        kb = os.path.getsize(dst) // 1024
        alpha = im.getchannel("A").getextrema()
        print(f"{name} -> pool/{dst_name}  {kb} KB  alpha={alpha[0]}..{alpha[1]}")
        idx += 1
        done += 1

    print(f"\n完成 {done} 张。下一步：")
    print("  node \"C:/Users/Adminstor/WorkBuddy/2026-10-26-09-16-00/lezhesoft-seo-fix/scripts/api-push.mjs\" \"更新主题吉祥物\"")
    return 0 if done else 1


if __name__ == "__main__":
    sys.exit(main())
