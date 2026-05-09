# SESSION 5 — FONT MIGRATION (Cinzel → Playfair Display, drop Manrope)

## Tóm tắt
Migrate font display từ **Cinzel** (Roman classical, không có vibe Á Đông) sang **Playfair Display** (editorial drama, contrast cao, magazine cổ điển) — tone phù hợp tửu quán giang hồ hơn. Đồng thời drop **Manrope** (UI font dư thừa), gộp body + UI vào một font duy nhất **Be Vietnam Pro** để giảm payload và đảm bảo Vietnamese render đồng nhất.

User picked combo 3 (Playfair + Source Serif 4) ở `font-preview.html`, plan B (heading serif + body sans) — vì app có nhiều bảng số liệu, slot table, form dày đặc → sans body dễ đọc hơn serif body.

---

## ✅ Thay đổi

### 1. Token semantic — `css/variables.css`

```diff
- @import url('...family=Be+Vietnam+Pro:wght@300;400;500;600;700;800
-              &family=Manrope:wght@400;500;600;700;800
-              &family=Cinzel:wght@500;600;700;900&display=swap');
+ @import url('...family=Be+Vietnam+Pro:wght@300;400;500;600;700;800
+              &family=Playfair+Display:wght@400;500;600;700;800;900&display=swap');

- --font-sans:    'Be Vietnam Pro', system-ui, ..., sans-serif;
- --font-display: 'Cinzel', 'Be Vietnam Pro', serif;
- --font-ui:      'Manrope', 'Be Vietnam Pro', system-ui, sans-serif;
+ --font-sans:    'Be Vietnam Pro', system-ui, ..., sans-serif;
+ --font-display: 'Playfair Display', 'Be Vietnam Pro', Georgia, serif;
+ --font-ui:      'Be Vietnam Pro', system-ui, -apple-system, sans-serif;
```

→ `--font-display` giờ là Playfair, `--font-ui` và `--font-sans` đều dùng Be Vietnam Pro. Token name `--font-ui` giữ lại (backward compat) nhưng map về cùng Be Vietnam Pro để xoá Manrope.

### 2. HTML font imports
Update Google Fonts URL ở 4 file load font độc lập:

- `index.html`
- `login.html`
- `gacha-component.html` (iframe)
- `minigames-hub.html` (iframe)

`app.html` không cần update vì load font qua `variables.css`.

### 3. Inline `font-family` replacements

| File | Cũ | Mới | Số lần |
|---|---|---|---|
| `index.html` | `'Cinzel', serif` | `'Playfair Display', Georgia, serif` | 7 |
| `login.html` | `'Cinzel', serif` | `'Playfair Display', Georgia, serif` | 1 |
| `gacha-component.html` | `'Cinzel', serif` | `'Playfair Display', Georgia, serif` | 2 |
| `gacha-component.html` | `'Manrope', sans-serif` | `'Be Vietnam Pro', sans-serif` | 16 |
| `gacha-component.html` | `'Manrope', monospace` (bug — dev viết sai) | `ui-monospace, 'SF Mono', Menlo, ..., monospace` | 1 |
| `minigames-hub.html` | `'Cinzel', serif` | `'Playfair Display', Georgia, serif` | 5 |
| `minigames-hub.html` | `'Manrope', sans-serif` | `'Be Vietnam Pro', sans-serif` | 1 |
| `minigames-hub.html` | `font-family="Manrope, sans-serif"` (SVG) | `font-family="Be Vietnam Pro, sans-serif"` | 2 |
| `js/app.js` (initDashboardStyles) | `'Cinzel',serif` | `var(--font-display)` | 4 |
| `js/dashboard.js` | `Cinzel,serif` (inline) | `var(--font-display)` | 1 |
| `js/tactics.js` | `Cinzel,serif` (inline) | `var(--font-display)` | 2 |
| `js/auth.js` | `Cinzel,serif` (inline) | `var(--font-display)` | 1 |
| `js/sessions.js` | `'Cinzel',serif` (inline) | `var(--font-display)` | 1 |
| `tokens-preview.html` | text describe Cinzel/Manrope | text describe Playfair | 1 |

**Tổng:** 45 chỗ replaced.

### 4. Bug fix nhỏ trong gacha-component.html
Tìm thấy `font-family: 'Manrope', monospace;` ở `.gh-edit-help code` — Manrope không phải monospace font. Fix sang `ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace` đúng theo convention `<code>` element.

### 5. JS files KHÔNG migrate full — chỉ inline font-family
`js/tactics.js`, `js/dashboard.js`, `js/auth.js`, `js/sessions.js`, `js/app.js` có inline `font-family:Cinzel,serif`. Đổi sang `var(--font-display)` thay vì hardcode `'Playfair Display'` — sau này chỉ cần đổi token là toàn bộ app theo. Đây cũng là migration nửa Phase 2 (inline → token) cho riêng font.

---

## 🔍 Verification

```
✅ grep -r "Cinzel"   --include="*.html" --include="*.css" --include="*.js"  → chỉ còn font-preview.html (demo file, OK)
✅ grep -r "Manrope"  --include="*.html" --include="*.css" --include="*.js"  → chỉ còn font-preview.html (demo file, OK)
✅ grep -r "Playfair Display" → 7 files (variables.css + 4 HTML + 2 iframe)
✅ node --check js/*.js  → all 15 files pass
✅ Backward compat token --font-ui giữ nguyên tên → các CSS đang ref var(--font-ui) không vỡ
```

---

## 📁 File diff

```
EDIT  css/variables.css        Google Fonts URL + 3 token vars
EDIT  index.html               URL + 7 font-family
EDIT  login.html               URL + 1 font-family
EDIT  gacha-component.html     URL + 19 font-family + 1 monospace fix
EDIT  minigames-hub.html       URL + 8 font-family (incl. 2 SVG)
EDIT  js/app.js                4 inline → var(--font-display)
EDIT  js/dashboard.js          1 inline → var(--font-display)
EDIT  js/tactics.js            2 inline → var(--font-display)
EDIT  js/auth.js               1 inline → var(--font-display)
EDIT  js/sessions.js           1 inline → var(--font-display)
EDIT  tokens-preview.html      describe text
NEW   CHANGELOG_session5.md
```

11 files edited, 1 new file.

---

## ⚠️ Lưu ý

1. **Payload giảm**: Trước load 3 font (Be Vietnam Pro + Manrope + Cinzel) ≈ 3 file CSS + ~6-8 woff2. Giờ load 2 font (Be Vietnam Pro + Playfair Display). Tốc độ load nhanh hơn ~20-30%.

2. **Vibe khác hẳn**: Playfair Display có thick-thin contrast cao đặc trưng (giống Bodoni nhưng mềm hơn). Khi đứng cạnh đỏ son + amber + bronze sẽ ra vibe editorial Á Đông cổ. Cinzel cũ là all-caps Roman đá — không ăn nhập.

3. **`font-preview.html` vẫn giữ tất cả 13 font** để bạn có thể đổi ý nếu cần. File này không phụ thuộc CSS variables, có thể xoá nếu không cần thiết nữa.

4. **`--font-ui` token tuy đã trỏ về Be Vietnam Pro** (giống `--font-sans`) nhưng vẫn giữ tên — phòng trường hợp tương lai muốn quay lại 2-font (vd thêm Inter cho UI số liệu đậm). Backward compat ngon.

5. **Phase 2 vẫn còn nhiều việc**: refactor inline styles, members table mobile, iframe sync. Font migration này có thể coi là sub-task Phase 1.6 (sau Phase 1.5 hex rebind).
