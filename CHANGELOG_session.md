# Session Changelog — Guest Access + Rules Editor + Hide Sync UI

Phiên này giải quyết 3 vấn đề:

1. **Guest không xem được Gacha** — khắc phục bằng Anonymous Auth
2. **Thể Lệ Trao Thưởng tùy chỉnh** — Admin tự sửa qua modal editor
3. **Ẩn UI Firebase/đồng bộ** cho non-admin — mọi page

---

## ⚠️ HÀNH ĐỘNG CẦN THỰC HIỆN TRƯỚC KHI DEPLOY

### 1. Bật Anonymous Authentication
**Bắt buộc** để guest đọc được data — nếu không bật, nút "Vào với tư cách Khách" sẽ báo `auth/admin-restricted-operation`.

```
Firebase Console → Authentication → Sign-in method
  → Anonymous → Enable → Save
```

### 2. Firestore Rules
Rules hiện tại đã đủ — `allow read: if isSignedIn();` ở `/guilds/guild_main/gacha`, `/guilds/guild_main`, `/guilds/guild_main/members`, `/users` đã cho guest anonymous (đã `request.auth != null`) đọc được.

Tuy vậy, file `FIRESTORE_RULES.txt` đã được cập nhật phần hướng dẫn để đề cập đến yêu cầu Anonymous Auth — không cần copy-paste rules lại nếu bạn đã publish version trước đó.

---

## 📋 Chi tiết thay đổi

### 1. Guest xem được Gacha (`login.html`, `js/firebase.js`)

**Root cause cũ**: `loginAsGuest()` chỉ ghi sessionStorage `{role:'guest'}` mà không sign-in Firebase Auth → trong iframe Gacha, `firebase.auth().currentUser === null` → `authReady()` resolve `signedIn:false` → subscribe Firestore bị skip → guest thấy state rỗng.

**Fix**:
- `login.html`: `loginAsGuest()` giờ gọi `firebase.auth().signInAnonymously()` trước, lưu UID anonymous vào session.
- `js/firebase.js` `onAuthStateChanged`: nếu detect session role=`guest` mà chưa attach Firebase user (do legacy session từ phiên bản cũ, hoặc cookie bị xóa) → tự động `signInAnonymously()` để Firestore Rules `request.auth != null` pass.
- `_listenUsers()`: sửa skip-self check từ `sess.id === 'guest'` thành `sess.role === 'guest'` (vì giờ guest có UID Firebase thật, không còn là literal `'guest'`).

### 2. Thể Lệ Trao Thưởng tùy chỉnh (`gacha-component.html`)

**Schema mới** (lưu vào cùng doc `/guilds/guild_main/gacha/state`, field mới `prizeRules`):

```js
prizeRules: {
  v: 1,
  sections: [
    {
      id: 'sec_xxx',
      kind: 'prize',          // hoặc 'note-list'
      tag: 'Phần Thưởng',
      tagColor: 'gold',       // 'crimson'|'gold'|'bronze'|'lantern'|'deep'|'custom'
      tagCustomBg: '#a02828', // chỉ khi tagColor='custom'
      tagCustomFg: '#fff',
      body: 'Mô tả với <strong>...</strong> hỗ trợ',
      pills: ['Mạng kết liễu', 'Sát thương người chơi']
    },
    {
      id: 'sec_luuy',
      kind: 'note-list',
      title: 'Lưu Ý',
      items: ['Item 1 với <em>nhấn nghiêng</em>', '...']
    }
  ]
}
```

Nếu Firestore chưa có `prizeRules` → fallback `DEFAULT_PRIZE_RULES` (đúng nội dung gốc).

**UI**:
- Header "Thể Lệ Trao Thưởng" có thêm nút **`✎ Sửa Thể Lệ`** — chỉ admin thấy (CSS `hidden` mặc định, JS unhide khi `isAdmin`).
- Click → mở **modal editor full-screen** với:
  - List section editor (drag-drop reorder + nút ▲▼ + 🗑)
  - 2 loại section: "Thẻ Phần Thưởng" (prize) và "Danh sách Lưu Ý" (note-list)
  - Color picker: 5 preset wuxia (Đỏ son / Vàng đèn / Đồng cổ / Cam lồng / Nâu đêm) + native color picker cho màu tùy ý (auto contrast text)
  - Pills editor: nhập tag, Enter để thêm, ✕ để xóa
  - Note items: textarea cho mỗi dòng, +Thêm dòng, 🗑 xóa
  - Body hỗ trợ inline `<strong>` và `<em>` (mọi HTML khác bị escape — chống XSS)
