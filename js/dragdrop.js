/**
 * dragdrop.js
 *
 * Drag & drop cho dashboard:
 *   1. Kéo team-card → thả lên team-card khác → swap toàn bộ 2 team
 *   2. Kéo slot-row.filled (member) → thả lên slot-row khác → di chuyển; nếu đích có người thì swap
 *
 * Cũng export setTeamSize() cho nút resize 3 mức.
 *
 * Gắn handler bằng event delegation trên document.body để khỏi phải re-bind sau mỗi
 * lần renderPage('dashboard').
 *
 * Phụ thuộc:
 *   - Sessions.swapTeams(a, b)
 *   - Sessions.setTeamSize(idx, size)
 *   - Sessions.moveOrSwapMember(fromPos, toPos)
 *   - renderPage, showToast, isAdmin
 */

(function() {
  // State của drag hiện tại (chỉ 1 drag tại 1 thời điểm)
  let _drag = null;  // { type:'team'|'member', fromTeamIdx, fromSlotIdx, isReserve }
  let _lastOver = null;

  // ── Helpers ──────────────────────────────────────────────────────────────
  function findTarget(el, attr) {
    while (el && el !== document.body) {
      if (el.getAttribute && el.getAttribute(attr)) return el;
      el = el.parentElement;
    }
    return null;
  }
  function clearDragVisuals() {
    document.querySelectorAll('.dragging-team, .dragging-member').forEach(el => {
      el.classList.remove('dragging-team', 'dragging-member');
    });
    document.querySelectorAll('.drag-over-team, .drag-over-slot').forEach(el => {
      el.classList.remove('drag-over-team', 'drag-over-slot');
    });
    _lastOver = null;
  }

  // ── DRAGSTART ────────────────────────────────────────────────────────────
  document.addEventListener('dragstart', function(e) {
    if (!isAdmin || !isAdmin()) return;

    // dragstart fires on the element with draggable="true" - use e.target directly
    // nhưng đôi khi event.target có thể là child nếu draggable parent
    let el = e.target;
    while (el && el !== document.body) {
      if (el.getAttribute && el.getAttribute('data-drag')) break;
      el = el.parentElement;
    }
    if (!el || el === document.body) return;

    const dragType = el.getAttribute('data-drag');

    if (dragType === 'member') {
      _drag = {
        type: 'member',
        fromTeamIdx: parseInt(el.getAttribute('data-team-idx'), 10),
        fromSlotIdx: parseInt(el.getAttribute('data-slot-idx'), 10),
        isReserve: false
      };
      el.classList.add('dragging-member');
      try { e.dataTransfer.setData('text/plain', 'member'); } catch (err) {}
      e.dataTransfer.effectAllowed = 'move';
    } else if (dragType === 'team') {
      _drag = {
        type: 'team',
        fromTeamIdx: parseInt(el.getAttribute('data-team-idx'), 10)
      };
      el.classList.add('dragging-team');
      try { e.dataTransfer.setData('text/plain', 'team'); } catch (err) {}
      e.dataTransfer.effectAllowed = 'move';
    }
  });

  // ── DRAGOVER (cần preventDefault để allow drop) ──────────────────────────
  document.addEventListener('dragover', function(e) {
    if (!_drag) return;

    if (_drag.type === 'team') {
      // Tìm team-card đích (đi lên cây, bỏ qua slot-row)
      let teamCard = e.target;
      while (teamCard && teamCard !== document.body) {
        if (teamCard.classList && teamCard.classList.contains('team-card')) break;
        teamCard = teamCard.parentElement;
      }
      if (teamCard && teamCard !== document.body && teamCard.classList.contains('team-card')) {
        const idx = parseInt(teamCard.getAttribute('data-team-idx'), 10);
        if (idx !== _drag.fromTeamIdx) {
          e.preventDefault();
          if (_lastOver !== teamCard) {
            if (_lastOver) _lastOver.classList.remove('drag-over-team');
            teamCard.classList.add('drag-over-team');
            _lastOver = teamCard;
          }
        }
      }
    } else if (_drag.type === 'member') {
      // Tìm slot-row (filled hoặc empty) bằng class
      let slotEl = e.target;
      while (slotEl && slotEl !== document.body) {
        if (slotEl.classList && slotEl.classList.contains('slot-row')) break;
        slotEl = slotEl.parentElement;
      }
      if (slotEl && slotEl !== document.body && slotEl.classList.contains('slot-row')) {
        const tiAttr = slotEl.getAttribute('data-team-idx');
        const siAttr = slotEl.getAttribute('data-slot-idx');
        if (tiAttr !== null && siAttr !== null) {
          const ti = parseInt(tiAttr, 10);
          const si = parseInt(siAttr, 10);
          if (!(ti === _drag.fromTeamIdx && si === _drag.fromSlotIdx)) {
            e.preventDefault();
            if (_lastOver !== slotEl) {
              if (_lastOver) _lastOver.classList.remove('drag-over-slot');
              slotEl.classList.add('drag-over-slot');
              _lastOver = slotEl;
            }
          }
        }
      }
    }
  });

  // ── DRAGLEAVE ────────────────────────────────────────────────────────────
  document.addEventListener('dragleave', function(e) {
    // Chỉ clear nếu rời khỏi element hiện tại đang highlight
    if (_lastOver && !_lastOver.contains(e.relatedTarget)) {
      _lastOver.classList.remove('drag-over-team', 'drag-over-slot');
      _lastOver = null;
    }
  });

  // ── DROP ─────────────────────────────────────────────────────────────────
  document.addEventListener('drop', function(e) {
    if (!_drag) return;
    e.preventDefault();

    if (_drag.type === 'team') {
      let teamCard = e.target;
      while (teamCard && teamCard !== document.body) {
        if (teamCard.classList && teamCard.classList.contains('team-card')) break;
        teamCard = teamCard.parentElement;
      }
      if (teamCard && teamCard !== document.body && teamCard.classList.contains('team-card')) {
        const toIdx = parseInt(teamCard.getAttribute('data-team-idx'), 10);
        if (toIdx !== _drag.fromTeamIdx) {
          if (typeof Sessions !== 'undefined' && Sessions.swapTeams(_drag.fromTeamIdx, toIdx)) {
            if (typeof showToast === 'function') showToast(`✅ Hoán đổi T${_drag.fromTeamIdx+1} ↔ T${toIdx+1}`);
            if (typeof renderPage === 'function') renderPage('dashboard');
          }
        }
      }
    } else if (_drag.type === 'member') {
      let slotEl = e.target;
      while (slotEl && slotEl !== document.body) {
        if (slotEl.classList && slotEl.classList.contains('slot-row')) break;
        slotEl = slotEl.parentElement;
      }
      if (slotEl && slotEl !== document.body && slotEl.classList.contains('slot-row')) {
        const toTi = parseInt(slotEl.getAttribute('data-team-idx'), 10);
        const toSi = parseInt(slotEl.getAttribute('data-slot-idx'), 10);
        if (!isNaN(toTi) && !isNaN(toSi) &&
            !(toTi === _drag.fromTeamIdx && toSi === _drag.fromSlotIdx)) {
          const fromPos = { teamIdx: _drag.fromTeamIdx, slotIdx: _drag.fromSlotIdx, isReserve: false };
          const toPos   = { teamIdx: toTi, slotIdx: toSi, isReserve: false };
          if (typeof Sessions !== 'undefined' && Sessions.moveOrSwapMember(fromPos, toPos)) {
            if (typeof showToast === 'function') showToast('✅ Đã di chuyển');
            if (typeof renderPage === 'function') renderPage('dashboard');
          }
        }
      }
    }

    clearDragVisuals();
    _drag = null;
  });

  // ── DRAGEND (cleanup) ────────────────────────────────────────────────────
  document.addEventListener('dragend', function() {
    clearDragVisuals();
    _drag = null;
  });
})();

// ── Resize team handler (gọi từ onclick của tsz-btn) ───────────────────────
function setTeamSize(teamIdx, size) {
  if (!isAdmin || !isAdmin()) return;
  if (typeof Sessions === 'undefined' || !Sessions.setTeamSize) return;
  Sessions.setTeamSize(teamIdx, size);
  if (typeof renderPage === 'function') renderPage('dashboard');
}
