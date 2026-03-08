import { useState, useMemo, useEffect, useCallback } from "react";

// ── SUPABASE ──────────────────────────────────────────────────────────────────
const SUPA_URL = "https://fmxechpugysdrlwndwep.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteGVjaHB1Z3lzZHJsd25kd2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NzQ3OTQsImV4cCI6MjA4ODU1MDc5NH0.OLlam5aZt3GI2MjZFvErsW0jED8_rTXt7daL-Nr2TW8";
const hdrs = { "Content-Type": "application/json", "apikey": SUPA_KEY, "Authorization": `Bearer ${SUPA_KEY}`, "Prefer": "return=representation" };

const db = {
  async get(table, params = "") {
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}${params}`, { headers: hdrs });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async post(table, body) {
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async patch(table, match, body) {
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${match}`, { method: "PATCH", headers: hdrs, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async delete(table, match) {
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${match}`, { method: "DELETE", headers: hdrs });
    if (!r.ok) throw new Error(await r.text());
  },
};

const mapBranch = b => ({ id: b.id, city: b.city, address: b.address, description: b.description || "", distanceKm: parseFloat(b.distance_km) || 0, servers: b.servers || 0, switches: b.switches || 0, hasMikrotik: b.has_mikrotik || false });
const mapJob    = j => ({ id: j.id, branchId: j.branch_id, userId: j.user_id, departureTime: j.departure_time, arrivalTime: j.arrival_time, hoursWorked: parseFloat(j.hours_worked) || 0, returnTime: j.return_time, kmTravelled: parseFloat(j.km_travelled) || 0, description: j.description || "" });
const mapUser   = u => ({ id: u.id, username: u.username, password: u.password, name: u.name, role: u.role });

// ── RATES ─────────────────────────────────────────────────────────────────────
const RATES = { kmExpenseRate: 0.08, hourlyRate: 25.00, travelFlat: 30.00 };

// ── HELPERS ───────────────────────────────────────────────────────────────────
const fmt     = d => d ? new Date(d).toLocaleString("hr-HR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";
const fmtDate = d => d ? new Date(d).toLocaleDateString("hr-HR") : "—";
const fmtCur  = n => `€ ${Number(n).toFixed(2)}`;
const uid     = () => Math.random().toString(36).slice(2, 10);

function toLocalDT(date) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d)) return "";
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function calcEarnings(job, rates) {
  const km  = job.kmTravelled || 0;
  const hrs = job.hoursWorked || 0;
  const gross    = rates.travelFlat + hrs * rates.hourlyRate;
  const expenses = km * rates.kmExpenseRate;
  return { travel: rates.travelFlat, labor: hrs * rates.hourlyRate, expenses, gross, net: gross - expenses };
}

// ── ICONS ─────────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 16 }) => {
  const icons = {
    logout:   "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
    plus:     "M12 4v16m8-8H4",
    list:     "M4 6h16M4 10h16M4 14h16M4 18h16",
    branch:   "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    job:      "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
    earnings: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    users:    "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    eye:      "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
    edit:     "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
    trash:    "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
    search:   "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
    check:    "M5 13l4 4L19 7",
    x:        "M6 18L18 6M6 6l12 12",
    settings: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
    refresh:  "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  };
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      {icons[name]?.split("M").filter(Boolean).map((d, i) => <path key={i} d={"M" + d} />)}
    </svg>
  );
};

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  :root{--bg:#f4f6f9;--bg2:#ffffff;--bg3:#edf0f5;--bg4:#dde2ec;--border:#d0d7e3;--border2:#b0bcd0;--accent:#0050AA;--accent2:#003d82;--green:#1a7f37;--red:#e60a14;--yellow:#f6c01a;--blue:#0050AA;--text:#0a1628;--text2:#3d5278;--text3:#7a8fad;--radius:6px;}
  html,body{max-width:100%;overflow-x:hidden;}
  body{font-family:'IBM Plex Sans',sans-serif;background:var(--bg);color:var(--text);}
  img,video,iframe,table{max-width:100%;}
  .mono{font-family:'IBM Plex Mono',monospace;}

  .login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0050AA 0%,#003d82 60%,#e60a14 100%);}
  .login-box{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:40px 40px;width:360px;box-shadow:0 8px 40px rgba(0,0,0,0.25);border-top:5px solid #f6c01a;}
  .login-logo{display:flex;align-items:center;gap:14px;margin-bottom:28px;}
  .login-logo-icon{width:52px;height:52px;background:#f6c01a;border-radius:50%;border:3px solid #e60a14;display:flex;align-items:center;justify-content:center;color:#0050AA;font-weight:700;font-size:16px;font-family:'IBM Plex Mono',monospace;box-shadow:0 2px 8px rgba(0,0,0,0.2);}
  .login-logo-text{font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;}
  .login-logo-sub{font-size:11px;color:rgba(255,255,255,0.7);font-family:'IBM Plex Mono',monospace;margin-top:1px;}
  .login-title{font-size:22px;font-weight:700;margin-bottom:6px;color:#0a1628;}
  .login-sub{font-size:13px;color:#3d5278;margin-bottom:28px;}
  .login-err{background:#fff0f0;border:1px solid var(--red);color:var(--red);border-radius:var(--radius);padding:10px 14px;font-size:13px;margin-bottom:16px;}

  .field{margin-bottom:16px;}
  .field label{display:block;font-size:12px;font-weight:600;color:#0050AA;margin-bottom:6px;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:0.5px;}
  .field input,.field select,.field textarea{width:100%;background:#ffffff;border:1px solid var(--border2);border-radius:var(--radius);padding:9px 12px;color:var(--text);font-size:14px;font-family:'IBM Plex Sans',sans-serif;transition:border-color 0.15s;outline:none;}
  .field input:focus,.field select:focus,.field textarea:focus{border-color:#0050AA;box-shadow:0 0 0 3px rgba(0,80,170,0.12);}
  .field select option{background:var(--bg3);}
  .field textarea{resize:vertical;min-height:80px;}
  .field-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  .field-row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;}

  .btn{display:inline-flex;align-items:center;gap:7px;padding:8px 16px;border-radius:var(--radius);border:none;cursor:pointer;font-size:13px;font-weight:500;font-family:'IBM Plex Sans',sans-serif;transition:all 0.15s;}
  .btn:disabled{opacity:0.5;cursor:not-allowed;}
  .btn-primary{background:#0050AA;color:#ffffff;}
  .btn-primary:hover:not(:disabled){background:#003d82;}
  .btn-ghost{background:transparent;color:var(--text2);border:1px solid var(--border);}
  .btn-ghost:hover{background:var(--bg3);color:var(--text);}
  .btn-danger{background:transparent;color:var(--red);border:1px solid rgba(248,81,73,0.2);}
  .btn-danger:hover{background:rgba(248,81,73,0.1);}
  .btn-sm{padding:5px 10px;font-size:12px;}
  .btn-full{width:100%;justify-content:center;padding:11px;}

  .app{display:flex;min-height:100vh;overflow-x:hidden;width:100%;}
  .sidebar{width:220px;min-height:100vh;background:#0050AA;border-right:none;display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;}
  .sidebar-logo{padding:20px 16px;border-bottom:1px solid rgba(255,255,255,0.15);display:flex;align-items:center;gap:10px;}
  .sidebar-logo-icon{width:36px;height:36px;background:#f6c01a;border-radius:50%;border:2px solid #e60a14;display:flex;align-items:center;justify-content:center;color:#0050AA;font-weight:700;font-size:13px;font-family:'IBM Plex Mono',monospace;}
  .sidebar-logo-name{font-weight:600;font-size:15px;color:#ffffff;}
  .sidebar-logo-sub{font-size:10px;color:rgba(255,255,255,0.6);font-family:'IBM Plex Mono',monospace;}
  .sidebar-nav{flex:1;padding:12px 8px;color:#fff;}
  .nav-item{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:var(--radius);cursor:pointer;font-size:13px;color:rgba(255,255,255,0.75);transition:all 0.15s;margin-bottom:2px;}
  .nav-item:hover{background:rgba(255,255,255,0.12);color:#ffffff;}
  .nav-item.active{background:#f6c01a;color:#0050AA;font-weight:600;}
  .sidebar-footer{padding:12px 8px;border-top:1px solid rgba(255,255,255,0.15);}
  .user-badge{display:flex;align-items:center;gap:9px;padding:8px 10px;}
  .user-avatar{width:28px;height:28px;background:#f6c01a;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#0050AA;font-family:'IBM Plex Mono',monospace;flex-shrink:0;}
  .user-name{font-size:13px;font-weight:500;color:#ffffff;}
  .user-role{font-size:11px;color:rgba(255,255,255,0.6);font-family:'IBM Plex Mono',monospace;}
  .main{margin-left:220px;flex:1;min-height:100vh;min-width:0;overflow-x:hidden;background:var(--bg);}
  .page-header{padding:24px 28px 0;display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;}
  .page-title{font-size:20px;font-weight:700;color:#0050AA;}
  .page-sub{font-size:13px;color:var(--text3);margin-top:2px;font-family:'IBM Plex Mono',monospace;}
  .page-body{padding:0 28px 28px;min-width:0;overflow-x:hidden;}

  .card{background:var(--bg2);border:1px solid var(--border);border-radius:8px;min-width:0;width:100%;box-shadow:0 1px 4px rgba(0,80,170,0.07);}
  .card-header{padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:var(--bg3);border-radius:8px 8px 0 0;}
  .card-title{font-size:14px;font-weight:600;}
  .card-body{padding:20px;}

  .table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;width:100%;}
  table{width:100%;border-collapse:collapse;font-size:13px;}
  th{padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#0050AA;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #0050AA;white-space:nowrap;}
  td{padding:11px 14px;border-bottom:1px solid rgba(48,54,61,0.5);color:var(--text2);}
  tr:last-child td{border-bottom:none;}
  tr:hover td{background:rgba(33,38,45,0.5);color:var(--text);}
  .td-mono{font-family:'IBM Plex Mono',monospace;font-size:12px;}

  .badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:100px;font-size:11px;font-weight:500;font-family:'IBM Plex Mono',monospace;}
  .badge-green{background:rgba(63,185,80,0.1);color:var(--green);border:1px solid rgba(63,185,80,0.2);}
  .badge-red{background:rgba(248,81,73,0.1);color:var(--red);border:1px solid rgba(248,81,73,0.2);}
  .badge-blue{background:rgba(88,166,255,0.1);color:var(--blue);border:1px solid rgba(88,166,255,0.2);}
  .badge-amber{background:rgba(246,192,26,0.15);color:#b08800;border:1px solid rgba(246,192,26,0.4);}

  .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px;min-width:0;}
  .stat-card{background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:18px 20px;min-width:0;overflow:hidden;box-shadow:0 1px 4px rgba(0,80,170,0.07);}
  .stat-label{font-size:11px;font-weight:500;color:var(--text3);font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;}
  .stat-value{font-size:26px;font-weight:600;font-family:'IBM Plex Mono',monospace;color:var(--text);line-height:1;word-break:break-all;}
  .stat-sub{font-size:12px;color:var(--text3);margin-top:5px;}
  .stat-card.accent{border-color:rgba(0,80,170,0.3);border-top:3px solid #0050AA;}
  .stat-card.accent .stat-value{color:#0050AA;}

  .filters{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;align-items:center;width:100%;min-width:0;}
  .filter-input{background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);padding:7px 11px 7px 32px;color:var(--text);font-size:13px;font-family:'IBM Plex Sans',sans-serif;outline:none;width:220px;}
  .filter-input:focus{border-color:var(--accent);}
  .filter-select{background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);padding:7px 11px;color:var(--text);font-size:13px;font-family:'IBM Plex Sans',sans-serif;outline:none;cursor:pointer;max-width:100%;}
  .filter-select:focus{border-color:var(--accent);}
  .search-wrap{position:relative;}
  .search-icon{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--text3);pointer-events:none;}

  .detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
  .detail-item{background:var(--bg3);border-radius:var(--radius);padding:14px 16px;}
  .detail-label{font-size:11px;color:var(--text3);font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;}
  .detail-value{font-size:14px;color:var(--text);font-weight:500;}
  .detail-full{grid-column:1/-1;}

  .modal-bg{position:fixed;inset:0;background:rgba(0,40,100,0.55);z-index:100;display:flex;align-items:center;justify-content:center;}
  .modal{background:var(--bg2);border:1px solid var(--border);border-radius:10px;width:560px;max-width:95vw;max-height:90vh;display:flex;flex-direction:column;}
  .modal-lg{width:720px;}
  .modal-header{padding:18px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:#0050AA;border-radius:10px 10px 0 0;}
  .modal-title{font-size:15px;font-weight:700;color:#ffffff;}
  .modal-body{padding:20px;overflow-y:auto;flex:1;}
  .modal-footer{padding:14px 20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px;}

  .earnings-breakdown{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-top:16px;min-width:0;}
  .earn-item{background:var(--bg3);border-radius:var(--radius);padding:14px;text-align:center;}
  .earn-label{font-size:11px;color:var(--text3);font-family:'IBM Plex Mono',monospace;margin-bottom:6px;}
  .earn-val{font-size:18px;font-weight:600;font-family:'IBM Plex Mono',monospace;color:#0050AA;word-break:break-all;}

  .flex{display:flex;align-items:center;gap:8px;}
  .gap-4{gap:4px;}
  .mt-20{margin-top:20px;}
  .text-red{color:var(--red);}
  .text-amber{color:#0050AA;font-weight:600;}
  .empty-state{text-align:center;padding:48px 20px;color:var(--text3);}
  .empty-icon{margin-bottom:12px;opacity:0.4;}
  .section-title{font-size:13px;font-weight:600;color:#0050AA;text-transform:uppercase;letter-spacing:0.5px;font-family:'IBM Plex Mono',monospace;margin-bottom:14px;margin-top:24px;}
  .section-title:first-child{margin-top:0;}

  .toggle-wrap{display:flex;align-items:center;gap:10px;}
  .toggle{position:relative;width:36px;height:20px;}
  .toggle input{opacity:0;width:0;height:0;}
  .toggle-slider{position:absolute;inset:0;background:var(--bg4);border-radius:20px;cursor:pointer;transition:0.2s;}
  .toggle-slider:before{content:'';position:absolute;height:14px;width:14px;left:3px;bottom:3px;background:white;border-radius:50%;transition:0.2s;}
  input:checked+.toggle-slider{background:var(--accent);}
  input:checked+.toggle-slider:before{transform:translateX(16px);}

  .spinner{width:32px;height:32px;border:3px solid rgba(255,255,255,0.3);border-top-color:#f6c01a;border-radius:50%;animation:spin 0.7s linear infinite;margin:0 auto;}
  @keyframes spin{to{transform:rotate(360deg);}}
  .loading-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:60px;color:rgba(255,255,255,0.8);font-family:'IBM Plex Mono',monospace;font-size:13px;}

  .toast{position:fixed;bottom:24px;right:24px;background:#ffffff;border:1px solid var(--border2);border-radius:8px;padding:12px 18px;font-size:13px;color:var(--text);z-index:999;display:flex;align-items:center;gap:10px;box-shadow:0 8px 24px rgba(0,80,170,0.15);animation:fadeup 0.2s ease;}
  .toast.err{border-color:var(--red);color:var(--red);}
  .toast.ok{border-color:var(--green);}
  @keyframes fadeup{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}

  /* ── TABLET ── */
  @media(max-width:1024px){
    .stats-grid{grid-template-columns:1fr 1fr;}
    .earnings-breakdown{grid-template-columns:1fr 1fr;width:100%;}
    .field-row3{grid-template-columns:1fr 1fr;}
    .sidebar{width:64px;}
    .sidebar-logo-name,.sidebar-logo-sub,.nav-item span,.user-name,.user-role{display:none;}
    .main{margin-left:64px;}
    .sidebar-logo{justify-content:center;padding:16px 8px;}
    .nav-item{justify-content:center;padding:10px;}
    .user-badge{justify-content:center;}
  }

  /* ── MOBILE ── */
  @media(max-width:640px){
    .sidebar{display:none !important;}
    .main{margin-left:0;padding-bottom:calc(72px + env(safe-area-inset-bottom));}
    /* bottom nav shown via JS isMobile */
    .page-header{padding:16px 12px 0;margin-bottom:16px;flex-wrap:wrap;gap:10px;width:100%;}
    .page-body{padding:0 12px 12px;}
    .page-title{font-size:17px;}
    .stats-grid{grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;}
    .stat-card{padding:14px;}
    .stat-value{font-size:20px;}
    .stat-sub{font-size:11px;}
    .earnings-breakdown{grid-template-columns:1fr 1fr;width:100%;}
    .field-row{grid-template-columns:1fr;}
    .detail-grid{grid-template-columns:1fr;}
    .field-row3{grid-template-columns:1fr;}
    .modal-bg{align-items:flex-start;z-index:99999;}
    .modal,.modal-lg{width:100%;max-width:100%;border-radius:0;height:100vh;max-height:100vh;overflow-x:hidden;overflow-y:auto;}
    .modal-footer{position:sticky;bottom:0;background:var(--bg2);z-index:2;padding:14px 20px;}
    table{font-size:12px;}
    td,th{padding:8px 10px;}
    .filters{gap:7px;}
    .filter-input{width:100%;max-width:100%;}
    .filter-select{font-size:12px;padding:6px 8px;}
    .login-wrap{align-items:flex-start;padding-top:40px;}
    .login-box{width:calc(100% - 32px);margin:0 16px;padding:32px 24px;}
    .toast{left:16px;right:16px;bottom:80px;}
    .hide-mobile{display:none;}
    .page-header .btn span{display:none;}
  }

  /* bottom nav — always in DOM, hidden on desktop via pointer-events+opacity */
  .bottom-nav{
    position:fixed;bottom:0;left:0;right:0;
    background:var(--bg2);border-top:1px solid var(--border);
    z-index:9999;justify-content:space-around;align-items:stretch;
    height:calc(62px + env(safe-area-inset-bottom));
    padding-bottom:env(safe-area-inset-bottom);
    display:flex;
  }
  .bottom-nav-hidden{display:none !important;}
  .bottom-nav-item{
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:4px;flex:1;cursor:pointer;color:rgba(255,255,255,0.65);
    font-size:10px;font-family:'IBM Plex Mono',monospace;letter-spacing:0.3px;
    border:none;background:transparent;padding:8px 2px;transition:color 0.15s;
    -webkit-tap-highlight-color:transparent;min-width:0;
  }
  .bottom-nav-item.active{color:#f6c01a;}
  .bottom-nav-item span{white-space:nowrap;font-size:9px;}
`;

// ── TOAST ─────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, []);
  return <div className={`toast ${type}`}>{msg}</div>;
}

// ── BRANCH FORM ───────────────────────────────────────────────────────────────
function BranchForm({ branch, onSave, onClose }) {
  const [form, setForm] = useState(branch || { id:"", city:"", address:"", description:"", distanceKm:"", servers:0, switches:0, hasMikrotik:false });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = /^\d{4}$/.test(form.id) && form.city && form.address;
  const handle = async () => {
    if (!valid) return;
    setSaving(true);
    await onSave({ ...form, distanceKm: parseFloat(form.distanceKm)||0, servers: Number(form.servers), switches: Number(form.switches) });
    setSaving(false);
  };
  return (
    <div className="modal-bg"><div className="modal">
      <div className="modal-header"><span className="modal-title">{branch ? "Edit Branch" : "Add Branch"}</span><button className="btn btn-ghost btn-sm" onClick={onClose}><Icon name="x"/></button></div>
      <div className="modal-body">
        <div className="field-row">
          <div className="field"><label>Branch ID (4 digits)</label><input value={form.id} onChange={e=>set("id",e.target.value)} maxLength={4} disabled={!!branch}/></div>
          <div className="field"><label>City</label><input value={form.city} onChange={e=>set("city",e.target.value)}/></div>
        </div>
        <div className="field"><label>Address</label><input value={form.address} onChange={e=>set("address",e.target.value)}/></div>
        <div className="field"><label>Description</label><input value={form.description} onChange={e=>set("description",e.target.value)}/></div>
        <div className="field-row3">
          <div className="field"><label>Distance (km)</label><input type="number" step="0.1" value={form.distanceKm} onChange={e=>set("distanceKm",e.target.value)}/></div>
          <div className="field"><label>Servers</label><input type="number" min="0" value={form.servers} onChange={e=>set("servers",e.target.value)}/></div>
          <div className="field"><label>Switches</label><input type="number" min="0" value={form.switches} onChange={e=>set("switches",e.target.value)}/></div>
        </div>
        <div className="toggle-wrap">
          <label className="toggle"><input type="checkbox" checked={form.hasMikrotik} onChange={e=>set("hasMikrotik",e.target.checked)}/><span className="toggle-slider"></span></label>
          <span style={{fontSize:13}}>Has MikroTik Switch</span>
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handle} disabled={!valid||saving}><Icon name="check"/> {saving?"Saving…":"Save"}</button>
      </div>
    </div></div>
  );
}

// ── JOB FORM ──────────────────────────────────────────────────────────────────
function JobForm({ job, branches, users, currentUser, onSave, onClose }) {
  const now = new Date();
  const [form, setForm] = useState(job ? {
    ...job,
    departureTime: toLocalDT(job.departureTime),
    arrivalTime:   toLocalDT(job.arrivalTime),
    returnTime:    toLocalDT(job.returnTime),
  } : {
    branchId:"", userId: currentUser.id,
    departureTime: toLocalDT(now),
    arrivalTime:   toLocalDT(new Date(now.getTime() + 2*3600000)),
    hoursWorked:   "",
    returnTime:    toLocalDT(new Date(now.getTime() + 4*3600000)),
    description:   "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const branch = branches.find(b => b.id === form.branchId);
  const kmTravelled = branch ? branch.distanceKm * 2 : 0;
  const earnings = branch ? calcEarnings({ ...form, kmTravelled }, RATES) : null;
  const valid = form.branchId && form.departureTime && form.arrivalTime && form.hoursWorked && form.returnTime;
  const handle = async () => {
    if (!valid) return;
    setSaving(true);
    await onSave({ ...form, hoursWorked: parseFloat(form.hoursWorked)||0, kmTravelled });
    setSaving(false);
  };
  return (
    <div className="modal-bg"><div className="modal modal-lg">
      <div className="modal-header"><span className="modal-title">{job?"Edit Service Job":"Record Service Job"}</span><button className="btn btn-ghost btn-sm" onClick={onClose}><Icon name="x"/></button></div>
      <div className="modal-body">
        <p className="section-title">Assignment</p>
        <div className="field-row">
          <div className="field"><label>Branch</label>
            <select value={form.branchId} onChange={e=>set("branchId",e.target.value)}>
              <option value="">— Select branch —</option>
              {branches.map(b=><option key={b.id} value={b.id}>[{b.id}] {b.city} — {b.address}</option>)}
            </select>
          </div>
          <div className="field"><label>Technician</label>
            <select value={form.userId} onChange={e=>set("userId",Number(e.target.value))}>
              {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>
        {branch && <div style={{background:"var(--bg3)",borderRadius:6,padding:"10px 14px",marginBottom:16,fontSize:13,display:"flex",gap:20}}>
          <span style={{color:"var(--text2)"}}>📍 {branch.address}, {branch.city}</span>
          <span style={{color:"var(--accent)",fontFamily:"IBM Plex Mono,monospace"}}>⟷ {(branch.distanceKm*2).toFixed(1)} km total</span>
        </div>}
        <p className="section-title">Timeline</p>
        <div className="field-row3">
          <div className="field"><label>Departure from office</label><input type="datetime-local" value={form.departureTime} onChange={e=>set("departureTime",e.target.value)}/></div>
          <div className="field"><label>Arrival at branch</label><input type="datetime-local" value={form.arrivalTime} onChange={e=>set("arrivalTime",e.target.value)}/></div>
          <div className="field"><label>Return to office</label><input type="datetime-local" value={form.returnTime} onChange={e=>set("returnTime",e.target.value)}/></div>
        </div>
        <div className="field" style={{maxWidth:180}}><label>Hours of work on-site</label><input type="number" step="0.5" min="0" value={form.hoursWorked} onChange={e=>set("hoursWorked",e.target.value)} placeholder="0.0"/></div>
        <p className="section-title">Service Description</p>
        <div className="field"><label>Actions performed</label><textarea value={form.description} onChange={e=>set("description",e.target.value)} rows={4}/></div>
        {earnings && <>
          <p className="section-title">Estimated Earnings</p>
          <div className="earnings-breakdown">
            <div className="earn-item"><div className="earn-label">Travel (flat)</div><div className="earn-val">{fmtCur(earnings.travel)}</div></div>
            <div className="earn-item"><div className="earn-label">Labor ({form.hoursWorked||0} h)</div><div className="earn-val">{fmtCur(earnings.labor)}</div></div>
            <div className="earn-item"><div className="earn-label">Expenses ({kmTravelled.toFixed(1)} km)</div><div className="earn-val" style={{color:"var(--red)"}}>{fmtCur(earnings.expenses)}</div></div>
            <div className="earn-item" style={{border:"1px solid rgba(240,165,0,0.3)"}}><div className="earn-label">Net</div><div className="earn-val">{fmtCur(earnings.net)}</div></div>
          </div>
        </>}
      </div>
      <div className="modal-footer">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handle} disabled={!valid||saving}><Icon name="check"/> {saving?"Saving…":"Save Job"}</button>
      </div>
    </div></div>
  );
}

// ── USER FORM ─────────────────────────────────────────────────────────────────
function UserForm({ user, onSave, onClose }) {
  const [form, setForm] = useState(user || { username:"", password:"", name:"", role:"technician" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.username && form.password && form.name;
  const handle = async () => { setSaving(true); await onSave(form); setSaving(false); };
  return (
    <div className="modal-bg"><div className="modal">
      <div className="modal-header"><span className="modal-title">{user?"Edit User":"Add User"}</span><button className="btn btn-ghost btn-sm" onClick={onClose}><Icon name="x"/></button></div>
      <div className="modal-body">
        <div className="field"><label>Full Name</label><input value={form.name} onChange={e=>set("name",e.target.value)}/></div>
        <div className="field-row">
          <div className="field"><label>Username</label><input value={form.username} onChange={e=>set("username",e.target.value)}/></div>
          <div className="field"><label>Password</label><input type="password" value={form.password} onChange={e=>set("password",e.target.value)}/></div>
        </div>
        <div className="field"><label>Role</label>
          <select value={form.role} onChange={e=>set("role",e.target.value)}>
            <option value="admin">Admin</option>
            <option value="technician">Technician</option>
          </select>
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handle} disabled={!valid||saving}><Icon name="check"/> {saving?"Saving…":"Save"}</button>
      </div>
    </div></div>
  );
}

// ── JOB DETAIL ────────────────────────────────────────────────────────────────
function JobDetail({ job, branch, user, onClose, onEdit }) {
  const earn = calcEarnings(job, RATES);
  return (
    <div className="modal-bg"><div className="modal modal-lg">
      <div className="modal-header">
        <div>
          <div className="modal-title">Service Job — {branch?.city??"Unknown"} [{job.branchId}]</div>
          <div style={{fontSize:12,color:"var(--text3)",fontFamily:"IBM Plex Mono,monospace",marginTop:2}}>{fmtDate(job.departureTime)} · {user?.name}</div>
        </div>
        <div className="flex">
          <button className="btn btn-ghost btn-sm" onClick={onEdit}><Icon name="edit" size={14}/> Edit</button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><Icon name="x"/></button>
        </div>
      </div>
      <div className="modal-body">
        <p className="section-title">Branch Info</p>
        <div className="detail-grid">
          <div className="detail-item"><div className="detail-label">Branch ID</div><div className="detail-value mono">{job.branchId}</div></div>
          <div className="detail-item"><div className="detail-label">Location</div><div className="detail-value">{branch?.address}, {branch?.city}</div></div>
          <div className="detail-item"><div className="detail-label">Servers / Switches</div><div className="detail-value">{branch?.servers??"—"} / {branch?.switches??"—"}</div></div>
          <div className="detail-item"><div className="detail-label">MikroTik</div><div className="detail-value">{branch?.hasMikrotik?<span className="badge badge-green">Yes</span>:<span className="badge badge-red">No</span>}</div></div>
        </div>
        <p className="section-title">Timeline</p>
        <div className="detail-grid">
          <div className="detail-item"><div className="detail-label">Departure</div><div className="detail-value">{fmt(job.departureTime)}</div></div>
          <div className="detail-item"><div className="detail-label">Arrival at branch</div><div className="detail-value">{fmt(job.arrivalTime)}</div></div>
          <div className="detail-item"><div className="detail-label">Return to office</div><div className="detail-value">{fmt(job.returnTime)}</div></div>
          <div className="detail-item"><div className="detail-label">Hours worked</div><div className="detail-value mono">{job.hoursWorked} h</div></div>
        </div>
        <p className="section-title">Service Description</p>
        <div className="detail-item detail-full" style={{background:"var(--bg3)",borderRadius:6,padding:"14px 16px"}}>
          <div style={{fontSize:13,lineHeight:1.6,color:"var(--text2)",whiteSpace:"pre-wrap"}}>{job.description||<em style={{color:"var(--text3)"}}>No description</em>}</div>
        </div>
        <p className="section-title">Earnings Breakdown</p>
        <div className="earnings-breakdown">
          <div className="earn-item"><div className="earn-label">Travel (flat)</div><div className="earn-val">{fmtCur(earn.travel)}</div></div>
          <div className="earn-item"><div className="earn-label">Labor ({job.hoursWorked} h)</div><div className="earn-val">{fmtCur(earn.labor)}</div></div>
          <div className="earn-item"><div className="earn-label">Expenses ({job.kmTravelled?.toFixed(1)} km)</div><div className="earn-val" style={{color:"var(--red)"}}>{fmtCur(earn.expenses)}</div></div>
          <div className="earn-item" style={{border:"1px solid rgba(240,165,0,0.3)"}}><div className="earn-label">Net</div><div className="earn-val">{fmtCur(earn.net)}</div></div>
        </div>
      </div>
      <div className="modal-footer"><button className="btn btn-ghost" onClick={onClose}>Close</button></div>
    </div></div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({ jobs, branches, users, currentUser }) {
  const myJobs = currentUser.role==="admin" ? jobs : jobs.filter(j=>j.userId===currentUser.id);
  const totalNet   = myJobs.reduce((s,j)=>s+calcEarnings(j,RATES).net,0);
  const totalKm    = myJobs.reduce((s,j)=>s+(j.kmTravelled||0),0);
  const totalHours = myJobs.reduce((s,j)=>s+(j.hoursWorked||0),0);
  const recent = [...myJobs].sort((a,b)=>new Date(b.departureTime)-new Date(a.departureTime)).slice(0,5);
  return (
    <div>
      <div className="page-header"><div><div className="page-title">Dashboard</div><div className="page-sub">Welcome back, {currentUser.name}</div></div></div>
      <div className="page-body">
        <div className="stats-grid">
          <div className="stat-card accent"><div className="stat-label">Net Earnings</div><div className="stat-value">{fmtCur(totalNet)}</div><div className="stat-sub">{myJobs.length} service jobs</div></div>
          <div className="stat-card"><div className="stat-label">Hours Worked</div><div className="stat-value">{totalHours.toFixed(1)}</div><div className="stat-sub">on-site hours</div></div>
          <div className="stat-card"><div className="stat-label">Km Travelled</div><div className="stat-value">{totalKm.toFixed(0)}</div><div className="stat-sub">total kilometers</div></div>
          <div className="stat-card"><div className="stat-label">Branches</div><div className="stat-value">{branches.length}</div><div className="stat-sub">{users.length} technicians</div></div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Recent Jobs</span></div>
          <div className="table-wrap">
            {recent.length===0
              ? <div className="empty-state"><div className="empty-icon"><Icon name="job" size={32}/></div>No jobs yet</div>
              : <table>
                  <thead><tr><th>Date</th><th>Branch</th><th>City</th><th>Hours</th><th>Km</th><th>Net</th></tr></thead>
                  <tbody>{recent.map(j=>{
                    const b=branches.find(x=>x.id===j.branchId);
                    const e=calcEarnings(j,RATES);
                    return <tr key={j.id}>
                      <td className="td-mono">{fmtDate(j.departureTime)}</td>
                      <td className="td-mono">{j.branchId}</td>
                      <td>{b?.city??"—"}</td>
                      <td className="td-mono">{j.hoursWorked} h</td>
                      <td className="td-mono">{j.kmTravelled?.toFixed(1)} km</td>
                      <td className="td-mono text-amber">{fmtCur(e.net)}</td>
                    </tr>;
                  })}</tbody>
                </table>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── BRANCHES PAGE ─────────────────────────────────────────────────────────────
function BranchesPage({ branches, reload, isAdmin, toast }) {
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const filtered = branches.filter(b=>b.id.includes(search)||b.city.toLowerCase().includes(search.toLowerCase())||b.address.toLowerCase().includes(search.toLowerCase()));

  const save = async (data) => {
    try {
      if (modal.mode==="add") {
        await db.post("branches",{id:data.id,city:data.city,address:data.address,description:data.description,distance_km:data.distanceKm,servers:data.servers,switches:data.switches,has_mikrotik:data.hasMikrotik});
      } else {
        await db.patch("branches",`id=eq.${data.id}`,{city:data.city,address:data.address,description:data.description,distance_km:data.distanceKm,servers:data.servers,switches:data.switches,has_mikrotik:data.hasMikrotik});
      }
      await reload(); setModal(null); toast("Branch saved","ok");
    } catch(e){ toast("Error: "+e.message,"err"); }
  };

  const del = async (id) => {
    if(!confirm("Delete this branch?")) return;
    try{ await db.delete("branches",`id=eq.${id}`); await reload(); toast("Deleted","ok"); }
    catch(e){ toast("Error: "+e.message,"err"); }
  };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Branches</div><div className="page-sub">{branches.length} locations</div></div>
        {isAdmin && <button className="btn btn-primary" onClick={()=>setModal({mode:"add"})}><Icon name="plus"/> Add Branch</button>}
      </div>
      <div className="page-body">
        <div className="filters">
          <div className="search-wrap"><span className="search-icon"><Icon name="search" size={14}/></span><input className="filter-input" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
        </div>
        <div className="card"><div className="table-wrap">
          {filtered.length===0
            ? <div className="empty-state"><div className="empty-icon"><Icon name="branch" size={32}/></div>No branches</div>
            : <table>
                <thead><tr><th>ID</th><th>City</th><th>Address</th><th>Distance</th><th className="hide-mobile">Servers</th><th className="hide-mobile">Switches</th><th>MikroTik</th><th className="hide-mobile">Description</th>{isAdmin&&<th></th>}</tr></thead>
                <tbody>{filtered.map(b=>(
                  <tr key={b.id}>
                    <td className="td-mono">{b.id}</td><td>{b.city}</td><td>{b.address}</td>
                    <td className="td-mono hide-mobile">{b.distanceKm} km</td><td className="td-mono hide-mobile">{b.servers}</td><td className="td-mono hide-mobile">{b.switches}</td>
                    <td>{b.hasMikrotik?<span className="badge badge-green">Yes</span>:<span className="badge badge-red">No</span>}</td>
                    <td className="hide-mobile" style={{maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.description}</td>
                    {isAdmin&&<td><div className="flex gap-4">
                      <button className="btn btn-ghost btn-sm" onClick={()=>setModal({mode:"edit",branch:b})}><Icon name="edit" size={13}/></button>
                      <button className="btn btn-danger btn-sm" onClick={()=>del(b.id)}><Icon name="trash" size={13}/></button>
                    </div></td>}
                  </tr>
                ))}</tbody>
              </table>}
        </div></div>
      </div>
      {modal && <BranchForm branch={modal.branch} onSave={save} onClose={()=>setModal(null)}/>}
    </div>
  );
}

// ── JOBS PAGE ─────────────────────────────────────────────────────────────────
function JobsPage({ jobs, reload, branches, users, currentUser, toast }) {
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [search, setSearch] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [sortCol, setSortCol] = useState("departureTime");
  const [sortDir, setSortDir] = useState(-1);
  const cities = [...new Set(branches.map(b=>b.city))].sort();
  const myJobs = currentUser.role==="admin" ? jobs : jobs.filter(j=>j.userId===currentUser.id);

  const filtered = useMemo(()=>myJobs.filter(j=>{
    const b=branches.find(x=>x.id===j.branchId);
    if(search && !j.branchId.includes(search) && !b?.city.toLowerCase().includes(search.toLowerCase()) && !j.description?.toLowerCase().includes(search.toLowerCase())) return false;
    if(filterBranch && j.branchId!==filterBranch) return false;
    if(filterCity && b?.city!==filterCity) return false;
    if(filterUser && j.userId!==Number(filterUser)) return false;
    if(filterDateFrom && new Date(j.departureTime)<new Date(filterDateFrom)) return false;
    if(filterDateTo && new Date(j.departureTime)>new Date(filterDateTo+"T23:59:59")) return false;
    return true;
  }).sort((a,b)=>{ const av=a[sortCol],bv=b[sortCol]; return sortDir*(av<bv?-1:av>bv?1:0); }),
  [myJobs,search,filterBranch,filterCity,filterUser,filterDateFrom,filterDateTo,sortCol,sortDir]);

  const sort = col => { if(sortCol===col) setSortDir(d=>-d); else{setSortCol(col);setSortDir(-1);} };
  const SH = ({col,label}) => <th style={{cursor:"pointer",userSelect:"none"}} onClick={()=>sort(col)}>{label} {sortCol===col?(sortDir===1?"↑":"↓"):""}</th>;

  const saveJob = async (data) => {
    try {
      const row={branch_id:data.branchId,user_id:data.userId,departure_time:data.departureTime,arrival_time:data.arrivalTime,hours_worked:data.hoursWorked,return_time:data.returnTime,km_travelled:data.kmTravelled,description:data.description};
      if(modal==="add"){ await db.post("jobs",{...row,id:uid()}); }
      else { await db.patch("jobs",`id=eq.${editingJob.id}`,row); }
      await reload(); setModal(null); setEditingJob(null); toast("Job saved","ok");
    } catch(e){ toast("Error: "+e.message,"err"); }
  };

  const del = async id => {
    if(!confirm("Delete this job?")) return;
    try{ await db.delete("jobs",`id=eq.${id}`); await reload(); toast("Deleted","ok"); }
    catch(e){ toast("Error: "+e.message,"err"); }
  };

  const clearFilters = ()=>{ setSearch(""); setFilterBranch(""); setFilterCity(""); setFilterUser(""); setFilterDateFrom(""); setFilterDateTo(""); };
  const hasFilters = search||filterBranch||filterCity||filterUser||filterDateFrom||filterDateTo;

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Service Jobs</div><div className="page-sub">{filtered.length} records shown</div></div>
        <button className="btn btn-primary" onClick={()=>setModal("add")}><Icon name="plus"/> New Job</button>
      </div>
      <div className="page-body">
        <div className="filters">
          <div className="search-wrap"><span className="search-icon"><Icon name="search" size={14}/></span><input className="filter-input" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
          <select className="filter-select" value={filterBranch} onChange={e=>setFilterBranch(e.target.value)}>
            <option value="">All branches</option>
            {branches.map(b=><option key={b.id} value={b.id}>[{b.id}] {b.city}</option>)}
          </select>
          <select className="filter-select" value={filterCity} onChange={e=>setFilterCity(e.target.value)}>
            <option value="">All cities</option>
            {cities.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          {currentUser.role==="admin" && <select className="filter-select" value={filterUser} onChange={e=>setFilterUser(e.target.value)}>
            <option value="">All technicians</option>
            {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
          </select>}
          <input type="date" className="filter-select" value={filterDateFrom} onChange={e=>setFilterDateFrom(e.target.value)}/>
          <input type="date" className="filter-select" value={filterDateTo} onChange={e=>setFilterDateTo(e.target.value)}/>
          {hasFilters && <button className="btn btn-ghost btn-sm" onClick={clearFilters}><Icon name="x" size={13}/> Clear</button>}
        </div>
        <div className="card"><div className="table-wrap">
          {filtered.length===0
            ? <div className="empty-state"><div className="empty-icon"><Icon name="job" size={32}/></div>No jobs found</div>
            : <table>
                <thead><tr>
                  <SH col="departureTime" label="Date"/>
                  <th>Branch</th><th>City</th>
                  {currentUser.role==="admin"&&<th>Technician</th>}
                  <SH col="hoursWorked" label="Hours"/>
                  <SH col="kmTravelled" label="Km"/>
                  <th>Net</th><th className="hide-mobile">MikroTik</th><th></th>
                </tr></thead>
                <tbody>{filtered.map(j=>{
                  const b=branches.find(x=>x.id===j.branchId);
                  const u=users.find(x=>x.id===j.userId);
                  const e=calcEarnings(j,RATES);
                  return <tr key={j.id}>
                    <td className="td-mono">{fmtDate(j.departureTime)}</td>
                    <td className="td-mono">{j.branchId}</td>
                    <td>{b?.city??"—"}</td>
                    {currentUser.role==="admin"&&<td>{u?.name??"—"}</td>}
                    <td className="td-mono">{j.hoursWorked} h</td>
                    <td className="td-mono">{j.kmTravelled?.toFixed(1)}</td>
                    <td className="td-mono text-amber">{fmtCur(e.net)}</td>
                    <td className="hide-mobile">{b?.hasMikrotik?<span className="badge badge-green">Yes</span>:<span className="badge badge-red">No</span>}</td>
                    <td><div className="flex gap-4">
                      <button className="btn btn-ghost btn-sm" onClick={()=>setDetail(j)}><Icon name="eye" size={13}/></button>
                      <button className="btn btn-ghost btn-sm" onClick={()=>{setEditingJob(j);setModal("edit");}}><Icon name="edit" size={13}/></button>
                      <button className="btn btn-danger btn-sm" onClick={()=>del(j.id)}><Icon name="trash" size={13}/></button>
                    </div></td>
                  </tr>;
                })}</tbody>
              </table>}
        </div></div>
      </div>
      {(modal==="add"||modal==="edit") && <JobForm job={modal==="edit"?editingJob:null} branches={branches} users={users} currentUser={currentUser} onSave={saveJob} onClose={()=>{setModal(null);setEditingJob(null);}}/>}
      {detail && <JobDetail job={detail} branch={branches.find(b=>b.id===detail.branchId)} user={users.find(u=>u.id===detail.userId)} onClose={()=>setDetail(null)} onEdit={()=>{setEditingJob(detail);setModal("edit");setDetail(null);}}/>}
    </div>
  );
}

// ── EARNINGS PAGE ─────────────────────────────────────────────────────────────
function EarningsPage({ jobs, branches, users, currentUser }) {
  const [filterUser, setFilterUser] = useState(currentUser.role==="admin"?"":String(currentUser.id));
  const [filterYear, setFilterYear] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const years = [...new Set(jobs.map(j=>new Date(j.departureTime).getFullYear()))].sort((a,b)=>b-a);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const filtered = jobs.filter(j=>{
    const d=new Date(j.departureTime);
    if(filterUser && j.userId!==Number(filterUser)) return false;
    if(filterYear && d.getFullYear()!==Number(filterYear)) return false;
    if(filterMonth && d.getMonth()!==Number(filterMonth)) return false;
    if(currentUser.role!=="admin" && j.userId!==currentUser.id) return false;
    return true;
  });

  const totals = filtered.reduce((acc,j)=>{
    const e=calcEarnings(j,RATES);
    acc.travel+=e.travel; acc.labor+=e.labor; acc.expenses+=e.expenses; acc.gross+=e.gross; acc.net+=e.net;
    acc.hours+=j.hoursWorked||0; acc.km+=j.kmTravelled||0; acc.count++;
    return acc;
  },{travel:0,labor:0,expenses:0,gross:0,net:0,hours:0,km:0,count:0});

  const byMonth={};
  filtered.forEach(j=>{
    const d=new Date(j.departureTime);
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    if(!byMonth[key]) byMonth[key]={count:0,hours:0,km:0,gross:0,expenses:0,net:0};
    const e=calcEarnings(j,RATES);
    byMonth[key].count++; byMonth[key].hours+=j.hoursWorked||0;
    byMonth[key].km+=j.kmTravelled||0; byMonth[key].gross+=e.gross;
    byMonth[key].expenses+=e.expenses; byMonth[key].net+=e.net;
  });

  return (
    <div>
      <div className="page-header"><div><div className="page-title">Earnings Summary</div><div className="page-sub">Financial overview</div></div></div>
      <div className="page-body">
        <div className="filters">
          {currentUser.role==="admin" && <select className="filter-select" value={filterUser} onChange={e=>setFilterUser(e.target.value)}>
            <option value="">All technicians</option>
            {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
          </select>}
          <select className="filter-select" value={filterYear} onChange={e=>setFilterYear(e.target.value)}>
            <option value="">All years</option>
            {years.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <select className="filter-select" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}>
            <option value="">All months</option>
            {months.map((m,i)=><option key={i} value={i}>{m}</option>)}
          </select>
        </div>
        <div className="stats-grid">
          <div className="stat-card accent"><div className="stat-label">Net Earnings</div><div className="stat-value">{fmtCur(totals.net)}</div><div className="stat-sub">{totals.count} jobs</div></div>
          <div className="stat-card"><div className="stat-label">Gross Income</div><div className="stat-value">{fmtCur(totals.gross)}</div><div className="stat-sub">travel + labor</div></div>
          <div className="stat-card"><div className="stat-label">Labor</div><div className="stat-value">{fmtCur(totals.labor)}</div><div className="stat-sub">{totals.hours.toFixed(1)} h × {fmtCur(RATES.hourlyRate)}/h</div></div>
          <div className="stat-card" style={{borderColor:"rgba(248,81,73,0.2)"}}><div className="stat-label">Km Expenses</div><div className="stat-value" style={{color:"var(--red)"}}>{fmtCur(totals.expenses)}</div><div className="stat-sub">{totals.km.toFixed(0)} km × {fmtCur(RATES.kmExpenseRate)}/km</div></div>
        </div>
        {Object.keys(byMonth).length>0 && <div className="card mt-20">
          <div className="card-header"><span className="card-title">Monthly Breakdown</span></div>
          <div className="table-wrap"><table>
            <thead><tr><th>Month</th><th>Jobs</th><th>Hours</th><th>Km</th><th>Gross</th><th>Expenses</th><th>Net</th></tr></thead>
            <tbody>{Object.entries(byMonth).sort((a,b)=>b[0].localeCompare(a[0])).map(([month,d])=>(
              <tr key={month}>
                <td className="td-mono">{month}</td>
                <td className="td-mono">{d.count}</td>
                <td className="td-mono">{d.hours.toFixed(1)} h</td>
                <td className="td-mono">{d.km.toFixed(0)} km</td>
                <td className="td-mono">{fmtCur(d.gross)}</td>
                <td className="td-mono text-red">{fmtCur(d.expenses)}</td>
                <td className="td-mono text-amber">{fmtCur(d.net)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>}
      </div>
    </div>
  );
}

// ── USERS PAGE ────────────────────────────────────────────────────────────────
function UsersPage({ users, reload, currentUser, toast }) {
  const [modal, setModal] = useState(null);

  const save = async (data) => {
    try {
      if (!modal || modal==="add") {
        await db.post("users",{username:data.username,password:data.password,name:data.name,role:data.role});
      } else {
        await db.patch("users",`id=eq.${modal.id}`,{username:data.username,password:data.password,name:data.name,role:data.role});
      }
      await reload(); setModal(null); toast("User saved","ok");
    } catch(e){ toast("Error: "+e.message,"err"); }
  };

  const del = async id => {
    if(id===currentUser.id) return toast("Can't delete yourself","err");
    if(!confirm("Delete user?")) return;
    try{ await db.delete("users",`id=eq.${id}`); await reload(); toast("Deleted","ok"); }
    catch(e){ toast("Error: "+e.message,"err"); }
  };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">User Management</div><div className="page-sub">{users.length} users</div></div>
        <button className="btn btn-primary" onClick={()=>setModal("add")}><Icon name="plus"/> Add User</button>
      </div>
      <div className="page-body">
        <div className="card"><div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Username</th><th>Role</th><th></th></tr></thead>
            <tbody>{users.map(u=>(
              <tr key={u.id}>
                <td><div className="flex"><div className="user-avatar">{u.name.slice(0,2).toUpperCase()}</div>{u.name}</div></td>
                <td className="td-mono">{u.username}</td>
                <td><span className={`badge ${u.role==="admin"?"badge-amber":"badge-blue"}`}>{u.role}</span></td>
                <td><div className="flex gap-4">
                  <button className="btn btn-ghost btn-sm" onClick={()=>setModal(u)}><Icon name="edit" size={13}/></button>
                  <button className="btn btn-danger btn-sm" onClick={()=>del(u.id)}><Icon name="trash" size={13}/></button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div></div>
      </div>
      {modal && <UserForm user={typeof modal==="object"&&modal!=="add"?modal:null} onSave={save} onClose={()=>setModal(null)}/>}
    </div>
  );
}

// ── SETTINGS PAGE ─────────────────────────────────────────────────────────────
function SettingsPage({ rates, setRates, toast }) {
  const [form, setForm] = useState(rates);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const save = () => { Object.assign(RATES,form); setRates({...form}); toast("Rates saved","ok"); };
  return (
    <div>
      <div className="page-header"><div><div className="page-title">Rate Settings</div><div className="page-sub">Configure payment rates</div></div></div>
      <div className="page-body">
        <div className="card" style={{maxWidth:480}}>
          <div className="card-header"><span className="card-title">Payment Configuration</span></div>
          <div className="card-body">
            <div className="field"><label>Hourly Labor Rate (€/h)</label><input type="number" step="0.5" value={form.hourlyRate} onChange={e=>set("hourlyRate",parseFloat(e.target.value))}/></div>
            <div className="field"><label>Km Expense Rate (€/km)</label><input type="number" step="0.01" value={form.kmExpenseRate} onChange={e=>set("kmExpenseRate",parseFloat(e.target.value))}/></div>
            <div className="field"><label>Travel Flat Rate per job (€)</label><input type="number" step="0.5" value={form.travelFlat} onChange={e=>set("travelFlat",parseFloat(e.target.value))}/></div>
            <button className="btn btn-primary" onClick={save}><Icon name="check"/> Save Rates</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  const [users,    setUsers]    = useState([]);
  const [branches, setBranches] = useState([]);
  const [jobs,     setJobs]     = useState([]);
  const [rates,    setRates]    = useState({...RATES});
  const [currentUser, setCurrentUser] = useState(() => {
    try { const u = localStorage.getItem("sv_user"); return u ? JSON.parse(u) : null; } catch { return null; }
  });
  const [page,     setPage]     = useState("dashboard");
  const [loading,  setLoading]  = useState(true);
  const [toastMsg, setToastMsg] = useState(null);
  const [loginForm, setLoginForm] = useState({ username:"", password:"" });
  const [loginErr,  setLoginErr]  = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const toast = (msg, type="ok") => setToastMsg({msg, type});

  const loadAll = useCallback(async () => {
    try {
      const [u, b, j] = await Promise.all([
        db.get("users","?order=id"),
        db.get("branches","?order=city"),
        db.get("jobs","?order=departure_time.desc"),
      ]);
      setUsers(u.map(mapUser));
      setBranches(b.map(mapBranch));
      setJobs(j.map(mapJob));
    } catch(e) { toast("DB error: "+e.message,"err"); }
    finally { setLoading(false); }
  }, []);

  useEffect(()=>{ loadAll(); }, [loadAll]);

  const login = async () => {
    setLoggingIn(true); setLoginErr("");
    try {
      const res = await db.get("users",`?username=eq.${encodeURIComponent(loginForm.username)}&password=eq.${encodeURIComponent(loginForm.password)}`);
      if(res.length>0){ const u = mapUser(res[0]); localStorage.setItem("sv_user", JSON.stringify(u)); setCurrentUser(u); }
      else setLoginErr("Invalid username or password.");
    } catch(e){ setLoginErr("Connection error: "+e.message); }
    setLoggingIn(false);
  };

  if(loading) return (
    <><style>{CSS}</style>
    <div className="login-wrap">
      <div className="loading-wrap">
        <div style={{width:64,height:64,background:"#f6c01a",borderRadius:"50%",border:"4px solid #e60a14",display:"flex",alignItems:"center",justifyContent:"center",color:"#0050AA",fontWeight:700,fontSize:22,fontFamily:"IBM Plex Mono,monospace",marginBottom:8}}>SV</div>
        <div className="spinner"/>
        <span>Connecting to database…</span>
      </div>
    </div>
    </>
  );

  if(!currentUser) return (
    <><style>{CSS}</style>
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-logo">
          <div className="login-logo-icon">SV</div>
          <div><div className="login-logo-text">Yell-LIDL</div><div className="login-logo-sub">ZÁZNAMY VÝJAZDOV</div></div>
        </div>
        <div className="login-title">Sign in</div>
        <div className="login-sub">Enter your credentials to continue</div>
        {loginErr && <div className="login-err">{loginErr}</div>}
        <div className="field"><label>Username</label><input value={loginForm.username} onChange={e=>setLoginForm(f=>({...f,username:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&login()} autoFocus/></div>
        <div className="field"><label>Password</label><input type="password" value={loginForm.password} onChange={e=>setLoginForm(f=>({...f,password:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&login()}/></div>
        <button className="btn btn-primary btn-full" onClick={login} disabled={loggingIn}>{loggingIn?"Signing in…":"Sign in"}</button>
      </div>
    </div>
    </>
  );

  const isAdmin = currentUser.role==="admin";
  const nav = [
    {id:"dashboard", label:"Dashboard",    icon:"list"},
    {id:"jobs",      label:"Service Jobs", icon:"job"},
    {id:"branches",  label:"Branches",     icon:"branch"},
    {id:"earnings",  label:"Earnings",     icon:"earnings"},
    ...(isAdmin ? [{id:"users",label:"Users",icon:"users"},{id:"settings",label:"Settings",icon:"settings"}] : []),
  ];

  return (
    <><style>{CSS}</style>
    <div className="app">
      {!isMobile && <div className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">SV</div>
          <div><div className="sidebar-logo-name">Yell-LIDL</div><div className="sidebar-logo-sub">ZÁZNAMY VÝJAZDOV</div></div>
        </div>
        <nav className="sidebar-nav">
          {nav.map(n=>(
            <div key={n.id} className={`nav-item ${page===n.id?"active":""}`} onClick={()=>setPage(n.id)}>
              <Icon name={n.icon} size={16}/><span>{n.label}</span>
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-badge">
            <div className="user-avatar">{currentUser.name.slice(0,2).toUpperCase()}</div>
            <div><div className="user-name">{currentUser.name}</div><div className="user-role">{currentUser.role}</div></div>
          </div>
          <div className="nav-item" style={{color:"var(--text3)",fontSize:12}} onClick={loadAll}>
            <Icon name="refresh" size={14}/><span>Refresh</span>
          </div>
          <div className="nav-item" onClick={()=>{ localStorage.removeItem("sv_user"); setCurrentUser(null); }} style={{color:"var(--red)",marginTop:2}}>
            <Icon name="logout" size={15}/><span>Sign out</span>
          </div>
        </div>
      </div>}
      <div className="main" style={isMobile ? {marginLeft:0, paddingBottom:'calc(72px + env(safe-area-inset-bottom))'} : {}}>
        {page==="dashboard" && <Dashboard jobs={jobs} branches={branches} users={users} currentUser={currentUser}/>}
        {page==="jobs"      && <JobsPage jobs={jobs} reload={loadAll} branches={branches} users={users} currentUser={currentUser} toast={toast}/>}
        {page==="branches"  && <BranchesPage branches={branches} reload={loadAll} isAdmin={isAdmin} toast={toast}/>}
        {page==="earnings"  && <EarningsPage jobs={jobs} branches={branches} users={users} currentUser={currentUser}/>}
        {page==="users" && isAdmin && <UsersPage users={users} reload={loadAll} currentUser={currentUser} toast={toast}/>}
        {page==="settings" && isAdmin && <SettingsPage rates={rates} setRates={setRates} toast={toast}/>}
      </div>
    </div>

    {/* ── BOTTOM NAV (mobile only) ── */}
    <nav className={`bottom-nav${!isMobile ? " bottom-nav-hidden" : ""}`}>
      {nav.map(n=>(
        <button key={n.id} className={`bottom-nav-item ${page===n.id?"active":""}`} onClick={()=>setPage(n.id)}>
          <Icon name={n.icon} size={22}/>
          <span>{n.label==="Dashboard"?"Home":n.label==="Service Jobs"?"Jobs":n.label==="Branches"?"Stores":n.label==="Earnings"?"Money":n.label}</span>
        </button>
      ))}
      <button className="bottom-nav-item" onClick={loadAll}><Icon name="refresh" size={20}/>Refresh</button>
      <button className="bottom-nav-item" style={{color:"var(--red)"}} onClick={()=>{ localStorage.removeItem("sv_user"); setCurrentUser(null); }}><Icon name="logout" size={20}/>Out</button>
    </nav>

    {toastMsg && <Toast msg={toastMsg.msg} type={toastMsg.type} onDone={()=>setToastMsg(null)}/>}
    </>
  );
}
