# 🐉 NHẤT MỘNG — Session Archive

**Ngày lưu:** 7 tháng 5, 2026
**Mục đích:** Lưu lại toàn bộ context project để mở session mới với đầy đủ thông tin.
**Cách dùng:** Khi mở session Claude mới, paste nội dung file này vào tin nhắn đầu tiên.

---

## 📋 TỔNG QUAN PROJECT

**Project:** Bang hội game "Nhất Mộng" (一夢江湖)
**Website chính:** `nhatmong.vercel.app`
**Người làm:** Admin bang hội (bạn)
**Stack:** HTML + CSS + JS standalone, Firebase (project `nhatmongdata`)
**Theme:** Tửu quán giang hồ — đỏ son · cam đèn lồng · nâu đồng cổ
**Fonts:** Be Vietnam Pro + Manrope + Cinzel
**Yêu cầu cá nhân:**
- KHÔNG dùng tone xanh lá ("đáng sợ")
- Thích "ngầu kiếm hiệp" nhưng không tối ám
- Vietnamese conversation
- Phản hồi rõ ràng khi UI không đúng (chứng khoán, generic, v.v.)

---

## 📦 INVENTORY FILE OUTPUT HIỆN TẠI

### 1. `gacha-component.html` (91 KB, 2608 dòng)
**Trạng thái:** ✅ HOÀN THÀNH — không thay đổi từ session trước

**Nội dung:** Hệ thống Gacha Bang Chiến độc lập
- Tên: "Gacha Thẻ tháng 3 - 4 cái/chu kỳ (2 tuần)"
- Pool quay từ 7 hạng mục tổng hợp
- Logic blacklist 2 chu kỳ: trúng ở chu kỳ N → bị khóa hết chu kỳ N+2
- Nút "Đóng chu kỳ" để admin chuyển N→N+1
- Theme tửu quán: 2 đèn lồng SVG (chữ N M = Nhất Mộng), tro tàn bay lên
- Vè bang: `"99% con nghẹo dừng lại trước cửa thắng"` (italic, vàng kim)
- 7 mega effects khi trúng: screen shake, pháo hoa toàn màn hình (40 hạt 4 cụm), kim quang ring, sunburst rays (12 tia), name slam-in, typewriter từng chữ, 5-phase Web Audio (riser/cymbal/coin/arpeggio/fanfare)

### 2. `minigames-hub.html` (173 KB, 4828 dòng)
**Trạng thái:** ✅ HOÀN THÀNH — vừa giảm từ 205KB sau khi xóa game đấu

**Nội dung:** Hub mini-games với 3 game

#### Header & layout chung:
- Brand "Sòng Bạc Giang Hồ · Bang Hội Nhất Mộng"
- Nickname input + admin badge "👑 Bang Trưởng" + sync badge online/offline
- Nút "← Về Sòng Bạc"
- Admin features: `const isAdmin = true` (test mode), toggle pill mở/đóng từng game ở góc card
- Card đóng có overlay xám "🔒 Bang Trưởng đã khóa"

#### Game 1: 🎯 Vòng Quay May Mắn
- Phong cách wheelofnames: textarea bên phải nhập tên (mỗi dòng 1 tên)
- Wheel tự render lại, 8 màu palette tửu quán luân phiên
- `crypto.getRandomValues()` cho random
- Click trực tiếp lên wheel để quay
- Smart sizing font theo số tên
- Default 4 tên "Hiệp Khách 1-4"
- Toggle "Tự xóa người trúng" mặc định ON
- Animation 5.5s deceleration, sound tick-tick + ascending arpeggio

#### Game 2: 🦆 Đua Vịt Giang Hồ
- Setup: chọn 4/6/8/10 vịt + ô input tự do 2-20
- 3 bối cảnh: 🌳 Rừng ban ngày · 🌅 Hoàng hôn · 🏯 Sân tre trúc
- 6 thú cổ vũ dọc đáy track với jump animation
- Flow: Setup → "Bắt đầu đua" → race screen → countdown 3-2-1 → race
- Top 1-2-3 podium Olympic style với 🥇🥈🥉 + thời gian + block podium
- Pool 20 tên giang hồ ("Lý Tiểu Vịt", "Quách Tĩnh Vịt"...)

#### Game 3: 📦 Mở Hòm Bí Mật (mode điểm)
- Setup: chọn 9/12/16 hòm
- Config phần thưởng: 💎 Báu vật lớn +10đ · 🪙 Báu vật nhỏ +5đ · 🐍 Bẫy rắn -5đ
- Hòm trống tự tính
- Tối đa 5 lượt mở mỗi ván
- 3 info pill: 💯 Điểm · 🎯 Lượt còn · 📦 Đã mở
- Floating delta `+10/+5/-5/0` bay lên khi mở hòm, 4 sound khác nhau
- Lịch sử max 10 lượt
- Đánh giá: ≥20 👑 Đại Cát · ≥10 🏆 Thắng lớn · 1-9 💰 Có lãi · 0 😐 Hòa · <0 💀 Lỗ

