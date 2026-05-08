# Hướng Dẫn Tích Hợp Mini-Games Hub Vào Nhất Mộng

## 1. File hiện tại

- `minigames-hub.html` (~210 KB, ~5900 dòng) — standalone, mở trực tiếp file là chạy được tất cả 4 game offline.
- Khi nhúng vào Nhất Mộng cần làm 2 việc: tách module + cắm Firebase config.

## 2. 4 game đã có

| Game | Mode hiện tại | Multiplayer (Phase 4) |
|---|---|---|
| 🎯 Vòng Quay May Mắn | Single, không cần multi | Không cần |
| 🦆 Đua Vịt Giang Hồ | Offline single-machine | Có thể nâng (nhiều người chọn vịt cùng lúc) |
| 🎃 Mở Hòm Bí Mật | Offline single-machine, mode điểm | Có thể nâng (luân phiên mở hòm) |
| 🥊 So Tài Tay Đôi | 1 vs AI, 3 độ khó | Có thể nâng (PvP qua phòng) |

## 3. Tích hợp Firebase — bước 1: load SDK

Trước file `minigames-hub.html` (hoặc trong `<head>` Nhất Mộng), thêm 2 script Firebase compat (v10 hoặc tương đương):

```html
<script src="https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore-compat.js"></script>
```

Nếu Nhất Mộng đã dùng Firebase rồi → dùng chung version với app chính, không cần load lại.

## 4. Tích hợp Firebase — bước 2: gọi `MGFirebase.init()`

Sau khi page load xong (DOMContentLoaded), gọi:

```javascript
// Nếu Nhất Mộng đã init firebase.app() rồi → MGFirebase tự nhận, không cần truyền config:
MGFirebase.init();

// Nếu file standalone, cần truyền config:
MGFirebase.init({
  apiKey: "...",
  authDomain: "nhatmong.firebaseapp.com",
  projectId: "nhatmong",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
});
```

**Quan trọng**: gọi `MGFirebase.init()` **TRƯỚC** khi script chính của hub chạy. Cách dễ nhất: paste 1 đoạn `<script>` ngay trên dòng `<script>` của hub.

Nếu chưa init Firebase → hub tự fallback localStorage, chạy bình thường nhưng admin tắt game chỉ ảnh hưởng máy admin (không sync toàn bang).

## 5. Firestore structure

Hub đọc/ghi đúng 1 document để sync game status:

```
minigames/
  status   ← { wheel: bool, duck: bool, chest: bool, rps: bool }
```

Phase 4 (multiplayer thật) sẽ thêm:
```
minigames/
  rooms/
    {roomId}/  ← state phòng đua vịt / mở hòm / kbb
```

## 6. Firestore Security Rules gợi ý

Paste vào Firebase Console → Firestore Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Tất cả thành viên đăng nhập đều được đọc trạng thái game
    match /minigames/status {
      allow read: if request.auth != null;
      // Chỉ admin được ghi
      allow write: if request.auth != null
                   && get(/databases/$(database)/documents/users/$(request.auth.uid))
                        .data.role == "admin";
    }

    // Phase 4 — phòng multiplayer
    match /minigames/rooms/{roomId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Trong rules giả định Nhất Mộng có collection `users/{uid}` với field `role`. Nếu khác cấu trúc → sửa lại dòng `get(...)`.

## 7. Admin role

Hiện trong file standalone đặt cứng:

```javascript
const isAdmin = true; // tạm test
```

Khi nhúng Nhất Mộng, đổi thành đọc role từ context Nhất Mộng:

```javascript
const isAdmin = window.NhatMong.user.role === 'admin';
// hoặc tương đương
```

Tìm `const isAdmin = true;` trong file hub → thay.

## 8. Tách module (optional)

Cấu trúc file hiện tại tất cả trong 1 HTML. Khi nhúng Nhất Mộng nên tách thành:

```
minigames/
  index.html        (chỉ markup)
  minigames.css     (toàn bộ <style>)
  minigames.js      (toàn bộ <script>)
  modules/
    wheel.js        (WheelGame IIFE)
    duck.js         (DuckGame IIFE)
    chest.js        (ChestGame IIFE)
    rps.js          (RpsGame IIFE)
    firebase.js     (MGFirebase IIFE)
    hub.js          (routing, admin, game status)
```

Cứ tìm các block `// ═══ GAME N: ... ═══` trong JS để biết boundaries.

## 9. Test flow Firebase

1. Mở 2 tab/trình duyệt cùng URL Nhất Mộng có nhúng hub.
2. 1 tab login admin, 1 tab login member.
3. Tab admin tắt game "Vòng Quay" → tab member sau ~1 giây phải tự đổi card sang "🔒 Đang khóa", click vào card báo toast "Bang Trưởng đã tạm khóa game này".
4. Refresh tab member → trạng thái vẫn đúng (vì đọc từ Firestore).
5. Tab admin bật lại → tab member tự mở khóa card.

Nếu không sync → mở DevTools console xem có log `[MGFirebase]` lỗi gì không. Phổ biến nhất:
- Quên load Firebase SDK trước hub.
- Permission denied (rules sai hoặc user chưa login).
- ProjectId sai trong config.

## 10. Roadmap Phase 4 (tương lai)

Khi muốn nâng 3 game multiplayer thật:

- Đua Vịt: admin tạo phòng → member chọn vịt cá cược → countdown → race kết quả từ admin (server-side hoặc 1 client làm host) → mọi người xem live.
- Mở Hòm: admin bày bàn → member luân phiên click → score từng người tracking trên Firestore.
- Kéo Búa Bao: 2 player join phòng → mỗi người chọn chiêu (encrypted hoặc commit-reveal để tránh peek) → reveal đồng thời.

Mỗi cái sẽ thêm `RoomManager` riêng dùng `MGFirebase.subscribeRoom/sendAction`. Adapter đã có placeholder, chỉ cần implement.

---

Có gì khó hiểu cứ paste log + screenshot, mình debug.
