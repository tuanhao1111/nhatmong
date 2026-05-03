/**
 * storage.js - Local cache + API wrapper
 * 
 * THAY ĐỔI:
 *   - Members.add/update/delete BÂY GIỜ ghi qua MembersFB (Firestore subcollection),
 *     KHÔNG ghi localStorage trực tiếp. Cache localStorage được cập nhật bởi
 *     onSnapshot listener ở firebase.js. Hàm trả về Promise (vẫn cập nhật cache
 *     optimistic để UI sync read tiếp tục hoạt động).
 *   - Sessions, Settings, Guild giữ nguyên - dùng saveData() để push qua _guildRef.
 */

const DB_KEY = 'nghich_thuy_han_guild';

const DEFAULT_DATA = {
  guild: { name: 'Nghịch Thủy Hàn', description: 'Bang hội hùng mạnh', maxMembers: 100, level: 1 },
  members: [],
  sessions: [],
  settings: {
    numTeams: 10, slotsPerTeam: 6, reserveSlots: 30,
    classes: [
      { id:'toai_mong',  name:'Toái Mộng', color:'#80c7e6' },
      { id:'thiet_y',    name:'Thiết Y',   color:'#e6a35c' },
      { id:'huyet_ha',   name:'Huyết Hà',  color:'#a3534a' },
      { id:'than_tuong', name:'Thần Tướng',color:'#5e7faf' },
      { id:'to_van',     name:'Tố Vân',    color:'#f28e99' },
      { id:'cuu_linh',   name:'Cửu Linh',  color:'#b36bb3' },
      { id:'long_ngam',  name:'Long Ngâm', color:'#8cb36b' }
    ],
    skills: [], tasks: [], maps: [],
    currentMap: ''
  },
  currentSession: null
};

function loadData() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_DATA));
    const d = JSON.parse(raw);
    if (!d.settings) d.settings = DEFAULT_DATA.settings;
    if (!d.settings.skills) d.settings.skills = [];
    if (!d.settings.tasks)  d.settings.tasks  = [];
    if (!d.settings.maps)   d.settings.maps   = [];
    if (!d.settings.classes)d.settings.classes = DEFAULT_DATA.settings.classes;
    if (!d.members) d.members = [];
    return d;
  } catch(e) { return JSON.parse(JSON.stringify(DEFAULT_DATA)); }
}

// Default saveData chỉ ghi cache local. firebase.js sẽ override window.saveData
// để thêm push lên Firestore.
function saveData(data) {
  try { localStorage.setItem(DB_KEY, JSON.stringify(data)); return true; }
  catch(e) { return false; }
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2,5);
}

// Optimistic cache update - gọi sau khi MembersFB.* thành công (hoặc trước cho UX)
function _cacheMemberAdd(m) {
  const data = loadData();
  if (!data.members.find(x => x.id === m.id)) data.members.push(m);
  try { localStorage.setItem(DB_KEY, JSON.stringify(data)); } catch(e){}
}
function _cacheMemberUpdate(id, patch) {
  const data = loadData();
  const i = data.members.findIndex(m => m.id === id);
  if (i >= 0) data.members[i] = Object.assign({}, data.members[i], patch);
  try { localStorage.setItem(DB_KEY, JSON.stringify(data)); } catch(e){}
}
function _cacheMemberDelete(id) {
  const data = loadData();
  const member = data.members.find(m => m.id === id);
  const inGameName = member ? member.inGameName : null;
  data.members = data.members.filter(m => m.id !== id);
  function matchSlot(slot) {
    if (!slot) return false;
    if (slot.id === id) return true;
    if (inGameName && slot.inGameName === inGameName) return true;
    return false;
  }
  if (data.currentSession && data.currentSession.teams)
    data.currentSession.teams.forEach(t => { if(t.slots) t.slots = t.slots.map(s => matchSlot(s)?null:s); });
  if (data.currentSession && data.currentSession.reserve)
    data.currentSession.reserve = data.currentSession.reserve.map(s => matchSlot(s)?null:s);
  if (data.sessions) data.sessions.forEach(sess => {
    if (sess.teams) sess.teams.forEach(t => { if(t.slots) t.slots = t.slots.map(s => matchSlot(s)?null:s); });
  });
  try { localStorage.setItem(DB_KEY, JSON.stringify(data)); } catch(e){}
  return data;
}

