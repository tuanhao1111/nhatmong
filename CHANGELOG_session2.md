# Session Changelog — Security Hardening + Brand/Font Drift Fix

Phiên này khắc phục các vấn đề tìm được khi review code:

1. **🔴 CRITICAL — XSS trong trang Quản Lý Tài Khoản** (đã verify exploit + fix)
2. **⚠ Concurrent-write conflict** trong Gacha Firestore push
3. **🎨 Brand drift** — "Nghịch Thủy Hàn" còn sót ở 4 chỗ
4. **🎨 Font drift** — main app shell không dùng fonts theme
5. **🧹 Dead code cleanup** trong firebase.js
6. **🛡 Defense-in-depth** — sanitize input ở fbRegister
7. **📄 FIRESTORE_RULES.txt** — file rules đầy đủ + an toàn

---

## 🔴 1. XSS in Quản Lý Tài Khoản (auth.js)

### Vector attack đã verify
```js
// js/auth.js dòng cũ:
onclick="deleteUser('${u.id}','${escHtml(u.name||u.username||'')}')"
```

`escHtml` trong `js/utils.js` cũ KHÔNG escape dấu `'` — chỉ xử lý `& < > "`. Nếu kẻ tấn công đăng ký với `name = "');alert('XSS');//"`, render thành:
```html
<button onclick="deleteUser('xxx','');alert('XSS');//')">Xóa</button>
```
→ Khi admin click bất kỳ delete button nào trên trang → JS chạy với quyền admin của admin → có thể tự promote role, đọc users, push payload Firestore.

Verified bằng jsdom: `alert()` fired → exploit confirmed.

### Fix (2 lớp defense-in-depth)

