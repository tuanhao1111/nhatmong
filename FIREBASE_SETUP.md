# 🔥 Hướng dẫn tích hợp Firebase — Từng bước chi tiết

## ✅ Bước 1: Tạo Firebase Project

1. Vào **https://console.firebase.google.com**
2. Click **"Add project"** (hoặc "Tạo dự án")
3. Đặt tên project (vd: `nghich-thuy-han`) → Continue
4. Tắt Google Analytics → **Create project**
5. Chờ tạo xong → **Continue**

---

## ✅ Bước 2: Lấy Firebase Config

1. Trong project, click icon **⚙️ (Settings)** → **Project settings**
2. Kéo xuống mục **"Your apps"**
3. Click icon **`</>`** (Web)
4. Đặt App nickname: `guild-manager` → **Register app**
5. Bạn sẽ thấy đoạn code như này:

```js
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXX",
  authDomain: "nghich-thuy-han.firebaseapp.com",
  projectId: "nghich-thuy-han",
  storageBucket: "nghich-thuy-han.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

6. **Copy toàn bộ 6 giá trị** đó
7. Mở file `js/firebase.js` → Paste vào phần `FIREBASE_CONFIG`:

```js
var FIREBASE_CONFIG = {
  apiKey:            "AIzaSyXXXXXXXXXXXXX",    // ← paste vào đây
  authDomain:        "nghich-thuy-han.firebaseapp.com",
  projectId:         "nghich-thuy-han",
  storageBucket:     "nghich-thuy-han.appspot.com",
  messagingSenderId: "123456789012",
  appId:             "1:123456789012:web:abcdef123456"
};
```

---

## ✅ Bước 3: Tạo Firestore Database

1. Menu trái → **Build** → **Firestore Database**
2. Click **"Create database"**
3. Chọn **"Start in test mode"** → **Next**
4. Chọn location: **`asia-southeast1`** (Singapore, gần VN nhất) → **Done**
5. Chờ tạo xong (~30 giây)

---

## ✅ Bước 4: Cấu hình Security Rules

1. Trong Firestore → Tab **Rules**
2. Xóa hết nội dung cũ, paste vào:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /guilds/{guildId} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

3. Click **Publish**

> ⚠️ Rules này cho phép ai cũng đọc/ghi. Sau khi ổn định, bạn có thể thêm auth check.

---

## ✅ Bước 5: Chạy thử

1. Mở `app.html` trong trình duyệt
2. Nhìn góc trên phải — nếu thấy badge **"🔥 Firebase"** màu xanh → thành công!
3. Thêm một thành viên
4. Vào Firebase Console → Firestore Database → Xem collection `guilds` → document `guild_main`
5. Dữ liệu phải xuất hiện ở đó

---

## ❌ Lỗi thường gặp & cách sửa

| Lỗi | Nguyên nhân | Cách sửa |
|-----|-------------|----------|
| Badge hiện `🟡 Local` | Chưa điền config | Kiểm tra lại `FIREBASE_CONFIG` trong `firebase.js` |
| `Firebase: Error (auth/...)` | Sai config | Copy lại config từ Firebase Console |
| Dữ liệu không sync | Rules chưa đúng | Kiểm tra Firestore Rules → Publish |
| Console: `Failed to fetch` | Không có internet | Cần kết nối internet để dùng Firebase |
| Console: `CORS error` | Mở file:// | Host trên localhost hoặc Netlify (xem bên dưới) |

---

## 🌐 Deploy miễn phí lên Netlify (khuyến nghị)

Nếu bạn muốn thành viên truy cập qua link thay vì mở file:

1. Vào **https://netlify.com** → Sign up miễn phí
2. **"Add new site"** → **"Deploy manually"**
3. Kéo thả toàn bộ thư mục `guild-manager` vào
4. Netlify tạo link tự động (vd: `https://xxx.netlify.app`)
5. Vào Firebase Console → **Authentication** → **Settings** → **Authorized domains**
6. Thêm domain Netlify của bạn vào

---

## 📊 Firebase Free Tier (Spark Plan)

| Tài nguyên | Giới hạn miễn phí |
|-----------|------------------|
| Firestore reads | 50,000 / ngày |
| Firestore writes | 20,000 / ngày |
| Storage | 1 GB |
| Bandwidth | 10 GB / tháng |

→ **Đủ dùng cho 1 bang hội** mà không cần trả tiền.
