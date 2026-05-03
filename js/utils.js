/**
 * utils.js - Hàm tiện ích dùng chung
 */

function showToast(message, type, duration) {
  duration = duration || 3000;
  var existing = document.querySelector('.toast');
  if (existing) existing.remove();
  var toast = document.createElement('div');
  toast.className = 'toast' + (type ? ' ' + type : '');
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(function() {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(function() { if (toast.parentNode) toast.remove(); }, 300);
  }, duration);
}

function confirmDelete(message) {
  return window.confirm(message || 'Bạn có chắc muốn xóa?');
}

function formatNumber(n) {
  n = n || 0;
  if (n >= 1e9) return (n/1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return n.toString();
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr);
  return d.toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr);
  return d.toLocaleString('vi-VN');
}

function getClassColor(classId) {
  if (!classId) return '#666';
  var settings = Settings.get();
  var cls = settings.classes.find(function(c) { return c.id === classId; });
  return cls ? cls.color : '#666';
}

function getClassName(classId) {
  if (!classId) return '';
  var settings = Settings.get();
  var cls = settings.classes.find(function(c) { return c.id === classId; });
  return cls ? cls.name : classId;
}

function getGroupName(groupId) {
  if (!groupId) return '';
  var settings = Settings.get();
  var g = settings.groups.find(function(g) { return g.id === groupId; });
  return g ? g.name : '';
}

function getGroupColor(groupId) {
  if (!groupId) return '#666';
  var settings = Settings.get();
  var g = settings.groups.find(function(g) { return g.id === groupId; });
  return g ? g.color : '#666';
}

function classBadge(classId) {
  var color = getClassColor(classId);
  var name  = getClassName(classId);
  if (!name) return '';
  return '<span class="badge" style="background:' + color + '22;color:' + color + ';border:1px solid ' + color + '44">' + escHtml(name) + '</span>';
}

function roleBadge(role) {
  var map = {
    leader:  { label:'Bang Chủ',   color:'#f0c040' },
    officer: { label:'Phó Bang',   color:'#40c0e0' },
    member:  { label:'Thành Viên', color:'#808090' }
  };
  var r = map[role] || map.member;
  return '<span class="badge" style="background:' + r.color + '22;color:' + r.color + '">' + r.label + '</span>';
}

function openModal(html, onClose, wide) {
  var existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = '<div class="modal" style="' + (wide ? 'max-width:700px;width:95%' : '') + '"><div style="max-height:80vh;overflow-y:auto">' + html + '</div></div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) { overlay.remove(); if (onClose) onClose(); }
  });
  return overlay;
}

function closeModal(overlay) {
  if (overlay) overlay.remove();
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function navigate(page) {
  if (typeof renderPage === 'function') renderPage(page);
}

function denyEdit() {
  showToast('🔒 Bạn không có quyền chỉnh sửa. Liên hệ Admin.', 'error', 4000);
}
