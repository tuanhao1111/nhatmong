# SESSION 4 — DESIGN SYSTEM PHASE 1.5 (HEX REBIND + DEAD FILE CLEANUP)

## Tóm tắt
Đóng các gap còn dư của Phase 1 — không phải Phase 2, vẫn nằm trong scope "rebind tone wuxia ngay lập tức không cần đụng JS logic".

Audit phát hiện:
1. **`css/tokens.css` (283 dòng) là dead file** — `variables.css` đã inline tokens, không HTML nào import nó. Để lại sẽ gây lệch (developer khác có thể sửa nhầm file).
2. **`js/app.js → initDashboardStyles()` còn 16 hex hardcoded** từ tone xanh-đen cũ (`#0f0f1e`, `#1a1a2e`, `#08080f`, `#0a0a14`, `#0c0c1c`, `#111124`, `#1a1a35`, `#1e1e38`, `#2a2a40`, `#0a0a18`, `#f0c040`, `#e8a020`, `#0a0a0f`). CSS này được inject mỗi lần render dashboard → Teams Grid + slots + reserve hiện vẫn xanh-đen bất chấp aliases. Đây là sai lệch giữa CHANGELOG_session3 ("đổi tone wuxia ngay lập tức") và rendering thực tế.
3. **Comment header `variables.css` lỗi thời** ("File này import tokens.css") không đúng sự thật.

KHÔNG đụng `dashboard.js` (21 hex), `members.js` (7 hex), `settings.js` (7 hex) — những file đó nằm trong scope refactor Phase 2.

---

## ✅ Đã làm

### 1. Xoá `css/tokens.css`
- File 283 dòng dead code (no HTML import).
- Tokens đã được inline vào `css/variables.css` từ session trước.
- Verify bằng `grep -rn "tokens.css" --include="*.html"` → 0 references.

### 2. Sửa header comment `css/variables.css`
- Từ: "File này import tokens.css và build semantic vars trên đó" (sai)
- Sang: mô tả đúng cấu trúc 4 tầng inline + lý do gộp file (Chrome block cross-file CSS imports trên `file://`).

### 3. Rebind 16 hex trong `js/app.js → initDashboardStyles()`

| Hex cũ | Vai trò | Token mới |
|---|---|---|
| `#0a0a18`, `#0f0f1e` (linear-gradient team-header-big) | bg gradient header | `var(--sand-2)` → `var(--sand-1)` |
| `#1a1a2e` (×6 chỗ: trd-item border, slot-row border, slot-num/name border-right, cfg-row border) | divider lines | `var(--sand-3)` |
| `#08080f` (×2: slot-num-cell bg, slot-info-cell.empty bg) | darker bg | `var(--sand-1)` |
| `#0a0a14` (×2: slot-name-cell.empty bg, slot-info-cell bg) | dark cell bg | `var(--sand-1)` |
| `#0c0c1c` (reserve-slot.empty bg) | empty slot bg | `var(--sand-1)` |
| `#2a2a40` (reserve-slot.empty dashed border) | dashed border | `var(--sand-6)` |
| `#111124` (reserve-slot.filled bg) | filled bg | `var(--sand-3)` |
| `#1e1e38` (reserve-slot.filled border) | border | `var(--sand-5)` |
| `#1a1a35` (reserve-slot.filled hover) | hover bg | `var(--sand-4)` |
| `#0f0f1e` (member-pick-item bg) | item bg | `var(--sand-2)` |
| `#1a1a2e` (member-pick-item hover bg) | hover bg | `var(--sand-3)` |
| `#f0c040`, `#e8a020` (slot-leader-badge gradient) | gold gradient | `var(--amber-9)` → `var(--amber-10)` |
| `#0a0a0f` (text on gold gradient) | dark text | `var(--sand-1)` |

Và 5 rgba refer tới các hex đó:

| Rgba cũ | Token mới |
|---|---|
| `rgba(240,192,64,0.25)` (drag-over-team shadow) | `var(--amber-a4)` |
| `rgba(240,192,64,0.10)` (drag-over-slot bg) | `var(--amber-a3)` |
| `rgba(240,192,64,0.15)` (tsz-btn.on bg) | `var(--amber-a4)` |
| `rgba(240,192,64,0.5)` (trd-trigger open border) | `var(--amber-a6)` |
| `rgba(255,255,255,0.04)` (trd-item hover) | `var(--sand-a4)` |
| `rgba(240,192,64,0.08)` (trd-item.selected) | `var(--amber-a3)` |
| `rgba(240,192,64,0.05)` (slot-row.filled hover) | `var(--amber-a3)` |
| `rgba(240,192,64,0.16)` (slot-skill-chip bg) | `var(--amber-a4)` |
| `rgba(240,192,64,0.4)` (slot-skill-chip border) | `var(--amber-a6)` |

→ Dashboard Teams Grid, Slots Excel-style 3-cột, Reserve grid, Team Role Dropdown, Member Pick modal — tất cả đổi sang sand+amber neutral nâu ấm, đúng tone tửu quán giang hồ.

---

## 🔍 Verification

```
✅ rg "#[0-9a-fA-F]{3,8}" js/app.js                      → 0 matches
✅ node --check js/app.js                                → pass
✅ var() audit toàn project                              → 0 undef refs
✅ Tổng vars defined trong variables.css                 → 262
✅ tokens.css                                            → REMOVED
✅ Backward compat                                       → giữ nguyên (--accent-cyan/-gold/-purple/-green/-red/-vermilion/-lantern-glow/-paper/-night-deep/...)
```

Hex còn lại (Phase 2 sẽ xử lý — KHÔNG nằm trong session này):
- `js/dashboard.js`: 21 hex (role colors `#f0c040`/`#e05050`/`#5090e0`/`#50d0a0` cho Lương/Công/Thủ/Trợ + map bg + absence cards)
- `js/members.js`: 7 hex
- `js/settings.js`: 7 hex
- `css/movies.css`: scoped palette riêng `.movie-hub` self-contained, sẽ migrate khi làm Phase 2 iframe sync.

---

## 📁 File diff

```
DELETE css/tokens.css                               (-283 lines, dead file)
EDIT   css/variables.css   header comment           (3 → 13 lines, đúng sự thật)
EDIT   js/app.js           initDashboardStyles()    (16 hex + 9 rgba → tokens)
NEW    CHANGELOG_session4.md
```

Total: 1 file deleted, 2 files edited, 1 changelog.

---

## ⚠️ Lưu ý cho session sau

1. **CHANGELOG_session3.md** vẫn claim "tokens.css NEW ~270 lines" và "variables.css import tokens.css" — sai. Nếu đọc lại session 3 để học thì cần biết: thực tế đã gộp file, tokens.css là dead file (giờ đã xoá).
2. Phase 2 vẫn còn nhiều việc:
   - Refactor inline styles `dashboard.js/members.js/settings.js` sang utilities + class names (lúc đó sẽ rebind 35 hex còn lại)
   - Card-based members table cho mobile
   - Test modal full-sheet bottom-up từng modal
   - Migrate `gacha-component.html` + `minigames-hub.html` + `movies.css` sang dùng chung tokens
3. Phase 3 (landing/login/dashboard redesign) vẫn chưa động.
