from PIL import Image, ImageDraw
import math, os

SIZE = 1024
OUT_DIR = "mobile/assets/images"

def draw_heart(draw, cx, cy, size, color):
    # 하트를 폴리곤으로 근사
    points = []
    for i in range(360):
        angle = math.radians(i)
        x = size * 16 * (math.sin(angle) ** 3)
        y = -size * (13 * math.cos(angle) - 5 * math.cos(2*angle) - 2 * math.cos(3*angle) - math.cos(4*angle))
        points.append((cx + x, cy + y))
    draw.polygon(points, fill=color)

def make_icon():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 배경: 파스텔 라벤더 → 연보라 그라디언트 효과 (단색으로 근사)
    for y in range(SIZE):
        ratio = y / SIZE
        r = int(221 + (196 - 221) * ratio)  # #DDD6FE → #C4B5FD
        g = int(214 + (181 - 214) * ratio)
        b = int(254 + (253 - 254) * ratio)
        draw.line([(0, y), (SIZE, y)], fill=(r, g, b, 255))

    # 배경을 둥근 사각형으로 마스킹
    mask = Image.new("L", (SIZE, SIZE), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([0, 0, SIZE-1, SIZE-1], radius=220, fill=255)
    img.putalpha(mask)

    draw = ImageDraw.Draw(img)

    cx, cy = SIZE // 2, SIZE // 2

    # 흰색 큰 원 (얼굴)
    face_r = 310
    draw.ellipse([cx-face_r, cy-face_r, cx+face_r, cy+face_r], fill=(255, 255, 255, 240))

    # 눈 (둥글고 귀여운)
    eye_r = 38
    eye_y = cy - 70
    eye_lx, eye_rx = cx - 105, cx + 105
    draw.ellipse([eye_lx-eye_r, eye_y-eye_r, eye_lx+eye_r, eye_y+eye_r], fill=(109, 40, 217))
    draw.ellipse([eye_rx-eye_r, eye_y-eye_r, eye_rx+eye_r, eye_y+eye_r], fill=(109, 40, 217))

    # 눈 반짝이 (하이라이트)
    draw.ellipse([eye_lx+12, eye_y-22, eye_lx+26, eye_y-8], fill=(255, 255, 255))
    draw.ellipse([eye_rx+12, eye_y-22, eye_rx+26, eye_y-8], fill=(255, 255, 255))

    # 미소
    smile_bbox = [cx-120, cy-30, cx+120, cy+110]
    draw.arc(smile_bbox, start=20, end=160, fill=(109, 40, 217), width=22)

    # 볼터치 (파스텔 핑크)
    cheek_r = 48
    cheek_y = cy + 55
    draw.ellipse([cx-195-cheek_r, cheek_y-cheek_r//2, cx-195+cheek_r, cheek_y+cheek_r//2],
                 fill=(249, 168, 212, 160))
    draw.ellipse([cx+195-cheek_r, cheek_y-cheek_r//2, cx+195+cheek_r, cheek_y+cheek_r//2],
                 fill=(249, 168, 212, 160))

    # 작은 하트 (오른쪽 위)
    heart_cx, heart_cy = cx + 200, cy - 200
    hs = 2.2
    pts = []
    for i in range(360):
        a = math.radians(i)
        x = hs * 16 * (math.sin(a) ** 3)
        y = -hs * (13*math.cos(a) - 5*math.cos(2*a) - 2*math.cos(3*a) - math.cos(4*a))
        pts.append((heart_cx + x, heart_cy + y))
    draw.polygon(pts, fill=(249, 168, 212, 220))

    # 별 (왼쪽 위)
    star_cx, star_cy = cx - 205, cy - 195
    star_pts = []
    for i in range(10):
        angle = math.radians(i * 36 - 90)
        r = 36 if i % 2 == 0 else 16
        star_pts.append((star_cx + r * math.cos(angle), star_cy + r * math.sin(angle)))
    draw.polygon(star_pts, fill=(253, 230, 138, 230))

    return img

icon = make_icon()
icon.save(os.path.join(OUT_DIR, "icon.png"))

# Android 포그라운드 아이콘 (배경 없이 얼굴만, 더 작게)
fg = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(fg)

cx, cy = SIZE // 2, SIZE // 2

face_r = 330
draw.ellipse([cx-face_r, cy-face_r, cx+face_r, cy+face_r], fill=(255, 255, 255, 255))

eye_r = 40
eye_y = cy - 75
eye_lx, eye_rx = cx - 110, cx + 110
draw.ellipse([eye_lx-eye_r, eye_y-eye_r, eye_lx+eye_r, eye_y+eye_r], fill=(109, 40, 217))
draw.ellipse([eye_rx-eye_r, eye_y-eye_r, eye_rx+eye_r, eye_y+eye_r], fill=(109, 40, 217))
draw.ellipse([eye_lx+13, eye_y-24, eye_lx+27, eye_y-10], fill=(255, 255, 255))
draw.ellipse([eye_rx+13, eye_y-24, eye_rx+27, eye_y-10], fill=(255, 255, 255))
draw.arc([cx-125, cy-35, cx+125, cy+115], start=20, end=160, fill=(109, 40, 217), width=24)

cheek_r = 50
cheek_y = cy + 58
draw.ellipse([cx-205-cheek_r, cheek_y-cheek_r//2, cx-205+cheek_r, cheek_y+cheek_r//2],
             fill=(249, 168, 212, 180))
draw.ellipse([cx+205-cheek_r, cheek_y-cheek_r//2, cx+205+cheek_r, cheek_y+cheek_r//2],
             fill=(249, 168, 212, 180))

fg.save(os.path.join(OUT_DIR, "android-icon-foreground.png"))

# 스플래시 아이콘도 동일하게
icon_small = make_icon().resize((76, 76), Image.LANCZOS)
icon_small.save(os.path.join(OUT_DIR, "splash-icon.png"))

print("아이콘 생성 완료!")
print(f"  - {OUT_DIR}/icon.png")
print(f"  - {OUT_DIR}/android-icon-foreground.png")
print(f"  - {OUT_DIR}/splash-icon.png")
