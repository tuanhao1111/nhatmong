# 🏯 Nghịch Thủy Hàn - Guild Manager

## Cấu trúc file

```
guild-manager/
├── index.html          ← File chính, mở file này trong trình duyệt
├── README.md           ← File này
├── css/
│   ├── variables.css   ← Màu sắc, font, utility classes chung
│   └── layout.css      ← Sidebar, topbar, layout tổng thể
└── js/
    ├── storage.js      ← Quản lý dữ liệu (localStorage database)
    ├── utils.js        ← Hàm tiện ích dùng chung (toast, format, ...)
    ├── app.js          ← Router SPA, khởi tạo app
    ├── dashboard.js    ← Trang Chiến Lượt (đội hình bang chiến)
    ├── members.js      ← Trang Thành Viên
    ├── sessions.js     ← Trang Lịch Sử đợt
    └── settings.js     ← Trang Cấu Hình
```

## Cách dùng

1. **Mở file**: Nhấp đôi vào `index.html` hoặc kéo vào trình duyệt
2. **Cấu hình**: Vào ⚙ Cấu Hình → Sửa tên bang, class, nhóm, đội hình
3. **Thêm thành viên**: Vào 👥 Thành Viên → Thêm thành viên
4. **Bang chiến**: Vào ⚔ Chiến Lượt → Tạo đợt mới → Kéo/thêm thành viên vào slot

## Tính năng

| Tính năng | Mô tả |
|-----------|-------|
| **Thành viên** | Thêm/sửa/xóa, phân class, nhóm, vai trò, chiến lực |
| **Đội hình** | N team × M slot, slot dự bị, phân nhóm team |
| **Bang chiến** | Tạo đợt, ghi chú chiến thuật, lịch sử đợt |
| **Cấu hình** | Tùy chỉnh class, nhóm, số team, slot |
| **Backup** | Xuất/nhập JSON, không mất dữ liệu |

## Dữ liệu

Dữ liệu lưu trong **localStorage** của trình duyệt (không cần server).
Dùng nút **📤 Xuất** để backup thường xuyên.

## Tuỳ chỉnh

- **Thêm tính năng mới**: Tạo file `js/tenpage.js`, thêm vào `PAGES` trong `app.js`
- **Đổi màu**: Sửa `:root` trong `css/variables.css`
- **Đổi font**: Sửa `@import` trong `css/variables.css`