**Lớp 1 — `escHtml` đầy đủ** (`js/utils.js`):
```js
// Cũ: thiếu ' và `
function escHtml(s){...replace(/"/g,'&quot;');}
// Mới:
function escHtml(s){...replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/`/g,'&#96;');}
```

**Lớp 2 — Bỏ inline onclick, dùng event delegation** (`js/auth.js`):
- Đổi từ `onclick="deleteUser('${id}','${name}')"` sang `data-action="delete-user" data-user-id="${id}" data-user-name="${escHtml(name)}"`
- Thêm 1 IIFE bind `document.addEventListener('click'/'change', ...)` đọc dataset → gọi `deleteUser(t.dataset.userId, t.dataset.userName)`
- Bền vững với re-render (`renderPage()` xóa innerHTML → listener trên `document` vẫn còn)

### Test
End-to-end với 4 evil users + jsdom:
- `"');alert('XSS1');//"`
- `'<img src=x onerror="alert(2)">'`
- `'"><script>alert(3)</script>'`
- `'Bang Chủ Lâm Phong Nhi 🐉'` (control case — tiếng Việt + emoji vẫn đúng)

→ 0 XSS triggers. Confirm deletes + role changes vẫn hoạt động bình thường.

---

## ⚠ 2. GachaSync.push: merge:false → merge:true (gacha-component.html)

### Vấn đề
`docRef.set(data, { merge: false })` overwrite TOÀN BỘ doc `gacha/state` mỗi lần save. Edge case race:
- Admin A đang sửa thể lệ → click Lưu (state local A có `prizeRules` mới + `history` cũ)
- Cùng lúc admin B đang spin gacha → state local B có `history` mới + `prizeRules` cũ
- Whoever saves cuối cùng → ghi đè data của người kia

### Fix
```js
// Cũ: await docRef.set(data, { merge: false });
// Mới: await docRef.set(data, { merge: true });
```

Consistent với `firebase.js saveData()` (đã merge:true) và `MGFirebase.pushGameStatus()` (đã merge:true).

**Caveat**: với `merge:true`, không xóa được field bằng cách bỏ nó khỏi object — phải dùng `firebase.firestore.FieldValue.delete()`. Hiện tại không có flow nào cần xóa hard, nên OK.

---

## 🎨 3. Brand "Nghịch Thủy Hàn" → "Nhất Mộng"

Trước đây mixed:
| File | Trước | Sau |
|---|---|---|
| `app.html` `<title>` + splash | "Nghịch Thủy Hàn" | "Nhất Mộng" ✅ |
| `login.html` `<title>` + logo | "Nghịch Thủy Hàn" | "Nhất Mộng" ✅ |
| `js/auth.js` requireAuth screen | "NGHỊCH THỦY HÀN" | "NHẤT MỘNG" ✅ |

Verify: `grep -rn "Nghịch Thủy Hàn\|NGHỊCH THỦY HÀN"` → 0 results.

---

## 🎨 4. Fonts: Be Vietnam Pro + Manrope + Cinzel

Trước đây:
- `gacha-component.html`: Be Vietnam Pro + Manrope + Cinzel ✅
- `app.html` + `css/variables.css`: Cinzel + **Noto Sans + ZCOOL XiaoWei + Noto Serif SC + Cormorant Garamond** ❌

→ Iframe Gacha đẹp wuxia, vào main app shell typography khác hẳn.

### Fix
- `app.html`: chỉ load Be Vietnam Pro + Manrope + Cinzel
- `css/variables.css`:
  - `body` font-family: `'Be Vietnam Pro', system-ui, sans-serif`
  - `input/select/textarea`: `'Manrope', system-ui, sans-serif`
  - `button`: `'Be Vietnam Pro', system-ui, sans-serif`
  - `h1-h4`: giữ Cinzel (đã đúng từ đầu)

`movies.css` còn dùng các font cũ — không sửa trong session này vì có thể là chủ đích cho UX trang movies (cinematic feel). Để bạn tự quyết.

### Cleanup nhẹ
- Splash gradient `gold→cyan` → `gold→#c0392b (đỏ son đậm)` cho khớp wuxia palette.

---

## 🧹 5. Dead code: `_listenUsers` skip-self check

`firebase.js`:
```js
// Cũ: if (sess.id === 'admin' || sess.role === 'guest') return;
//   ↑ legacy của bản pre-Firebase-Auth — admin giờ có UID Firebase thật
//     nên 'admin' literal không bao giờ match.
// Mới: if (sess.role === 'guest') return;
```

---

## 🛡 6. `_sanitizeProfileText` ở fbRegister (firebase.js)

Defense-in-depth: input vào Firestore đã sạch sẵn, render-side escape là lớp 2.

```js
function _sanitizeProfileText(s, maxLen) {
  if (s == null) return '';
  // Bỏ < > " ' ` \ và control chars; giữ Unicode (tiếng Việt, emoji OK)
  var cleaned = String(s).replace(/[<>"'`\\\u0000-\u001F\u007F]/g, '').trim();
  return cleaned.slice(0, maxLen || 60);
}
```

Apply cho name (60 chars), inGameName (60), inGameId (40), discordId (60), class (30) — match field length thực tế dùng.

Test cases:
- ✅ `Bang<script>alert('x')</script>` → `Bangscriptalert(x)/script`
- ✅ `Lâm Phong Nhi` (Vietnamese) → giữ nguyên
- ✅ `Bang Chủ 🐉` (emoji) → giữ nguyên
- ✅ Trim whitespace
- ✅ Cap maxLen
- ✅ `null` → `''`

---

## 📄 7. FIRESTORE_RULES.txt — file rules production-ready

File mới đầy đủ:
- `isSignedIn() / isAdmin() / isMember() / isSelf(uid)` helpers
- `isCleanText(s, maxLen)` — server-side regex tương tự `_sanitizeProfileText` chống bypass client-side
- Per-collection rules:
  - `/users/{uid}`: read all signed · self-create với role bắt buộc 'member' · self-update không được tự promote · admin delete
  - `/guilds/guild_main`: read signed · admin write
  - `/guilds/guild_main/members/{id}`: self-update với role không đổi · admin full
  - `/guilds/guild_main/gacha/{docId}`: read signed · admin write
  - `/guilds/guild_main/gacha/audit/{id}`: append-only log (immutable)
  - `/minigames/status`: read signed · admin write
  - `/minigames/rooms/{id}`: host hoặc admin update
- Catch-all `deny`

Đáng chú ý — quy tắc `isCleanText`:
```
!s.matches('.*[<>"\'`\\\\\\u0000-\\u001f\\u007f].*')
```
Block các ký tự nguy hiểm ở backend → kẻ tấn công không thể bypass bằng cách gọi Firestore SDK trực tiếp (skip client validation).

---

## 🧪 Tổng kết test

| Test | Pass |
|---|---|
| escHtml escape `'` `\`` etc. | 5/5 |
| XSS không fire khi click delete với 4 evil users | 4/4 |
| Brand consistency | ✅ |
| Fonts loaded đúng | 7/7 |
| Gacha merge:true | 2/2 |
| Dead code removed | 2/2 |
| _sanitizeProfileText behaviour | 7/7 |
| Integration: admin=1 / admin=0 vẫn render đúng | 5/5 |
| Sanitizer XSS từ session trước (regression) | 17/17 |

**Total: 49 actual checks, 0 failures.**

---

## 📝 Files thay đổi

| File | Thay đổi |
|---|---|
| `js/utils.js` | escHtml escape thêm `'` và `` ` `` |
| `js/auth.js` | Bỏ inline onclick → data-action + event delegation; brand rename |
| `js/firebase.js` | Bỏ dead code `sess.id === 'admin'`; thêm `_sanitizeProfileText` |
| `gacha-component.html` | GachaSync.push: merge:true |
| `app.html` | Fonts thay đổi; splash gradient red; brand rename |
| `login.html` | Brand rename |
| `css/variables.css` | Be Vietnam Pro / Manrope thay Noto Sans |
| `FIRESTORE_RULES.txt` | **MỚI** — rules production-ready với input validation |

---

## ⚠ Hành động cần làm trên Firebase Console sau deploy

1. **Copy `FIRESTORE_RULES.txt`** vào Console → Firestore → Rules → Publish
2. Verify Anonymous Auth bật (Authentication → Sign-in method)
3. Test một vòng:
   - Đăng ký user mới với name có `<script>` → verify Firestore reject
   - Login admin → trang Quản Lý Tài Khoản render đúng, click delete OK
   - Login member → vào Gacha thấy read-only
   - Login guest (anonymous) → mọi page read-only

---

## 🔮 Còn lại cho session sau

Từ ý tưởng nâng cấp đã đề xuất, ưu tiên:
- **Audit log thể lệ Gacha** (rules đã prepared sẵn `/guilds/guild_main/gacha/audit/{ts}`)
- **Optimistic concurrency** cho gacha state (version field + transaction)
- **Activity feed dashboard** (last 20 events)
- **Mobile UX cho rules editor modal** (drag-drop khó trên touch)
- Migrate `movies.css` sang fonts mới nếu thấy không match brand
