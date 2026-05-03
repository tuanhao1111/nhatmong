# Hướng Dẫn Migrate Sang Phiên Bản Mới

## TÓM TẮT THAY ĐỔI

Phiên bản cũ:
- Login bằng email + lưu password dạng `btoa()` (Base64) trong Firestore (LỘ MẬT KHẨU)
- Member đăng ký → ghi vào localStorage cá nhân → admin không thấy
- Firestore Rules: `allow read, write: if true` (ai cũng đọc/ghi/xóa được data của bạn)

Phiên bản mới:
- Login bằng **username** qua Firebase Authentication (password được Firebase mã hóa, KHÔNG lưu plaintext ở đâu)
- Member đăng ký → ghi thẳng vào `/users/{uid}` và `/guilds/guild_main/members/{uid}` qua Firebase Auth + realtime onSnapshot → admin thấy ngay
- Firestore Rules: phân quyền theo role (admin/member/guest), member chỉ sửa được record của mình, không tự thăng chức được, người chưa đăng nhập không đọc được gì

## CÁC BƯỚC DEPLOY

### Bước 1: Bật Firebase Authentication

1. Vào https://console.firebase.google.com/u/0/project/nhatmongdata
2. Authentication → Get started
3. Sign-in method → Email/Password → Enable (KHÔNG cần bật Email link)
4. Save

### Bước 2: Update Firestore Rules

1. Vào Firestore Database → Rules tab
2. Copy nội dung từ file `FIRESTORE_RULES.txt` (đoạn `rules_version = '2'` ... `}`)
3. Publish

### Bước 3: Backup data cũ (NẾU CÓ)

Nếu Firestore của bạn đã có data quan trọng (members trong `/guilds/guild_main`):

1. Vào Firestore → `/guilds/guild_main`
2. Mở DevTools (F12) trong trang web cũ → Console tab
3. Chạy: `copy(JSON.stringify(JSON.parse(localStorage.getItem('nghich_thuy_han_guild')), null, 2))`
4. Dán vào file `.json` để lưu

### Bước 4: Deploy code mới

Upload toàn bộ thư mục mới (file đã sửa) lên Vercel hoặc nơi đang host.

### Bước 5: Tạo tài khoản Admin (LẦN ĐẦU)

1. Vào trang web mới → Đăng ký:
   - Username: `admin` (hoặc gì cũng được)
   - Password: `admin123` (hoặc gì cũng được)
   - Tên / tên ingame / class: nhập đầy đủ

2. Sau khi đăng ký xong, account này sẽ có role `member` mặc định.

3. Vào Firebase Console → Firestore → `/users/{uid của admin vừa tạo}`
   - Sửa field `role` từ `"member"` → `"admin"`
   - Save

4. Refresh trang web → account này giờ là Admin (sẽ thấy menu Cấu Hình + Tài Khoản, có nút "Push Firebase").

### Bước 6: Migrate data cũ (NẾU CÓ)

Nếu bạn đã backup data cũ ở Bước 3:

1. Đăng nhập với account admin vừa tạo
2. Vào trang Cấu Hình → import file JSON đã backup (chức năng có sẵn ở Cấu Hình)
3. Bấm nút "🔥 Push Firebase" trên topbar để đẩy lên cloud

LƯU Ý: Members trong data cũ có ID dạng `Date.now().toString(36)`, KHÁC với UID của Firebase Auth. Nghĩa là:
- Member cũ vẫn xuất hiện trong danh sách (admin có thể xem/sửa/xóa)
- Nhưng những member cũ này KHÔNG thể tự đăng nhập được, vì họ không có tài khoản Auth
- Họ phải đăng ký mới với Firebase Auth, sau đó admin xóa record cũ + giữ record mới

Nếu bang ít người (< 20-30) thì khuyên: bảo từng người đăng ký lại, admin xóa hết record cũ. Sạch và đơn giản nhất.

## KIỂM TRA SAU KHI DEPLOY

Test theo thứ tự:

1. **Đăng ký member mới** (mở incognito, không phải trình duyệt admin)
   - Đăng ký username "test1" / password "test123" / điền đủ thông tin ingame
   - Kết quả mong đợi: redirect vào app.html, thấy bản thân trong "Thành Viên"

2. **Admin thấy member mới ngay** (ở trình duyệt admin, không refresh)
   - Mở trang "Thành Viên" → phải thấy "test1" xuất hiện trong vài giây
   - Mở trang "Tài Khoản" → phải thấy "test1" với role Member

3. **Member tự sửa info**
   - Ở incognito (đang login test1) → vào trang "Thành Viên"
   - Phải thấy nút "✏ Sửa info của tôi" ở dòng của mình (không có ở dòng người khác)
   - Sửa chiến lực → Save → admin phải thấy update ngay

4. **Member KHÔNG thể tự thăng admin** (test bảo mật)
   - Ở incognito, mở DevTools Console
   - Chạy: `firebase.firestore().collection('users').doc(firebase.auth().currentUser.uid).update({role:'admin'})`
   - Phải báo lỗi `permission-denied` → tốt
   - Nếu thành công → rules sai, vui lòng kiểm tra lại Bước 2

5. **Admin xếp nhóm cho member**
   - Trang "Thành Viên" → bấm "Sửa" ở dòng test1 → đổi nhóm → Save
   - Member phải thấy nhóm cập nhật trong vài giây

## TROUBLESHOOTING

**"Firebase chưa kết nối, vui lòng đợi..." khi đăng nhập**
→ Check Console (F12), thường do chưa bật Authentication ở Bước 1

**"Tên đăng nhập hoặc mật khẩu không đúng" mặc dù vừa đăng ký**
→ Có thể đăng ký failed giữa chừng. Vào Firebase Console → Authentication → Users
→ nếu thấy email `username@nhatmong.local` thì account Auth có, nhưng có thể `/users/{uid}` chưa tạo → xóa user đó trong Auth, đăng ký lại

**Admin không thấy member mới sau vài phút**
→ Mở Console (F12) → tab Network → filter "firestore" → kiểm tra request có lỗi `permission-denied` không
→ Nếu có → rules chưa publish đúng, kiểm tra Bước 2

**Account admin@guild.com cũ vẫn login được**
→ Phải xóa account cũ trong Authentication. Hoặc tạo account mới và set role admin ở /users/{uid}.

## TÍNH NĂNG XEM PHIM

Đã tích hợp trang "🎬 Xem Phim" (Bún Bò on Air) vào sidebar.

- Phim load từ API phimapi.com (không cần host video, không tốn bandwidth)
- **Guest** xem được, nhưng favorites/history chỉ lưu localStorage (mất khi xóa cookie hoặc đổi máy)
- **Member/Admin** đăng nhập rồi: favorites/history sync lên Firestore tại `/users/{uid}/movies/data` → vào máy nào cũng thấy
- Hỗ trợ HLS streaming (.m3u8) qua hls.js

Files liên quan:
- `js/movies.js` - logic trang
- `css/movies.css` - styling (đã scope vào `.movie-hub`, không xung đột với nhatmong)
- `app.html` - đã thêm hls.js CDN + load file movies

Firestore path mới được mở rule cho:
- `/users/{uid}/movies/{anyDoc}` - chỉ owner (chính user đó) đọc/ghi được

Nếu muốn bỏ trang phim: xóa dòng `movies:` trong `PAGES` ở `js/app.js`. Code và CSS có thể giữ lại không sao.