- Footer: **↺ Mặc định** (reset về default), **Hủy** (đóng không lưu), **💾 Lưu thể lệ** (push lên Firestore)
- ESC + click backdrop để đóng

**Sanitizer**: `sanitizeRichText()` whitelist `<strong>`, `<em>`, `<b>` (→ strong), `<i>` (→ em). Mọi tag/attribute khác bị HTML-escape. Điều này đảm bảo nếu account admin bị compromise, kẻ xấu cũng không inject được `<script>` vào view của member/guest.

**Realtime sync**: subscribe callback gọi `renderRules()` mỗi khi nhận snapshot mới → nếu admin sửa từ máy A, member ở máy B thấy update ngay không cần reload.

### 3. Ẩn UI Firebase/đồng bộ cho non-admin

#### 3a. Topbar app chính (`js/firebase.js`, `js/app.js`)
- `_badge()` (firebase.js): chèn badge `🔥 Firebase` vào `.topbar-actions` chỉ khi role=admin. Member/guest → tự gỡ khỏi DOM nếu đã có (defensive cho case role thay đổi runtime).
- `topbar-user-tag` (app.js): chỉ render text "Admin: Tên" cho admin. Member/guest thấy topbar gọn — họ vẫn thấy role + tên trong sidebar-footer góc dưới-trái (trải nghiệm hiện có không bị ảnh hưởng).
- **Bonus**: sửa bug typo `}}` thừa ở dòng 81 app.js (vô hại nhưng render literal `}` vào HTML).

#### 3b. Iframe Gacha (`gacha-component.html`)
- CSS rule mới: `.gacha-hub.gh-readonly #ghSyncBadge { display: none !important; }`. Member/guest đã có class `.gh-readonly` rồi nên badge "Đang đồng bộ / Chưa đăng nhập" tự động ẩn.

#### 3c. Iframe Mini-Games (`minigames-hub.html`)
- CSS rule mới: `body:not(.mg-admin) .mg-sync-badge { display: none !important; }`.
- JS: trong IIFE `MiniGamesHub`, sau khi đọc `isAdmin` từ query string → `document.body.classList.toggle('mg-admin', isAdmin)`. Admin có class → thấy badge; member/guest không có → CSS ẩn.

---

## 🧪 Đã test

- ✅ Syntax check tất cả inline `<script>` blocks
- ✅ jsdom integration test với `?admin=1`:
  - Edit button visible, click → modal mở
  - Default rules render đầy đủ 4 sections (3 prize + 1 note-list với 9 items)
  - Editor body render 4 section editors
- ✅ jsdom test với `?admin=0`:
  - Edit button hidden
  - `.gh-readonly` class apply
  - Container vẫn render đầy đủ data
- ✅ jsdom test minigames-hub:
  - `?admin=1` → `body.mg-admin` class
  - `?admin=0` → không có class → CSS sẽ ẩn `.mg-sync-badge`
- ✅ Sanitizer test: `<script>`, `<a href onclick>` đều bị escape; `<strong>`, `<em>`, `<b>`, `<i>` được giữ
- ✅ Contrast picker: tự pick fg `#1a0f0a` cho nền sáng, `#fff` cho nền tối

---

## 📝 Files thay đổi

| File | Thay đổi |
|------|----------|
| `login.html` | `loginAsGuest()` → `signInAnonymously()` |
| `js/firebase.js` | Auto anonymous signin trong `onAuthStateChanged` cho guest session; `_badge()` admin-only; sửa skip-self check trong `_listenUsers` |
| `js/app.js` | `topbar-user-tag` admin-only; sửa bug `}}` |
| `gacha-component.html` | + CSS rules editor + modal markup + JS render dynamic + RulesEditor module + ẩn `#ghSyncBadge` cho non-admin |
| `minigames-hub.html` | + CSS `body:not(.mg-admin) .mg-sync-badge { display:none }` + JS toggle `mg-admin` body class |
| `FIRESTORE_RULES.txt` | Update setup notes về Anonymous Auth |

---

## 🔮 Ý tưởng cho phiên sau (không làm trong phiên này)

- Có thể tách `prizeRules` thành sub-doc riêng `/guilds/guild_main/gacha/rules` để tách concern và giảm payload subscribe (hiện 1 doc state ~vài KB là OK).
- Rich-text editor đầy đủ (bold/italic/list buttons) thay vì textarea raw HTML cho admin.
- Image upload cho phần thưởng (Firebase Storage).
- History/audit log của các lần sửa thể lệ.