#### Game 4 (đã xóa hoàn toàn): ❌ Game đánh nhau
Đã xóa khỏi hub trong session này (xem section "Hành trình rebuild" bên dưới).

#### Firebase integration đã nhúng:
```javascript
apiKey: "AIzaSyBszK09g8sHvufGNrFwDDgcw6rolV37KSA"
authDomain: "nhatmongdata.firebaseapp.com"
projectId: "nhatmongdata"
storageBucket: "nhatmongdata.firebasestorage.app"
messagingSenderId: "814787062547"
appId: "1:814787062547:web:c4ca571227c5a5555688e6"
measurementId: "G-WH87JWSQGF"
```
- Firebase SDK v10 compat loaded từ gstatic
- `MGFirebase.init()` tự động chạy
- GameStatus dual-backend: Firebase (realtime onSnapshot) hoặc fallback localStorage
- Firestore structure: `minigames/status` document `{ wheel: bool, duck: bool, chest: bool }`
- User cần publish rules tạm thời:
  ```
  match /minigames/{document=**} { allow read, write: if true; }
  ```
- ⚠️ Chưa rõ user đã test sync Firebase chưa

### 3. `FIREBASE_INTEGRATION.md` (8 KB)
Hướng dẫn nhúng vào Nhất Mộng project chính:
- Cách load Firebase SDK trong head
- Cách gọi `MGFirebase.init()`
- Cách tách module nếu cần
- Phần multiplayer Phase 4 (chưa làm)

---

## 🎢 HÀNH TRÌNH SESSION NÀY (game đánh nhau v8 → v13)

Session này tập trung gần như toàn bộ vào game thứ 4 — game đánh nhau — qua nhiều iteration không thành công, cuối cùng quyết định xóa.

### v8 — FaceFighter style đầu (5 chiêu)
Boxing 1v1 với 3 chiêu tấn công + 2 phòng thủ, mặt to giữa khung gỗ vàng + 4 rồng góc + 2 banner cuộn giấy + HP đèn cháy + 6 lớp thương tích.

### v9 — Rebuild theo ảnh user gửi
User gửi ảnh FaceFighter Appy thực tế, chỉ ra UI chưa giống FaceFighter thật. Rebuild với 4 nút tròn 4 góc + camera flip giữa player ↔ AI, gọn lại 4 chiêu (Đấm cao/Đấm thấp/Đỡ/Né).

### v10 — Thêm thương tích + special meter
- Special meter ⚡ ở giữa khung
- 6 lớp thương tích tích lũy theo HP loss thresholds (mắt thâm, môi sưng, plaster, vết máu)
- Incoming-fist bay vào camera POV

### v11 — Piece-based combat (port từ source Java)
User upload `FaceFighter-master.zip` từ repo PattMayne. Đã đọc Java source code (Fight.java, Turn.java, FacePiece.java, FaceFactory.java, Player.java) → port nguyên logic sang JS:
- 3 phase: Face Builder → Foe Select → Battle
- Mỗi nhân vật có nhiều FacePiece với HP riêng
- Reflective (Cool Shades), Absorbent (Mighty Beard), Kamikaze logic
- 19 PNG assets extract từ source
- Đóng gói thành `facefighter-assets.zip` (đã xóa)
- File guide `FACEFIGHTER_ASSETS_GUIDE.md` (đã xóa)

### 💡 Insight quan trọng — User hỏi "có thể chèn Java vào web không"
Tôi đã thừa nhận:
- Java applet đã chết từ 2017
- Source là Android Java, không port được lên web ngoài cách rewrite logic sang JS
- CheerpJ không hỗ trợ Android SDK
- Phiên bản tôi làm chỉ là "mô phỏng" chứ không phải game gốc

### v12 — Embed picker games
User chọn hướng embed game external. Rebuild thành tuyển tập 5 game đối kháng từ Famobi + iDev.Games:
- Ultimate Boxing
- Super Color Combat
- Undisputed MMA
- Punchers
- Kung Fu Fighting

Có iframe player với loading/error/reload/fullscreen + nút "Mở tab mới" fallback. Comment hướng dẫn chỉnh sửa GAMES array trực tiếp trong code + file `EDIT_GAMES_GUIDE.md` chi tiết. Hỗ trợ cả emoji và URL ảnh thumbnail.

