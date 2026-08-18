/* Clean Air Horizons 2026 — Command Centre (frontend) */
'use strict';

/* ---------------- state ---------------- */
let DATA = null;
let BASE_VERSION = 0;
let EDIT = false;
let EDITOR_KEY = '';
let EDITOR_NAME = '';
let DIRTY = false;
let ACTIVE_TAB = 'dashboard';
let EVENTDAY_SUB = 'a';
let SERVER_NEWER = false;
let POLL = null;

const STATUS = ['Not started','In progress','Waiting for response','Blocked','Completed','Not applicable'];
const PRIORITY = ['Critical','High','Medium','Low'];
const WORKSTREAM = ['Overall coordination','Sessions','Panelists','Outreach','Registration','Technical','Documents','Reports/materials','Printing','Logistics','Website','Press/media','Admin','Other'];
const DOCTYPE = ['Document','Moderator questions','Meeting notes','Technical material','Presentation','Video','Logo','Outreach','Website','Registration','Press release','Report/publication','Printing','Logistics','Admin','Other'];
const SEVERITY = ['Critical','High','Medium','Low'];
const SESSION_TYPE = ['Plenary','Parallel (CA-led)','Parallel (Partner-led)','Ceremony','Cultural','Roundtable','Workshop','Fireside chat','Logistics','Other'];
const SCORED = new Set(['Plenary','Parallel (CA-led)','Parallel (Partner-led)','Ceremony','Cultural','Roundtable','Workshop','Fireside chat']);
const READY_LABELS = {moderator:'moderator',panelists:'panelists',bios:'bios',photos:'photos',questions:'questions',materials:'PPT/materials',videos:'videos',logos:'logos',seating:'seating',agendaM2M:'M2M agenda',printing:'printing',techCheck:'tech check'};

/* ---------------- helpers ---------------- */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
function el(tag, props={}, kids=[]){
  const n = document.createElement(tag);
  for(const k in props){
    if(k==='class') n.className=props[k];
    else if(k==='html') n.innerHTML=props[k];
    else if(k.startsWith('on')) n.addEventListener(k.slice(2), props[k]);
    else if(props[k]!==undefined && props[k]!==null) n.setAttribute(k, props[k]);
  }
  (Array.isArray(kids)?kids:[kids]).forEach(c=>{ if(c==null) return; n.appendChild(typeof c==='string'?document.createTextNode(c):c); });
  return n;
}
const unassigned = v => !v || v==='To be assigned' || String(v).trim()==='';
const cls = s => 'pill '+String(s||'').replace(/[^A-Za-z]/g,'');
function toast(msg, kind){ const t=$('#toast'); t.textContent=msg; t.className='toast '+(kind||''); t.hidden=false; clearTimeout(t._t); t._t=setTimeout(()=>t.hidden=true, 3200); }
function markDirty(){ DIRTY=true; const b=$('#saveBtn'); b.hidden=false; b.classList.add('dirty'); b.textContent='Save changes'; }

/* parse "HH:MM - HH:MM" → [startMin,endMin] or null */
function parseSlot(t){
  const m = String(t||'').match(/(\d{1,2}):(\d{2})\s*[-\u2013]\s*(\d{1,2}):(\d{2})/);
  if(!m) return null;
  return [ (+m[1])*60+(+m[2]), (+m[3])*60+(+m[4]) ];
}
function overlaps(a,b){ const x=parseSlot(a.time),y=parseSlot(b.time); if(!x||!y||a.date!==b.date) return false; return x[0]<y[1] && y[0]<x[1]; }