const Members = {
  getAll()    { return loadData().members || []; },
  getById(id) { return this.getAll().find(m => m.id === id); },
  count()     { return this.getAll().length; },

  /** Trả về Promise<member>. Optimistic update cache trước khi Firestore confirm. */
  add(m) {
    const nm = {
      id: m.id || genId(),
      name: m.name || '',
      inGameName: m.inGameName || '',
      inGameId:   m.inGameId   || '',
      discordId:  m.discordId  || '',
      class:      m.class      || '',
      power:      m.power      || 0,
      combatRole: m.combatRole || '',
      skill:      m.skill      || (m.skills && m.skills[0]) || '',
      skills:     Array.isArray(m.skills) ? m.skills : (m.skill ? [m.skill] : []),
      tasks:      m.tasks      || [],
      role:       m.role       || 'member',
      joinDate:   m.joinDate   || new Date().toISOString().split('T')[0],
      note:       m.note       || ''
    };
    _cacheMemberAdd(nm);
    if (typeof MembersFB !== 'undefined' && MembersFB) {
      return MembersFB.add(nm).catch(function(e){
        console.error('[Members.add] Firestore error:', e);
        if (typeof showToast === 'function')
          showToast('❌ Không lưu được lên Firebase: ' + (e.code || e.message), 'error', 4000);
        throw e;
      });
    }
    return Promise.resolve(nm);
  },

  /** Trả về Promise. */
  update(id, patch) {
    _cacheMemberUpdate(id, patch);
    if (typeof MembersFB !== 'undefined' && MembersFB) {
      return MembersFB.update(id, patch).catch(function(e){
        console.error('[Members.update] Firestore error:', e);
        if (typeof showToast === 'function')
          showToast('❌ Không lưu được lên Firebase: ' + (e.code || e.message), 'error', 4000);
        throw e;
      });
    }
    return Promise.resolve();
  },

  /** Trả về Promise. */
  delete(id) {
    const data = _cacheMemberDelete(id);
    // Khi xóa member, currentSession đã thay đổi → cũng cần push session lên guild doc
    if (typeof window.saveData === 'function') window.saveData(data);
    if (typeof MembersFB !== 'undefined' && MembersFB) {
      return MembersFB.delete(id).catch(function(e){
        console.error('[Members.delete] Firestore error:', e);
        if (typeof showToast === 'function')
          showToast('❌ Không xóa được trên Firebase: ' + (e.code || e.message), 'error', 4000);
        throw e;
      });
    }
    return Promise.resolve();
  }
};

const Sessions = {
  getAll()    { return loadData().sessions || []; },
  getCurrent(){ return loadData().currentSession || null; },
  createNew(config={}) {
    const data = loadData();
    if (data.currentSession) {
      data.sessions.unshift(Object.assign({},data.currentSession,{status:'closed',closedAt:new Date().toISOString()}));
    }
    const now = new Date();
    const session = {
      id: genId(),
      name: config.name || ('Tuần '+getWeekNumber(now)+' - '+now.getFullYear()),
      createdAt: now.toISOString(), status:'active',
      map: config.map || data.settings.currentMap || '',
      teams: buildEmptyTeams(data.settings),
      reserve: buildEmptyReserve(data.settings),
      tactics: { notes:'', markers:[], customMarkers:[] },
      settings: JSON.parse(JSON.stringify(data.settings))
    };
    data.currentSession = session;
    if (typeof window.saveData === 'function') window.saveData(data); else saveData(data);
    return session;
  },
  updateCurrent(updates) {
    const data = loadData();
    if (!data.currentSession) return false;
    data.currentSession = Object.assign({}, data.currentSession, updates);
    if (typeof window.saveData === 'function') window.saveData(data); else saveData(data);
    return data.currentSession;
  },
  saveMarkers(markers, customMarkers) {
    const data = loadData();
    if (!data.currentSession) return;
    data.currentSession.tactics.markers = markers;
    if (customMarkers !== undefined) data.currentSession.tactics.customMarkers = customMarkers;
    if (typeof window.saveData === 'function') window.saveData(data); else saveData(data);
  },
  assignMember(teamIdx, slotIdx, memberId, isReserve=false, extra={}) {
    const data = loadData();
    if (!data.currentSession) return false;
    const member = data.members.find(m => m.id===memberId);
    if (!member) return false;
    const info = {
      id: memberId,
      name: member.name,
      inGameName: member.inGameName,
      class: member.class,
      combatRole: extra.combatRole || member.combatRole,
      // Backward compat: giữ field skill (single) và thêm skills (array)
      skill: member.skill,
      skills: extra.skills || (member.skill ? [member.skill] : []),
      customSkill: extra.customSkill || '',
      isLeader: !!extra.isLeader,
      isCustom: false  // member từ DB
    };
    if (isReserve) data.currentSession.reserve[slotIdx] = info;
    else data.currentSession.teams[teamIdx].slots[slotIdx] = info;
    if (typeof window.saveData === 'function') window.saveData(data); else saveData(data);
    return true;
  },
  /**
   * Gán slot bằng "thành viên tạm" - admin tự gõ thông tin, không lưu vào DB
   * custom = { name, class, combatRole, skills:[], customSkill, isLeader }
   */
  assignCustom(teamIdx, slotIdx, custom={}, isReserve=false) {
    const data = loadData();
    if (!data.currentSession) return false;
    const info = {
      id: 'custom_' + Date.now().toString(36) + Math.random().toString(36).substr(2,4),
      name: custom.name || '',
      inGameName: custom.name || '',
      class: custom.class || '',
      combatRole: custom.combatRole || '',
      skill: (custom.skills && custom.skills[0]) || '',
      skills: custom.skills || [],
      customSkill: custom.customSkill || '',
      isLeader: !!custom.isLeader,
      isCustom: true  // member tạm, không trong DB
    };
    if (isReserve) data.currentSession.reserve[slotIdx] = info;
    else data.currentSession.teams[teamIdx].slots[slotIdx] = info;
    if (typeof window.saveData === 'function') window.saveData(data); else saveData(data);
    return true;
  },
  /** Sửa skill/leader/role của slot có sẵn (không đổi member) */
  updateSlot(teamIdx, slotIdx, isReserve, patch) {
    const data = loadData();
    if (!data.currentSession) return false;
    const slot = isReserve
      ? data.currentSession.reserve[slotIdx]
      : data.currentSession.teams[teamIdx].slots[slotIdx];
    if (!slot) return false;
    Object.assign(slot, patch);
    if (typeof window.saveData === 'function') window.saveData(data); else saveData(data);
    return true;
  },
  removeSlot(teamIdx, slotIdx, isReserve=false) {
    const data = loadData();
    if (!data.currentSession) return false;
    if (isReserve) data.currentSession.reserve[slotIdx] = null;
    else data.currentSession.teams[teamIdx].slots[slotIdx] = null;
    if (typeof window.saveData === 'function') window.saveData(data); else saveData(data);
    return true;
  }
};

