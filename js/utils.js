/**
 * utils.js - Hàm tiện ích dùng chung
 */

function showToast(message, type, duration) {
  duration = duration || 3000;
  var existing = document.querySelector('.toast');
  if (existing) existing.remove();
  var toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.style.cssText =
    'position:fixed;bottom:24px;right:24px;z-index:9999;' +
    'padding:12px 20px;border-radius:8px;font-size:14px;font-weight:500;' +
    'max-width:360px;box-shadow:0 4px 20px rgba(0,0,0,0.5);transition:opacity 0.3s;' +
    'background:' + (type==='error'?'#2d1515':type==='success'?'#0f2d1f':'#1a1a2e') + ';' +
    'color:' + (type==='error'?'#f87171':type==='success'?'#4ade80':'#e8e8f0') + ';' +
    'border:1px solid ' + (type==='error'?'#7f1d1d44':type==='success'?'#14532d44':'#2a2a4044');
  document.body.appendChild(toast);
  setTimeout(function() {
    toast.style.opacity = '0';
    setTimeout(function() { if (toast.parentNode) toast.remove(); }, 300);
  }, duration);
}

function confirmDelete(message) {
  return window.confirm(message || 'Bạn có chắc muốn xóa?');
}

function formatNumber(n) {
  n = Number(n) || 0;
  if (n >= 1e9) return (n/1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return n.toString();
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'});
  } catch(e){ return dateStr; }
}

function getClassColor(classId) {
  if (!classId) return '#666';
  try { var c=Settings.get().classes.find(function(c){return c.id===classId;}); return c?c.color:'#666'; }
  catch(e){ return '#666'; }
}

function getClassName(classId) {
  if (!classId) return '';
  try { var c=Settings.get().classes.find(function(c){return c.id===classId;}); return c?c.name:classId; }
  catch(e){ return classId||''; }
}

function getGroupName(groupId) {
  if (!groupId) return '';
  try { var g=Settings.get().groups.find(function(g){return g.id===groupId;}); return g?g.name:''; }
  catch(e){ return ''; }
}

function getGroupColor(groupId) {
  if (!groupId) return '#666';
  try { var g=Settings.get().groups.find(function(g){return g.id===groupId;}); return g?g.color:'#666'; }
  catch(e){ return '#666'; }
}

function classBadge(classId) {
  var color=getClassColor(classId), name=getClassName(classId);
  if (!name) return '';
  return '<span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:'+color+'22;color:'+color+';border:1px solid '+color+'44">'+escHtml(name)+'</span>';
}

function openModal(html, onClose, wide) {
  var e = document.querySelector('.modal-overlay');
  if (e) e.remove();
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = '<div class="modal"'+(wide?' style="max-width:700px;width:95%"':'')+'>'+
    '<div style="max-height:80vh;overflow-y:auto">'+html+'</div></div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(ev){
    if (ev.target===overlay){overlay.remove();if(onClose)onClose();}
  });
  return overlay;
}

function escHtml(str) {
  if (!str && str!==0) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function navigate(page) { if(typeof renderPage==='function') renderPage(page); }

function denyEdit() { showToast('🔒 Bạn không có quyền chỉnh sửa.','error',3000); }
