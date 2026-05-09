# Changelog — Tích hợp Kho POV Bang Chiến (admin-only)

## Tóm tắt

Nhúng tính năng "Kho POV Bang Chiến" (gốc là file standalone `kho-pov-bang-chien.html`) thành **một page mới trong app Nhất Mộng**, chỉ admin mới thấy & truy cập được.

## Quyết định kiến trúc

File gốc và app Nhất Mộng có 2 hệ Firebase + auth khác nhau:

|  | nhatmong | kho-pov gốc |
|---|---|---|
| Firebase project | `nhatmongdata` | (riêng) |
| Auth | username/password (fake email `@nhatmong.local`) | Google Sign-In |
| Phân quyền | `/users/{uid}.role` (admin/member/guest) | `/guild_war_access/whitelist` + `/admins` (theo email) |
| SDK | compat v9.23 | modular v10.13 |

→ Không nhúng nguyên file (sẽ tạo 2 Firebase app + 2 hệ login chồng nhau).
→ **Cách làm**: chuyển nội dung kho POV thành 1 page (`renderKhoPovPage`), dùng chung Firebase project `nhatmongdata` và hệ auth username/password đã có.

## File thay đổi

### Mới
- **`js/khopov.js`** — Toàn bộ logic Kho POV: render page, listen Firestore `guild_war_matches`, form CRUD, modal viewer iframe Drive, anti-leak listener bật/tắt theo page.

### Sửa
- **`app.html`** — thêm `<script src="js/khopov.js"></script>` (trước `app.js`).
- **`js/app.js`** — thêm vào `PAGES`:
  ```js
  khopov: { label:'Kho POV', icon:'🎥', render: renderKhoPovPage, adminOnly:true }
  ```
  + thêm `'khopov'` vào danh sách bottom-nav active state.
- **`FIRESTORE_RULES.txt`** — thêm rule cho collection mới:
  ```
  match /guild_war_matches/{matchId} {
    allow read, write: if isAdmin();
  }
  ```

## Cấu trúc Firestore mới

```
guild_war_matches/                    (collection mới, cùng project nhatmongdata)
  {auto-id}/
    date: "YYYY-MM-DD"
    opponent: string
    result: "win" | "loss" | "draw"
    note: string
    links: [{ name, url, type:"video"|"image" }]
    createdAt, updatedAt: serverTimestamp
    createdBy, updatedBy: uid
    createdByName, updatedByName: string (để hiển thị)
```

**Không cần migration** vì đây là collection mới. Nếu trước đây bạn đã dùng file `kho-pov-bang-chien.html` ở Firebase project khác và muốn đem data sang, cần export/import thủ công qua Firebase Console (Firestore → Export collection).

## Hành vi

### Phân quyền
- **Admin**: thấy mục "Kho POV" trong sidebar, đọc + thêm + sửa + xóa.
- **Member/Guest**: KHÔNG thấy mục Kho POV trong sidebar; nếu nhập tay URL `#khopov` cũng bị guard (Firestore Rules từ chối read luôn).

### Anti-leak
- Tắt right-click, F12, Ctrl+S, Ctrl+U, Ctrl+Shift+I/J/C **chỉ khi đang ở page Kho POV**.
- Tự động gỡ khi user chuyển sang page khác (lắng nghe `hashchange`).
- Watermark hiển thị username người xem trong modal viewer.
- Iframe Drive sandboxed (`allow-scripts allow-same-origin allow-presentation`), có overlay che nút "Open in new tab" góc phải trên.

### Realtime
- Dùng `onSnapshot` của Firebase compat v9 (cùng SDK với phần còn lại của app).
- Subscribe khi vào page, unsubscribe khi rời page.

## Hướng dẫn deploy

### 1. Publish Firestore Rules mới (BẮT BUỘC)
- Mở Firebase Console → project `nhatmongdata` → Firestore Database → Rules.
- Copy toàn bộ block `rules_version = '2';` từ `FIRESTORE_RULES.txt`.
- Paste, Publish.
- Nếu không làm bước này, admin sẽ gặp lỗi `permission-denied` khi vào page Kho POV.

### 2. Upload file lên hosting
Thay 4 file đã sửa/mới:
- `app.html`
- `js/app.js`
- `js/khopov.js` (mới)
- `FIRESTORE_RULES.txt` (chỉ tham khảo, không deploy)

### 3. Test
1. Login bằng tài khoản admin → thấy "Kho POV" trong sidebar (icon 🎥).
2. Click vào → thấy stats, toolbar "+ Thêm trận", danh sách rỗng.
3. Bấm "+ Thêm trận" → điền form → Lưu → trận xuất hiện trong list.
4. Click vào file POV → modal viewer mở, video/ảnh Drive nhúng iframe.
5. Logout, login bằng member → sidebar KHÔNG có "Kho POV". Thử URL `#khopov` → màn hình 🔒 "Chỉ Admin được xem Kho POV".
6. Mở DevTools (F12) ở page Kho POV → bị chặn. Mở ở page khác → hoạt động bình thường.

## Hạn chế & lưu ý

- **Anti-leak là client-side**, không thay thế security thật. Người có kỹ thuật vẫn có thể bypass (mở DevTools trước khi vào page, dùng curl/wget, v.v.). Bảo mật thật sự dựa vào Firestore Rules + Drive permission.
- **Drive folder phải share đúng**: đặt folder ở chế độ "Hạn chế" và share riêng cho email các thành viên. Nếu để "Bất kỳ ai có link", người không thuộc bang vẫn xem được khi có link.
- Nếu sau này muốn cho member xem (không sửa) Kho POV, sửa rule:
  ```
  match /guild_war_matches/{matchId} {
    allow read:  if isMember();
    allow write: if isAdmin();
  }
  ```
  + đổi `adminOnly:true` thành check `isMember()` trong `app.js` PAGES.