const Settings = {
  get()         { return loadData().settings || DEFAULT_DATA.settings; },
  update(u)     { const data=loadData(); data.settings=Object.assign({},data.settings,u); _save(data); return data.settings; },
  addClass(c)   { const data=loadData(); data.settings.classes.push(Object.assign({id:genId()},c)); _save(data); },
  updateClass(id,u){ const data=loadData(); const i=data.settings.classes.findIndex(c=>c.id===id); if(i>=0){data.settings.classes[i]=Object.assign({},data.settings.classes[i],u);_save(data);} },
  deleteClass(id){ const data=loadData(); data.settings.classes=data.settings.classes.filter(c=>c.id!==id); _save(data); },
  addMap(m)     { const data=loadData(); if(!data.settings.maps)data.settings.maps=[]; data.settings.maps.push(m); _save(data); },
  updateMap(id,u){ const data=loadData(); const i=(data.settings.maps||[]).findIndex(m=>m.id===id); if(i>=0){data.settings.maps[i]=Object.assign({},data.settings.maps[i],u);_save(data);} },
  deleteMap(id) { const data=loadData(); data.settings.maps=(data.settings.maps||[]).filter(m=>m.id!==id); _save(data); },
};

const Guild = {
  get()     { return loadData().guild || DEFAULT_DATA.guild; },
  update(u) { const data=loadData(); data.guild=Object.assign({},data.guild,u); _save(data); return data.guild; }
};

function _save(data) {
  if (typeof window.saveData === 'function') window.saveData(data);
  else saveData(data);
}

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));
  return Math.ceil((((d-new Date(Date.UTC(d.getUTCFullYear(),0,1)))/86400000)+1)/7);
}

function buildEmptyTeams(settings) {
  const teams=[], n=settings.numTeams||10, s=settings.slotsPerTeam||6;
  for(let i=0;i<n;i++) teams.push({index:i,label:'T'+(i+1),slots:Array(s).fill(null)});
  return teams;
}
function buildEmptyReserve(settings) {
  return Array(settings.reserveSlots||30).fill(null);
}
function buildDefaultMarkers(numTeams) {
  const cols=Math.ceil(Math.sqrt(numTeams)), rows=Math.ceil(numTeams/cols), markers=[];
  for(let i=0;i<numTeams;i++){
    markers.push({ teamIndex:i,
      x: +(10+(i%cols)*(80/Math.max(cols-1,1))).toFixed(1),
      y: +(15+Math.floor(i/cols)*(70/Math.max(rows-1,1))).toFixed(1)
    });
  }
  return markers;
}

// Image storage
const IMG_PREFIX = 'nth_img_';
function loadImageFromStorage(k){try{return localStorage.getItem(IMG_PREFIX+k)||'';}catch(e){return '';}}
function saveImageToStorage(k,v){try{localStorage.setItem(IMG_PREFIX+k,v);return true;}catch(e){return false;}}
function removeImageFromStorage(k){try{localStorage.removeItem(IMG_PREFIX+k);}catch(e){}}
