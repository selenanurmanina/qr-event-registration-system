/**
 * AISINDO Workshop - Registrasi, Tiket QR, Absensi
 * File: Code.gs  (letakkan di Apps Script yang terikat ke Google Sheet)
 */
const TZ = 'Asia/Jakarta';
const AL = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const HEAD = {
  Participants: ['participant_id','ticket_token','full_name','email','institution','ticket_type','registration_timestamp','ticket_status','recovery_hash'],
  Attendance: ['attendance_id','participant_id','event_day','checkin_timestamp','checkin_status','checked_in_by'],
  EventConfig: ['event_name','event_location','day_1_date','day_1_start_time','day_1_end_time','day_2_date','day_2_start_time','day_2_end_time','timezone','registration_status','id_prefix','restrict_schedule'],
  AuditLog: ['timestamp','actor','action','participant_id','result']
};
const DEF_CFG = ['Workshop AISINDO 2026','Isi lokasi / tautan acara di sini','2026-11-10','09:00','16:00','2026-11-11','09:00','16:00','Asia/Jakarta','open','AIS-WS26','FALSE'];
const TYPES = { D1: [1], D2: [2], BUNDLE: [1, 2] };

/* ---------- SETUP (jalankan sekali dari editor) ---------- */
function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(HEAD).forEach(n => {
    const s = ss.getSheetByName(n) || ss.insertSheet(n);
    if (s.getLastRow() === 0) {
      s.getRange(1, 1, 1, HEAD[n].length).setValues([HEAD[n]]).setFontWeight('bold');
      s.setFrozenRows(1);
    }
    s.getRange(1, 1, s.getMaxRows(), HEAD[n].length).setNumberFormat('@'); // semua teks: cegah auto-format & formula
  });
  const c = sh('EventConfig');
  if (c.getLastRow() < 2) c.getRange(2, 1, 1, DEF_CFG.length).setValues([DEF_CFG]);
  const d = ss.getSheetByName('Sheet1'); if (d && ss.getSheets().length > 1) ss.deleteSheet(d);
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('code_salt')) p.setProperty('code_salt', Utilities.getUuid());
  if (!p.getProperty('pin_salt')) p.setProperty('pin_salt', Utilities.getUuid());
}

/* Akun login. Untuk mengganti PIN, ubah nilai 'pin' di bawah lalu deploy versi baru. Tidak perlu menjalankan fungsi apa pun. */
const USERS = {
  admin:   { pin: 'Admin123',   role: 'admin' },
  panitia: { pin: 'Panitia321', role: 'staff' }
};

/* ---------- UTIL ---------- */
const sh = n => SpreadsheetApp.getActive().getSheetByName(n);
const now = () => Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
const hash = s => Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8));
function rnd(n) {
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid() + Date.now());
  let o = ''; for (let i = 0; i < n; i++) o += AL[(b[i] & 255) % AL.length]; return o;
}
function rows(n) {
  const v = sh(n).getDataRange().getValues(), h = v.shift();
  return v.map((r, i) => { const o = { _row: i + 2 }; h.forEach((k, j) => o[k] = String(r[j])); return o; });
}
const cfg = () => rows('EventConfig')[0];
function log(actor, action, pid, result) { sh('AuditLog').appendRow([now(), actor, action, pid || '', result]); }
function limited(key, max, sec) {
  const c = CacheService.getScriptCache(), n = +(c.get(key) || 0);
  if (n >= max) return true; c.put(key, String(n + 1), sec); return false;
}
function auth(sess, need) {
  const v = CacheService.getScriptCache().get('s_' + sess);
  if (!v) throw new Error('Sesi berakhir. Silakan login ulang.');
  const [role, name] = v.split('|');
  if (need === 'admin' && role !== 'admin') throw new Error('Hanya admin yang boleh melakukan ini.');
  return { role, name };
}
function pubCfg() {
  const c = cfg();
  return { event_name: c.event_name, event_location: c.event_location, d1: [c.day_1_date, c.day_1_start_time, c.day_1_end_time],
           d2: [c.day_2_date, c.day_2_start_time, c.day_2_end_time], open: c.registration_status === 'open' };
}
function ticketOf(id) {
  const r = rows('Participants').find(x => x.participant_id === id);
  return r && { id: r.participant_id, token: r.ticket_token, name: r.full_name, institution: r.institution, type: r.ticket_type, status: r.ticket_status, cfg: pubCfg() };
}

/* ---------- WEB APP ---------- */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('Workshop AISINDO')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function getPublicConfig() { return pubCfg(); }