/* ---------------- editable cell builders ---------------- */
function tdText(row,key,{area=false,ph=''}={}){
  if(EDIT){
    const n = area ? el('textarea',{}, row[key]||'') : el('input',{type:'text',value:row[key]||'',placeholder:ph});
    n.addEventListener('input',()=>{ row[key]=n.value; markDirty(); if(key==='deadline'||key==='status'||key==='priority') {} });
    return el('td',{}, n);
  }
  const v = row[key];
  if(v==null||v==='') return el('td',{class:'muted'},'—');
  return el('td',{class:'cell-static'}, String(v));
}
function tdSelect(row,key,opts,{pill=false}={}){
  if(EDIT){
    const s = el('select',{});
    opts.forEach(o=> s.appendChild(el('option',{value:o, ...(row[key]===o?{selected:'selected'}:{})}, o)));
    if(!opts.includes(row[key])) s.insertBefore(el('option',{value:row[key]||'',selected:'selected'}, row[key]||'—'), s.firstChild);
    s.addEventListener('change',()=>{ row[key]=s.value; markDirty(); softRerender(); });
    return el('td',{}, s);
  }
  if(pill) return el('td',{}, el('span',{class:cls(row[key])}, row[key]||'—'));
  return el('td',{}, row[key]||'—');
}
function tdPerson(row,key){
  if(EDIT) return tdSelect(row,key,DATA.team);
  const v=row[key];
  return el('td',{class: unassigned(v)?'tba':''}, v||'To be assigned');
}
function tdLink(row,key){
  if(EDIT){
    const n=el('input',{type:'text',value:row[key]||'',placeholder:'https:// or doc name'});
    n.addEventListener('input',()=>{ row[key]=n.value; markDirty(); });
    return el('td',{}, n);
  }
  const v=row[key]; if(!v) return el('td',{class:'muted'},'—');
  if(/^https?:\/\//.test(v)) return el('td',{}, el('a',{href:v,target:'_blank',rel:'noopener'},'open ↗'));
  return el('td',{class:'cell-static'}, v);
}
function tdCheck(row,key){
  const c = el('input',{type:'checkbox', ...(row[key]?{checked:'checked'}:{})});
  c.disabled = !EDIT;
  c.addEventListener('change',()=>{ row[key]=c.checked; markDirty(); softRerender(); });
  return el('td',{}, c);
}
function rowActionsTd(list,row){
  if(!EDIT) return el('td',{});
  return el('td',{}, el('button',{class:'btn-mini btn-danger', onclick:()=>{ const i=list.indexOf(row); if(i>-1){list.splice(i,1); markDirty(); render();} }}, '✕'));
}

/* light re-render of just the active tab (used after a dropdown/checkbox change so
   dashboard metrics & readiness update without losing edit focus on other tabs) */
let _soft=null;
function softRerender(){ clearTimeout(_soft); _soft=setTimeout(()=>renderActive(), 120); }

/* ---------------- computed logic ---------------- */
function readiness(s){
  if(!SCORED.has(s.type)) return null;
  const miss=[];
  const isPanel = /Plenary|Parallel/.test(s.type);
  if(unassigned(s.lead)) miss.push('lead');
  if(unassigned(s.note1)||unassigned(s.note2)) miss.push('2 note takers');
  if(unassigned(s.technical)) miss.push('technical');
  if(isPanel && unassigned(s.moderator)) miss.push('moderator');
  if(unassigned(s.support)) miss.push('support');
  const c=s.c||{};
  const wants = isPanel ? ['moderator','bios','questions','materials','seating','agendaM2M'] : ['bios','seating','agendaM2M'];
  wants.forEach(k=>{ if(k==='moderator') return; if(!c[k]) miss.push(READY_LABELS[k]); });
  // level
  let level='ready';
  const essentialMissing = unassigned(s.lead)|| (unassigned(s.note1)&&unassigned(s.note2)) || unassigned(s.technical) || (isPanel&&unassigned(s.moderator));
  if(essentialMissing) level='bad';
  else if(miss.length) level='warn';
  return {level, miss};
}

function overdue(row){
  if(!row.deadline || row.status==='Completed' || row.status==='Not applicable') return false;
  const d = new Date(row.deadline); if(isNaN(d)) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  return d < today;
}
function dueSoon(row){
  if(!row.deadline || row.status==='Completed' || row.status==='Not applicable') return false;
  const d=new Date(row.deadline); if(isNaN(d)) return false;
  const today=new Date(); today.setHours(0,0,0,0);
  const diff=(d-today)/86400000; return diff>=0 && diff<=7;
}

function computeAlerts(){
  const A=[];
  // before-event tasks
  DATA.beforeEvent.forEach(t=>{
    if(overdue(t) && (t.priority==='Critical'||t.priority==='High')) A.push({sev:'red',msg:`Overdue: ${t.task}`,where:`${t.workstream} · due ${t.deadline}`});
    else if(overdue(t)) A.push({sev:'amber',msg:`Overdue: ${t.task}`,where:`${t.workstream} · due ${t.deadline}`});
    else if(dueSoon(t) && t.status!=='Completed') A.push({sev:'amber',msg:`Due within 7 days: ${t.task}`,where:`due ${t.deadline}`});
    if(unassigned(t.responsible) && (t.priority==='Critical'||t.priority==='High') && t.status!=='Completed') A.push({sev:'red',msg:`No owner: ${t.task}`,where:t.workstream});
  });
  // sessions
  const scored = DATA.sessions.filter(s=>SCORED.has(s.type));
  scored.forEach(s=>{
    const r=readiness(s); if(!r) return;
    if(r.level==='bad') A.push({sev:'red',msg:`Session not ready: ${short(s.session)}`,where:`${dLabel(s.date)} ${s.time} · missing ${r.miss.slice(0,3).join(', ')}`});
    else if(r.level==='warn') A.push({sev:'amber',msg:`Needs attention: ${short(s.session)}`,where:`missing ${r.miss.slice(0,3).join(', ')}`});
    // single note taker
    if(unassigned(s.note1)!==unassigned(s.note2)) A.push({sev:'red',msg:`Only one note taker: ${short(s.session)}`,where:`${dLabel(s.date)} ${s.time}`});
    // senior-role conflict
    [['support',s.support],['note1',s.note1],['note2',s.note2],['technical',s.technical]].forEach(([role,p])=>{
      if(p && DATA.seniorStaff.includes(p)) A.push({sev:'amber',msg:`Senior-role conflict: ${p} on ${role}`,where:short(s.session)});
    });
  });
  // clashes: same person leading / note-taking two overlapping sessions
  for(let i=0;i<scored.length;i++) for(let j=i+1;j<scored.length;j++){
    if(!overlaps(scored[i],scored[j])) continue;
    const a=scored[i], b=scored[j];
    [['lead','lead'],['note1','note taker'],['note2','note taker']].forEach(()=>{});
    const rolesA={lead:a.lead,n1:a.note1,n2:a.note2,tech:a.technical};
    const rolesB={lead:b.lead,n1:b.note1,n2:b.note2,tech:b.technical};
    Object.entries(rolesA).forEach(([ra,pa])=>{
      if(unassigned(pa)) return;
      Object.entries(rolesB).forEach(([rb,pb])=>{
        if(pa===pb) A.push({sev:'red',msg:`Clash: ${pa} assigned to two overlapping sessions`,where:`${s2(a)} & ${s2(b)}`});
      });
    });
  }
  // docs technical overdue
  DATA.docs.forEach(d=>{ if((d.type==='Presentation'||d.type==='Technical material'||d.type==='Video') && overdue(d)) A.push({sev:'red',msg:`Technical item overdue: ${d.item}`,where:`due ${d.deadline}`}); });
  // de-dup
  const seen=new Set(); return A.filter(a=>{ const k=a.sev+a.msg+a.where; if(seen.has(k))return false; seen.add(k); return true; })
    .sort((x,y)=> (x.sev==='red'?0:1)-(y.sev==='red'?0:1));
}
const short = s => { s=String(s||''); return s.length>52? s.slice(0,52)+'…':s; };
const s2 = s => `${dLabel(s.date)} ${s.time}`;
const dLabel = d => d==='2026-09-07'?'7 Sep': d==='2026-09-08'?'8 Sep': (d||'');

function computeMetrics(){
  const items=[...DATA.beforeEvent, ...DATA.docs];
  const by=k=>items.filter(t=>t.status===k).length;
  const scored=DATA.sessions.filter(s=>SCORED.has(s.type));
  let ready=0,warn=0,bad=0; scored.forEach(s=>{const r=readiness(s); if(r){if(r.level==='ready')ready++;else if(r.level==='warn')warn++;else bad++;}});
  return {
    open: items.filter(t=>t.status!=='Completed'&&t.status!=='Not applicable').length,
    completed: by('Completed'), inprogress: by('In progress'), waiting: by('Waiting for response'),
    blocked: by('Blocked'), overdue: items.filter(overdue).length,
    critical: DATA.beforeEvent.filter(t=>t.priority==='Critical'&&t.status!=='Completed').length,
    ready, warn, bad,
    unassigned: DATA.beforeEvent.filter(t=>unassigned(t.responsible)&&t.status!=='Completed').length
  };
}

function computeWorkload(){
  const map={};
  const bump=(p,f)=>{ if(unassigned(p))return; (map[p]=map[p]||{tasks:0,hi:0,sessions:0,notes:0,eventday:0}); map[p][f]++; };
  DATA.sessions.forEach(s=>{
    if(!unassigned(s.lead)){ map[s.lead]=map[s.lead]||{tasks:0,hi:0,sessions:0,notes:0,eventday:0}; map[s.lead].sessions++; }
    if(!unassigned(s.support)){ map[s.support]=map[s.support]||{tasks:0,hi:0,sessions:0,notes:0,eventday:0}; map[s.support].sessions++; }
    ['note1','note2'].forEach(k=>{ if(!unassigned(s[k])){ map[s[k]]=map[s[k]]||{tasks:0,hi:0,sessions:0,notes:0,eventday:0}; map[s[k]].notes++; } });
  });
  DATA.beforeEvent.forEach(t=>{ if(!unassigned(t.responsible)){ map[t.responsible]=map[t.responsible]||{tasks:0,hi:0,sessions:0,notes:0,eventday:0}; map[t.responsible].tasks++; if(t.priority==='Critical'||t.priority==='High') map[t.responsible].hi++; } });
  DATA.eventDay.runOfShow.forEach(r=>{ if(!unassigned(r.responsible)){ map[r.responsible]=map[r.responsible]||{tasks:0,hi:0,sessions:0,notes:0,eventday:0}; map[r.responsible].eventday++; } });
  // conflicts
  const scored=DATA.sessions.filter(s=>SCORED.has(s.type));
  const conflictPeople=new Set();
  for(let i=0;i<scored.length;i++)for(let j=i+1;j<scored.length;j++){ if(!overlaps(scored[i],scored[j]))continue;
    [['lead'],['note1'],['note2'],['support'],['technical']].forEach(([r])=>{ const a=scored[i][r],b=scored[j][r]; if(!unassigned(a)&&a===b) conflictPeople.add(a); }); }
  return Object.entries(map).map(([p,v])=>({person:p,...v,
    conflict: conflictPeople.has(p),
    senior: DATA.seniorStaff.includes(p) && (v.notes>0||v.eventday>0)
  })).sort((a,b)=> (b.tasks+b.sessions+b.notes+b.eventday)-(a.tasks+a.sessions+a.notes+a.eventday));
}

/* ---------------- header ---------------- */
function renderHeader(){
  const m=DATA.meta;
  $('#eventSub').textContent = m.tagline;
  const days = Math.ceil((new Date(m.startDate) - new Date().setHours(0,0,0,0))/86400000);
  $('#daysLeft').textContent = days>=0? days : 'Live';
  $('#eventMeta').innerHTML = `<div><b>${m.dateLabel}</b> · ${m.time}</div><div>${m.venue}</div><div>${m.location}</div>`;
  const upd = m.updatedAt? new Date(m.updatedAt).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—';
  $('#syncInfo').innerHTML = `v${m.version} · last saved by ${m.updatedBy||'—'} · ${upd}`;
  $('#footVersion').textContent = `Version ${m.version} · ${upd}`;
  $('#editToggle').textContent = EDIT? 'Stop editing' : 'Switch to editing';
  $('#editToggle').classList.toggle('btn-ghost', EDIT);
  $('#saveBtn').hidden = !EDIT;
  $('#editorLine').hidden = !EDIT;
  if(EDIT) $('#editorLine').innerHTML = `Editing as <b>${EDITOR_NAME}</b>`;
}

/* ---------------- tab dispatch ---------------- */
function renderActive(){
  renderHeader();
  const v=$('#view'); v.innerHTML='';
  if(SERVER_NEWER && EDIT){
    v.appendChild(el('div',{class:'newer'},[ 'A newer version was saved by someone else. Your unsaved edits are kept here — ',
      el('a',{href:'#',onclick:e=>{e.preventDefault(); if(confirm('Discard your unsaved edits and load the latest version?')) load();}},'load latest (discards your edits)'),'.' ]));
  }
  if(EDIT) v.appendChild(el('div',{class:'editbanner'},['✎ Editing mode — changes are saved for everyone only when you press ', el('b',{},'Save changes'),'.']));
  ({dashboard:renderDashboard, before:renderBefore, oneweek:renderOneWeek, sessions:renderSessions, docs:renderDocs, eventday:renderEventDay}[ACTIVE_TAB])(v);
}
const render = renderActive;

/* ---------------- 01 Dashboard ---------------- */
function renderDashboard(v){
  const M=computeMetrics();
  const alerts=computeAlerts();

  const kpis = el('div',{class:'kpis'},[
    kpi(M.open,'Open tasks','info'), kpi(M.completed,'Completed','good'),
    kpi(M.inprogress,'In progress','info'), kpi(M.overdue,'Overdue', M.overdue?'bad':'good'),
    kpi(M.critical,'Critical pending', M.critical?'bad':'good'), kpi(M.unassigned,'Unassigned', M.unassigned?'warn':'good'),
  ]);
  const kpis2 = el('div',{class:'kpis'},[
    kpi(M.ready,'Sessions ready','good'), kpi(M.warn,'Need attention', M.warn?'warn':'good'),
    kpi(M.bad,'Not ready', M.bad?'bad':'good'), kpi(M.waiting,'Awaiting response','info'),
    kpi(M.blocked,'Blocked', M.blocked?'bad':'good'), kpi(DATA.sessions.filter(s=>SCORED.has(s.type)).length,'Total sessions','info'),
  ]);

  const alertBox = el('div',{class:'panel'},[
    el('h2',{},['Needs attention', el('span',{class:'hint'},'auto-generated')]),
    alerts.length? el('div',{class:'alerts'}, alerts.map(a=>el('div',{class:'alert '+(a.sev==='red'?'red':'amber')},[
        el('span',{class:'dot'}, a.sev==='red'?'🔴':'🟠'),
        el('div',{},[ el('div',{}, a.msg), el('div',{class:'where'}, a.where) ])
      ])))
    : el('div',{class:'alert-empty'},'✓ Nothing flagged right now.')
  ]);

  // readiness board
  const scored=DATA.sessions.filter(s=>SCORED.has(s.type));
  const board = el('div',{class:'panel'},[
    el('h2',{},['Session readiness', el('span',{class:'hint'},'green = ready · amber = attention · red = not ready')]),
    el('div',{class:'readboard'}, scored.map(s=>{ const r=readiness(s);
      const tag = r.level==='ready'?['ready','Ready']: r.level==='warn'?['warn','Attention']:['bad','Not ready'];
      return el('div',{class:'readrow'},[
        el('div',{class:'t'}, `${dLabel(s.date)}\n${s.time.split(' ')[0]}`),
        el('div',{},[ el('div',{class:'name'}, short(s.session)),
          r.miss.length? el('div',{class:'miss'},'missing: '+r.miss.join(', ')) : el('div',{class:'miss'},'all components in place') ]),
        el('span',{class:'readtag '+tag[0]}, tag[1])
      ]);
    }))
  ]);

  v.appendChild(el('div',{class:'grid cols-2'},[ el('div',{class:'grid'},[kpis,kpis2,alertBox]), board ]));

  // master links
  v.appendChild(el('div',{class:'panel',style:'margin-top:16px'},[
    el('h2',{},['Master source links', el('span',{class:'hint'},'link to where information lives — don’t duplicate it')]),
    tableEl(['Resource','Purpose','Owner','Link', EDIT?'':null].filter(x=>x!==null),
      DATA.links.map(l=>[ tdText(l,'resource'), tdText(l,'purpose'), tdPerson(l,'owner'), tdLink(l,'url'), EDIT?rowActionsTd(DATA.links,l):null ].filter(Boolean)) ),
    EDIT? el('button',{class:'btn-mini',style:'margin-top:8px',onclick:()=>{DATA.links.push({resource:'',purpose:'',owner:'To be assigned',url:''});markDirty();render();}},'+ Add link') : null
  ]));

  // event control + escalation + workload + issue log
  const ec=DATA.eventControl;
  const control = el('div',{class:'panel'},[
    el('h2',{},'Event control'),
    el('div',{class:'control-grid'},[
      ctrl('Overall coordination','overall'), ctrl('Central technical','technical'),
      ctrl('Overall outreach','outreach'), ctrl('Admin coordination','admin')
    ]),
    el('div',{class:'escalation'},['Escalation: if something goes wrong → tell your ', el('b',{},'session lead'), ' → if unresolved or critical, tell ', el('b',{},ec.overall||'the event coordinator'), '.',
      el('div',{style:'margin-top:6px'}, `Technical cut-off for all PPTs/videos: ${EDIT?'':(ec.techCutoff||'—')}`, EDIT? tinyInput(ec,'techCutoff'):'')])
  ]);

  const wl=computeWorkload();
  const workload = el('div',{class:'panel'},[
    el('h2',{},['Workload & conflicts', el('span',{class:'hint'},'flags only — reassign manually')]),
    el('div',{class:'tablewrap'}, tableEl(['Person','Tasks','Hi/Crit','Sessions','Notes','Event day','Flag'],
      wl.filter(w=>w.tasks+w.sessions+w.notes+w.eventday>0).map(w=>[
        el('td',{}, w.person),
        el('td',{class:'num'}, w.tasks), el('td',{class:'num'}, w.hi),
        el('td',{class:'num'}, w.sessions), el('td',{class:'num'}, w.notes), el('td',{class:'num'}, w.eventday),
        el('td',{}, [ w.conflict? el('span',{class:'pill Blocked'},'Conflict '):null, w.senior? el('span',{class:'pill High'},'Senior-role'):null, (!w.conflict&&!w.senior)? el('span',{class:'muted'},'—'):null ].filter(Boolean))
      ])))
  ]);

  v.appendChild(el('div',{class:'grid cols-2',style:'margin-top:16px'},[ control, workload ]));

  // issue log
  v.appendChild(el('div',{class:'panel',style:'margin-top:16px'},[
    el('h2',{},['Event issue log', el('span',{class:'hint'},'so problems get an owner instead of getting lost in chat')]),
    el('div',{class:'tablewrap'}, tableEl(['Time','Issue','Location/session','Severity','Responsible','Escalated to','Resolution','Status', EDIT?'':null].filter(x=>x!==null),
      DATA.issues.map(i=>[ tdText(i,'time'), tdText(i,'issue',{area:true}), tdText(i,'location'), tdSelect(i,'severity',SEVERITY,{pill:true}), tdPerson(i,'responsible'), tdPerson(i,'escalatedTo'), tdText(i,'resolution',{area:true}), tdText(i,'status'), EDIT?rowActionsTd(DATA.issues,i):null ].filter(Boolean)) )),
    EDIT? el('button',{class:'btn-mini',style:'margin-top:8px',onclick:()=>{DATA.issues.push({time:'',issue:'',location:'',severity:'Medium',responsible:'To be assigned',escalatedTo:'To be assigned',resolution:'',status:'Open'});markDirty();render();}},'+ Log issue')
      : (DATA.issues.length? null : el('div',{class:'muted',style:'padding:8px'},'No issues logged.'))
  ]));

  function ctrl(label,key){ return el('div',{class:'control-item'},[ el('div',{class:'r'},label),
    EDIT? tdInline(ec,key) : el('div',{class:'p'}, ec[key]||'To be assigned') ]); }
}
function kpi(n,l,k){ return el('div',{class:'kpi '+(k||'')},[ el('div',{class:'n'}, String(n)), el('div',{class:'l'}, l) ]); }
function tdInline(o,k){ const n=el('input',{type:'text',value:o[k]||'',style:'width:100%;margin-top:3px'}); n.addEventListener('input',()=>{o[k]=n.value;markDirty();}); return n; }
function tinyInput(o,k){ const n=el('input',{type:'text',value:o[k]||'',style:'width:120px;margin-left:6px'}); n.addEventListener('input',()=>{o[k]=n.value;markDirty();}); return n; }

/* ---------------- generic table ---------------- */
function tableEl(headers, rows){
  const thead=el('thead',{}, el('tr',{}, headers.map(h=>el('th',{},h))));
  const tbody=el('tbody',{}, rows.map(cells=>el('tr',{}, cells)));
  return el('table',{}, [thead, tbody]);
}

/* ---------------- 02 Before event ---------------- */
let beFilter={ws:'',status:'',q:''};
function renderBefore(v){
  v.appendChild(el('h2',{class:'section-title'},'Before event — preparation tracker'));
  const bar=el('div',{class:'toolbar'},[
    filterSel('Workstream',['',...WORKSTREAM],beFilter.ws,x=>{beFilter.ws=x;render();}),
    filterSel('Status',['',...STATUS],beFilter.status,x=>{beFilter.status=x;render();}),
    (()=>{const i=el('input',{type:'text',placeholder:'Search tasks…',value:beFilter.q}); i.addEventListener('input',()=>{beFilter.q=i.value;renderBefore(clear(v));}); return i;})(),
    el('div',{class:'spacer'}),
  ]);
  let rows=DATA.beforeEvent.filter(t=> (!beFilter.ws||t.workstream===beFilter.ws) && (!beFilter.status||t.status===beFilter.status) && (!beFilter.q|| (t.task+t.notes+t.responsible).toLowerCase().includes(beFilter.q.toLowerCase())) );
  bar.appendChild(el('div',{class:'count-chip'}, `${rows.length} of ${DATA.beforeEvent.length} tasks`));
  v.appendChild(bar);

  const headers=['Workstream','Task','Responsible','Support','Deadline','Priority','Status','Link','Notes', EDIT?'':null].filter(x=>x!==null);
  const trs=rows.map(t=>{
    const cells=[ tdSelect(t,'workstream',WORKSTREAM), tdText(t,'task',{area:true}), tdPerson(t,'responsible'), tdText(t,'support'),
      tdText(t,'deadline',{ph:'YYYY-MM-DD'}), tdSelect(t,'priority',PRIORITY,{pill:true}), tdSelect(t,'status',STATUS,{pill:true}),
      tdLink(t,'link'), tdText(t,'notes',{area:true}), EDIT?rowActionsTd(DATA.beforeEvent,t):null ].filter(Boolean);
    const tr=el('tr',{}, cells); if(overdue(t)) tr.classList.add('overdue'); return tr;
  });
  v.appendChild(el('div',{class:'tablewrap'}, el('table',{},[ el('thead',{},el('tr',{},headers.map(h=>el('th',{},h)))), el('tbody',{},trs) ])));
  if(EDIT) v.appendChild(el('button',{class:'btn-mini',style:'margin-top:10px',onclick:()=>{DATA.beforeEvent.unshift({id:'be'+Date.now(),workstream:'Other',task:'',responsible:'To be assigned',support:'',deadline:'',priority:'Medium',status:'Not started',dependency:'',link:'',notes:''});markDirty();render();}},'+ Add task'));
}
function clear(v){ v.innerHTML=''; return v; }
function filterSel(label,opts,val,cb){ const s=el('select',{}); opts.forEach(o=>s.appendChild(el('option',{value:o,...(o===val?{selected:'selected'}:{})}, o||('All '+label.toLowerCase())))); s.addEventListener('change',()=>cb(s.value)); return s; }

/* ---------------- 03 One week before ---------------- */
function renderOneWeek(v){
  v.appendChild(el('h2',{class:'section-title'},'One week before — is everything actually ready?'));
  const done=DATA.oneWeek.filter(x=>x.done).length, pct=Math.round(done/DATA.oneWeek.length*100);
  v.appendChild(el('div',{class:'panel'},[
    el('h2',{},[`Readiness checklist`, el('span',{class:'hint'},`${done}/${DATA.oneWeek.length} done`)]),
    el('div',{class:'progressbar'}, el('i',{style:`width:${pct}%`})),
    el('div',{class:'checklist'}, DATA.oneWeek.map(item=>{
      const c=el('input',{type:'checkbox',...(item.done?{checked:'checked'}:{})}); c.disabled=!EDIT;
      c.addEventListener('change',()=>{item.done=c.checked;markDirty();renderOneWeek(clear(v));});
      return el('div',{class:'checkitem'+(item.done?' done':'')},[ c, el('label',{}, item.label) ]);
    }))
  ]));

  // per-session readiness snapshot (auto)
  const scored=DATA.sessions.filter(s=>SCORED.has(s.type));
  const rows=scored.map(s=>{ const r=readiness(s);
    const yn=(v)=> unassigned(v)? el('span',{class:'s-bad'},[el('span',{class:'status-dot'}),'—']) : el('span',{class:'s-ready'},[el('span',{class:'status-dot'}),String(v).split(',')[0]]);
    const flag=(cond)=> cond? el('span',{class:'s-ready'},[el('span',{class:'status-dot'}),'yes']) : el('span',{class:'s-bad'},[el('span',{class:'status-dot'}),'no']);
    const tag=r.level==='ready'?['readtag ready','Ready']:r.level==='warn'?['readtag warn','Attention']:['readtag bad','Not ready'];
    return el('tr',{},[
      el('td',{},[el('div',{}, short(s.session)), el('div',{class:'muted',style:'font-size:11px'}, `${dLabel(s.date)} ${s.time} · ${s.room}`)]),
      el('td',{}, yn(s.lead)), el('td',{}, yn(s.support)),
      el('td',{}, (!unassigned(s.note1)&&!unassigned(s.note2))? el('span',{class:'s-ready'},[el('span',{class:'status-dot'}),'2']) : el('span',{class:'s-bad'},[el('span',{class:'status-dot'}), (unassigned(s.note1)&&unassigned(s.note2))?'0':'1'])),
      el('td',{}, yn(s.moderator)),
      el('td',{}, flag(s.c&&s.c.questions)), el('td',{}, flag(s.c&&s.c.materials)),
      el('td',{}, flag(s.c&&s.c.seating)), el('td',{}, flag(s.c&&s.c.agendaM2M)),
      el('td',{}, el('span',{class:tag[0]}, tag[1]))
    ]);
  });
  v.appendChild(el('div',{class:'panel',style:'margin-top:16px'},[
    el('h2',{},['Session readiness snapshot', el('span',{class:'hint'},'derived from Sessions & people — edit there')]),
    el('div',{class:'tablewrap'}, el('table',{},[
      el('thead',{}, el('tr',{}, ['Session','Lead','Support','Note takers','Moderator','Questions','PPT/video','Seating','M2M agenda','Ready?'].map(h=>el('th',{},h)))),
      el('tbody',{}, rows)
    ]))
  ]));
}

/* ---------------- 04 Sessions & people ---------------- */
let sessDay='all';
function renderSessions(v){
  v.appendChild(el('h2',{class:'section-title'},'Sessions & people'));
  const daySel=el('select',{});
  [['all','Both days'],['2026-09-07','7 September'],['2026-09-08','8 September']].forEach(([val,lab])=> daySel.appendChild(el('option',{value:val,...(sessDay===val?{selected:'selected'}:{})}, lab)));
  daySel.addEventListener('change',()=>{sessDay=daySel.value;render();});
  v.appendChild(el('div',{class:'toolbar'},[ daySel,
    el('div',{class:'count-chip'},'Tip: tick the readiness boxes (bios/questions/PPT/seating/M2M) as each piece is confirmed.')
  ]));
  const list=DATA.sessions.filter(s=> sessDay==='all'||s.date===sessDay);
  const headers=['Date','Time','Room','Session','Type','Lead','Support','Note taker 1','Note taker 2','Technical','Emcee','Moderator','Bios','Q’s','PPT','Seat','M2M','Ready', EDIT?'':null].filter(x=>x!==null);
  const trs=list.map(s=>{
    if(!s.c) s.c={};
    const r=readiness(s);
    const tag=!r?el('span',{class:'muted'},'—'): el('span',{class: r.level==='ready'?'readtag ready':r.level==='warn'?'readtag warn':'readtag bad'}, r.level==='ready'?'Ready':r.level==='warn'?'Att.':'No');
    const cells=[
      el('td',{class:'cell-static'}, dLabel(s.date)), tdText(s,'time'), tdText(s,'room'),
      tdText(s,'session',{area:true}), tdSelect(s,'type',SESSION_TYPE),
      tdPerson(s,'lead'), tdPerson(s,'support'), tdPerson(s,'note1'), tdPerson(s,'note2'),
      tdPerson(s,'technical'), tdText(s,'emcee'), SCORED.has(s.type)&&/Plenary|Parallel/.test(s.type)?tdPerson(s,'moderator'):el('td',{class:'muted'},'—'),
      cCheck(s,'bios'), cCheck(s,'questions'), cCheck(s,'materials'), cCheck(s,'seating'), cCheck(s,'agendaM2M'),
      el('td',{}, tag), EDIT?rowActionsTd(DATA.sessions,s):null
    ].filter(Boolean);
    const tr=el('tr',{}, cells);
    if(s.flag){ tr.title=s.flag; }
    return tr;
  });
  v.appendChild(el('div',{class:'tablewrap'}, el('table',{},[ el('thead',{},el('tr',{},headers.map(h=>el('th',{},h)))), el('tbody',{},trs) ])));

  // flags note
  const flagged=list.filter(s=>s.flag);
  if(flagged.length) v.appendChild(el('div',{class:'panel',style:'margin-top:14px'},[
    el('h2',{},['Source inconsistencies to confirm', el('span',{class:'hint'},'flagged, not silently changed')]),
    el('div',{}, flagged.map(s=>el('div',{style:'padding:5px 0;border-top:1px solid var(--line-soft);font-size:12.5px'},[
      el('span',{class:'flagcell'},'⚑ '), el('b',{}, short(s.session)+': '), s.flag ])))
  ]));
  if(EDIT) v.appendChild(el('button',{class:'btn-mini',style:'margin-top:10px',onclick:()=>{DATA.sessions.push({id:'sess'+Date.now(),date:'2026-09-07',time:'',room:'',session:'',type:'Plenary',lead:'To be assigned',support:'To be assigned',note1:'To be assigned',note2:'To be assigned',technical:'To be assigned',emcee:'',moderator:'To be assigned',biosOwner:'',expected:'',seating:'',keyLink:'',flag:'',c:{}});markDirty();render();}},'+ Add session'));

  // panelist tracker
  v.appendChild(el('h2',{class:'section-title',style:'margin-top:26px'},'Panelist tracker'));
  const pcols=['Session','Panelist','Organisation','Designation','Confirmed','Bio','Photo','Contact','Info shared','Follow-up','Notes', EDIT?'':null].filter(x=>x!==null);
  const ptrs=DATA.panelists.map(p=>[
    tdText(p,'session',{area:true}), tdText(p,'panelist'), tdText(p,'org'), tdText(p,'designation'),
    tdText(p,'confirmation'), tdText(p,'bio'), tdText(p,'photo'), tdText(p,'contact'), tdText(p,'infoShared'),
    tdText(p,'followUp'), tdText(p,'notes',{area:true}), EDIT?rowActionsTd(DATA.panelists,p):null
  ].filter(Boolean));
  v.appendChild(el('div',{class:'tablewrap'}, ptrs.length? el('table',{},[el('thead',{},el('tr',{},pcols.map(h=>el('th',{},h)))),el('tbody',{},ptrs.map(c=>el('tr',{},c)))]) : el('div',{class:'muted',style:'padding:12px'},'No panelists added yet. Use the master List of Panelists doc, then add rows here as they confirm.')));
  if(EDIT) v.appendChild(el('button',{class:'btn-mini',style:'margin-top:10px',onclick:()=>{DATA.panelists.push({session:'',panelist:'',org:'',designation:'',confirmation:'Pending',bio:'No',photo:'No',contact:'',infoShared:'No',followUp:'',notes:''});markDirty();render();}},'+ Add panelist'));

  v.appendChild(el('div',{class:'panel',style:'margin-top:16px'},[ el('h2',{},'Standard panelist message'),
    el('div',{class:'muted',style:'font-size:12.5px;line-height:1.6'}, '“We have also drafted your bio based on the public information available on the web, and the same has been attached for your kind review. We also request that you kindly share a high-resolution photograph for the outreach collaterals.”') ]));
}
function cCheck(s,key){ if(!s.c)s.c={}; const c=el('input',{type:'checkbox',...(s.c[key]?{checked:'checked'}:{})}); c.disabled=!EDIT; c.addEventListener('change',()=>{s.c[key]=c.checked;markDirty();softRerender();}); return el('td',{style:'text-align:center'}, c); }

/* ---------------- 05 Documents & coordination ---------------- */
let docFilter='';
function renderDocs(v){
  v.appendChild(el('h2',{class:'section-title'},'Documents & coordination'));
  v.appendChild(el('div',{class:'toolbar'},[ filterSel('Type',['',...DOCTYPE],docFilter,x=>{docFilter=x;render();}),
    el('div',{class:'count-chip'},'One table for documents, moderator questions, technical materials, logos, printing, reports and more.') ]));
  const rows=DATA.docs.filter(d=>!docFilter||d.type===docFilter);
  const headers=['Type','Item','Session/Workstream','Responsible','Status','Deadline','Link','Notes', EDIT?'':null].filter(x=>x!==null);
  const trs=rows.map(d=>{ const cells=[ tdSelect(d,'type',DOCTYPE), tdText(d,'item',{area:true}), tdText(d,'sessionWorkstream'), tdPerson(d,'responsible'),
      tdSelect(d,'status',STATUS,{pill:true}), tdText(d,'deadline',{ph:'YYYY-MM-DD'}), tdLink(d,'link'), tdText(d,'notes',{area:true}), EDIT?rowActionsTd(DATA.docs,d):null ].filter(Boolean);
    const tr=el('tr',{},cells); if(overdue(d)) tr.classList.add('overdue'); return tr; });
  v.appendChild(el('div',{class:'tablewrap'}, el('table',{},[ el('thead',{},el('tr',{},headers.map(h=>el('th',{},h)))), el('tbody',{},trs) ])));
  if(EDIT) v.appendChild(el('button',{class:'btn-mini',style:'margin-top:10px',onclick:()=>{DATA.docs.unshift({id:'doc'+Date.now(),type:'Document',item:'',sessionWorkstream:'',responsible:'To be assigned',status:'Not started',deadline:'',link:'',notes:''});markDirty();render();}},'+ Add item'));

  v.appendChild(el('div',{class:'panel',style:'margin-top:16px'},[ el('h2',{},'Technical cut-off — important'),
    el('div',{class:'muted',style:'font-size:12.5px;line-height:1.6'},[ 'All final PPTs and videos must reach the central technical PoC before the cut-off (currently ',
      el('b',{}, DATA.eventControl.techCutoff||'to be set'),'). Do not let session teams send files on the day. Keep a backup copy of every critical presentation and video.' ]) ]));

  // Team directory (reference — from the CEEW team list)
  if(Array.isArray(DATA.directory) && DATA.directory.length){
    const dir=DATA.directory.slice().sort((a,b)=>a.name.localeCompare(b.name));
    const drows=dir.map(p=>el('tr',{},[
      el('td',{}, DATA.seniorStaff.includes(p.name)? el('span',{},[p.name,' ',el('span',{class:'pill High',style:'font-size:10px'},'Lead')]) : p.name),
      el('td',{class:'muted'}, p.role||'—'),
      el('td',{}, p.email? el('a',{href:'mailto:'+p.email}, p.email) : el('span',{class:'muted'},'—'))
    ]));
    v.appendChild(el('div',{class:'panel',style:'margin-top:16px'},[
      el('h2',{},'Team directory'),
      el('div',{class:'muted',style:'font-size:12px;margin-bottom:8px'}, dir.length+' people. Programme leads are marked; the dashboard flags a lead if placed in an operational note-taking or support role.'),
      el('div',{class:'tablewrap'}, el('table',{},[ el('thead',{},el('tr',{},['Name','Role','Email'].map(h=>el('th',{},h)))), el('tbody',{},drows) ])),
      (DATA.extras&&DATA.extras.length)? el('div',{class:'muted',style:'font-size:11.5px;margin-top:8px;line-height:1.5'}, '⚑ Also referenced from the event-day responsibility sheets but not in the CEEW team directory: '+DATA.extras.join(', ')+'. Confirm names/roles for these.') : ''
    ]));
  }
}

/* ---------------- 06 Event day ---------------- */
function renderEventDay(v){
  v.appendChild(el('h2',{class:'section-title'},'Event day'));
  v.appendChild(el('div',{class:'subtabs'},[
    subtab('a','One-day-before checklist'), subtab('b','7 September — run of show'),
    subtab('c','8 September — run of show'), subtab('d','Do’s & don’ts')
  ]));
  if(EVENTDAY_SUB==='a') renderDayBefore(v);
  else if(EVENTDAY_SUB==='b') renderRun(v,'2026-09-07');
  else if(EVENTDAY_SUB==='c') renderRun(v,'2026-09-08');
  else renderDoDont(v);
}
function subtab(k,label){ return el('button',{class:'subtab'+(EVENTDAY_SUB===k?' active':''), onclick:()=>{EVENTDAY_SUB=k;render();}}, label); }
function renderDayBefore(v){
  const groups={}; DATA.eventDay.dayBeforeChecklist.forEach(c=>{(groups[c.section]=groups[c.section]||[]).push(c);});
  const done=DATA.eventDay.dayBeforeChecklist.filter(c=>c.done).length, tot=DATA.eventDay.dayBeforeChecklist.length;
  v.appendChild(el('div',{class:'panel'},[ el('h2',{},['One-day-before checklist', el('span',{class:'hint'},`${done}/${tot} done`)]),
    el('div',{class:'progressbar'}, el('i',{style:`width:${Math.round(done/tot*100)}%`})),
    ...Object.entries(groups).map(([sec,items])=> el('div',{class:'chk-group'},[ el('h4',{},sec),
      el('div',{class:'checklist'}, items.map(item=>{ const c=el('input',{type:'checkbox',...(item.done?{checked:'checked'}:{})}); c.disabled=!EDIT;
        c.addEventListener('change',()=>{item.done=c.checked;markDirty();renderEventDay(clear(v));}); return el('div',{class:'checkitem'+(item.done?' done':'')},[c,el('label',{},item.label)]); })) ]))
  ]));
}
function renderRun(v,date){
  const rows=DATA.eventDay.runOfShow.filter(r=>r.date===date);
  const headers=['Time','Location','Task','Responsible','Backup','Status','Notes', EDIT?'':null].filter(x=>x!==null);
  const trs=rows.map(r=>[ tdText(r,'time'), tdText(r,'location'), tdText(r,'task',{area:true}), tdPerson(r,'responsible'), tdPerson(r,'backup'),
    tdSelect(r,'status',STATUS,{pill:true}), tdText(r,'notes',{area:true}), EDIT?rowActionsTd(DATA.eventDay.runOfShow,r):null ].filter(Boolean));
  v.appendChild(el('div',{class:'panel'},[ el('h2',{},[`${dLabel(date)} — run of show`, el('span',{class:'hint'},'who → does what → where → by when')]),
    el('div',{class:'tablewrap'}, el('table',{},[ el('thead',{},el('tr',{},headers.map(h=>el('th',{},h)))), el('tbody',{},trs.map(c=>el('tr',{},c))) ])) ]));
  if(EDIT) v.appendChild(el('button',{class:'btn-mini',style:'margin-top:10px',onclick:()=>{DATA.eventDay.runOfShow.push({id:'r'+Date.now(),date,time:'',location:'',task:'',responsible:'To be assigned',backup:'',status:'Not started',dependency:'',notes:''});markDirty();render();}},'+ Add run-of-show item'));
}
function renderDoDont(v){
  const dos=['Arrive before your reporting time.','Know your exact responsibility.','Keep the minute-by-minute agenda accessible.','Keep moderator questions ready.','Check the room before the session begins.','Check technical requirements before the session.','Keep backup copies of important files.','Stay reachable on the designated channel.','Inform the lead immediately about delays/issues.','Confirm handovers rather than assuming.','Check the next session before leaving your post.','Keep transitions on time.'];
  const donts=['Don’t leave your position without informing the lead/backup.','Don’t assume someone else has completed a task.','Don’t make last-minute changes without informing the session lead.','Don’t assign one person to two simultaneous responsibilities.','Don’t wait until the session begins to find a missing PPT.','Don’t depend on one copy of a critical file.','Don’t leave seating requirements unclear.','Don’t give senior programme staff small operational duties.','Don’t allow unresolved problems to remain unreported.'];
  v.appendChild(el('div',{class:'dodont'},[
    el('div',{class:'dobox do'},[ el('h4',{},'Do'), el('ul',{}, dos.map(d=>el('li',{},d))) ]),
    el('div',{class:'dobox dont'},[ el('h4',{},'Don’t'), el('ul',{}, donts.map(d=>el('li',{},d))) ])
  ]));
}

/* ---------------- data / sync ---------------- */
async function load(){
  try{
    const r=await fetch('/api/data'); const d=await r.json();
    DATA=d; BASE_VERSION=d.meta.version; SERVER_NEWER=false; DIRTY=false;
    const b=$('#saveBtn'); b.classList.remove('dirty');
    populateTeamSelect(); renderActive();
  }catch(e){ toast('Could not load data. Is the server running?','err'); }
}
async function poll(){
  if(DIRTY) { // check if server moved ahead of our base version
    try{ const r=await fetch('/api/data'); const d=await r.json(); if(d.meta.version!==BASE_VERSION){ SERVER_NEWER=true; renderActive(); } }catch(e){}
    return;
  }
  try{ const r=await fetch('/api/data'); const d=await r.json();
    if(d.meta.version!==BASE_VERSION){ DATA=d; BASE_VERSION=d.meta.version; renderActive(); } }catch(e){}
}
async function save(){
  if(!EDIT) return;
  const b=$('#saveBtn'); b.textContent='Saving…';
  try{
    const r=await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json','x-editor-key':EDITOR_KEY},
      body:JSON.stringify({data:DATA, baseVersion:BASE_VERSION, editorName:EDITOR_NAME})});
    const res=await r.json();
    if(r.status===409){ toast(res.error,'err'); if(res.current){ SERVER_NEWER=true; } b.textContent='Save changes'; renderActive(); return; }
    if(!r.ok){ toast(res.error||'Save failed','err'); b.textContent='Save changes'; return; }
    BASE_VERSION=res.version; DATA.meta.version=res.version; DATA.meta.updatedAt=res.updatedAt; DATA.meta.updatedBy=res.updatedBy;
    DIRTY=false; SERVER_NEWER=false; b.classList.remove('dirty'); b.textContent='Saved ✓'; setTimeout(()=>b.textContent='Save changes',1500);
    toast('Saved — everyone will see this on their next refresh.','ok'); renderActive();
  }catch(e){ toast('Save failed — network error.','err'); b.textContent='Save changes'; }
}

