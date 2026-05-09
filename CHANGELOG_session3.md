# SESSION 3 — DESIGN SYSTEM PHASE 1 + FONT DRIFT FIX

## Tóm tắt
Phase 1 của redesign UI/UX: thiết lập design system foundation dựa trên **Radix Colors** (math-proven cho dark mode + APCA contrast) + **Linear** typography scale + visual mood từ **Casino Admin Dashboard** wuxia.

KHÔNG đụng tới logic JS / Firebase / Firestore — chỉ CSS layer + bootstrap files (`app.html`, `index.html`, `login.html`) + minimal JS patch để add bottom-nav cho mobile.

---

## ✅ Đã làm

### 1. Design tokens (PRIMITIVE LAYER)
**File mới: `css/tokens.css`** (186 tokens)

Chia làm 9 nhóm:

| Nhóm | Tokens | Reference |
|------|--------|-----------|
| **Color scales** | 6 scales × 12 steps = 72 | Radix Colors (sand, tomato, amber, bronze, red, grass) |
| **Alpha colors** | 12 (cho overlay/hover/focus) | Radix Colors alpha variants |
| **Typography** | font families × 4, sizes × 10, line-heights × 4, weights × 6, tracking × 5 | Linear-inspired modular scale 1.2 |
| **Spacing** | 16 levels (0 → 96px) | 4px base, Tailwind/Linear style |
| **Radius** | 8 levels (0 → full) | — |
| **Border widths** | 5 | — |
| **Shadow** | 5 elevation + 3 glow + 2 focus | — |
| **Motion** | 5 easings + 5 durations | — |
| **Z-index** | 10 levels | — |
| **Layout & safe-area** | sidebar/topbar/bottom-nav heights + iOS safe-area-inset | — |
| **Tap targets** | 44px (mobile min), 40px (desktop cozy) | iOS HIG + Material |

**Color strategy ánh xạ wuxia:**
- `sand-*` → neutral nâu ấm (background, border, text) → bỏ tone xanh-đen `#0a0a0f` cũ
- `tomato-*` → đỏ son giang hồ (primary CTA)
- `amber-*` → vàng đèn lồng (secondary, warning)
- `bronze-*` → đồng cổ (admin badges, vintage)
- `red-*` → semantic error (tách khỏi tomato để không clash)
- `grass-*` → semantic success (chỉ dùng cho ✓ icons, không lan ra UI chung)

### 2. Semantic layer + backward compat
**File mới: `css/variables.css`** (rewrite)

Giữ TẤT CẢ tên biến cũ (`--bg-primary`, `--accent-gold`, `--accent-cyan`, `--text-primary`, ...) nhưng REBIND về Radix scale.
→ **Toàn bộ inline styles trong `dashboard.js`/`members.js`/... đổi tone wuxia ngay lập tức KHÔNG cần refactor.**

Mapping legacy aliases:
```
--accent-cyan    → --amber-11   (info text)
--accent-purple  → --bronze-9   (admin avatar fallback)
--accent-green   → --grass-9    (success)
--accent-red     → --red-9      (error)

# Cho iframes (gacha-component / minigames-hub):
--vermilion, --crimson, --crimson-glow → tomato-9/10/11
--lantern-warm, --lantern-glow         → amber-9/11
--bronze, --bronze-bright              → bronze-9/11
--paper, --paper-aged                  → sand-12/11
--night-deep, --ink-black              → sand-1
```

Ngoài alias, file này còn build:
- Global reset + base styles
- `.btn` + variants (primary/amber/outline/ghost/danger/sm/lg + legacy `.btn-cyan`/`.btn-green`)
- Form inputs (focus ring đỏ son APCA, mobile font-size 16px chống iOS zoom)
- `.badge` + 5 variants
- `.card` + `.card-hover`
- `.modal-overlay` + `.modal` (mobile = bottom-sheet)
- `.toast` + variants
- `prefers-reduced-motion` + `::selection`

### 3. Utilities layer (NEW)
**File mới: `css/utilities.css`** — Tailwind-style utility classes

Mục đích: thay thế dần inline styles trong JS (75 chỗ trong `dashboard.js`, 61 trong `members.js`).

Phủ:
- Flex/grid (`flex`, `gap-3`, `items-center`, `justify-between`...)
- Spacing (`p-4`, `mt-2`, `mx-auto`...)
- Text (`text-lg`, `font-semibold`, `text-gold`, `truncate`, `line-clamp-2`...)
- Background, border, radius, shadow utilities
- Common patterns: `.stat-tile`, `.chip`, `.empty-state`, `.section-divider`

### 4. Layout rewrite (mobile-first)
**File: `css/layout.css`** (rewrite)

Highlight thay đổi:
- **Sidebar drawer pattern** mobile: `transform: translateX(-100%)` mặc định, mở qua `.is-open` (đổi từ `.open` cũ → khớp convention BEM-ish)
- **`.sidebar-backdrop`** mới: overlay khi drawer mở
- **`.bottom-nav`** mới: 5 mục cố định mobile, hidden ở desktop
- **Safe-area-inset** cho iPhone notch + Android nav bar (`padding-bottom: var(--safe-bottom)`)
- **Tap target ≥ 44px** cho mọi nav-item, button, input
- **`100dvh`** thay `100vh` để fix iOS Safari URL bar
- **Responsive breakpoints**: 768px (mobile), 480px (compact phone)
- Stats row chuyển sang `grid` `auto-fit minmax(120px, 1fr)` thay vì `flex` 1px gap (responsive đúng cách)