/* Pintu API untuk halaman scanner terpisah (hosting lain). Hanya login dan check-in yang dibuka. */
function doPost(e) {
  let out;
  try {
    const q = JSON.parse(e.postData.contents);
    if (q.action === 'login') out = login(q.user, q.pin);
    else if (q.action === 'checkin') out = checkin(q.sess, q.value, q.manual === true);
    else out = { error: 'Aksi tidak dikenal.' };
  } catch (err) { out = { error: String(err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- REGISTRASI ---------- */
function register(d) {
  const c = cfg();
  if (c.registration_status !== 'open') return { ok: false, msg: 'Registrasi sedang ditutup.' };
  const name = String(d.name || '').trim().replace(/\s+/g, ' '), email = String(d.email || '').trim().toLowerCase(),
        inst = String(d.institution || '').trim(), type = d.type;
  if (!name || !email || !inst || !TYPES[type] || d.consent !== true) return { ok: false, msg: 'Lengkapi semua kolom dan setujui penggunaan data.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || name.length > 100 || inst.length > 150 || email.length > 120)
    return { ok: false, msg: 'Format email atau isi kolom tidak valid.' };
  const lock = LockService.getScriptLock();
  try { lock.waitLock(25000); } catch (e) { return { ok: false, msg: 'Server sedang sibuk. Coba lagi sebentar.' }; }
  try {
    if (rows('Participants').some(r => r.email === email && r.ticket_status !== 'canceled'))
      return { ok: false, msg: 'Email ini sudah terdaftar. Buka "Cari Kembali Tiket" dengan kode pemulihan Anda, atau hubungi panitia.' };
    const p = PropertiesService.getScriptProperties(), n = +(p.getProperty('seq') || 0) + 1;
    p.setProperty('seq', String(n));
    const id = c.id_prefix + '-' + ('0000' + n).slice(-4), token = rnd(32);
    sh('Participants').appendRow([id, token, name, email, inst, type, now(), 'active', '']);
    SpreadsheetApp.flush();
    log('public', 'REGISTER', id, 'OK');
    return { ok: true, ticket: ticketOf(id) };
  } catch (e) {
    return { ok: false, msg: 'Data gagal disimpan, tiket belum diterbitkan. Silakan coba lagi.' };
  } finally { lock.releaseLock(); }
}

/* ---------- PEMULIHAN TIKET (email + kode pemulihan) ---------- */
function recover(email, name) {
  const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  email = norm(email); name = norm(name);
  if (!email || !name) return { ok: false, msg: 'Isi email dan nama lengkap.' };
  if (limited('rc_' + hash(email).slice(0, 16), 5, 900) || limited('rc_all', 100, 900))
    return { ok: false, msg: 'Terlalu banyak percobaan. Coba lagi 15 menit lagi atau hubungi panitia.' };
  const r = rows('Participants').find(x => x.email === email && norm(x.full_name) === name);
  if (!r) { log('public', 'RECOVER', '', 'FAIL'); return { ok: false, msg: 'Data tidak cocok. Periksa email dan nama lengkap sesuai saat mendaftar, atau hubungi panitia.' }; }
  log('public', 'RECOVER', r.participant_id, 'OK');
  return { ok: true, ticket: ticketOf(r.participant_id) };
}

/* ---------- LOGIN PANITIA / ADMIN ---------- */
function login(user, pin) {
  if (limited('lg', 20, 600)) return { ok: false, msg: 'Terlalu banyak percobaan. Tunggu 10 menit.' };
  const u = String(user || '').trim().toLowerCase(), acc = USERS.hasOwnProperty(u) ? USERS[u] : null;
  if (!acc || acc.pin !== String(pin || '').trim()) { log('unknown', 'LOGIN', '', 'FAIL'); return { ok: false, msg: 'Nama pengguna atau PIN salah.' }; }
  const t = rnd(32);
  CacheService.getScriptCache().put('s_' + t, acc.role + '|' + u, 21600);
  log(u, 'LOGIN', '', 'OK');
  return { ok: true, token: t, role: acc.role, name: u };
}

/* ---------- CHECK-IN (atomik) ---------- */
function checkin(sess, val, manual) {
  const who = auth(sess), by = who.name + ' (' + who.role + ')';
  val = String(val || '').trim();
  if (!val) return { status: 'INVALID', msg: 'Kode kosong.' };
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    const c = cfg(), P = rows('Participants');
    const p = manual ? P.find(x => x.participant_id.toUpperCase() === val.toUpperCase()) : P.find(x => x.ticket_token === val);
    if (!p || p.ticket_status !== 'active') { log(by, 'CHECKIN', p ? p.participant_id : '', 'INVALID'); return { status: 'INVALID', msg: p ? 'Tiket dinonaktifkan.' : 'Tiket tidak ditemukan.' }; }
    const d = new Date(), today = Utilities.formatDate(d, TZ, 'yyyy-MM-dd'), tm = Utilities.formatDate(d, TZ, 'HH:mm');
    const day = today === c.day_1_date ? 1 : today === c.day_2_date ? 2 : 0;
    const info = { name: p.full_name, id: p.participant_id, institution: p.institution, type: p.ticket_type, day: day };
    const out = (status, msg, extra) => { log(by, 'CHECKIN', p.participant_id, status); return Object.assign({ status: status, msg: msg }, info, extra || {}); };
    if (!day) return out('EVENT_CLOSED', 'Hari ini bukan hari pelaksanaan acara.');
    const st = c['day_' + day + '_start_time'], en = c['day_' + day + '_end_time'];
    if (c.restrict_schedule.toUpperCase() === 'TRUE' && (tm < st || tm > en)) return out('EVENT_CLOSED', 'Check-in dibuka ' + st + '-' + en + ' WIB.');
    if (!TYPES[p.ticket_type].includes(day)) return out('NOT_ELIGIBLE', 'Tiket ini tidak berlaku untuk Hari ke-' + day + '.');
    const prev = rows('Attendance').find(a => a.participant_id === p.participant_id && a.event_day === String(day) && a.checkin_status === 'VALID');
    if (prev) return out('ALREADY_CHECKED_IN', 'Sudah check-in Hari ke-' + day + '.', { time: prev.checkin_timestamp });
    const ts = now();
    sh('Attendance').appendRow(['ATT-' + Utilities.getUuid().slice(0, 8).toUpperCase(), p.participant_id, String(day), ts, 'VALID', by]);
    SpreadsheetApp.flush();
    return out('VALID', 'Check-in berhasil.', { time: ts });
  } finally { lock.releaseLock(); }
}

/* ---------- ADMIN ---------- */
function adminData(sess) {
  auth(sess, 'admin');
  const P = rows('Participants'), A = rows('Attendance').filter(a => a.checkin_status === 'VALID');
  const act = P.filter(p => p.ticket_status === 'active'), ids = new Set(act.map(p => p.participant_id));
  const A2 = A.filter(a => ids.has(a.participant_id)), hadir = new Set(A2.map(a => a.participant_id)).size;
  const cnt = t => act.filter(p => p.ticket_type === t).length, ci = d => A2.filter(a => a.event_day === d).length;
  const at = (id, d) => (A.find(a => a.participant_id === id && a.event_day === d) || {}).checkin_timestamp || '';
  return {
    config: cfg(),
    stats: { total: act.length, d1: cnt('D1'), d2: cnt('D2'), bundle: cnt('BUNDLE'), ci1: ci('1'), ci2: ci('2'),
             belum: act.length - hadir, pct: act.length ? Math.round(hadir * 1000 / act.length) / 10 : 0 },
    participants: P.map(p => ({ id: p.participant_id, name: p.full_name, email: p.email, institution: p.institution, type: p.ticket_type,
                                status: p.ticket_status, reg: p.registration_timestamp, a1: at(p.participant_id, '1'), a2: at(p.participant_id, '2') })),
    audit: rows('AuditLog').slice(-40).reverse().map(r => [r.timestamp, r.actor, r.action, r.participant_id, r.result])
  };
}
function adminSetStatus(sess, id, status) {
  const a = auth(sess, 'admin');
  if (!['active', 'canceled'].includes(status)) throw new Error('Status tidak valid.');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const r = rows('Participants').find(x => x.participant_id === id);
    if (!r) throw new Error('Peserta tidak ditemukan.');
    sh('Participants').getRange(r._row, 8).setValue(status);
    log(a.name, 'SET_STATUS_' + status.toUpperCase(), id, 'OK');
    return { ok: true };
  } finally { lock.releaseLock(); }
}
function adminSaveConfig(sess, o) {
  const a = auth(sess, 'admin');
  const keys = HEAD.EventConfig, v = keys.map(k => String(o[k] == null ? '' : o[k]).trim());
  const g = k => v[keys.indexOf(k)];
  ['day_1_date', 'day_2_date'].forEach(k => { if (!/^\d{4}-\d{2}-\d{2}$/.test(g(k))) throw new Error(k + ' harus yyyy-mm-dd.'); });
  ['day_1_start_time', 'day_1_end_time', 'day_2_start_time', 'day_2_end_time'].forEach(k => { if (!/^\d{2}:\d{2}$/.test(g(k))) throw new Error(k + ' harus HH:mm.'); });
  if (!['open', 'closed'].includes(g('registration_status'))) throw new Error('registration_status: open atau closed.');
  if (!['TRUE', 'FALSE'].includes(g('restrict_schedule').toUpperCase())) throw new Error('restrict_schedule: TRUE atau FALSE.');
  if (!/^[A-Za-z0-9-]{2,20}$/.test(g('id_prefix'))) throw new Error('id_prefix: 2-20 huruf/angka/strip.');
  sh('EventConfig').getRange(2, 1, 1, keys.length).setValues([v]);
  log(a.name, 'SAVE_CONFIG', '', 'OK');
  return { ok: true };
}