/* ---------------- edit gate ---------------- */
function populateTeamSelect(){
  const g=$('#gateName'); if(!g||!DATA) return; g.innerHTML='';
  DATA.team.filter(p=>p!=='To be assigned').forEach(p=>g.appendChild(el('option',{value:p},p)));
}
function openGate(){ $('#gateError').hidden=true; $('#gateKey').value=''; $('#gate').hidden=false; $('#gateKey').focus(); }
async function confirmGate(){
  const key=$('#gateKey').value, name=$('#gateName').value;
  try{
    const r=await fetch('/api/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key})});
    const res=await r.json();
    if(!res.ok){ const e=$('#gateError'); e.textContent='That passcode isn’t right. Ask the event coordinator.'; e.hidden=false; return; }
    EDITOR_KEY=key; EDITOR_NAME=name; EDIT=true; $('#gate').hidden=true; renderActive();
    toast('Editing enabled. Remember to Save.','ok');
  }catch(e){ const el2=$('#gateError'); el2.textContent='Could not verify — is the server running?'; el2.hidden=false; }
}
function stopEditing(){
  if(DIRTY && !confirm('You have unsaved changes. Leave editing and discard them?')) return;
  EDIT=false; EDITOR_KEY=''; DIRTY=false; SERVER_NEWER=false;
  const b=$('#saveBtn'); b.classList.remove('dirty');
  load();
}

/* ---------------- wire up ---------------- */
$('#tabs').addEventListener('click',e=>{ const t=e.target.closest('.tab'); if(!t)return; $$('.tab').forEach(x=>x.classList.remove('active')); t.classList.add('active'); ACTIVE_TAB=t.dataset.tab; renderActive(); });
$('#refreshBtn').addEventListener('click',()=>{ if(DIRTY && !confirm('Refreshing will load the latest saved version and discard your unsaved edits. Continue?')) return; load(); toast('Refreshed.','ok'); });
$('#editToggle').addEventListener('click',()=>{ if(EDIT) stopEditing(); else openGate(); });
$('#saveBtn').addEventListener('click',save);
$('#gateCancel').addEventListener('click',()=>$('#gate').hidden=true);
$('#gateConfirm').addEventListener('click',confirmGate);
$('#gateKey').addEventListener('keydown',e=>{ if(e.key==='Enter') confirmGate(); });
window.addEventListener('beforeunload',e=>{ if(DIRTY){ e.preventDefault(); e.returnValue=''; } });

load().then(()=>{ POLL=setInterval(poll, 20000); });
