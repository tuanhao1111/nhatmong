/* =============================================================================
   BANG CHIẾN · Xếp team — chỉ leader

   - Đồng bộ danh sách thành viên từ Google Sheet (đọc CSV, không cần server)
   - Kéo-thả / chạm-để-xếp vào 2 đoàn × 5 team × 6 người (đổi được quy mô)
   - Đổi tên đoàn & team, ghi mục tiêu team, giao nhiệm vụ + đội trưởng từng người
   - Màu theo môn phái, chỉnh được cho khớp màu đang tô trong Sheet
   - Xuất: copy văn bản Discord · ảnh PNG · file JSON (nạp lại được)

   Đội hình lưu trong localStorage của máy leader (theo lựa chọn "chỉ đọc Sheet").
   ========================================================================== */
(function () {
  'use strict';

  // ── Khoá lưu trữ ─────────────────────────────────────────────────────────
  var K_STATE = 'nm_bc_state';
  var K_UNLOCK = 'nm_bc_unlock';
  var K_PASS = 'nm_bc_pass';

  // Mật khẩu leader mặc định: "nhatmong" (SHA-256).
  // Đổi trong Cấu hình → mục 5; muốn cố định trên mọi máy thì thay chuỗi dưới
  // bằng hash mới mà ô "Đổi mật khẩu" in ra.
  var PASS_HASH = '2e9025e443ee094bc14317024ca40848a57e896be668b60b36ac5618620d66c0';

  // Google Sheet danh sách thành viên bang (đổi được trong Cấu hình → mục 1)
  var DEFAULT_URL = 'https://docs.google.com/spreadsheets/d/1o1yobj8zfKSyDi7f_XMjfzyDp0LDZzRdbGJwKiPNVK0/edit';
  // Lần đồng bộ đầu tiên chỉ lấy người có trạng thái này vào kho quân
  var DEFAULT_STATUS = 'bang chien';

  // ── Môn phái mặc định (Nghịch Thuỷ Hàn) ──────────────────────────────────
  var PHAI_DEF = [
    ['Thần Tương', '#ffd166'],
    ['Huyết Hà', '#ff3b4e'],
    ['Toái Mộng', '#b44cff'],
    ['Thiết Y', '#9fb3c8'],
    ['Cửu Linh', '#00e5ff'],
    ['Tố Vấn', '#7dffb0'],
    ['Long Ngâm', '#ff8c42']
  ];
  var PHAI_FALLBACK = '#8a7fb0';

  var TASK_PRESETS = [
    'Chỉ huy', 'Ôm cờ', 'Hộ vệ ôm cờ', 'Cướp cờ', 'Giữ trụ', 'Phá trụ',
    'Trị liệu', 'Khống chế', 'Bắt lẻ', 'Mở trận / đỡ đòn', 'Trinh sát', 'Tiếp viện'
  ];

  // Từ khoá đoán cột theo tiêu đề Sheet (đã bỏ dấu, viết thường)
  var HINTS = {
    name: ['ten nhan vat', 'ten nv', 'nhan vat', 'ten ingame', 'ingame', 'ten trong game', 'ho ten', 'thanh vien', 'nick', 'nickname', 'ign', 'ten', 'name'],
    phai: ['mon phai', 'he phai', 'phai', 'class', 'job', 'nghe nghiep', 'nghe'],
    power: ['luc chien', 'chien luc', 'diem luc chien', 'suc manh', 'power', 'bxh', 'lc', 'cs'],
    note: ['ghi chu', 'chu thich', 'nhiem vu', 'vai tro', 'dps/def', 'note', 'role', 'dps'],
    status: ['status', 'trang thai', 'tinh trang', 'tu cach']
  };
  var FIELDS = ['name', 'phai', 'power', 'note', 'status'];

  // ── Tiện ích ─────────────────────────────────────────────────────────────
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Bỏ dấu tiếng Việt + viết thường + gộp khoảng trắng — dùng để so khớp. */
  function norm(s) {
    return String(s == null ? '' : s)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, function (c) { return c === 'Đ' ? 'D' : 'd'; })
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function toast(msg, isErr) {
    var el = $('#toast');
    el.textContent = msg;
    el.className = 'bc-toast show' + (isErr ? ' err' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.className = 'bc-toast' + (isErr ? ' err' : ''); }, 2800);
  }

  /** SHA-256 thuần JS — chạy được cả khi mở bằng file:// (không cần crypto.subtle). */
  function sha256(str) {
    function rr(n, x) { return (x >>> n) | (x << (32 - n)); }
    var primes = [], n = 2;
    while (primes.length < 64) {
      var p = true;
      for (var d = 2; d * d <= n; d++) if (n % d === 0) { p = false; break; }
      if (p) primes.push(n);
      n++;
    }
    var K = primes.map(function (q) { return (Math.pow(q, 1 / 3) % 1) * 4294967296 | 0; });
    var H = primes.slice(0, 8).map(function (q) { return (Math.pow(q, 1 / 2) % 1) * 4294967296 | 0; });

    var msg = unescape(encodeURIComponent(String(str)));
    var l = msg.length;
    var nBlk = ((l + 8) >> 6) + 1;
    var wa = new Array(nBlk * 16);
    for (var i = 0; i < wa.length; i++) wa[i] = 0;
    for (i = 0; i < l; i++) wa[i >> 2] |= (msg.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
    wa[l >> 2] |= 0x80 << (24 - (l % 4) * 8);
    wa[nBlk * 16 - 1] = l * 8;

    var w = new Array(64), a, b, c, d2, e, f, g, h, T1, T2, t;
    for (var j = 0; j < wa.length; j += 16) {
      a = H[0]; b = H[1]; c = H[2]; d2 = H[3]; e = H[4]; f = H[5]; g = H[6]; h = H[7];
      for (t = 0; t < 64; t++) {
        if (t < 16) w[t] = wa[j + t] | 0;
        else {
          var s0 = rr(7, w[t - 15]) ^ rr(18, w[t - 15]) ^ (w[t - 15] >>> 3);
          var s1 = rr(17, w[t - 2]) ^ rr(19, w[t - 2]) ^ (w[t - 2] >>> 10);
          w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
        }
        T1 = (h + (rr(6, e) ^ rr(11, e) ^ rr(25, e)) + ((e & f) ^ (~e & g)) + K[t] + w[t]) | 0;
        T2 = ((rr(2, a) ^ rr(13, a) ^ rr(22, a)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d2 + T1) | 0; d2 = c; c = b; b = a; a = (T1 + T2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d2) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(function (x) { return ('00000000' + (x >>> 0).toString(16)).slice(-8); }).join('');
  }

  // ── Trạng thái ───────────────────────────────────────────────────────────
  var S = defaultState();
  var pick = null;      // key đang "nhặt" bằng chuột/ngón tay
  var filterPhai = {};  // normPhai -> true nghĩa là đang ẨN
  var editing = null;   // key đang mở modal nhiệm vụ

  function defaultState() {
    var colors = {}, labels = {};
    PHAI_DEF.forEach(function (p) { colors[norm(p[0])] = p[1]; labels[norm(p[0])] = p[0]; });
    var st = {
      url: DEFAULT_URL, tab: '',
      map: { name: -1, phai: -1, power: -1, note: -1, status: -1 },
      headers: [],
      statusLabels: {},   // normStatus -> nhãn gốc trong Sheet
      statusOff: {},      // normStatus -> true nghĩa là KHÔNG đưa vào kho quân
      statusInit: false,  // đã tự chọn "Bang Chiến" lần đầu chưa
      colors: colors, labels: labels,
      nDoan: 2, nTeam: 5, nSize: 6,
      doanNames: ['Đoàn 1', 'Đoàn 2'],
      teams: {}, tasks: {}, members: [], syncAt: 0
    };
    rebuildTeams(st);
    return st;
  }

  function tid(d, t) { return 'd' + d + 't' + t; }

  /** Dựng lại bảng team theo quy mô hiện tại, giữ nguyên team cũ còn trong phạm vi. */
  function rebuildTeams(st) {
    var next = {};
    for (var d = 0; d < st.nDoan; d++) {
      for (var t = 0; t < st.nTeam; t++) {
        var id = tid(d, t);
        var old = st.teams[id];
        var slots = new Array(st.nSize);
        for (var s = 0; s < st.nSize; s++) slots[s] = (old && old.slots[s]) || null;
        next[id] = {
          name: (old && old.name) || ('Team ' + (d * st.nTeam + t + 1)),
          note: (old && old.note) || '',
          cap: (old && old.cap) || null,
          slots: slots
        };
      }
      if (!st.doanNames[d]) st.doanNames[d] = 'Đoàn ' + (d + 1);
    }
    st.doanNames.length = st.nDoan;
    st.teams = next;
  }

  function save() {
    try { localStorage.setItem(K_STATE, JSON.stringify(S)); }
    catch (e) { toast('Không lưu được (bộ nhớ trình duyệt đầy)', true); }
  }

  function load() {
    try {
      var raw = localStorage.getItem(K_STATE);
      if (!raw) return;
      var o = JSON.parse(raw);
      Object.keys(S).forEach(function (k) { if (o[k] !== undefined) S[k] = o[k]; });
      // vá dữ liệu cũ / thiếu
      PHAI_DEF.forEach(function (p) {
        var n = norm(p[0]);
        if (!S.colors[n]) S.colors[n] = p[1];
        if (!S.labels[n]) S.labels[n] = p[0];
      });
      rebuildTeams(S);
      cleanTeams();
    } catch (e) { /* dữ liệu hỏng → dùng mặc định */ }
  }

  // ── Đọc Google Sheet ─────────────────────────────────────────────────────

  /** Đổi link Sheet bất kỳ sang endpoint trả CSV. */
  function csvUrl(raw, tab) {
    raw = String(raw || '').trim();
    if (!raw) return '';
    if (/output=csv|tqx=out:csv|format=csv/.test(raw)) return raw;      // đã là link CSV
    var m = raw.match(/\/spreadsheets\/(?:d\/)?(?:e\/)?([a-zA-Z0-9\-_]{20,})/);
    if (!m) return '';
    // headers=1: bắt Google chỉ coi ĐÚNG 1 dòng đầu là tiêu đề. Thiếu tham số
    // này Google tự đoán và hay gộp luôn dòng dữ liệu đầu vào tiêu đề → mất
    // một thành viên.
    var base = 'https://docs.google.com/spreadsheets/d/' + m[1] + '/gviz/tq?tqx=out:csv&headers=1';
    if (tab && tab.trim()) return base + '&sheet=' + encodeURIComponent(tab.trim());
    var g = raw.match(/[#&?]gid=([0-9]+)/);
    return g ? base + '&gid=' + g[1] : base;
  }

  /** Parser CSV đầy đủ: hỗ trợ dấu nháy, dấu phẩy và xuống dòng bên trong ô. */
  function parseCSV(text) {
    var rows = [], row = [], cell = '', q = false, i = 0;
    text = String(text).replace(/^\uFEFF/, '');
    while (i < text.length) {
      var ch = text[i];
      if (q) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
          q = false; i++; continue;
        }
        cell += ch; i++; continue;
      }
      if (ch === '"') { q = true; i++; continue; }
      if (ch === ',') { row.push(cell); cell = ''; i++; continue; }
      if (ch === '\r') { i++; continue; }
      if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; continue; }
      cell += ch; i++;
    }
    row.push(cell);
    if (row.length > 1 || row[0] !== '') rows.push(row);
    return rows;
  }

  /** Tìm dòng tiêu đề: dòng khớp nhiều từ khoá nhất trong 10 dòng đầu. */
  function findHeaderRow(rows) {
    var best = 0, bestScore = -1;
    var all = [].concat(HINTS.name, HINTS.phai, HINTS.power, HINTS.note);
    for (var r = 0; r < Math.min(10, rows.length); r++) {
      var score = 0;
      rows[r].forEach(function (c) {
        var n = norm(c);
        if (!n) return;
        if (all.indexOf(n) >= 0) score += 3;
        else if (all.some(function (h) { return n.indexOf(h) >= 0; })) score += 1;
      });
      if (score > bestScore) { bestScore = score; best = r; }
    }
    return bestScore > 0 ? best : 0;
  }

  /** Đoán chỉ số cột cho name/phai/power/note. */
  function guessMap(headers) {
    var used = {}, map = { name: -1, phai: -1, power: -1, note: -1 };
    FIELDS.forEach(function (field) {
      var hints = HINTS[field], best = -1, bestScore = 0;
      headers.forEach(function (h, i) {
        if (used[i]) return;
        var n = norm(h);
        if (!n) return;
        var score = 0, pos = hints.indexOf(n);
        if (pos >= 0) score = 100 - pos;
        else {
          // Chỉ cho khớp một phần với từ khoá đủ dài — nếu không "lc"/"cs" sẽ
          // ăn nhầm những cột như "DPS/DEF/TLCB".
          for (var k = 0; k < hints.length; k++) {
            if (hints[k].length >= 4 && n.indexOf(hints[k]) >= 0) { score = 50 - k; break; }
          }
        }
        if (score > bestScore) { bestScore = score; best = i; }
      });
      if (best >= 0) { map[field] = best; used[best] = true; }
    });
    // Không đoán được cột tên → lấy cột đầu tiên có nhiều chữ nhất
    if (map.name < 0) map.name = 0;
    return map;
  }

  function setStatus(msg, kind) {
    $('#st-msg').textContent = msg;
    $('#st-dot').className = 'bc-status__dot' + (kind ? ' bc-status__dot--' + kind : '');
  }

  /**
   * Tải Sheet → mảng thành viên.
   * @param {boolean} remap - true thì đoán lại cột (dùng khi đổi nguồn).
   */
  function sync(remap) {
    var url = csvUrl(S.url, S.tab);
    if (!url) {
      setStatus('Chưa có link Sheet hợp lệ', 'err');
      toast('Bấm “Cấu hình” và dán link Google Sheet', true);
      return Promise.reject(new Error('no-url'));
    }
    setStatus('Đang tải Sheet…');
    return fetch(url + '&_=' + Date.now(), { credentials: 'omit' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (text) {
        if (/^\s*</.test(text)) throw new Error('Sheet chưa mở quyền xem công khai');
        var rows = parseCSV(text).filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
        if (!rows.length) throw new Error('Sheet rỗng');

        var hr = findHeaderRow(rows);
        S.headers = rows[hr].map(function (h, i) { return String(h).trim() || ('Cột ' + (i + 1)); });
        if (remap || S.map.name < 0 || S.map.name >= S.headers.length) S.map = guessMap(S.headers);

        var seen = {}, list = [];
        for (var r = hr + 1; r < rows.length; r++) {
          var row = rows[r];
          var name = String(row[S.map.name] || '').trim();
          if (!name) continue;
          var key = norm(name), n = 2;
          while (seen[key]) key = norm(name) + '#' + n++;
          seen[key] = true;

          var phai = S.map.phai >= 0 ? String(row[S.map.phai] || '').trim() : '';
          var pn = norm(phai);
          if (pn && !S.labels[pn]) { S.labels[pn] = phai; S.colors[pn] = S.colors[pn] || PHAI_FALLBACK; }

          var status = S.map.status >= 0 ? String(row[S.map.status] || '').trim() : '';
          var sn = norm(status);
          if (sn && !S.statusLabels[sn]) S.statusLabels[sn] = status;

          list.push({
            key: key, name: name, phai: phai, phaiN: pn,
            status: status, statusN: sn,
            power: parsePower(S.map.power >= 0 ? row[S.map.power] : ''),
            powerRaw: S.map.power >= 0 ? String(row[S.map.power] || '').trim() : '',
            note: S.map.note >= 0 ? String(row[S.map.note] || '').trim() : ''
          });
        }
        S.members = list;
        S.syncAt = Date.now();
        initStatusFilter();
        cleanTeams();
        save();
        renderAll();
        setStatus('Đã đồng bộ ' + list.length + ' thành viên · ' + timeStr(S.syncAt), 'ok');
        return list;
      })
      .catch(function (err) {
        var msg = String(err && err.message || err);
        if (/Failed to fetch|NetworkError|TypeError/.test(msg)) {
          msg = 'Không đọc được Sheet — kiểm tra quyền chia sẻ “Bất kỳ ai có link · Người xem”';
        }
        setStatus(msg, 'err');
        toast(msg, true);
        throw err;
      });
  }

  /** "12.5M" / "1,234,567" / "12tr" → số. */
  function parsePower(v) {
    var s = String(v == null ? '' : v).trim().toLowerCase();
    if (!s) return 0;
    var mult = 1;
    if (/tr|m\b|triệu/.test(s)) mult = 1e6;
    else if (/k\b|nghìn|ngàn/.test(s)) mult = 1e3;
    s = s.replace(/[^0-9.,]/g, '');
    // 1.234.567 hoặc 1,234,567 → bỏ dấu phân cách hàng nghìn
    if ((s.match(/[.,]/g) || []).length > 1) s = s.replace(/[.,]/g, '');
    else s = s.replace(/,/g, '.');
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n * mult;
  }

  function fmtPower(n) {
    if (!n) return '';
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return Math.round(n / 1e3) + 'K';
    return String(Math.round(n));
  }

  function timeStr(ts) {
    var d = new Date(ts);
    var p = function (x) { return ('0' + x).slice(-2); };
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  // ── Truy vấn đội hình ────────────────────────────────────────────────────
  function byKey(key) {
    for (var i = 0; i < S.members.length; i++) if (S.members[i].key === key) return S.members[i];
    return null;
  }

  function colorOf(m) { return (m && S.colors[m.phaiN]) || PHAI_FALLBACK; }

  /**
   * Lần đầu đọc được cột trạng thái thì tự chỉ bật "Bang Chiến" — Sheet còn có
   * "Học Việc"/"Out" vốn không ra trận. Sau đó leader tự bật/tắt thì tôn trọng.
   */
  function initStatusFilter() {
    var keys = Object.keys(S.statusLabels);
    if (S.statusInit || !keys.length) return;
    if (keys.indexOf(DEFAULT_STATUS) < 0) return;   // Sheet không có "Bang Chiến" → bật hết
    keys.forEach(function (k) { if (k !== DEFAULT_STATUS) S.statusOff[k] = true; });
    S.statusInit = true;
  }

  /** Người này có được đưa vào kho quân để xếp không? */
  function eligible(m) { return !!m && !S.statusOff[m.statusN]; }

  /** Đang bật từ 2 nhóm trạng thái trở lên? */
  function multiStatus() {
    return Object.keys(S.statusLabels).filter(function (n) { return !S.statusOff[n]; }).length > 1;
  }

  function findSlot(key) {
    for (var d = 0; d < S.nDoan; d++) {
      for (var t = 0; t < S.nTeam; t++) {
        var team = S.teams[tid(d, t)];
        var s = team.slots.indexOf(key);
        if (s >= 0) return { d: d, t: t, s: s, id: tid(d, t), team: team };
      }
    }
    return null;
  }

  /** Bỏ key không còn trong Sheet + đội trưởng không còn trong team. */
  function cleanTeams() {
    var valid = {};
    S.members.forEach(function (m) { valid[m.key] = true; });
    var hasMembers = S.members.length > 0;
    Object.keys(S.teams).forEach(function (id) {
      var team = S.teams[id];
      team.slots = team.slots.map(function (k) { return (k && (!hasMembers || valid[k])) ? k : null; });
      if (team.cap && team.slots.indexOf(team.cap) < 0) team.cap = null;
    });
  }

  function placedKeys() {
    var out = {};
    Object.keys(S.teams).forEach(function (id) {
      S.teams[id].slots.forEach(function (k) { if (k) out[k] = id; });
    });
    return out;
  }

  function placeAt(key, d, t, s) {
    var id = tid(d, t), team = S.teams[id];
    if (!team) return;
    var from = findSlot(key);
    if (from && from.id === id && from.s === s) return;
    var occupant = team.slots[s];

    if (from) S.teams[from.id].slots[from.s] = null;
    if (occupant && occupant !== key) {
      if (from) S.teams[from.id].slots[from.s] = occupant;   // đổi chỗ
      else {                                                 // đẩy về kho quân
        if (S.teams[id].cap === occupant) S.teams[id].cap = null;
      }
    }
    team.slots[s] = key;
    cleanTeams();
    save();
    renderAll();
  }

  function placeInTeam(key, d, t) {
    var team = S.teams[tid(d, t)];
    if (!team) return;
    if (team.slots.indexOf(key) >= 0) return;
    var s = team.slots.indexOf(null);
    if (s < 0) { toast('Team đã đủ ' + S.nSize + ' người', true); return; }
    placeAt(key, d, t, s);
  }

  function recall(key) {
    var loc = findSlot(key);
    if (!loc) return;
    loc.team.slots[loc.s] = null;
    if (loc.team.cap === key) loc.team.cap = null;
    save();
    renderAll();
  }

  // ── Render ───────────────────────────────────────────────────────────────
  function renderAll() { renderLegend(); renderStatusChips(); renderPool(); renderBoard(); renderStats(); }

  function memCard(m, opts) {
    opts = opts || {};
    var c = colorOf(m);
    var task = S.tasks[m.key] || '';
    var isCap = opts.cap === m.key;
    var meta = [];
    if (m.phai) meta.push('<span class="mem__phai">' + esc(m.phai) + '</span>');
    // Chỉ hiện trạng thái khi đang bật nhiều nhóm, kẻo lặp lại "Bang Chiến" 60 lần
    if (m.status && multiStatus()) meta.push('<span>' + esc(m.status) + '</span>');
    if (m.power) meta.push('<span>' + esc(fmtPower(m.power)) + '</span>');
    if (m.note) meta.push('<span>' + esc(m.note) + '</span>');

    return '<div class="mem' + (opts.inSlot ? ' mem--slot' : '') + (pick === m.key ? ' picked' : '') + '"' +
      ' style="--pc:' + esc(c) + '" draggable="true" data-key="' + esc(m.key) + '">' +
      (isCap ? '<span class="mem__cap" title="Đội trưởng">★</span>' : '') +
      '<div class="mem__body">' +
        '<div class="mem__name">' + esc(m.name) + '</div>' +
        (meta.length ? '<div class="mem__meta">' + meta.join('') + '</div>' : '') +
        (task ? '<span class="mem__task">▸ ' + esc(task) + '</span>' : '') +
      '</div>' +
      '<div class="mem__acts">' +
        '<button class="mem__x mem__x--edit" data-act="edit" title="Giao nhiệm vụ">✎</button>' +
        (opts.inSlot ? '<button class="mem__x" data-act="recall" title="Rút về kho quân">✕</button>' : '') +
      '</div>' +
      '</div>';
  }

  function renderLegend() {
    var counts = {};
    S.members.forEach(function (m) { if (eligible(m)) counts[m.phaiN] = (counts[m.phaiN] || 0) + 1; });
    var keys = Object.keys(S.labels).filter(function (n) { return n && (counts[n] || PHAI_DEF.some(function (p) { return norm(p[0]) === n; })); });
    $('#legend').innerHTML = keys.map(function (n) {
      return '<span class="phai-chip' + (filterPhai[n] ? ' off' : '') + '" style="color:' + esc(S.colors[n] || PHAI_FALLBACK) + '" data-phai="' + esc(n) + '">' +
        '<span class="phai-chip__n">' + esc(S.labels[n]) + '</span>' +
        '<span class="phai-chip__c">' + (counts[n] || 0) + '</span></span>';
    }).join('');
  }

  /** Chip trạng thái (Bang Chiến / Học Việc / Out…) — bấm để bật/tắt khỏi kho quân. */
  function renderStatusChips() {
    var box = $('#legend-status');
    var counts = {};
    S.members.forEach(function (m) { if (m.statusN) counts[m.statusN] = (counts[m.statusN] || 0) + 1; });
    var keys = Object.keys(counts);
    box.hidden = keys.length < 2;
    if (box.hidden) { box.innerHTML = ''; return; }
    box.innerHTML = keys.map(function (n) {
      var on = !S.statusOff[n];
      return '<span class="phai-chip' + (on ? '' : ' off') + '" style="color:' + (on ? '#3ddc84' : '#8a7fb0') +
        '" data-status="' + esc(n) + '" title="Bấm để ' + (on ? 'bỏ' : 'đưa') + ' nhóm này ' + (on ? 'khỏi' : 'vào') + ' kho quân">' +
        '<span class="phai-chip__n">' + esc(S.statusLabels[n] || n) + '</span>' +
        '<span class="phai-chip__c">' + counts[n] + '</span></span>';
    }).join('');
  }

  function renderPool() {
    var placed = placedKeys();
    var q = norm($('#pool-search').value);
    var list = S.members.filter(function (m) {
      if (placed[m.key]) return false;
      if (!eligible(m)) return false;
      if (filterPhai[m.phaiN]) return false;
      if (q && norm(m.name).indexOf(q) < 0 && norm(m.phai).indexOf(q) < 0) return false;
      return true;
    });

    var sort = $('#pool-sort').value;
    if (sort === 'power') list.sort(function (a, b) { return b.power - a.power; });
    else if (sort === 'name') list.sort(function (a, b) { return a.name.localeCompare(b.name, 'vi'); });
    else if (sort === 'phai') list.sort(function (a, b) { return (a.phai || 'zz').localeCompare(b.phai || 'zz', 'vi') || b.power - a.power; });

    $('#pool-count').textContent = list.length;
    $('#pool-list').innerHTML = list.length
      ? list.map(function (m) { return memCard(m, {}); }).join('')
      : '<div class="bc-pool__empty">' + (S.members.length ? 'Không có ai khớp bộ lọc' : 'Chưa có dữ liệu<br>Bấm “Cấu hình” → dán link Google Sheet') + '</div>';
  }

  function renderBoard() {
    var html = '';
    for (var d = 0; d < S.nDoan; d++) {
      var filled = 0, power = 0;
      for (var t = 0; t < S.nTeam; t++) {
        S.teams[tid(d, t)].slots.forEach(function (k) {
          if (!k) return;
          filled++;
          var m = byKey(k);
          if (m) power += m.power;
        });
      }
      html += '<section class="doan" data-d="' + d + '">' +
        '<div class="doan__head">' +
          '<span class="doan__idx">Đoàn ' + (d + 1) + '</span>' +
          '<input class="doan__name" data-d="' + d + '" value="' + esc(S.doanNames[d]) + '" maxlength="40" aria-label="Tên đoàn ' + (d + 1) + '">' +
          '<span class="doan__stat">' + filled + '/' + (S.nTeam * S.nSize) + ' người' + (power ? ' · ' + fmtPower(power) : '') + '</span>' +
        '</div><div class="doan__grid">';

      for (t = 0; t < S.nTeam; t++) html += teamCard(d, t);
      html += '</div></section>';
    }
    $('#board').innerHTML = html;
  }

  function teamCard(d, t) {
    var team = S.teams[tid(d, t)];
    var n = team.slots.filter(Boolean).length;
    var power = 0;
    team.slots.forEach(function (k) { var m = k && byKey(k); if (m) power += m.power; });

    var slots = team.slots.map(function (k, s) {
      var m = k && byKey(k);
      if (!m) return '<div class="slot" data-d="' + d + '" data-t="' + t + '" data-s="' + s + '">Trống ' + (s + 1) + '</div>';
      return '<div class="slot slot--filled" data-d="' + d + '" data-t="' + t + '" data-s="' + s + '">' +
        memCard(m, { inSlot: true, cap: team.cap }) + '</div>';
    }).join('');

    return '<div class="team' + (n >= S.nSize ? ' full' : '') + '" data-d="' + d + '" data-t="' + t + '">' +
      '<div class="team__head">' +
        '<input class="team__name" data-d="' + d + '" data-t="' + t + '" value="' + esc(team.name) + '" maxlength="40" aria-label="Tên team">' +
        '<span class="team__count">' + n + '/' + S.nSize + '</span>' +
      '</div>' +
      '<input class="team__note" data-d="' + d + '" data-t="' + t + '" value="' + esc(team.note) + '" maxlength="120" placeholder="Mục tiêu / nhiệm vụ của team…">' +
      '<div class="team__slots">' + slots + '</div>' +
      '<div class="team__foot"><span>' + (power ? 'Tổng LC ' + fmtPower(power) : '') + '</span>' +
      '<span>' + phaiMix(team) + '</span></div>' +
      '</div>';
  }

  function phaiMix(team) {
    var c = {};
    team.slots.forEach(function (k) {
      var m = k && byKey(k);
      if (m && m.phai) c[m.phai] = (c[m.phai] || 0) + 1;
    });
    return Object.keys(c).map(function (p) { return esc(p) + '×' + c[p]; }).join(' · ');
  }

  function renderStats() {
    var placed = Object.keys(placedKeys()).length;
    var cap = S.nDoan * S.nTeam * S.nSize;
    var pool = S.members.filter(eligible).length;
    $('#st-total').textContent = pool < S.members.length ? pool + '/' + S.members.length : S.members.length;
    $('#st-placed').textContent = placed;
    $('#st-cap').textContent = cap;
    $('#st-free').textContent = Math.max(0, pool - placed);
    $('#st-task').textContent = Object.keys(S.tasks).filter(function (k) { return S.tasks[k]; }).length;
    $('#sub-shape').textContent = S.nDoan + ' đoàn × ' + S.nTeam + ' team × ' + S.nSize + ' người';
  }

  // ── Kéo-thả + chạm-để-xếp ────────────────────────────────────────────────
  function setPick(key) {
    pick = (pick === key) ? null : key;
    renderPool(); renderBoard();
  }

  function onBoardClick(e) {
    var btn = e.target.closest('[data-act]');
    var memEl = e.target.closest('.mem');
    var key = memEl && memEl.dataset.key;

    if (btn && key) {
      e.stopPropagation();
      if (btn.dataset.act === 'recall') { recall(key); return; }
      if (btn.dataset.act === 'edit') { openMember(key); return; }
    }
    if (memEl) {
      // Đang nhặt người khác mà bấm vào một người trên bàn → đổi chỗ hai người
      if (pick && pick !== key) {
        var host = memEl.closest('.slot');
        if (host) {
          placeAt(pick, +host.dataset.d, +host.dataset.t, +host.dataset.s);
          pick = null; renderAll();
          return;
        }
      }
      setPick(key);
      return;
    }

    var slot = e.target.closest('.slot');
    if (slot && pick) {
      placeAt(pick, +slot.dataset.d, +slot.dataset.t, +slot.dataset.s);
      pick = null; renderAll();
      return;
    }
    var team = e.target.closest('.team');
    if (team && pick) {
      placeInTeam(pick, +team.dataset.d, +team.dataset.t);
      pick = null; renderAll();
    }
  }

  function onPoolClick(e) {
    var btn = e.target.closest('[data-act]');
    var memEl = e.target.closest('.mem');
    if (btn && memEl) {
      e.stopPropagation();
      if (btn.dataset.act === 'edit') { openMember(memEl.dataset.key); return; }
    }
    if (memEl) { setPick(memEl.dataset.key); return; }
    if (pick && findSlot(pick)) { recall(pick); pick = null; renderAll(); }
  }

  function initDnD() {
    document.addEventListener('dragstart', function (e) {
      var mem = e.target.closest && e.target.closest('.mem');
      if (!mem) return;
      e.dataTransfer.setData('text/plain', mem.dataset.key);
      e.dataTransfer.effectAllowed = 'move';
      mem.classList.add('dragging');
      pick = null;
    });
    document.addEventListener('dragend', function (e) {
      $$('.dragging').forEach(function (el) { el.classList.remove('dragging'); });
      $$('.drop-on').forEach(function (el) { el.classList.remove('drop-on'); });
    });
    document.addEventListener('dragover', function (e) {
      var zone = e.target.closest && (e.target.closest('.slot') || e.target.closest('.team') || e.target.closest('.bc-pool'));
      if (!zone) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!zone.classList.contains('drop-on')) {
        $$('.drop-on').forEach(function (el) { el.classList.remove('drop-on'); });
        zone.classList.add('drop-on');
      }
    });
    document.addEventListener('drop', function (e) {
      var zone = e.target.closest && (e.target.closest('.slot') || e.target.closest('.team') || e.target.closest('.bc-pool'));
      if (!zone) return;
      e.preventDefault();
      var key = e.dataTransfer.getData('text/plain');
      if (!key || !byKey(key)) return;
      if (zone.classList.contains('bc-pool')) recall(key);
      else if (zone.classList.contains('slot')) placeAt(key, +zone.dataset.d, +zone.dataset.t, +zone.dataset.s);
      else placeInTeam(key, +zone.dataset.d, +zone.dataset.t);
      $$('.drop-on').forEach(function (el) { el.classList.remove('drop-on'); });
    });
  }

  // ── Xếp tự động ──────────────────────────────────────────────────────────
  /**
   * Lấp các ô trống bằng người còn ngoài kho: rải đều lực chiến (snake draft)
   * và ưu tiên người thuộc phái đang ít trong team đó.
   */
  function autoFill() {
    var placed = placedKeys();
    var pool = S.members.filter(function (m) { return !placed[m.key] && eligible(m); })
      .sort(function (a, b) { return b.power - a.power; });
    if (!pool.length) { toast('Không còn ai ngoài kho quân', true); return; }

    // Danh sách ô trống theo thứ tự rắn bò để lực chiến rải đều giữa các team
    var order = [];
    for (var s = 0; s < S.nSize; s++) {
      var teams = [];
      for (var d = 0; d < S.nDoan; d++) for (var t = 0; t < S.nTeam; t++) teams.push([d, t]);
      // Lượt cuối không đảo chiều: nếu quân số lẻ không đủ 60, ô trống dồn về
      // các team cuối cho dễ nhìn thay vì rơi vào Team 1.
      if (s % 2 && s !== S.nSize - 1) teams.reverse();
      teams.forEach(function (dt) { order.push({ d: dt[0], t: dt[1], s: s }); });
    }

    var n = 0;
    order.forEach(function (o) {
      if (!pool.length) return;
      var team = S.teams[tid(o.d, o.t)];
      if (team.slots[o.s]) return;

      // đếm phái đang có trong team
      var have = {};
      team.slots.forEach(function (k) { var m = k && byKey(k); if (m) have[m.phaiN] = (have[m.phaiN] || 0) + 1; });

      // trong 6 ứng viên mạnh nhất, chọn người thuộc phái ít nhất trong team
      var bestI = 0, bestC = Infinity;
      for (var i = 0; i < Math.min(6, pool.length); i++) {
        var c = have[pool[i].phaiN] || 0;
        if (c < bestC) { bestC = c; bestI = i; if (c === 0) break; }
      }
      team.slots[o.s] = pool.splice(bestI, 1)[0].key;
      n++;
    });

    cleanTeams(); save(); renderAll();
    toast('Đã xếp ' + n + ' người vào ô trống');
  }

  // ── Modal ────────────────────────────────────────────────────────────────
  function openModal(id) { $('#' + id).hidden = false; }
  function closeModal(id) { $('#' + id).hidden = true; }

  function openMember(key) {
    var m = byKey(key);
    if (!m) return;
    editing = key;
    var loc = findSlot(key);
    var teamName = loc ? S.doanNames[loc.d] + ' · ' + loc.team.name : 'Đang ở kho quân';
    $('#mem-where').textContent = teamName;
    $('#mem-head').style.setProperty('--pc', colorOf(m));
    $('#mem-head').innerHTML = '<div><div class="mem-head__n">' + esc(m.name) + '</div>' +
      '<div class="mem-head__m">' + esc([m.phai, fmtPower(m.power), m.note].filter(Boolean).join(' · ') || 'không có thông tin thêm') + '</div></div>';
    $('#mem-task').value = S.tasks[key] || '';
    $('#mem-cap').checked = !!(loc && loc.team.cap === key);
    $('#mem-cap').disabled = !loc;
    $('#mem-remove').hidden = !loc;
    openModal('modal-mem');
    setTimeout(function () { $('#mem-task').focus(); }, 30);
  }

  function saveMember() {
    if (!editing) return;
    var v = $('#mem-task').value.trim();
    if (v) S.tasks[editing] = v; else delete S.tasks[editing];
    var loc = findSlot(editing);
    if (loc) loc.team.cap = $('#mem-cap').checked ? editing : (loc.team.cap === editing ? null : loc.team.cap);
    save(); renderAll(); closeModal('modal-mem');
    editing = null;
  }

  function openCfg() {
    $('#cfg-url').value = S.url;
    $('#cfg-tab').value = S.tab;
    $('#cfg-doan').value = S.nDoan;
    $('#cfg-tpd').value = S.nTeam;
    $('#cfg-size').value = S.nSize;
    $('#cfg-pass').value = '';
    $('#cfg-pass-msg').textContent = '';
    $('#cfg-test-msg').textContent = '';
    renderMapSelects();
    renderColorRows();
    openModal('modal-cfg');
  }

  function renderMapSelects() {
    var opts = '<option value="-1">— không có —</option>' + S.headers.map(function (h, i) {
      return '<option value="' + i + '">' + esc(h) + '</option>';
    }).join('');
    FIELDS.forEach(function (f) {
      var sel = $('#map-' + f);
      sel.innerHTML = opts;
      sel.value = String(S.map[f]);
      sel.disabled = !S.headers.length;
    });
  }

  function renderColorRows() {
    var keys = Object.keys(S.labels).filter(Boolean);
    $('#cfg-colors').innerHTML = keys.map(function (n) {
      var c = S.colors[n] || PHAI_FALLBACK;
      return '<div class="color-row">' +
        '<span class="color-row__n" style="color:' + esc(c) + '">' + esc(S.labels[n]) + '</span>' +
        '<span class="color-row__hex">' + esc(c) + '</span>' +
        '<input class="color-row__c" type="color" value="' + esc(c) + '" data-phai="' + esc(n) + '">' +
        '</div>';
    }).join('');
  }

  // ── Xuất dữ liệu ─────────────────────────────────────────────────────────
  function discordText() {
    var out = ['**⚔ ĐỘI HÌNH BANG CHIẾN — NHẤT MỘNG**', '_Cập nhật: ' + timeStr(Date.now()) + '_', ''];
    for (var d = 0; d < S.nDoan; d++) {
      out.push('__**' + S.doanNames[d].toUpperCase() + '**__');
      for (var t = 0; t < S.nTeam; t++) {
        var team = S.teams[tid(d, t)];
        var n = team.slots.filter(Boolean).length;
        out.push('**' + team.name + '** (' + n + '/' + S.nSize + ')' + (team.note ? ' — ' + team.note : ''));
        team.slots.forEach(function (k, i) {
          var m = k && byKey(k);
          if (!m) { out.push('' + (i + 1) + '. _(trống)_'); return; }
          var bits = [];
          if (m.phai) bits.push(m.phai);
          if (m.power) bits.push(fmtPower(m.power));
          var task = S.tasks[k];
          out.push('' + (i + 1) + '. ' + (team.cap === k ? '★ ' : '') + m.name +
            (bits.length ? ' [' + bits.join(' · ') + ']' : '') + (task ? ' → ' + task : ''));
        });
        out.push('');
      }
    }
    return out.join('\n');
  }

  function copyText() {
    var txt = discordText();
    var done = function () {
      toast(txt.length > 1900
        ? 'Đã copy (' + txt.length + ' ký tự — Discord giới hạn 2000, nên gửi từng đoàn)'
        : 'Đã copy đội hình');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, function () { fallbackCopy(txt); done(); });
    } else { fallbackCopy(txt); done(); }
  }

  function fallbackCopy(txt) {
    var ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* bỏ qua */ }
    document.body.removeChild(ta);
  }

  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function exportJSON() {
    var blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    download(blob, 'doi-hinh-bang-chien-' + timeStr(Date.now()).replace(/[/: ]/g, '-') + '.json');
    toast('Đã lưu file đội hình');
  }

  function importJSON(file) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var o = JSON.parse(fr.result);
        if (!o || !o.teams) throw new Error('sai định dạng');
        Object.keys(S).forEach(function (k) { if (o[k] !== undefined) S[k] = o[k]; });
        rebuildTeams(S); cleanTeams(); save(); renderAll();
        toast('Đã nạp đội hình từ file');
      } catch (e) { toast('File không hợp lệ', true); }
    };
    fr.readAsText(file);
  }

  // ── Xuất ảnh PNG ─────────────────────────────────────────────────────────
  function rrect(ctx, x, y, w, h, r) {
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function clip(ctx, text, max) {
    text = String(text || '');
    if (ctx.measureText(text).width <= max) return text;
    while (text.length > 1 && ctx.measureText(text + '…').width > max) text = text.slice(0, -1);
    return text + '…';
  }

  function exportPNG() {
    var SC = 2;                       // hệ số nét
    var pad = 44, cardW = 372, gap = 16, rowH = 42;
    var cols = S.nTeam;
    var cardH = 86 + S.nSize * rowH + 14;
    var W = pad * 2 + cols * cardW + (cols - 1) * gap;
    var headH = 128;
    var doanH = 50 + cardH + 30;
    var H = headH + S.nDoan * doanH + pad;

    var cv = document.createElement('canvas');
    cv.width = W * SC; cv.height = H * SC;
    var ctx = cv.getContext('2d');
    ctx.scale(SC, SC);
    var F = function (size, weight, mono) {
      ctx.font = (weight || 400) + ' ' + size + 'px ' + (mono ? '"JetBrains Mono", monospace' : '"Chakra Petch", "Segoe UI", sans-serif');
    };

    // nền
    ctx.fillStyle = '#070510';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(180,76,255,0.07)';
    ctx.lineWidth = 1;
    for (var gx = 0; gx < W; gx += 48) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
    for (var gy = 0; gy < H; gy += 48) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

    // tiêu đề
    F(11, 500, true);
    ctx.fillStyle = '#00e5ff';
    ctx.fillText('MODULE 04 // ĐIỀU BINH BANG CHIẾN', pad, pad + 12);
    F(46, 700);
    ctx.fillStyle = '#ece7f7';
    ctx.fillText('ĐỘI HÌNH BANG CHIẾN', pad, pad + 60);
    F(13, 400, true);
    ctx.fillStyle = 'rgba(178,166,205,0.8)';
    ctx.fillText('NHẤT MỘNG · ' + timeStr(Date.now()) + ' · ' +
      Object.keys(placedKeys()).length + '/' + (S.nDoan * S.nTeam * S.nSize) + ' suất', pad, pad + 86);

    var y = headH;
    for (var d = 0; d < S.nDoan; d++) {
      // thanh tên đoàn
      ctx.fillStyle = 'rgba(0,229,255,0.10)';
      rrect(ctx, pad, y, W - pad * 2, 34, 10); ctx.fill();
      F(19, 700);
      ctx.fillStyle = '#00e5ff';
      ctx.fillText(S.doanNames[d].toUpperCase(), pad + 14, y + 24);
      y += 50;

      for (var t = 0; t < S.nTeam; t++) {
        var team = S.teams[tid(d, t)];
        var x = pad + t * (cardW + gap);

        ctx.fillStyle = 'rgba(20,13,38,0.9)';
        rrect(ctx, x, y, cardW, cardH, 14); ctx.fill();
        ctx.strokeStyle = 'rgba(180,76,255,0.35)';
        rrect(ctx, x, y, cardW, cardH, 14); ctx.stroke();

        F(17, 700);
        ctx.fillStyle = '#ece7f7';
        ctx.fillText(clip(ctx, team.name, cardW - 90), x + 14, y + 28);
        F(11, 400, true);
        ctx.fillStyle = 'rgba(178,166,205,0.75)';
        ctx.textAlign = 'right';
        ctx.fillText(team.slots.filter(Boolean).length + '/' + S.nSize, x + cardW - 14, y + 28);
        ctx.textAlign = 'left';

        F(12, 400);
        ctx.fillStyle = '#8fe9ff';
        ctx.fillText(clip(ctx, team.note || '—', cardW - 28), x + 14, y + 50);

        ctx.strokeStyle = 'rgba(180,76,255,0.18)';
        ctx.beginPath(); ctx.moveTo(x + 12, y + 62); ctx.lineTo(x + cardW - 12, y + 62); ctx.stroke();

        for (var s = 0; s < S.nSize; s++) {
          var ry = y + 74 + s * rowH;
          var m = team.slots[s] && byKey(team.slots[s]);
          if (!m) {
            F(12, 400, true);
            ctx.fillStyle = 'rgba(178,166,205,0.3)';
            ctx.fillText('— trống —', x + 26, ry + 20);
            continue;
          }
          var col = colorOf(m);
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(x + 20, ry + 15, 4, 0, Math.PI * 2); ctx.fill();

          F(15, 600);
          ctx.fillStyle = '#ece7f7';
          var nm = (team.cap === m.key ? '★ ' : '') + m.name;
          ctx.fillText(clip(ctx, nm, cardW - 150), x + 32, ry + 20);

          F(10.5, 400, true);
          ctx.fillStyle = col;
          ctx.textAlign = 'right';
          ctx.fillText(clip(ctx, [m.phai, fmtPower(m.power)].filter(Boolean).join(' · '), 118), x + cardW - 14, ry + 20);
          ctx.textAlign = 'left';

          var task = S.tasks[m.key];
          if (task) {
            F(11.5, 400);
            ctx.fillStyle = '#8affc1';
            ctx.fillText(clip(ctx, '▸ ' + task, cardW - 46), x + 32, ry + 35);
          }
        }
      }
      y += cardH + 30;
    }

    cv.toBlob(function (blob) {
      download(blob, 'doi-hinh-bang-chien.png');
      toast('Đã xuất ảnh PNG');
    }, 'image/png');
  }

  // ── Cổng leader ──────────────────────────────────────────────────────────
  function currentHash() { return localStorage.getItem(K_PASS) || PASS_HASH; }

  function unlock() {
    $('#gate').hidden = true;
    $('#nav').hidden = false;
    $('#page').hidden = false;
    boot();
  }

  function initGate() {
    if (localStorage.getItem(K_UNLOCK) === currentHash()) { unlock(); return; }
    $('#gate-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var h = sha256($('#gate-pass').value);
      if (h === currentHash()) {
        localStorage.setItem(K_UNLOCK, h);
        unlock();
      } else {
        $('#gate-err').textContent = 'Sai mật khẩu';
        $('#gate-pass').value = '';
        $('#gate-pass').focus();
      }
    });
    $('#gate-pass').focus();
  }

  // ── Khởi động phần trang ─────────────────────────────────────────────────
  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    load();
    renderAll();
    bind();
    if (S.syncAt) setStatus('Đội hình lưu lúc ' + timeStr(S.syncAt) + ' · bấm ⟳ để làm mới', 'ok');
    if (S.url) sync(false).catch(function () { /* đã báo lỗi ở trên */ });
  }

  function bind() {
    initDnD();

    $('#pool-list').addEventListener('click', onPoolClick);
    $('#pool').addEventListener('click', function (e) {
      if (e.target === e.currentTarget && pick) { recall(pick); pick = null; renderAll(); }
    });
    $('#board').addEventListener('click', onBoardClick);

    $('#pool-search').addEventListener('input', renderPool);
    $('#pool-sort').addEventListener('change', renderPool);
    $('#pool-recall').addEventListener('click', function () {
      if (!confirm('Rút toàn bộ người khỏi bàn xếp?')) return;
      Object.keys(S.teams).forEach(function (id) {
        S.teams[id].slots = S.teams[id].slots.map(function () { return null; });
        S.teams[id].cap = null;
      });
      save(); renderAll(); toast('Đã rút hết về kho quân');
    });

    // chú giải phái: bấm để lọc, giữ để đổi màu (mở Cấu hình)
    $('#legend').addEventListener('click', function (e) {
      var chip = e.target.closest('.phai-chip');
      if (!chip) return;
      var n = chip.dataset.phai;
      if (filterPhai[n]) delete filterPhai[n]; else filterPhai[n] = true;
      renderLegend(); renderPool();
    });

    // chip trạng thái: bật/tắt cả nhóm khỏi kho quân (Học Việc, Out…)
    $('#legend-status').addEventListener('click', function (e) {
      var chip = e.target.closest('.phai-chip');
      if (!chip) return;
      var n = chip.dataset.status;
      if (S.statusOff[n]) delete S.statusOff[n]; else S.statusOff[n] = true;
      S.statusInit = true;
      save(); renderAll();
    });

    // sửa tên đoàn / team / mục tiêu ngay tại chỗ
    $('#board').addEventListener('input', function (e) {
      var el = e.target;
      if (el.classList.contains('doan__name')) { S.doanNames[+el.dataset.d] = el.value; save(); }
      else if (el.classList.contains('team__name')) { S.teams[tid(+el.dataset.d, +el.dataset.t)].name = el.value; save(); }
      else if (el.classList.contains('team__note')) { S.teams[tid(+el.dataset.d, +el.dataset.t)].note = el.value; save(); }
    });

    $('#btn-sync').addEventListener('click', function () { sync(false).catch(function () {}); });
    $('#btn-cfg').addEventListener('click', openCfg);
    $('#btn-auto').addEventListener('click', autoFill);
    $('#btn-clear').addEventListener('click', function () {
      if (!confirm('Xoá sạch đội hình (người, tên team, mục tiêu, nhiệm vụ)?')) return;
      var url = S.url, tab = S.tab, map = S.map, headers = S.headers, colors = S.colors, labels = S.labels, members = S.members;
      S = defaultState();
      S.url = url; S.tab = tab; S.map = map; S.headers = headers;
      S.colors = colors; S.labels = labels; S.members = members; S.syncAt = Date.now();
      save(); renderAll(); toast('Đã dọn bàn');
    });
    $('#btn-copy').addEventListener('click', copyText);
    $('#btn-png').addEventListener('click', exportPNG);
    $('#btn-export').addEventListener('click', exportJSON);
    $('#btn-import').addEventListener('click', function () { $('#file-import').click(); });
    $('#file-import').addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) importJSON(e.target.files[0]);
      e.target.value = '';
    });
    $('#btn-lock').addEventListener('click', function () {
      localStorage.removeItem(K_UNLOCK);
      location.reload();
    });

    // ── modal chung ──
    document.addEventListener('click', function (e) {
      var c = e.target.closest('[data-close]');
      if (c) closeModal(c.dataset.close);
      if (e.target.classList.contains('bc-modal')) e.target.hidden = true;
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        $$('.bc-modal').forEach(function (m) { m.hidden = true; });
        if (pick) { pick = null; renderAll(); }
      }
    });

    // ── modal nhiệm vụ ──
    $('#mem-presets').innerHTML = TASK_PRESETS.map(function (p) {
      return '<button class="task-preset" type="button">' + esc(p) + '</button>';
    }).join('');
    $('#mem-presets').addEventListener('click', function (e) {
      var b = e.target.closest('.task-preset');
      if (!b) return;
      var ta = $('#mem-task');
      ta.value = ta.value.trim() ? ta.value.trim() + ' · ' + b.textContent : b.textContent;
      ta.focus();
    });
    $('#mem-save').addEventListener('click', saveMember);
    $('#mem-remove').addEventListener('click', function () {
      if (editing) recall(editing);
      closeModal('modal-mem'); editing = null;
    });

    // ── modal cấu hình ──
    $('#cfg-test').addEventListener('click', function () {
      S.url = $('#cfg-url').value.trim();
      S.tab = $('#cfg-tab').value.trim();
      var u = csvUrl(S.url, S.tab);
      $('#cfg-test-msg').textContent = u ? 'Đang tải: ' + u : 'Link không nhận diện được — cần dạng docs.google.com/spreadsheets/d/…';
      if (!u) return;
      sync(true).then(function (list) {
        $('#cfg-test-msg').innerHTML = 'Đọc được <b>' + list.length + '</b> dòng · cột: ' +
          esc(S.headers.join(' | '));
        renderMapSelects(); renderColorRows();
      }, function (err) {
        $('#cfg-test-msg').textContent = 'Lỗi: ' + (err && err.message || err);
      });
    });

    FIELDS.forEach(function (f) {
      $('#map-' + f).addEventListener('change', function () { S.map[f] = +this.value; });
    });

    $('#cfg-colors').addEventListener('input', function (e) {
      var inp = e.target.closest('.color-row__c');
      if (!inp) return;
      S.colors[inp.dataset.phai] = inp.value;
      var row = inp.closest('.color-row');
      row.querySelector('.color-row__n').style.color = inp.value;
      row.querySelector('.color-row__hex').textContent = inp.value;
      save(); renderAll();
    });

    $('#cfg-pass-set').addEventListener('click', function () {
      var v = $('#cfg-pass').value;
      if (!v) { $('#cfg-pass-msg').textContent = 'Nhập mật khẩu mới trước đã.'; return; }
      var h = sha256(v);
      localStorage.setItem(K_PASS, h);
      localStorage.setItem(K_UNLOCK, h);
      $('#cfg-pass').value = '';
      $('#cfg-pass-msg').innerHTML = 'Đã đổi mật khẩu trên máy này. Muốn áp dụng cho mọi máy, ' +
        'thay <code>PASS_HASH</code> trong <code>js/bangchien.js</code> bằng:<br><code>' + h + '</code>';
      toast('Đã đổi mật khẩu leader');
    });

    $('#cfg-save').addEventListener('click', function () {
      S.url = $('#cfg-url').value.trim();
      S.tab = $('#cfg-tab').value.trim();
      var nd = Math.max(1, Math.min(6, +$('#cfg-doan').value || 2));
      var nt = Math.max(1, Math.min(10, +$('#cfg-tpd').value || 5));
      var ns = Math.max(1, Math.min(12, +$('#cfg-size').value || 6));
      if (nd !== S.nDoan || nt !== S.nTeam || ns !== S.nSize) {
        S.nDoan = nd; S.nTeam = nt; S.nSize = ns;
        rebuildTeams(S); cleanTeams();
      }
      save();
      closeModal('modal-cfg');
      if (S.url) sync(false).catch(function () {}); else renderAll();
    });
  }

  // ── Chạy ─────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initGate);
  else initGate();

  // để tiện kiểm thử trong console
  window.NM_BC = { get state() { return S; }, sync: sync, sha256: sha256 };
})();
