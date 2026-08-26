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

  // Danh sách kỹ năng MẪU — leader sửa lại cho khớp tên thật trong game
  // (Cấu hình → mục 4). Cố tình để tên chung chung, không bịa tên chiêu.
  var SKILLS_DEF = [
    'Khiên chắn', 'Giải khống', 'Tăng tốc', 'Hồi máu nhóm', 'Choáng diện rộng',
    'Miễn thương', 'Kéo nhóm', 'Phản đòn', 'Đẩy lùi', 'Ẩn thân'
  ];

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
  var readOnly = false; // true khi mở bằng link chia sẻ (#v=…)

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
      teams: {}, tasks: {}, members: [], syncAt: 0,
      bench: [],                       // key những người để dự bị
      skills: {},                      // key -> [tên kỹ năng mang theo]
      skillList: SKILLS_DEF.slice(),   // danh sách kỹ năng leader tự quản
      taskList: TASK_PRESETS.slice(),  // danh sách nhiệm vụ mẫu leader tự quản
      requirePhai: ['to van']          // phái mà mỗi team buộc phải có (trị liệu)
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
    // Chế độ chỉ xem dùng chung biến S — tuyệt đối không được ghi đè đội hình
    // thật của leader khi chính leader mở link chia sẻ trên máy mình.
    if (readOnly) return;
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

  /** "#ffd166" → "255,209,102" để pha nền rgba() cho cả box thẻ. */
  function rgbOf(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n) || h.length !== 6) return '138,127,176';
    return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
  }

  /**
   * Màu chữ cho tên nhân vật: lấy màu phái rồi pha dần với trắng cho tới khi
   * tương phản với nền thẻ (đã pha 30% màu phái) đạt >= 4.5:1 theo WCAG AA.
   * Nhờ vậy phái màu tối như Toái Mộng / Huyết Hà vẫn đọc rõ, và màu leader tự
   * chọn cũng luôn an toàn.
   */
  function textColorFor(hex) {
    var rgb = rgbOf(hex).split(',').map(Number);
    var base = [10, 7, 20];
    var bg = [0, 1, 2].map(function (i) { return 0.30 * rgb[i] + 0.70 * base[i]; });
    var fg = rgb.slice();
    for (var i = 0; i < 24 && contrast(fg, bg) < 4.6; i++) {
      fg = fg.map(function (v) { return v + (255 - v) * 0.10; });
    }
    return '#' + fg.map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join('');
  }

  function relLum(c) {
    var a = c.map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }

  function contrast(f, b) {
    var l1 = relLum(f), l2 = relLum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  // ── Dự bị ────────────────────────────────────────────────────────────────
  function onBench(key) { return S.bench.indexOf(key) >= 0; }

  function benchAdd(key) {
    var loc = findSlot(key);
    if (loc) {
      loc.team.slots[loc.s] = null;
      if (loc.team.cap === key) loc.team.cap = null;
    }
    if (!onBench(key)) S.bench.push(key);
    save(); renderAll();
  }

  function benchRemove(key) {
    var i = S.bench.indexOf(key);
    if (i >= 0) S.bench.splice(i, 1);
  }

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
    // dự bị: bỏ người không còn trong Sheet và người đã được xếp vào bàn
    S.bench = S.bench.filter(function (k) {
      return k && (!hasMembers || valid[k]) && !findSlot(k);
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
    benchRemove(key);                 // vào bàn xếp thì không còn là dự bị
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

  /** Đưa một người về kho quân, dù đang ở trên bàn xếp hay ở khu dự bị. */
  function recall(key) {
    var loc = findSlot(key);
    if (loc) {
      loc.team.slots[loc.s] = null;
      if (loc.team.cap === key) loc.team.cap = null;
    } else if (!onBench(key)) {
      return;
    }
    benchRemove(key);
    save();
    renderAll();
  }

  // ── Render ───────────────────────────────────────────────────────────────
  function renderAll() {
    renderLegend(); renderStatusChips(); renderPool(); renderBench(); renderBoard(); renderStats();
    if (!readOnly) updateCheckBadge();
  }

  function renderBench() {
    var list = S.bench.map(byKey).filter(Boolean);
    $('#bench-count').textContent = list.length;
    $('#bench-list').innerHTML = list.length
      ? list.map(function (m) { return memCard(m, { inBench: true }); }).join('')
      : '<div class="bc-bench__empty">Kéo người vào đây<br>để làm dự bị</div>';
  }

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

    var sk = S.skills[m.key] || [];

    return '<div class="mem' + (opts.inSlot ? ' mem--slot' : '') + (pick === m.key ? ' picked' : '') + '"' +
      ' style="--pc:' + esc(c) + ';--pc-a:' + rgbOf(c) + ';--pc-t:' + esc(textColorFor(c)) +
      '" draggable="true" data-key="' + esc(m.key) + '">' +
      (isCap ? '<span class="mem__cap" title="Đội trưởng">★</span>' : '') +
      '<div class="mem__body">' +
        '<div class="mem__name">' + esc(m.name) + '</div>' +
        (meta.length ? '<div class="mem__meta">' + meta.join('') + '</div>' : '') +
        (task ? '<span class="mem__task">▸ ' + esc(task) + '</span>' : '') +
        (sk.length ? '<span class="mem__skills">✦ ' + esc(sk.join(' · ')) + '</span>' : '') +
      '</div>' +
      '<div class="mem__acts">' +
        '<button class="mem__x mem__x--edit" data-act="edit" title="Nhiệm vụ &amp; kỹ năng">✎</button>' +
        (opts.inBench ? '<button class="mem__x" data-act="unbench" title="Trả về kho quân">✕</button>' : '') +
        (opts.inSlot ? '<button class="mem__x mem__x--bench" data-act="bench" title="Cho xuống dự bị">⛨</button>' : '') +
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
      if (placed[m.key] || onBench(m.key)) return false;
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
    $('#st-bench').textContent = S.bench.length;
    $('#st-free').textContent = Math.max(0, pool - placed - S.bench.length);
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
      if (btn.dataset.act === 'bench') { benchAdd(key); return; }
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
    if (pick && (findSlot(pick) || onBench(pick))) { recall(pick); pick = null; renderAll(); }
  }

  /** Khu dự bị: bấm thẻ = nhặt, ✎ = nhiệm vụ, ✕ = trả về kho quân,
      bấm chỗ trống trong khu = thả người đang nhặt xuống dự bị. */
  function onBenchClick(e) {
    var btn = e.target.closest('[data-act]');
    var memEl = e.target.closest('.mem');
    if (btn && memEl) {
      e.stopPropagation();
      var k = memEl.dataset.key;
      if (btn.dataset.act === 'edit') { openMember(k); return; }
      if (btn.dataset.act === 'unbench') { benchRemove(k); save(); renderAll(); return; }
    }
    if (memEl) { setPick(memEl.dataset.key); return; }
    if (pick) { benchAdd(pick); pick = null; renderAll(); }
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
      var zone = e.target.closest && (e.target.closest('.slot') || e.target.closest('.team') || e.target.closest('.bc-bench') || e.target.closest('.bc-pool'));
      if (!zone) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!zone.classList.contains('drop-on')) {
        $$('.drop-on').forEach(function (el) { el.classList.remove('drop-on'); });
        zone.classList.add('drop-on');
      }
    });
    document.addEventListener('drop', function (e) {
      var zone = e.target.closest && (e.target.closest('.slot') || e.target.closest('.team') || e.target.closest('.bc-bench') || e.target.closest('.bc-pool'));
      if (!zone) return;
      e.preventDefault();
      var key = e.dataTransfer.getData('text/plain');
      if (!key || !byKey(key)) return;
      if (zone.classList.contains('bc-pool')) recall(key);
      else if (zone.classList.contains('bc-bench')) benchAdd(key);
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
    var pool = S.members.filter(function (m) { return !placed[m.key] && !onBench(m.key) && eligible(m); })
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

  // ── Kiểm tra đội hình ────────────────────────────────────────────────────
  /** "A, B, C và 3 người nữa" — cho dòng kết quả khỏi dài lê thê. */
  function shortList(names) {
    if (names.length <= 3) return names.join(', ');
    return names.slice(0, 3).join(', ') + ' và ' + (names.length - 3) + ' người nữa';
  }

  /**
   * Quét toàn bộ đội hình, trả về danh sách vấn đề.
   * lv: 'err' (chắc chắn phải sửa) · 'warn' (nên xem lại) · 'info' (còn thiếu sót nhỏ)
   */
  function checkRoster() {
    var out = [];
    var need = S.requirePhai || [];
    var perDoan = [];

    for (var d = 0; d < S.nDoan; d++) {
      var doanFilled = 0;
      for (var t = 0; t < S.nTeam; t++) {
        var team = S.teams[tid(d, t)];
        var ms = team.slots.map(function (k) { return k ? byKey(k) : null; }).filter(Boolean);
        doanFilled += ms.length;
        var where = S.doanNames[d] + ' · ' + team.name;

        var empty = S.nSize - ms.length;
        if (empty) out.push({ lv: 'err', d: d, t: t, msg: where + ' — còn ' + empty + ' ô trống' });
        if (ms.length && !team.cap) out.push({ lv: 'warn', d: d, t: t, msg: where + ' — chưa đặt đội trưởng' });

        var cnt = {};
        ms.forEach(function (m) { if (m.phaiN) cnt[m.phaiN] = (cnt[m.phaiN] || 0) + 1; });
        Object.keys(cnt).forEach(function (n) {
          if (cnt[n] >= 3) out.push({ lv: 'warn', d: d, t: t, msg: where + ' — ' + cnt[n] + ' người cùng phái ' + (S.labels[n] || n) });
        });
        need.forEach(function (n) {
          if (ms.length && !cnt[n]) out.push({ lv: 'warn', d: d, t: t, msg: where + ' — chưa có ' + (S.labels[n] || n) });
        });

        // Gom "chưa có nhiệm vụ / kỹ năng" thành một dòng mỗi team — liệt kê
        // từng người sẽ ra cả trăm dòng, không ai đọc nổi.
        var noTask = [], noSkill = [];
        ms.forEach(function (m) {
          if (!eligible(m)) {
            out.push({ lv: 'warn', d: d, t: t, key: m.key, msg: where + ' — “' + m.name + '” thuộc nhóm ' + (m.status || 'đang bị lọc') + ', không nằm trong kho quân' });
          }
          if (!S.tasks[m.key]) noTask.push(m.name);
          if (!(S.skills[m.key] || []).length) noSkill.push(m.name);
        });
        if (noTask.length) {
          out.push({ lv: 'info', d: d, t: t, msg: where + ' — ' + noTask.length + '/' + ms.length + ' người chưa có nhiệm vụ: ' + shortList(noTask) });
        }
        if (noSkill.length) {
          out.push({ lv: 'info', d: d, t: t, msg: where + ' — ' + noSkill.length + '/' + ms.length + ' người chưa gán kỹ năng: ' + shortList(noSkill) });
        }
      }
      perDoan.push(doanFilled);
    }

    // Lệch quân số giữa các đoàn
    if (perDoan.length > 1) {
      var mx = Math.max.apply(null, perDoan), mn = Math.min.apply(null, perDoan);
      if (mx - mn >= 2) {
        out.push({ lv: 'warn', msg: 'Quân số lệch giữa các đoàn: ' + perDoan.join(' / ') + ' người' });
      }
    }

    // Lệch lực chiến (chỉ khi Sheet có cột lực chiến)
    if (S.map.power >= 0) {
      var pw = [];
      for (d = 0; d < S.nDoan; d++) for (t = 0; t < S.nTeam; t++) {
        var sum = 0;
        S.teams[tid(d, t)].slots.forEach(function (k) { var m = k && byKey(k); if (m) sum += m.power; });
        pw.push({ d: d, t: t, v: sum, name: S.doanNames[d] + ' · ' + S.teams[tid(d, t)].name });
      }
      var vals = pw.map(function (x) { return x.v; }).filter(function (v) { return v > 0; });
      if (vals.length > 1) {
        var hi = pw.slice().sort(function (a, b) { return b.v - a.v; })[0];
        var lo = pw.slice().filter(function (x) { return x.v > 0; }).sort(function (a, b) { return a.v - b.v; })[0];
        if (hi.v > lo.v * 1.25) {
          out.push({ lv: 'warn', d: hi.d, t: hi.t, msg: 'Lực chiến lệch: ' + hi.name + ' (' + fmtPower(hi.v) + ') mạnh hơn ' + lo.name + ' (' + fmtPower(lo.v) + ') trên 25%' });
        }
      }
    }

    var rank = { err: 0, warn: 1, info: 2 };
    out.sort(function (a, b) { return rank[a.lv] - rank[b.lv]; });
    return out;
  }

  /** Số lỗi + cảnh báo, hiện ngay trên nút Kiểm tra. */
  function updateCheckBadge() {
    if (!S.members.length) { $('#btn-check-n').textContent = ''; return; }
    var n = checkRoster().filter(function (i) { return i.lv !== 'info'; }).length;
    $('#btn-check-n').textContent = n ? '(' + n + ')' : '';
  }

  function renderCheckNeed() {
    var keys = Object.keys(S.labels).filter(Boolean);
    $('#check-need').innerHTML = keys.map(function (n) {
      return '<span class="chip' + (S.requirePhai.indexOf(n) >= 0 ? ' on' : '') + '" data-name="' + esc(n) + '">' +
        '<button type="button" class="chip__t">' + esc(S.labels[n]) + '</button></span>';
    }).join('');
  }

  function renderCheck() {
    var list = checkRoster();
    var c = { err: 0, warn: 0, info: 0 };
    list.forEach(function (i) { c[i.lv]++; });
    $('#check-sum').textContent = list.length
      ? c.err + ' lỗi · ' + c.warn + ' cảnh báo · ' + c.info + ' thiếu sót nhỏ'
      : 'Đội hình sạch, không có vấn đề gì';

    var icon = { err: '✕', warn: '!', info: 'i' };
    $('#check-list').innerHTML = list.map(function (i, idx) {
      return '<button type="button" class="check-item check-item--' + i.lv + '" data-i="' + idx + '">' +
        '<span class="check-item__i">' + icon[i.lv] + '</span><span>' + esc(i.msg) + '</span></button>';
    }).join('');
    renderCheck._list = list;
  }

  function openCheck() {
    if (!S.members.length) { toast('Chưa có dữ liệu để kiểm tra', true); return; }
    renderCheckNeed();
    renderCheck();
    openModal('modal-check');
  }

  /** Đóng modal, cuộn tới team liên quan và nháy sáng nó. */
  function jumpToTeam(d, t) {
    closeModal('modal-check');
    var el = $('.team[data-d="' + d + '"][data-t="' + t + '"]');
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('flash');
    setTimeout(function () { el.classList.remove('flash'); }, 2200);
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
    renderTaskPicker();
    renderSkillPicker();
    $('#mem-cap').checked = !!(loc && loc.team.cap === key);
    $('#mem-cap').disabled = !loc;
    $('#mem-remove').hidden = !loc;
    $('#mem-bench').hidden = onBench(key);
    openModal('modal-mem');
    setTimeout(function () { $('#mem-task').focus(); }, 30);
  }

  /** HTML một chip: phần chữ bấm để bật/tắt, nút ✕ để xoá khỏi danh sách mẫu. */
  function chipHTML(name, on, kind) {
    return '<span class="chip' + (kind === 'task' ? ' chip--task' : '') + (on ? ' on' : '') +
      '" data-name="' + esc(name) + '">' +
      '<button type="button" class="chip__t">' + esc(name) + '</button>' +
      '<button type="button" class="chip__x" title="Xoá khỏi danh sách">✕</button></span>';
  }

  /** Chip kỹ năng trong modal thành viên — sáng lên nếu người này đang mang. */
  function renderSkillPicker() {
    var have = (editing && S.skills[editing]) || [];
    $('#mem-skills').innerHTML = S.skillList.map(function (s) {
      return chipHTML(s, have.indexOf(s) >= 0, 'skill');
    }).join('');
  }

  /** Chip nhiệm vụ mẫu — sáng lên nếu đang có trong ô nhiệm vụ. */
  function renderTaskPicker() {
    var cur = tokens($('#mem-task').value).map(norm);
    $('#mem-presets').innerHTML = S.taskList.map(function (t) {
      return chipHTML(t, cur.indexOf(norm(t)) >= 0, 'task');
    }).join('');
  }

  function renderSkillEditor() { $('#cfg-skills').innerHTML = S.skillList.map(function (s) { return chipHTML(s, false, 'skill'); }).join(''); }
  function renderTaskEditor() { $('#cfg-tasks').innerHTML = S.taskList.map(function (t) { return chipHTML(t, false, 'task'); }).join(''); }

  /** Tách ô nhiệm vụ thành các phần ngăn bởi " · ". */
  function tokens(text) {
    return String(text || '').split('·').map(function (t) { return t.trim(); }).filter(Boolean);
  }

  /** Bấm chip nhiệm vụ: đang có thì gỡ ra, chưa có thì thêm vào. */
  function toggleTaskToken(text, name) {
    var list = tokens(text), i = -1;
    for (var j = 0; j < list.length; j++) if (norm(list[j]) === norm(name)) { i = j; break; }
    if (i >= 0) list.splice(i, 1); else list.push(name);
    return list.join(' · ');
  }

  /** Thêm vào danh sách mẫu. Trả về tên đã chuẩn hoá, '' nếu rỗng. */
  function addTo(list, raw) {
    var name = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!name) return '';
    var dup = list.filter(function (s) { return norm(s) === norm(name); })[0];
    if (dup) return dup;                       // trùng thì dùng lại mục cũ
    list.push(name);
    save();
    return name;
  }

  function addSkill(raw) { return addTo(S.skillList, raw); }
  function addTask(raw) { return addTo(S.taskList, raw); }

  /** Đếm số người đang mang kỹ năng này. */
  function skillUsers(name) {
    return Object.keys(S.skills).filter(function (k) { return S.skills[k].indexOf(name) >= 0; });
  }

  /** Đếm số người có nhiệm vụ chứa phần này. */
  function taskUsers(name) {
    return Object.keys(S.tasks).filter(function (k) {
      return tokens(S.tasks[k]).some(function (t) { return norm(t) === norm(name); });
    });
  }

  /** Xoá kỹ năng khỏi danh sách chung; stripAll=true thì gỡ khỏi mọi thành viên. */
  function removeSkill(name, stripAll) {
    S.skillList = S.skillList.filter(function (s) { return s !== name; });
    if (stripAll) {
      Object.keys(S.skills).forEach(function (k) {
        S.skills[k] = S.skills[k].filter(function (s) { return s !== name; });
        if (!S.skills[k].length) delete S.skills[k];
      });
    }
    save();
  }

  /** Xoá nhiệm vụ mẫu; stripAll=true thì gỡ phần đó khỏi nhiệm vụ mọi thành viên. */
  function removeTask(name, stripAll) {
    S.taskList = S.taskList.filter(function (t) { return t !== name; });
    if (stripAll) {
      Object.keys(S.tasks).forEach(function (k) {
        var left = tokens(S.tasks[k]).filter(function (t) { return norm(t) !== norm(name); });
        if (left.length) S.tasks[k] = left.join(' · '); else delete S.tasks[k];
      });
    }
    save();
  }

  /**
   * Xử lý chung cho mọi hàng chip: bấm chữ = bật/tắt, bấm ✕ = xoá khỏi danh sách.
   * @param {string} kind 'skill' | 'task'
   * @param {boolean} picker true nếu là hàng chip trong modal thành viên
   */
  function onChipRow(e, kind, picker) {
    var chip = e.target.closest('.chip');
    if (!chip) return;
    var name = chip.dataset.name;

    if (e.target.closest('.chip__x')) {
      var users = kind === 'skill' ? skillUsers(name) : taskUsers(name);
      var strip = true;
      if (users.length) {
        strip = confirm('“' + name + '” đang dùng ở ' + users.length + ' người.\n\n' +
          'OK = xoá khỏi danh sách VÀ gỡ khỏi những người đó.\n' +
          'Cancel = giữ nguyên, không xoá gì.');
        if (!strip) return;
      }
      // Giữ lại những chip đang bật trong modal (chưa bấm Lưu) để không mất công chọn lại
      var chosen = $$('#mem-skills .chip.on').map(function (c) { return c.dataset.name; });

      if (kind === 'skill') removeSkill(name, strip); else removeTask(name, strip);

      if (editing) {
        if (kind === 'task') $('#mem-task').value = stripToken($('#mem-task').value, name, strip);
        renderTaskPicker();
        renderSkillPicker();
        $$('#mem-skills .chip').forEach(function (c) {
          if (chosen.indexOf(c.dataset.name) >= 0) c.classList.add('on');
        });
      }
      renderSkillEditor(); renderTaskEditor();
      renderAll();
      toast('Đã xoá “' + name + '”');
      return;
    }

    if (!picker) return;                       // ở Cấu hình chỉ dùng nút ✕
    if (kind === 'skill') { chip.classList.toggle('on'); return; }
    $('#mem-task').value = toggleTaskToken($('#mem-task').value, name);
    renderTaskPicker();
  }

  function stripToken(text, name, doIt) {
    if (!doIt) return text;
    return tokens(text).filter(function (t) { return norm(t) !== norm(name); }).join(' · ');
  }

  function saveMember() {
    if (!editing) return;
    var v = $('#mem-task').value.trim();
    if (v) S.tasks[editing] = v; else delete S.tasks[editing];

    var sk = $$('#mem-skills .chip.on').map(function (c) { return c.dataset.name; });
    if (sk.length) S.skills[editing] = sk; else delete S.skills[editing];

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
    renderSkillEditor();
    renderTaskEditor();
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
          var sk = S.skills[k] || [];
          out.push('' + (i + 1) + '. ' + (team.cap === k ? '★ ' : '') + m.name +
            (bits.length ? ' [' + bits.join(' · ') + ']' : '') + (task ? ' → ' + task : '') +
            (sk.length ? ' ✦ ' + sk.join(' · ') : ''));
        });
        out.push('');
      }
    }
    if (S.bench.length) {
      out.push('__**DỰ BỊ**__ (' + S.bench.length + ')');
      S.bench.forEach(function (k, i) {
        var m = byKey(k);
        if (!m) return;
        var sk = S.skills[k] || [];
        out.push('' + (i + 1) + '. ' + m.name + (m.phai ? ' [' + m.phai + ']' : '') +
          (S.tasks[k] ? ' → ' + S.tasks[k] : '') + (sk.length ? ' ✦ ' + sk.join(' · ') : ''));
      });
      out.push('');
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

  // ── Link chia sẻ đội hình ────────────────────────────────────────────────
  // Toàn bộ đội hình được nén rồi nhét vào phần #… của URL, nên không cần
  // server: ai mở link cũng dựng lại được đúng bảng, ở chế độ chỉ xem.

  function b64url(u8) {
    var s = '';
    for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function unb64url(str) {
    str = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    var bin = atob(str), u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }

  /**
   * Gói đội hình thành cấu trúc gọn nhất có thể: môn phái và kỹ năng được đưa
   * vào bảng tra, thành viên chỉ giữ chỉ số → link ngắn hơn nhiều.
   */
  function sharePayload() {
    var phaiIdx = {}, phaiTab = [], skillIdx = {}, skillTab = [];
    function pi(m) {
      if (!m.phai) return -1;
      if (phaiIdx[m.phaiN] === undefined) { phaiIdx[m.phaiN] = phaiTab.length; phaiTab.push([m.phai, colorOf(m)]); }
      return phaiIdx[m.phaiN];
    }
    function si(s) {
      if (skillIdx[s] === undefined) { skillIdx[s] = skillTab.length; skillTab.push(s); }
      return skillIdx[s];
    }
    function pack(key) {
      var m = byKey(key);
      if (!m) return null;
      return [m.name, pi(m), S.tasks[key] || '', (S.skills[key] || []).map(si)];
    }

    var teams = [];
    for (var d = 0; d < S.nDoan; d++) {
      for (var t = 0; t < S.nTeam; t++) {
        var team = S.teams[tid(d, t)];
        teams.push([
          team.name, team.note || '', team.slots.indexOf(team.cap),
          team.slots.map(function (k) { return k ? pack(k) : null; })
        ]);
      }
    }
    return {
      v: 1, s: [S.nDoan, S.nTeam, S.nSize], n: S.doanNames.slice(),
      p: phaiTab, k: skillTab, t: teams,
      b: S.bench.map(pack).filter(Boolean), d: Date.now()
    };
  }

  /** JSON → gzip (nếu trình duyệt hỗ trợ) → base64url. Tiền tố z/j cho biết có nén hay không. */
  function encodeShare(obj) {
    var bytes = new TextEncoder().encode(JSON.stringify(obj));
    if (typeof CompressionStream !== 'function') return Promise.resolve('j' + b64url(bytes));
    var stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Response(stream).arrayBuffer().then(function (buf) {
      return 'z' + b64url(new Uint8Array(buf));
    });
  }

  function decodeShare(str) {
    // Bọc try/catch: atob và JSON.parse ném lỗi ĐỒNG BỘ, nếu không bọc thì
    // link sai ký tự sẽ văng ra ngoài chuỗi Promise và chết lặng.
    try {
      var tag = String(str).charAt(0), u8 = unb64url(String(str).slice(1));
      if (tag === 'j') return Promise.resolve(JSON.parse(new TextDecoder().decode(u8)));
      if (tag !== 'z') return Promise.reject(new Error('Link không đúng định dạng'));
      if (typeof DecompressionStream !== 'function') return Promise.reject(new Error('Trình duyệt quá cũ, không giải nén được'));
      var stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
      return new Response(stream).text().then(JSON.parse);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function shareLink() {
    var placed = Object.keys(placedKeys()).length;
    if (!placed && !S.bench.length) { toast('Chưa xếp ai vào bàn', true); return; }
    encodeShare(sharePayload()).then(function (enc) {
      var url = location.origin + location.pathname + '#v=' + enc;
      var done = function () {
        toast('Đã copy link (' + Math.round(url.length / 1024 * 10) / 10 + ' KB) — ai mở cũng xem được, không sửa được');
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, function () { fallbackCopy(url); done(); });
      } else { fallbackCopy(url); done(); }
    }, function (err) {
      toast('Không tạo được link: ' + (err && err.message || err), true);
    });
  }

  /** Dựng lại state từ gói chia sẻ để dùng chung mọi hàm render sẵn có. */
  function sharedToState(p) {
    var st = defaultState();
    st.nDoan = p.s[0]; st.nTeam = p.s[1]; st.nSize = p.s[2];
    st.doanNames = p.n.slice();
    rebuildTeams(st);
    st.colors = {}; st.labels = {};
    (p.p || []).forEach(function (pair) {
      var n = norm(pair[0]);
      st.labels[n] = pair[0];
      st.colors[n] = pair[1];
    });

    var seen = {};
    function add(rec) {
      if (!rec) return null;
      var name = rec[0], key = norm(name), i = 2;
      while (seen[key]) key = norm(name) + '#' + (i++);
      seen[key] = true;
      var phai = rec[1] >= 0 && p.p[rec[1]] ? p.p[rec[1]][0] : '';
      st.members.push({
        key: key, name: name, phai: phai, phaiN: norm(phai),
        status: '', statusN: '', power: 0, powerRaw: '', note: ''
      });
      if (rec[2]) st.tasks[key] = rec[2];
      var sk = (rec[3] || []).map(function (x) { return p.k[x]; }).filter(Boolean);
      if (sk.length) st.skills[key] = sk;
      return key;
    }

    (p.t || []).forEach(function (rec, idx) {
      var d = Math.floor(idx / st.nTeam), t = idx % st.nTeam;
      var team = st.teams[tid(d, t)];
      if (!team) return;
      team.name = rec[0]; team.note = rec[1];
      team.slots = rec[3].map(add);
      team.cap = (rec[2] >= 0 && team.slots[rec[2]]) ? team.slots[rec[2]] : null;
    });
    (p.b || []).forEach(function (rec) {
      var k = add(rec);
      if (k) st.bench.push(k);
    });
    return st;
  }

  /** Mở trang ở chế độ chỉ xem từ link chia sẻ — bỏ qua cổng mật khẩu. */
  function openShared(enc) {
    decodeShare(enc).then(function (p) {
      if (!p || p.v !== 1 || !p.s) throw new Error('Dữ liệu link không hợp lệ');
      S = sharedToState(p);
      readOnly = true;
      document.body.classList.add('ro');
      $('#gate').hidden = true;
      $('#nav').hidden = false;
      $('#page').hidden = false;
      $('#robar').hidden = false;
      $('#robar-time').textContent = 'Chốt lúc ' + timeStr(p.d || Date.now());
      document.title = 'Đội hình Bang Chiến — Nhất Mộng';
      renderAll();
    }, function (err) {
      // Lỗi thật từ gzip/base64 rất khó hiểu với người dùng → nói bằng tiếng người
      var raw = String(err && err.message || err);
      var msg = /không hợp lệ|quá cũ|định dạng/i.test(raw) ? raw : 'link bị cắt ngắn hoặc dán thiếu';
      $('#gate-err').textContent = 'Link đội hình hỏng — ' + msg + '. Xin bang chủ gửi lại.';
      $('#gate-pass').focus();
    });
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
    var pad = 44, cardW = 372, gap = 16, rowH = 50;
    var cols = S.nTeam;
    var cardH = 86 + S.nSize * rowH + 14;
    var W = pad * 2 + cols * cardW + (cols - 1) * gap;
    var headH = 128;
    var doanH = 50 + cardH + 30;
    // khối dự bị ở cuối ảnh: xếp thành hàng, mỗi hàng `cols` người
    var benchList = S.bench.map(byKey).filter(Boolean);
    var benchRows = benchList.length ? Math.ceil(benchList.length / cols) : 0;
    var benchH = benchList.length ? 50 + benchRows * rowH + 16 : 0;
    var H = headH + S.nDoan * doanH + benchH + pad;

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
            ctx.fillText('— trống —', x + 26, ry + 22);
            continue;
          }
          memRow(ctx, m, x + 10, ry, cardW - 20, rowH, team.cap === m.key);
        }
      }
      y += cardH + 30;
    }

    // ── Dự bị ──
    if (benchList.length) {
      ctx.fillStyle = 'rgba(255,209,102,0.10)';
      rrect(ctx, pad, y, W - pad * 2, 34, 10); ctx.fill();
      F(19, 700);
      ctx.fillStyle = '#ffd166';
      ctx.fillText('DỰ BỊ (' + benchList.length + ')', pad + 14, y + 24);
      y += 50;
      benchList.forEach(function (m, i) {
        var bx = pad + (i % cols) * (cardW + gap);
        var by = y + Math.floor(i / cols) * rowH;
        memRow(ctx, m, bx, by, cardW, rowH, false);
      });
    }

    /** Một dòng thành viên: nền pha màu phái + tên mang màu phái. */
    function memRow(c2, m, x, ry, w, h, isCap) {
      var col = colorOf(m), rgb = rgbOf(col);
      c2.fillStyle = 'rgba(' + rgb + ',0.20)';
      rrect(c2, x, ry + 2, w, h - 6, 9); c2.fill();
      c2.fillStyle = col;
      rrect(c2, x, ry + 2, 4, h - 6, 2); c2.fill();

      F(15, 700);
      c2.fillStyle = textColorFor(col);
      c2.fillText(clip(c2, (isCap ? '★ ' : '') + m.name, w - 130), x + 14, ry + 21);

      F(10.5, 400, true);
      c2.fillStyle = 'rgba(255,255,255,0.82)';
      c2.textAlign = 'right';
      c2.fillText(clip(c2, [m.phai, fmtPower(m.power)].filter(Boolean).join(' · '), 112), x + w - 10, ry + 21);
      c2.textAlign = 'left';

      var task = S.tasks[m.key];
      if (task) {
        F(11.5, 400);
        c2.fillStyle = '#a8ffcd';
        c2.fillText(clip(c2, '▸ ' + task, w - 24), x + 14, ry + 34);
      }
      var sk = S.skills[m.key] || [];
      if (sk.length) {
        F(10, 400, true);
        c2.fillStyle = '#ffd9a0';
        c2.fillText(clip(c2, '✦ ' + sk.join(' · '), w - 24), x + 14, ry + (task ? 45 : 35));
      }
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
    // Dán một link chia sẻ khác vào thanh địa chỉ chỉ đổi phần #… nên trình
    // duyệt không tải lại trang — phải tự nạp lại để dựng đúng đội hình mới.
    window.addEventListener('hashchange', function () {
      if (readOnly || (location.hash || '').indexOf('#v=') === 0) location.reload();
    });

    // Link chia sẻ đội hình: mở thẳng chế độ chỉ xem, không hỏi mật khẩu
    var h = location.hash || '';
    if (h.indexOf('#v=') === 0) { openShared(h.slice(3)); return; }

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
    $('#bench').addEventListener('click', onBenchClick);
    $('#board').addEventListener('click', onBoardClick);

    $('#pool-search').addEventListener('input', renderPool);
    $('#pool-sort').addEventListener('change', renderPool);
    $('#pool-recall').addEventListener('click', function () {
      if (!confirm('Rút toàn bộ người khỏi bàn xếp và khu dự bị về kho quân?')) return;
      Object.keys(S.teams).forEach(function (id) {
        S.teams[id].slots = S.teams[id].slots.map(function () { return null; });
        S.teams[id].cap = null;
      });
      S.bench = [];
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
      if (!confirm('Xoá sạch đội hình (người, dự bị, tên team, mục tiêu, nhiệm vụ, kỹ năng đã gán)?')) return;
      // Giữ lại phần cấu hình: nguồn Sheet, map cột, màu phái, lọc trạng thái,
      // danh sách kỹ năng — chỉ dọn đội hình.
      var keep = {
        url: S.url, tab: S.tab, map: S.map, headers: S.headers,
        colors: S.colors, labels: S.labels, members: S.members,
        statusLabels: S.statusLabels, statusOff: S.statusOff, statusInit: S.statusInit,
        skillList: S.skillList, taskList: S.taskList
      };
      S = defaultState();
      Object.keys(keep).forEach(function (k) { S[k] = keep[k]; });
      S.syncAt = Date.now();
      save(); renderAll(); toast('Đã dọn bàn');
    });
    $('#btn-check').addEventListener('click', openCheck);
    $('#btn-share').addEventListener('click', shareLink);

    // chip "phái bắt buộc" trong modal kiểm tra
    $('#check-need').addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      var n = chip.dataset.name, i = S.requirePhai.indexOf(n);
      if (i >= 0) S.requirePhai.splice(i, 1); else S.requirePhai.push(n);
      save();
      renderCheckNeed(); renderCheck(); updateCheckBadge();
    });

    // bấm một dòng kết quả → nhảy tới team đó
    $('#check-list').addEventListener('click', function (e) {
      var b = e.target.closest('.check-item');
      if (!b) return;
      var item = (renderCheck._list || [])[+b.dataset.i];
      if (item && item.d !== undefined) jumpToTeam(item.d, item.t);
      else closeModal('modal-check');
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
    $('#mem-presets').addEventListener('click', function (e) { onChipRow(e, 'task', true); });
    $('#mem-task').addEventListener('input', renderTaskPicker);
    $('#mem-task-clear').addEventListener('click', function () {
      $('#mem-task').value = '';
      renderTaskPicker();
      $('#mem-task').focus();
    });
    $('#mem-task-add').addEventListener('click', function () {
      var inp = $('#mem-task-new');
      var name = addTask(inp.value);
      if (!name) { inp.focus(); return; }
      inp.value = '';
      $('#mem-task').value = toggleTaskToken($('#mem-task').value, name);   // thêm xong gán luôn
      renderTaskPicker(); renderTaskEditor();
      inp.focus();
    });
    $('#mem-task-new').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); $('#mem-task-add').click(); }
    });
    $('#mem-save').addEventListener('click', saveMember);
    $('#mem-remove').addEventListener('click', function () {
      if (editing) recall(editing);
      closeModal('modal-mem'); editing = null;
    });
    $('#mem-bench').addEventListener('click', function () {
      if (editing) { saveMember(); benchAdd(editing); }
      closeModal('modal-mem'); editing = null;
    });

    // chip kỹ năng: bấm chữ = bật/tắt (chỉ ghi vào state khi Lưu), ✕ = xoá khỏi danh sách
    $('#mem-skills').addEventListener('click', function (e) { onChipRow(e, 'skill', true); });
    $('#mem-skill-add').addEventListener('click', function () {
      var inp = $('#mem-skill-new');
      var chosen = $$('#mem-skills .chip.on').map(function (c) { return c.dataset.name; });
      var name = addSkill(inp.value);
      if (!name) { inp.focus(); return; }
      inp.value = '';
      if (chosen.indexOf(name) < 0) chosen.push(name);      // thêm xong bật luôn cho người này
      renderSkillPicker();
      $$('#mem-skills .chip').forEach(function (c) {
        if (chosen.indexOf(c.dataset.name) >= 0) c.classList.add('on');
      });
      renderSkillEditor();
      inp.focus();
    });
    $('#mem-skill-new').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); $('#mem-skill-add').click(); }
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

    // quản lý danh sách kỹ năng trong Cấu hình
    $('#cfg-skill-add').addEventListener('click', function () {
      var inp = $('#cfg-skill-new');
      if (!addSkill(inp.value)) { inp.focus(); return; }
      inp.value = '';
      renderSkillEditor(); renderAll();
      inp.focus();
    });
    $('#cfg-skill-new').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); $('#cfg-skill-add').click(); }
    });
    $('#cfg-skills').addEventListener('click', function (e) { onChipRow(e, 'skill', false); });

    // quản lý danh sách nhiệm vụ mẫu trong Cấu hình
    $('#cfg-tasks').addEventListener('click', function (e) { onChipRow(e, 'task', false); });
    $('#cfg-task-add').addEventListener('click', function () {
      var inp = $('#cfg-task-new');
      if (!addTask(inp.value)) { inp.focus(); return; }
      inp.value = '';
      renderTaskEditor();
      inp.focus();
    });
    $('#cfg-task-new').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); $('#cfg-task-add').click(); }
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