### 5. Bootstrap files redesign
**`app.html`** — rewrite từ 1-line minified → format đầy đủ
- Splash screen dùng tokens (gradient tomato → amber thay đỏ-vàng cũ)
- `theme-color` meta cho mobile browser chrome
- `viewport-fit=cover` cho safe-area
- Import order: `tokens.css` (qua `variables.css` import) → `layout.css` → `utilities.css` → `movies.css`

**`index.html`** — fix font drift
- ✅ Gỡ `Noto Sans` import
- ✅ Replace `font-family: 'Noto Sans'` → `'Be Vietnam Pro'` (3 chỗ)
- Add Manrope cho UI font

**`login.html`** — fix font drift
- ✅ Gỡ `Noto Sans` import
- ✅ Replace 2 chỗ inline `font-family: 'Noto Sans'`

### 6. JS patch nhẹ (chỉ `js/app.js`)
- `buildSidebar()` → đổi class `.open` → `.is-open` để khớp CSS, thêm `<div class="sidebar-backdrop">`, `closeSidebar()` được gọi sau khi click nav-item
- `toggleSidebar()` / `openSidebar()` / `closeSidebar()` mới — toggle cả backdrop
- `buildBottomNav()` mới — render 5 tab mobile (Chiến Lượt, Thành Viên, Gacha, Mini Game, More)
  - Tab "More" mở sidebar drawer chứa các secondary pages (Settings, Accounts, Sessions, Movies)
  - Active state highlight bằng top border + amber color
- `renderPage()` → cập nhật bottom-nav active state khi đổi page (logic group "More" cho secondary pages)
- `initApp()` → render bottom-nav sau page-content; hamburger button vào topbar (chỉ hiện mobile qua CSS); user avatar dùng bronze gradient thay xanh dương cũ

### 7. Demo file
**`tokens-preview.html`** — standalone preview design system
- 6 color scales × 12 steps (click cell → copy hex)
- Type scale demo (--fs-xs → --fs-5xl với câu mẫu wuxia)
- Buttons (5 variants × 3 sizes + disabled state)
- Form inputs (text/select/textarea với focus ring)
- Cards + stats row + empty state
- Spacing scale visual
- Radius variants
- Shadow variants (5 elevation + 3 glow)

→ Mở `tokens-preview.html` để xem trước trước khi deploy.

---

## ⚠️ Chưa làm (Phase 2 cho session sau)

Theo plan ban đầu, Phase 1 chỉ là foundation. Phase 2 + 3 sẽ:

1. **Phase 2 — Mobile UX deep work**
   - Refactor inline styles trong `dashboard.js` (75 chỗ), `members.js` (61 chỗ), `settings.js` (25 chỗ) sang utilities + class names
   - Card-based members table cho mobile (hiện table sẽ vỡ ngang trên ≤480px)
   - Modal full-sheet bottom-up đã set CSS nhưng chưa test thực tế với từng modal
   - Drawer animation polish + swipe-to-dismiss

2. **Phase 3 — Trang trọng tâm redesign**
   - **Landing `index.html`**: hero tửu quán có background đèn lồng + texture giấy, social proof, screenshot dashboard mock, CTA rõ
   - **Login `login.html`**: card tửu quán gỗ/giấy thay glass dark
   - **Dashboard**: extract inline styles, role-summary cards có icon + animation chuẩn, empty state có illustration
   - **Settings**: tabs ngang desktop, accordion mobile

3. **Iframe sync (gacha-component / minigames-hub)**
   - Hai file iframe đã có theme tửu quán riêng. Phase 1 đã alias var để parent rebrand không vỡ chúng.
   - Phase 2 sẽ migrate 2 iframe sang dùng cùng `tokens.css` để loại bỏ duplicate definitions (~70 lines × 2 file = 140 lines duplicate có thể cắt).

---

## 🔍 Verification

```
✅ HTML parse: app.html, index.html, login.html, tokens-preview.html — all OK
✅ JS syntax: js/app.js — node --check pass
✅ CSS tokens: 186 primitive + 76 semantic = 262 vars defined
✅ CSS coverage: 0 var() references undefined (sau khi resolve scope của movies.css)
✅ Backward compat: TẤT CẢ legacy var names (--accent-cyan, --accent-gold, --vermilion, --lantern-glow, ...) vẫn work
✅ Font drift: Noto Sans grep count = 0 (toàn project)
```

## 📁 File diff
```
NEW    css/tokens.css         (~270 lines)  · primitive design tokens
REWRITE css/variables.css      (~430 lines)  · semantic layer + base styles + components
REWRITE css/layout.css         (~370 lines)  · mobile-first, bottom-nav, drawer pattern
NEW    css/utilities.css      (~280 lines)  · utility classes
REWRITE app.html               (~85 lines)   · formatted, theme-color, safe-area
PATCH  index.html             font import + 3 inline font-family fixes
PATCH  login.html             font import + 2 inline font-family fixes
PATCH  js/app.js              buildSidebar / toggleSidebar / buildBottomNav / renderPage active state
NEW    tokens-preview.html    standalone demo
```
