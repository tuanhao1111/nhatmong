/**
 * utils.js - Hàm tiện ích
 */
function showToast(msg, type, dur) {
  dur = dur||3000;
  var e = document.querySelector('.toast'); if(e) e.remove();
  var t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  t.style.cssText='position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:500;max-width:360px;box-shadow:0 4px 20px rgba(0,0,0,0.5);transition:opacity 0.3s;background:'+(type==='error'?'#2d1515':type==='success'?'#0f2d1f':'#1a1a2e')+';color:'+(type==='error'?'#f87171':type==='success'?'#4ade80':'#e8e8f0')+';border:1px solid '+(type==='error'?'#7f1d1d44':type==='success'?'#14532d44':'#2a2a4044');
  document.body.appendChild(t);
  setTimeout(function(){ t.style.opacity='0'; setTimeout(function(){ if(t.parentNode)t.remove(); },300); },dur);
}
function confirmDelete(msg){ return window.confirm(msg||'Bạn có chắc muốn xóa?'); }
function formatNumber(n){n=Number(n)||0;if(n>=1e9)return(n/1e9).toFixed(1)+'B';if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'K';return n.toString();}
function formatDate(s){if(!s)return '';try{return new Date(s).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'});}catch(e){return s;}}
function getClassColor(id){if(!id)return '#666';try{var c=Settings.get().classes.find(function(c){return c.id===id;});return c?c.color:'#666';}catch(e){return '#666';}}
function getClassName(id){if(!id)return '';try{var c=Settings.get().classes.find(function(c){return c.id===id;});return c?c.name:id;}catch(e){return id||'';}}
function getGroupName(id){if(!id)return '';try{var g=Settings.get().groups.find(function(g){return g.id===id;});return g?g.name:'';}catch(e){return '';}}
function getGroupColor(id){if(!id)return '#666';try{var g=Settings.get().groups.find(function(g){return g.id===id;});return g?g.color:'#666';}catch(e){return '#666';}}
function classBadge(id){var col=getClassColor(id),nm=getClassName(id);if(!nm)return '';return '<span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:'+col+'22;color:'+col+';border:1px solid '+col+'44">'+escHtml(nm)+'</span>';}
function openModal(html,onClose,wide){var e=document.querySelector('.modal-overlay');if(e)e.remove();var o=document.createElement('div');o.className='modal-overlay';o.innerHTML='<div class="modal"'+(wide?' style="max-width:700px;width:95%"':'')+'>'+html+'</div>';document.body.appendChild(o);o.addEventListener('click',function(ev){if(ev.target===o){o.remove();if(onClose)onClose();}});return o;}
function escHtml(s){if(!s&&s!==0)return '';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function navigate(p){if(typeof renderPage==='function')renderPage(p);}
function denyEdit(){showToast('🔒 Bạn không có quyền chỉnh sửa.','error',3000);}
