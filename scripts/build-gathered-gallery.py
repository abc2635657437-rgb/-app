#!/usr/bin/env python3
"""Build the Gathered top-100 review page (mobile-safe) plus lightweight thumbnails.

Reads : modules/data/gathered-sources.json, modules/data/background-priority-100.json
        assets/route-photos/<qid>-gathered-background.png (+ -mobile.png)
Writes: assets/route-photos/thumbs/<qid>-w720.jpg, <qid>-m540.jpg
        artifacts/gathered-top100.html
"""
import html
import json
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTO_DIR = os.path.join(ROOT, "assets", "route-photos")
THUMB_DIR = os.path.join(PHOTO_DIR, "thumbs")
OUT_HTML = os.path.join(ROOT, "artifacts", "gathered-top100.html")

COUNTRY_ZH = {
    "CN": "中国", "FR": "法国", "IN": "印度", "US": "美国", "TR": "土耳其", "PE": "秘鲁",
    "IT": "意大利", "GB": "英国", "ES": "西班牙", "GR": "希腊", "DE": "德国", "EG": "埃及",
    "JP": "日本", "BR": "巴西", "MX": "墨西哥", "RU": "俄罗斯", "AE": "阿联酋", "ZA": "南非",
    "AU": "澳大利亚", "NZ": "新西兰", "CA": "加拿大", "SG": "新加坡", "KR": "韩国", "TH": "泰国",
    "VN": "越南", "ID": "印度尼西亚", "NL": "荷兰", "AT": "奥地利", "CH": "瑞士", "PT": "葡萄牙",
    "PL": "波兰", "CZ": "捷克", "HU": "匈牙利", "SE": "瑞典", "NO": "挪威", "DK": "丹麦",
    "FI": "芬兰", "IE": "爱尔兰", "BE": "比利时", "IL": "以色列", "JO": "约旦", "LB": "黎巴嫩",
    "MA": "摩洛哥", "TN": "突尼斯", "KE": "肯尼亚", "TZ": "坦桑尼亚", "AR": "阿根廷", "CL": "智利",
    "CO": "哥伦比亚", "CU": "古巴", "PH": "菲律宾", "MY": "马来西亚", "KH": "柬埔寨", "NP": "尼泊尔",
    "LK": "斯里兰卡", "PK": "巴基斯坦", "SA": "沙特阿拉伯", "QA": "卡塔尔", "HR": "克罗地亚",
    "RO": "罗马尼亚", "BG": "保加利亚", "UA": "乌克兰", "IS": "冰岛", "MT": "马耳他", "VA": "梵蒂冈",
}


def make_thumbs(pid, wide_path, mobile_path):
    out = {}
    if os.path.exists(wide_path):
        im = Image.open(wide_path).convert("RGB")
        w = im.resize((720, round(720 * im.height / im.width)), Image.LANCZOS)
        p = os.path.join(THUMB_DIR, f"{pid.lower()}-w720.jpg")
        w.save(p, "JPEG", quality=82, optimize=True, progressive=True)
        out["wide"] = "/assets/route-photos/thumbs/" + os.path.basename(p)
    if os.path.exists(mobile_path):
        im = Image.open(mobile_path).convert("RGB")
        m = im.resize((540, round(540 * im.height / im.width)), Image.LANCZOS)
        p = os.path.join(THUMB_DIR, f"{pid.lower()}-m540.jpg")
        m.save(p, "JPEG", quality=82, optimize=True, progressive=True)
        out["mobile"] = "/assets/route-photos/thumbs/" + os.path.basename(p)
    return out