### v13 — XÓA HOÀN TOÀN ✂️
User quyết định xóa game đấu khỏi hub. Đã xóa:
- ✗ Card RPS trong grid
- ✗ Toàn bộ HTML section, CSS (~325 dòng), JS module (~290 dòng), 6 sound functions không dùng (~60 dòng)
- ✗ Tất cả references trong `getGameName`, `DEFAULT_STATUS`, `GAMES_NEED_NICK`, register/init
- ✗ 3 file phụ: `EDIT_GAMES_GUIDE.md`, `FACEFIGHTER_ASSETS_GUIDE.md`, `facefighter-assets.zip`
- File giảm từ **205KB → 173KB** (-16%, gọn 32KB)

### 📚 Bài học từ session
Vấn đề cốt lõi là Claude không thể tạo ra game đánh nhau "thật" trên web — chỉ làm được mô phỏng emoji/SVG hoặc embed game external. User cuối cùng đưa ra quyết định đúng đắn nhất: xóa hẳn game này, tập trung 3 game khác đã hoạt động tốt. Khi đối mặt với vấn đề kỹ thuật không giải được (Java → web), thừa nhận sớm tốt hơn là cố thử nhiều phiên bản.

---

## 🛠 KIẾN THỨC KỸ THUẬT QUAN TRỌNG

### Module pattern
- Mỗi game IIFE riêng (WheelGame, DuckGame, ChestGame), expose `{ init, $screen }`
- `secureRandomInt()` declared local trong từng module
- `escapeHtml()`, `fmtTime()` global utils
- `showModal()`, `showToast()` global helpers
- Sound: Web Audio API (`playTone`, `playNoise`) global

### State globals
- `GAMES_NEED_NICK = new Set([])` — tất cả game offline không cần nick
- `DEFAULT_STATUS = { wheel: true, duck: true, chest: true }` — admin có thể toggle

### Firebase Firestore structure
```
minigames/
  status              → { wheel: bool, duck: bool, chest: bool }
  rooms/
    {roomId}          → state phòng multiplayer (Phase 4 — CHƯA LÀM)
```

### Firestore rules gợi ý (test mode)
```
match /minigames/status {
  allow read: if request.auth != null;
  allow write: if request.auth != null
                && request.auth.uid in ["UID_ADMIN_1", "UID_ADMIN_2"];
}
```

---

## 🎯 NEXT STEPS GỢI Ý (cho session sau)

### Có thể làm:
1. **Multiplayer Firebase cho 3 game còn lại** (Phase 4):
   - Đua Vịt: nhiều người chọn vịt cùng lúc, có phòng chờ
   - Mở Hòm: luân phiên mở hòm trong cùng 1 ván
   - Vòng Quay: admin quay, nhiều người xem realtime
2. **Test integration vào nhatmong.vercel.app**:
   - User chưa confirm đã test sync Firebase chưa
   - Cần tách module + cắm vào sidebar/topbar architecture của project chính
3. **Polish 3 game hiện có** nếu user phát hiện bug khi dùng thực tế
4. **Game thứ 4 hướng khác** (nếu user đổi ý) — nhưng đừng làm game đánh nhau, đã thử và không thành công

### KHÔNG làm:
- ❌ Game đánh nhau dạng FaceFighter (đã thử nhiều lần, không khả thi)
- ❌ Embed Java applet hoặc CheerpJ (không support Android SDK)
- ❌ Tạo game cần engine 3D phức tạp

---

## 🔑 QUICK REFERENCE PASTE VÀO SESSION MỚI

```
Tôi là admin bang hội game "Nhất Mộng" (nhatmong.vercel.app).
Project có 2 component chính đã hoàn thành:

1. gacha-component.html (91KB) — Gacha Bang Chiến với blacklist 2-cycle
2. minigames-hub.html (173KB) — Hub 3 mini-game: Vòng Quay May Mắn, Đua Vịt Giang Hồ, Mở Hòm Bí Mật

Theme: tửu quán giang hồ (đỏ son · cam đèn lồng · nâu đồng cổ).
Fonts: Be Vietnam Pro + Manrope + Cinzel.
KHÔNG dùng tone xanh lá.
Vietnamese conversation.

Firebase đã nhúng (project nhatmongdata), config có sẵn trong code.
Game thứ 4 (đánh nhau) đã thử nhiều phiên bản (v8-v12) và xóa hoàn toàn ở v13.

[Mô tả task mới của bạn ở đây]
```

---

## 📂 FILE CẦN GIỮ LẠI

Khi đóng session, hãy download các file này về máy:

| File | Size | Mô tả |
|---|---|---|
| `gacha-component.html` | 91 KB | Gacha standalone, hoàn thành |
| `minigames-hub.html` | 173 KB | Hub 3 game, hoàn thành |
| `FIREBASE_INTEGRATION.md` | 8 KB | Guide nhúng Firebase |
| `SESSION_ARCHIVE.md` | (file này) | Context cho session sau |

---

*File này được tạo tự động cuối session 7/5/2026. Bản gốc tóm tắt session lưu trong transcript của Claude.*