def main():
    os.makedirs(THUMB_DIR, exist_ok=True)
    manifest = json.load(open(os.path.join(ROOT, "modules", "data", "gathered-sources.json"), encoding="utf-8"))["sources"]
    queue = json.load(open(os.path.join(ROOT, "modules", "data", "background-priority-100.json"), encoding="utf-8"))["entries"]

    cards, ready = [], 0
    for entry in queue:
        pid = entry["id"]
        meta = manifest.get(pid, {})
        wide = os.path.join(PHOTO_DIR, pid.lower() + "-gathered-background.png")
        mobile = os.path.join(PHOTO_DIR, pid.lower() + "-gathered-background-mobile.png")
        thumbs = make_thumbs(pid, wide, mobile)
        has = "wide" in thumbs
        ready += 1 if has else 0
        cc = entry.get("countryCode") or ""
        cards.append({
            "id": pid, "n": entry["priority"], "name": entry.get("name") or "",
            "name_en": entry.get("name_en") or "", "city": entry.get("city") or "",
            "cc": cc, "cc_zh": COUNTRY_ZH.get(cc, cc), "category": entry.get("category") or "",
            "author": meta.get("sourceAuthor") or "", "license": meta.get("license") or "",
            "sourceUrl": meta.get("sourceUrl") or "", "thumbs": thumbs, "has": has,
        })

    hero = next((c for c in cards if c["has"]), cards[0])
    data = json.dumps(cards, ensure_ascii=False)

    body = []
    for c in cards:
        if c["has"]:
            pic = (
                '<picture>'
                f'<source media="(max-width:640px)" srcset="{c["thumbs"].get("mobile", c["thumbs"]["wide"])}">'
                f'<img src="{c["thumbs"]["wide"]}" alt="{html.escape(c["name_en"] or c["name"])} gathered background" '
                'loading="lazy" decoding="async" width="720" height="432">'
                '</picture>'
            )
        else:
            pic = '<div class="pending">待生成</div>'
        body.append(
            f'<li class="card" data-id="{c["id"]}">'
            f'<button type="button" class="card-btn">'
            f'<span class="shot">{pic}<span class="num">{c["n"]:02d}</span></span>'
            f'<span class="meta"><strong>{html.escape(c["name"])}</strong>'
            f'<em>{html.escape(c["name_en"])}</em>'
            f'<small>{html.escape(c["city"])} · {html.escape(c["cc_zh"])} · {html.escape(c["license"])}</small>'
            f'</span></button></li>'
        )

    doc = f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>地图热度前一百 · Gathered 纸感艺术背景</title>
<style>
*{{box-sizing:border-box}}
html,body{{margin:0;max-width:100%;overflow-x:hidden;-webkit-text-size-adjust:100%}}
body{{background:#f6f2e8;color:#173747;font:16px/1.6 system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}}
img{{max-width:100%;height:auto;display:block}}
a{{color:inherit;text-underline-offset:3px}}
.wrap{{width:100%;max-width:1240px;margin:0 auto;padding:0 16px}}

/* ---------- header ---------- */
.top{{position:sticky;top:0;z-index:20;background:#f6f2e8f2;backdrop-filter:blur(8px);border-bottom:1px solid #e2dccd}}
.top .wrap{{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:baseline;justify-content:space-between;padding:10px 16px}}
.brand{{font:700 clamp(17px,4.4vw,21px)/1.2 SimSun,Georgia,serif;letter-spacing:.5px}}
.brand span{{display:block;font:400 11px/1.5 system-ui,sans-serif;letter-spacing:2px;color:#6b7a75}}
.top .meta{{font-size:12px;color:#6b7a75;letter-spacing:1px}}

/* ---------- hero: gathered art as a fixed full-page layer ---------- */
.hero{{position:relative;isolation:isolate;min-height:min(78vh,620px);display:flex;align-items:flex-end;
  padding:clamp(20px,5vw,56px) 0 clamp(18px,4vw,40px);
  background:#f6f2e8 url("{hero['thumbs'].get('wide','')}") center/cover no-repeat;background-attachment:fixed}}
@media(max-width:820px){{.hero{{background-attachment:scroll;background-position:center top}}}}
.hero::before{{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,#f6f2e8f2 0%,#f6f2e8b8 26%,#f6f2e800 52%,#f6f2e8e0 100%)}}
.panel{{background:#fffaf0e8;border:1px solid #e6dfcd;border-radius:10px;padding:clamp(16px,3.4vw,26px);max-width:760px}}
.kicker{{margin:0 0 8px;font-size:12px;letter-spacing:2px;color:#8a5a3c;text-transform:uppercase}}
h1{{font:700 clamp(24px,6.2vw,40px)/1.25 SimSun,Georgia,serif;margin:0 0 8px}}
.sub{{margin:0;font-size:clamp(13px,3.4vw,15px);color:#52625e}}
.stats{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;margin:18px 0 0;background:#e6dfcd;border:1px solid #e6dfcd;border-radius:8px;overflow:hidden}}
@media(min-width:560px){{.stats{{grid-template-columns:repeat(4,minmax(0,1fr))}}}}
.stats div{{background:#fffaf0;padding:12px 10px}}
.stats dt{{font:700 clamp(18px,4.6vw,26px)/1.1 SimSun,Georgia,serif;margin:0}}
.stats dd{{margin:4px 0 0;font-size:11.5px;color:#68716c;letter-spacing:.5px}}

/* ---------- grid ---------- */
h2{{font:700 clamp(19px,4.6vw,26px)/1.3 SimSun,Georgia,serif;margin:34px 0 6px}}
.note{{margin:0 0 16px;font-size:12.5px;color:#68716c}}
.cards{{list-style:none;margin:0 0 40px;padding:0;display:grid;gap:14px;
  grid-template-columns:repeat(auto-fill,minmax(min(100%,232px),1fr))}}
.card{{min-width:0}}
.card-btn{{display:block;width:100%;padding:0;border:1px solid #e6dfcd;border-radius:9px;background:#fffaf0;
  color:inherit;font:inherit;text-align:left;cursor:pointer;overflow:hidden}}
.card-btn:focus-visible{{outline:2px solid #8a5a3c;outline-offset:2px}}
.shot{{position:relative;display:block;aspect-ratio:5/3;background:#efe9db}}
.shot img{{width:100%;height:100%;object-fit:cover}}
.num{{position:absolute;left:8px;bottom:8px;background:#173747e0;color:#f7f3e8;font:700 11px/1 system-ui,sans-serif;
  padding:5px 7px;border-radius:4px;letter-spacing:1px}}
.meta{{display:block;padding:10px 11px 12px;min-width:0}}
.meta strong{{display:block;font-size:14.5px;line-height:1.35;overflow-wrap:anywhere}}
.meta em{{display:block;font-style:normal;font-size:11.5px;color:#8a9490;margin-top:2px;overflow-wrap:anywhere}}
.meta small{{display:block;font-size:11px;color:#68716c;margin-top:6px;overflow-wrap:anywhere}}
.pending{{display:flex;align-items:center;justify-content:center;height:100%;font-size:12px;color:#9aa39e}}

/* ---------- detail overlay: gathered art fixed behind ivory cards ---------- */
dialog{{width:100%;max-width:100%;height:100%;max-height:100%;margin:0;padding:0;border:0;background:transparent}}
dialog::backdrop{{background:#12222ccc}}
.sheet{{position:relative;min-height:100%;background:#f6f2e8 center/cover no-repeat;background-attachment:fixed}}
@media(max-width:820px){{.sheet{{background-attachment:scroll;background-position:center top;background-size:auto 100%}}}}
.sheet-in{{max-width:820px;margin:0 auto;padding:16px 16px 40px}}
.back{{min-height:44px;padding:8px 14px;border:1px solid #b8c0b9;background:#fffaf0e8;color:inherit;border-radius:6px;font:inherit;cursor:pointer}}
.sheet h3{{font:700 clamp(21px,5.4vw,30px)/1.3 SimSun,Georgia,serif;margin:14px 0 6px;
  background:#fffaf0e8;padding:10px 12px;border-radius:8px}}
.block{{background:#fffaf0e8;border-radius:8px;padding:12px 14px;margin:10px 0;font-size:13.5px;overflow-wrap:anywhere}}
.block a{{word-break:break-word}}
.art{{width:100%;border-radius:8px;border:1px solid #e6dfcd}}
@media(prefers-reduced-motion:no-preference){{dialog{{animation:fade .18s ease-out}}@keyframes fade{{from{{opacity:0}}to{{opacity:1}}}}}}
</style></head>
<body>
<header class="top"><div class="wrap">
  <div class="brand">Travel World<span>同路人 · 旅行手帖</span></div>
  <div class="meta">本地预览 · 未上线</div>
</div></header>

<section class="hero"><div class="wrap"><div class="panel">
  <p class="kicker">Gathered · 艺术衍生背景</p>
  <h1>地图热度前一百 · 纸感画册</h1>
  <p class="sub">真实授权照片 → 本地代码渲染的纸感艺术背景。左半保留实拍，右半转成双色丝网印刷，中间是撕纸纤维接缝。</p>
  <dl class="stats">
    <div><dt>{len(cards)}</dt><dd>个景点</dd></div>
    <div><dt>5:3 / 2:3</dt><dd>桌面 / 手机画幅</dd></div>
    <div><dt>100%</dt><dd>可溯源授权照片</dd></div>
    <div><dt>0</dt><dd>消耗生成额度</dd></div>
  </dl>
</div></div></section>

<main class="wrap">
  <h2>全部 {len(cards)} 个景点</h2>
  <p class="note">点任意一张查看大图与出处。手机端自动切换为 2:3 竖版画幅，不裁掉主体、不会横向溢出。</p>
  <ol class="cards" id="cards">
{chr(10).join('    ' + b for b in body)}
  </ol>
</main>

<dialog id="dlg"><div class="sheet" id="sheet"><div class="sheet-in">
  <button type="button" class="back" id="close">返回画册</button>
  <h3 id="dName"></h3>
  <img class="art" id="dImg" alt="">
  <div class="block" id="dMeta"></div>
  <div class="block"><strong>这是什么</strong><br>本地代码渲染的艺术衍生背景，不是现场实拍照片，也不是 AI 生成图。左半保留原始实拍，右半转为双色丝印，中间为撕纸纤维接缝。</div>
  <div class="block" id="dSrc"></div>
</div></div></dialog>

<script>
const DATA = {data};
const dlg = document.getElementById('dlg');
const isPhone = () => matchMedia('(max-width:640px)').matches;
document.getElementById('cards').addEventListener('click', e => {{
  const li = e.target.closest('.card'); if (!li) return;
  const c = DATA.find(x => x.id === li.dataset.id); if (!c || !c.has) return;
  const wide = '/assets/route-photos/' + c.id.toLowerCase() + '-gathered-background.png';
  document.getElementById('dName').textContent = c.n + ' · ' + c.name + ' · ' + c.name_en;
  const img = document.getElementById('dImg');
  img.src = isPhone() ? (c.thumbs.mobile || c.thumbs.wide) : wide;
  img.alt = c.name_en + ' gathered background';
  document.getElementById('sheet').style.backgroundImage = 'url("' + (c.thumbs.wide) + '")';
  document.getElementById('dMeta').innerHTML =
    c.city + ' · ' + c.cc_zh + ' · ' + c.category + '<br>源图作者：' + c.author + ' · ' + c.license;
  document.getElementById('dSrc').innerHTML = '原始实拍与授权：<a href="' + c.sourceUrl +
    '" target="_blank" rel="noopener noreferrer">' + c.sourceUrl + '</a>';
  dlg.showModal();
}});
document.getElementById('close').onclick = () => dlg.close();
dlg.addEventListener('click', e => {{ if (e.target === dlg) dlg.close(); }});
</script>
</body></html>
"""
    os.makedirs(os.path.dirname(OUT_HTML), exist_ok=True)
    with open(OUT_HTML, "w", encoding="utf-8") as fh:
        fh.write(doc)
    print(json.dumps({"cards": len(cards), "withArtwork": ready, "html": OUT_HTML}, ensure_ascii=False))


if __name__ == "__main__":
    main()
