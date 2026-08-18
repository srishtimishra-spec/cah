/*
 * build-seed.js
 * Builds data/data.default.json for the Clean Air Horizons 2026 Command Centre.
 * All content below is transcribed from the CEEW source files:
 *   - CA - Clean Air Horizons Agenda 2026 (13 Aug 26)
 *   - CA - Session PoCs for CAH (23 Jul 26)
 *   - IJ - Responsibility Sheet (7-8 Sep)
 *   - MSA - CAC event responsibility and checklist (1 Jul 26)
 * Where sources disagree, the row carries a "flag" note rather than a silent fix.
 * No people or facts have been invented.
 */
const fs = require('fs');
const path = require('path');

let _id = 0;
const id = (p) => `${p}-${++_id}`;

// ---- CEEW team directory (authoritative list supplied by the coordinator) ----
const directory = [
  { name: 'Aadya Saxena',        email: 'aadya.saxena@ceew.in',        role: 'Consultant' },
  { name: 'Anwesha',            email: 'anweshasarma.ceew@gmail.com', role: 'Consultant' },
  { name: 'Abhishek Dhiman',     email: 'abhishek.dhiman@ceew.in',     role: 'Programme Lead' },
  { name: 'Apaar Srivastava',    email: 'apaar.srivastava@ceew.in',    role: 'Programme Associate' },
  { name: 'Arpan Patra',         email: 'arpan.patra@ceew.in',         role: 'Programme Lead' },
  { name: 'Ayushi Saxena',       email: 'saxena.ayushi1294@gmail.com', role: 'Consultant' },
  { name: 'Ayushman Saboo',      email: 'ayushman.saboo@ceew.in',      role: 'Research Analyst' },
  { name: 'Evita Xavier',        email: 'evita.xavier@ceew.in',        role: 'Research Analyst' },
  { name: 'Hladinee Borgohain',  email: 'hladinee.borgohain@gmail.com',role: 'Consultant' },
  { name: 'Gayathri Anand',      email: 'gayathri.anand@ceew.in',      role: 'Programme Assistant' },
  { name: 'Khushi Sharma',       email: 'khushi.sharma@ceew.in',       role: 'Research Analyst' },
  { name: 'Kurinji Kemanth',     email: 'kurinji.Selvaraj@ceew.in',    role: 'Programme Lead' },
  { name: 'Rafi',                email: 'mohammad.rafiuddin@ceew.in',  role: 'Programme Lead' },
  { name: 'Soumya Tyagi',        email: 'soumyaty@gmail.com',          role: 'Intern' },
  { name: 'Sahbaz',              email: 'mohammed.ahmed@ceew.in',      role: 'Programme Associate' },
  { name: 'Navjot',              email: 'navjot.sarao@ceew.in',        role: 'Consultant' },
  { name: 'Prarthana Borah',     email: 'prarthana.borah@ceew.in',     role: 'Fellow, Team Lead' },
  { name: 'Prince Sant',         email: 'prince.sant@ceew.in',         role: 'Consultant' },
  { name: 'Priyanka Singh',      email: 'priyanka.singh@ceew.in',      role: 'Senior Programme Lead' },
  { name: 'Rahul Das',           email: 'rahul.das@ceew.in',           role: 'Programme Associate' },
  { name: 'Rinuragavi V N',      email: 'rinuragavi.vn@ceew.in',       role: 'Consultant' },
  { name: 'Rishikesh P',         email: 'rishikesh.p@ceew.in',         role: 'Research Analyst' },
  { name: 'Rochishnu Dutta',     email: 'rochishnu.dutta@ceew.in',     role: 'Consultant' },
  { name: 'Sankalp Kumar',       email: 'sankalp.kumar@ceew.in',       role: 'Programme Associate' },
  { name: 'Shailja Singla',      email: 'shailja.singla@ceew.in',      role: 'Consultant' },
  { name: 'Shruti Tripathi',     email: 'shruti.tripathi@ceew.in',     role: 'Consultant' },
  { name: 'Shubhi Verma',        email: 'shubhi.verma@ceew.in',        role: 'Research Analyst' },
  { name: 'Sneha Maria Ignatious',email:'sneha.ignatious@ceew.in',     role: '' },
  { name: 'Srish Prakash',       email: 'srish.prakash@ceew.in',       role: 'Consultant' },
  { name: 'Srishti Jain',        email: 'srishti.jain@ceew.in',        role: 'Research Analyst' },
  { name: 'Srishti Mishra',      email: 'srishti.mishra@ceew.in',      role: 'Research Analyst' },
  { name: 'Sunita Patra',        email: 'sunita.patra@ceew.in',        role: 'Programme Associate' },
  { name: 'Surya Shekhar Auddy', email: 'surya.auddy@ceew.in',         role: 'Research Analyst' },
  { name: 'Urvika',             email: 'urvika.goel@ceew.in',         role: 'Consultant' },
  { name: 'V V Nandagopan',      email: 'vv.nandagopan@ceew.in',       role: 'Consultant' },
  { name: 'Viraj Joshi',         email: 'viraj.joshi@ceew.in',         role: 'Research Analyst' },
  { name: 'Vishwas Desai',       email: 'vishwas.desai@ceew.in',       role: 'Research Analyst' }
];

// Programme Leads / Team Lead / Fellow — flagged if placed in operational note-taking/support roles.
const seniorStaff = [
  'Prarthana Borah', 'Priyanka Singh', 'Kurinji Kemanth', 'Rafi',
  'Abhishek Dhiman', 'Arpan Patra'
];

/* Map the short names used in the source PoC/responsibility sheets to the canonical
 * directory names. "Srish" -> "Srish Prakash" and "Sunita" -> "Sunita Patra" resolve
 * the ambiguities flagged earlier; these two remain worth a human confirm because the
 * source wrote only the first name. Names not in the directory (event-day AV/setup
 * helpers from the responsibility sheet, e.g. Ajit Mishra, Yadu Kathuria, Iris James)
 * are retained as-is so no real assignment is lost. */
const NAME_MAP = {
  'Aadya':'Aadya Saxena', 'Apaar':'Apaar Srivastava', 'Ayushi':'Ayushi Saxena',
  'Ayushman':'Ayushman Saboo', 'Evita':'Evita Xavier', 'Khushi':'Khushi Sharma',
  'Rahul':'Rahul Das', 'Rochishnu':'Rochishnu Dutta', 'Soumya':'Soumya Tyagi',
  'Srish':'Srish Prakash', 'Sunita':'Sunita Patra', 'Surya':'Surya Shekhar Auddy',
  'Rishi':'Rishikesh P'
};
const mapName = (v) => {
  if (!v || v === 'To be assigned') return v;
  return String(v).split(',').map(s => { const t = s.trim(); return NAME_MAP[t] || t; }).join(', ');
};

// ---- Master links (from the brief) ----
const links = [
  { resource: 'Master Event Drive', purpose: 'Main event repository', owner: 'To be assigned', url: 'https://drive.google.com/drive/u/0/folders/1ibAEMn6ljuuJFGEyX5Jf-Pn7IZPR9ssy' },
  { resource: 'Logos of Partner-led Sessions', purpose: 'Partner/session logos', owner: 'To be assigned', url: 'https://docs.google.com/document/d/1rFa54_cuZRJWJR7yVc0VGPg0CGnUK6xWm2K6ziB-7tA/edit' },
  { resource: 'Master Sheet for Responsibilities', purpose: 'Existing responsibility master sheet', owner: 'To be assigned', url: 'https://docs.google.com/spreadsheets/d/1adLSxxzO767Bi_oaJZk8LHIsOTUFmPkRyJu-bnTAQEQ/edit' },
  { resource: 'Bios', purpose: 'Master bios document', owner: 'Aadya', url: 'https://docs.google.com/document/d/17RDDxFlDNVPtnlxlAow6FUpeMZCictAoxljk2rODjyQ/edit' },
  { resource: 'Partner-led Session Template', purpose: 'Template for partner-led sessions', owner: 'To be assigned', url: 'https://docs.google.com/document/d/1UvzaPlvyBVob0Ha1qQ62fHoLfX4Xx89ZVH3LLlRhK9A/edit' },
  { resource: 'Session Calendar & PoCs', purpose: 'Existing session calendar', owner: 'To be assigned', url: 'https://docs.google.com/spreadsheets/d/1aRtHA_llJF1NJxgQiOesIDv7HaqSFeHG95c1t8f2YPM/edit' },
  { resource: 'Draft Invitation Letters', purpose: 'Draft letters', owner: 'Khushi', url: 'https://docs.google.com/document/d/15jHJfoLPy43g79PdhGF2Sx-z5JvQTxpE918pfNyZUQY/edit' },
  { resource: 'List of Panelists', purpose: 'Master panelist list', owner: 'To be assigned', url: 'https://docs.google.com/spreadsheets/d/1zWKvJ9Fd3EzoyePYT97HDLqaMeCEj4GwY3BxnPoaQmk/edit' },
  { resource: 'Event Agenda', purpose: 'Master agenda', owner: 'Sahbaz', url: 'https://docs.google.com/document/d/1Ykq5feGJuP1LUFm_bn8MqOgSY-zpV_1xjv9NG6AVcaE/edit' }
];

// ---- Sessions (Day 1 = 2026-09-07, Day 2 = 2026-09-08) ----
// readiness component flags default false; breaks/networking are type "Logistics" (not scored)
const S = (o) => Object.assign({
  id: id('sess'), room: '', type: 'Plenary', lead: 'To be assigned', support: 'To be assigned',
  note1: 'To be assigned', note2: 'To be assigned', technical: 'To be assigned',
  emcee: '', moderator: 'To be assigned', biosOwner: '', expected: '', seating: 'Cluster (round tables, 6 chairs)',
  keyLink: '', flag: '',
  c: {} // readiness checklist components
}, o);

const READY_KEYS = ['moderator','panelists','bios','photos','questions','materials','videos','logos','seating','agendaM2M','printing','techCheck'];
const emptyC = () => READY_KEYS.reduce((a,k)=>(a[k]=false,a),{});

const sessions = [
  // ---------------- DAY 1 ----------------
  S({ date:'2026-09-07', time:'09:30 - 10:30', room:'Both', session:'Registration and Tea', type:'Logistics', lead:'Yadu Kathuria', support:'Iris James', moderator:'', note1:'', note2:'', biosOwner:'' }),
  S({ date:'2026-09-07', time:'10:30 - 12:00', room:'Silver Oak', session:'Inaugural Address', type:'Ceremony', lead:'Priyanka Singh', support:'Sahbaz', biosOwner:'Aadya', emcee:'Aadya' }),
  S({ date:'2026-09-07', time:'12:00 - 12:15', room:'Silver Oak', session:'Report launches (5 launches)', type:'Ceremony', lead:'Rahul', support:'Niharika', biosOwner:'Aadya', flag:'Co-PoCs: Rahul, Srishti, Niharika' }),
  S({ date:'2026-09-07', time:'12:15 - 13:15', room:'Silver Oak', session:'Plenary 1: AI for Clean Air — Faster and better AQ management', type:'Plenary', lead:'Rafi', biosOwner:'Aadya' }),
  S({ date:'2026-09-07', time:'12:15 - 13:15', room:'Magnolia', session:'CA-led parallel 1: Schools for Circular Labs — Empowering Students as Environmental Stewards', type:'Parallel (CA-led)', lead:'Srishti Mishra', biosOwner:'Ayushi' }),
  S({ date:'2026-09-07', time:'13:15 - 14:15', room:'Both', session:'Networking Lunch', type:'Logistics', lead:'Yadu Kathuria', support:'Iris James', moderator:'', note1:'', note2:'', biosOwner:'' }),
  S({ date:'2026-09-07', time:'14:15 - 15:15', room:'Silver Oak', session:'Plenary 2: Promoting electric cooking in low-income households', type:'Plenary', lead:'Surya', biosOwner:'Aadya' }),
  S({ date:'2026-09-07', time:'14:15 - 15:15', room:'Magnolia', session:'Partner-led parallel 1: IIT Gandhinagar', type:'Parallel (Partner-led)', lead:'Rafi', support:'Shubhi Verma', biosOwner:'Soumya' }),
  S({ date:'2026-09-07', time:'15:15 - 16:15', room:'Silver Oak', session:'CA-led parallel 2: Voices from the ground', type:'Parallel (CA-led)', lead:'Sunita', support:'Soumya', biosOwner:'Aadya', flag:'Title differs across sources — PoC sheet labels CA-led 2 as "Evidence, Institutions and Investment: Making State Clean Air Missions Work" (PoC Abhishek Dhiman, Ayushi). Confirm which is correct.' }),
  S({ date:'2026-09-07', time:'15:15 - 16:15', room:'Magnolia', session:'CA-led parallel 3: Air — The Missing Link in MSME Transition', type:'Parallel (CA-led)', lead:'Sunita', support:'Srish', biosOwner:'Ayushi', flag:'"Srish" / "Srishti Mishra" appear separately in sources — confirm if same person.' }),
  S({ date:'2026-09-07', time:'16:15 - 16:30', room:'Both', session:'Tea Break', type:'Logistics', lead:'Yadu Kathuria', support:'Iris James', moderator:'', note1:'', note2:'', biosOwner:'' }),
  S({ date:'2026-09-07', time:'16:30 - 17:30', room:'Silver Oak', session:'Plenary 3: Aligning private investments with India\u2019s clean air priorities', type:'Plenary', lead:'Arpan Patra', support:'Rakshita', biosOwner:'Aadya' }),
  S({ date:'2026-09-07', time:'16:30 - 17:30', room:'Magnolia', session:'Partner-led parallel 2: Decision Support Systems for preventive mobility (Sustainable Mobility)', type:'Parallel (Partner-led)', lead:'Apaar', biosOwner:'Soumya' }),
  S({ date:'2026-09-07', time:'17:30 - 18:30', room:'Silver Oak', session:'Voice, Visibility and Vision: Clean Air, Young Ideas (Cultural Program)', type:'Cultural', lead:'Aadya', biosOwner:'Aadya', moderator:'' }),
  S({ date:'2026-09-07', time:'18:30 - 21:00', room:'Silver Oak', session:'Networking Dinner', type:'Logistics', lead:'Yadu Kathuria', support:'Iris James', moderator:'', note1:'', note2:'', biosOwner:'' }),

  // ---------------- DAY 2 ----------------
  S({ date:'2026-09-08', time:'10:00 - 11:00', room:'Silver Oak', session:'Plenary 4: Special opening plenary — Global Economic Assessment of Integrated Climate and Clean Air Action (with CCAC)', type:'Plenary', lead:'Priyanka Singh', support:'Sahbaz', biosOwner:'Aadya' }),
  S({ date:'2026-09-08', time:'11:00 - 12:00', room:'Silver Oak', session:'Plenary 5: Circular solutions for clean air in cities (WCEF Side Event)', type:'Plenary', lead:'Ayushman', biosOwner:'Aadya' }),
  S({ date:'2026-09-08', time:'11:00 - 12:00', room:'Magnolia', session:'Partner-led parallel 3: AI-Enabled Behavioral Solutions for Clean Air (ABCD)', type:'Parallel (Partner-led)', lead:'Srishti Jain', biosOwner:'Soumya' }),
  S({ date:'2026-09-08', time:'12:00 - 13:00', room:'Silver Oak', session:'Plenary 6: Scaling clean air solutions — From Blueprint to Breath', type:'Plenary', lead:'Kurinji Kemanth', biosOwner:'Aadya' }),
  S({ date:'2026-09-08', time:'12:00 - 13:00', room:'Magnolia', session:'CA-led parallel 4: Cleaning the air through ecological restoration — Greening Indian cities', type:'Parallel (CA-led)', lead:'Rochishnu', biosOwner:'Ayushi' }),
  S({ date:'2026-09-08', time:'13:00 - 14:00', room:'Both', session:'Networking Lunch', type:'Logistics', lead:'Yadu Kathuria', support:'Iris James', moderator:'', note1:'', note2:'', biosOwner:'' }),
  S({ date:'2026-09-08', time:'14:00 - 15:00', room:'Silver Oak', session:'CA-led parallel 5: Global Carbon and Local Air — What ESG Reporting is missing', type:'Parallel (CA-led)', lead:'Shubhi Verma', biosOwner:'Ayushi', flag:'PoC sheet titles this "Strengthening Air Emissions Disclosures in ESG Reporting" — confirm final title.' }),
  S({ date:'2026-09-08', time:'14:00 - 15:00', room:'Magnolia', session:'CA-led parallel 6: Women and Air — Women Leading India\u2019s Clean Air Battle', type:'Parallel (CA-led)', lead:'Kurinji Kemanth', biosOwner:'Ayushi' }),
  S({ date:'2026-09-08', time:'15:00 - 16:00', room:'Silver Oak', session:'Partner-led parallel 4: Clean Air Through Dignity and Livelihoods (Purpose)', type:'Parallel (Partner-led)', lead:'Khushi', biosOwner:'Soumya' }),
  S({ date:'2026-09-08', time:'15:00 - 16:00', room:'Magnolia', session:'CA-led parallel 7: Workshop with MCD officials on Bulk Waste Generators (BWG)', type:'Parallel (CA-led)', lead:'Aadya', biosOwner:'Ayushi', flag:'Title varies across sources (BWG implementation compliance / MCD workshop / challenges & opportunities). Confirm final title.' }),
  S({ date:'2026-09-08', time:'16:00 - 16:45', room:'Silver Oak', session:'Partner-led parallel 5: From Awareness to Action — Youth, Cities & Cross-Sector Partnerships (GoSharpener)', type:'Parallel (Partner-led)', lead:'Shailja Singla', support:'Srishti Mishra', biosOwner:'Soumya' }),
  S({ date:'2026-09-08', time:'16:45 - 17:00', room:'Silver Oak', session:'Valedictory Session', type:'Ceremony', lead:'To be assigned', emcee:'To be assigned', moderator:'', biosOwner:'' }),
  S({ date:'2026-09-08', time:'To confirm', room:'To confirm', session:'CA-led parallel 8: Air quality resilience', type:'Parallel (CA-led)', lead:'Viraj Joshi', biosOwner:'Ayushi', flag:'Listed in Session PoCs but not on the Final Calendar — confirm whether/where this is scheduled.' })
];
sessions.forEach(s => { if (!s.c || Object.keys(s.c).length===0) s.c = emptyC(); });

// ---- Before Event tasks (from MSA checklist; Excel serial dates -> ISO) ----
// status mapping: Completed / In progress / Not started ("Not Initiated") 
const st = (s) => ({ 'Completed':'Completed', 'In progress':'In progress', 'Not Initiated':'Not started', 'Not started':'Not started' }[s] || 'Not started');
const B = (workstream, task, session, responsible, support, deadline, status, link, notes) => ({
  id: id('be'), workstream, task, session: session||'', responsible: responsible||'To be assigned',
  support: support||'', deadline: deadline||'', priority: 'Medium', status: st(status), dependency:'', link: link||'', notes: notes||''
});

const beforeEvent = [
  // A. Preparing content
  B('Documents','Concept note','','Sahbaz','Priyanka Singh, Prarthana Borah','2026-07-24','Completed','CA - Concept note and agenda 10 Jul 26','Send mail to outreach'),
  B('Documents','Agenda','','Sahbaz','Priyanka Singh, Prarthana Borah','2026-07-24','Completed','CA - Clean Air Horizons Agenda 2026 13 Aug 26','Send mails to colleagues, then call with outreach'),
  B('Admin','Common email for the CAH secretariat','','Sahbaz','Ajit Mishra','2026-07-21','Completed','cah@ceew.in',''),
  B('Outreach','Writing to Outreach about the event (email)','','Sahbaz','','','Completed','',''),
  B('Panelists','Participant invitee list','','To be assigned','','','Completed','CA - List of Invitees 07 Jul 26',''),
  B('Logistics','Venue booking','','Sahbaz','Yadu Kathuria, Iris James','','Completed','',''),
  B('Panelists','Finalising the Chief Guest','','Priyanka Singh','Prarthana Borah','2026-08-14','In progress','',''),
  B('Panelists','Finalising experts for panels','','To be assigned','','2026-07-31','In progress','','Project Leads to finalise'),
  B('Documents','Drafting letters for Chief Guests','','Khushi','Evita','2026-07-24','In progress','CA - Draft letters 17 Jul 26; Invitation letters for AG 14 Aug 26','Drafted, awaiting review (PB, PS)'),
  B('Documents','Drafting letters for partner proposals','','Sahbaz','','2026-07-24','Completed','CA - Draft letter for CAH partnership 23 Jul 26','Drafted, awaiting review'),
  B('Outreach','Email for inviting partners for parallel sessions','','Sahbaz','','','Completed','',''),
  B('Panelists','Email draft for the panellists','','Evita','','','Completed','CA - Draft letters 17 Jul 26',''),
  B('Documents','Partner proposal document','','Khushi','Evita','2026-08-10','In progress','CA - CAH-2026 Session template 24 Jul 26',''),
  B('Outreach','Coordinating and sending letters to respective people','','Shubhi Verma','Ganesh, Kakoli','2026-07-31','Not started','',''),
  B('Outreach','Draft email for inviting participants','','Khushi','Iris James','2026-07-24','In progress','CA - Draft email for CAH 05 Aug 26','Drafted, awaiting review'),
  B('Outreach','CAH social media announcement','','Sahbaz','','','Completed','CAH Social media announcements 13 Aug 26',''),
  B('Outreach','Flyer and landing slide for the event','','Sahbaz','Aadya, Iris James','2026-07-31','Completed','',''),
  B('Documents','Briefing note for AG','','Srish','','2026-08-21','Not started','',''),
  B('Documents','Speech & talking points for guests','','Aadya','','2026-08-21','Not started','',''),
  B('Documents','Detailed minute-by-minute agenda','','Evita','','2026-08-21','Not started','','Every session support person needs a printed M2M on event day'),
  B('Sessions','Format of panel discussion','','Sahbaz','','','Not started','',''),
  B('Sessions','Questions for panel discussion','','Sahbaz','','','Not started','',''),
  B('Sessions','Questions for fireside chat','','Sahbaz','','','Not started','',''),
  B('Panelists','Bios and high-res pictures of speakers','','Aadya','Ayushi','','In progress','CA - CAH Bio and high res images 12 Aug 26',''),
  B('Reports/materials','Email for reports on registration desk + QR for reports','','Sahbaz','','','Not started','',''),
  B('Reports/materials','Email for bag/folder for panellists and minister','','Sahbaz','','','Not started','','To be discussed with PB'),
  B('Documents','Email to Outreach for translation of AG brief','','Srish','Rishi','','Not started','',''),
  B('Documents','Keynote address — pointers for ministers','','Aadya','','','Not started','',''),
  // B. Execution
  B('Admin','AG signature for letter','','Shubhi Verma','','','Not started','',''),
  B('Panelists','Formal invitation to Chief Guests','','Priyanka Singh','Prarthana Borah','','Not started','','Coordinate with CEO\u2019s office'),
  B('Panelists','Formal invitation to panellists','','To be assigned','Ganesh, Prarthana Borah','','Not started','',''),
  B('Panelists','Invite and email to the panellists','','To be assigned','Prarthana Borah, Gayathri Anand','','Not started','',''),
  B('Sessions','Minute-to-minute (M2M) event-day coordination schedule','','Evita','','','Not started','',''),
  B('Reports/materials','Memento for the Chief Guests','','Shubhi Verma','','','Not started','',''),
  B('Documents','Prep block for Arunabha','','Sahbaz','','','Not started','',''),
  // C. Content for reports / digital
  B('Website','Website content','','Rahul','Srishti Mishra','','Not started','',''),
  B('Documents','Author quote','','Rahul','Srishti Mishra','','Not started','',''),
  B('Documents','Proof reading','','Rahul','Srishti Mishra','','Not started','',''),
  B('Reports/materials','Digital assets — QR code for agenda and report','','Rahul','Srishti Mishra, Yadu Kathuria, Iris James','','Not started','',''),
  B('Registration','Google Form and WhatsApp for participant registration','','Rahul','Srishti Mishra, Iris James','','Not started','',''),
  B('Press/media','LinkedIn pre-event post','','Evita','Sahbaz, Shreya Kapoor, Iris James','','Not started','',''),
  B('Press/media','LinkedIn post-event post','','Khushi','Sahbaz, Shreya Kapoor, Iris James','','Not started','',''),
  B('Press/media','Press release','','Shubhi Verma','Sahbaz, Arunava, Neera','','Not started','',''),
  B('Sessions','Emcee','','Aadya','','','Not started','',''),
  // Outreach chain from the brief (13)
  B('Outreach','Social media','','Srishti Mishra','Shreya Kapoor','','Not started','','Draft \u2192 Review \u2192 Approval \u2192 Final \u2192 Publish'),
  B('Outreach','Event flyer','','Srishti Mishra','Roxie','','Not started','',''),
  B('Outreach','Registration mass mailer','','Srishti Mishra','Iris James','','Not started','',''),
  B('Press/media','Press release (outreach chain)','','Srishti Mishra','Arunava, Neera','','Not started','',''),
  B('Website','Website update','','Rahul','Shubham','','Not started','','Content \u2192 Draft \u2192 Review \u2192 Submit \u2192 Update \u2192 Final link'),
  B('Outreach','VIP letters','','Shubhi Verma','Veena, Gayathri Anand, Ganesh, Kakoli','','Not started','',''),
  B('Logistics','Standee','','Yadu Kathuria','','','Not started','',''),
  B('Outreach','Logos — event, partner, partner-led sessions (central location)','','To be assigned','','','Not started','Logos of Partner-led Sessions','Use existing Logos doc as source')
];

// ---- Documents & Coordination (technical + reports + moderator questions consolidated) ----
const D = (type, item, sw, responsible, status, deadline, link, notes) => ({
  id: id('doc'), type, item, sessionWorkstream: sw||'', responsible: responsible||'To be assigned',
  status: st(status), deadline: deadline||'', link: link||'', notes: notes||''
});
const docs = [
  D('Report/publication','5 reports for launch','Report launches','Rahul','In progress','','','Titles + QR codes needed; confirm which 5'),
  D('Presentation','Central PPT/video cut-off — all final files to technical PoC','All sessions','To be assigned','Not started','2026-09-04','','Set a firm cut-off; do not accept last-minute files on the day'),
  D('Technical material','Console, laptop, USB, pen drive, AV','Event-wide','Ajit Mishra','Not started','','','Central AV; coordinate all sessions with Ajit ji'),
  D('Moderator questions','Panel discussion questions','All plenaries/panels','Sahbaz','Not started','','','Print and hand to each moderator before the session'),
  D('Moderator questions','Fireside chat questions','As applicable','Sahbaz','Not started','','',''),
  D('Logo','Event + partner + partner-led session logos','Outreach','To be assigned','Not started','Logos of Partner-led Sessions','','One central logo location'),
  D('Document','Minute-by-minute agenda (master + per session)','All sessions','Evita','Not started','','','Printed copy for every session support person'),
  D('Registration','Google Form + WhatsApp registration','Registration','Rahul','Not started','','',''),
  D('Printing','Consolidated print list \u2192 Admin (Samal ji)','Event-wide','To be assigned','Not started','','','Agendas, questions, QR, signage, reports, flyers, standee, badges'),
  D('Meeting notes','Master meeting-notes doc (session-wise sections)','All sessions','To be assigned','Not started','','','One doc, do not create a sheet per session')
];

// ---- Event Day: one-day-before checklist ----
const chk = (section, label) => ({ id:id('c'), section, label, done:false });
const dayBeforeChecklist = [
  ...['Rooms confirmed','Seating confirmed','Moderators confirmed','Panelists confirmed','Bios/photos ready','Questions printed','PPTs received','Videos tested','Technical requirements confirmed','Minute-by-minute agendas printed'].map(l=>chk('Sessions',l)),
  ...['Master agenda','Session agendas','Moderator questions','QR codes','Signage','Reports/publications','Flyers','Standee'].map(l=>chk('Printing',l)),
  ...['Pens','CEEW notepads','What on Earth bookmarks','Name badges','Other materials'].map(l=>chk('Materials',l)),
  ...['Registration list','QR code tested','On-spot registration confirmed','Registration desk staffed'].map(l=>chk('Registration',l)),
  ...['Seating','Room allocation','Signage','Screens','Microphones','Laptops/connections','Presentation setup','Wi-Fi','Water for speakers/panelists'].map(l=>chk('Venue',l))
];

// ---- Event Day: run of show (7 & 8 Sep) built from IJ responsibility sheet ----
const R = (date, time, location, task, responsible, backup, notes) => ({
  id:id('r'), date, time, location, task, responsible: responsible||'To be assigned', backup: backup||'', status:'Not started', dependency:'', notes: notes||''
});
const runDay = (date) => ([
  R(date,'07:00','Venue','Setup begins — Ajit ji, Yadu, Iris on site by 07:00','Ajit Mishra','Yadu Kathuria, Iris James','Rest of team to reach by 07:30'),
  R(date,'07:00','Both halls','Overall setup, tent cards, mics on tables','Iris James','Yadu Kathuria',''),
  R(date,'07:00','Console','Console, laptop & USB, pen drive, audio check','Ajit Mishra','Yadu Kathuria',''),
  R(date,'07:30','Registration desk','Registration desk ready — attendees registered & guided in','Gayathri Anand','To be assigned','Desk PoC to be confirmed; add one intern'),
  R(date,'09:00','Registration desk','Registration and tea; tent cards placed at each table','Iris James','Yadu Kathuria',''),
  R(date,'Ongoing','Both halls','Point of contact for panellists — follow up on speaker ETAs','To be assigned','','Panellist PoC to be confirmed'),
  R(date,'Ongoing','Both halls','Attendee mics for Q&A','To be assigned','','To be confirmed'),
  R(date,'Ongoing','Both halls','Photographer + videographer coordination & briefing','Iris James','Yadu Kathuria','1 photographer + 1 videographer'),
  R(date,'Ongoing','Both halls','Timekeeping','Iris James','','Keep transitions on time'),
  R(date,'Ongoing','Console','Video conferencing and livestream','Ajit Mishra','',''),
  R(date,'Ongoing','Both halls','No plastic bottles; water glasses; tea/coffee','Yadu Kathuria','Iris James',''),
  R(date,'Ongoing','Both halls','Event troubleshooting','Yadu Kathuria','Iris James',''),
  R(date,'Post-session','Both halls','Photos transfer & image selection','Yadu Kathuria','Iris James','After sessions'),
  R(date,'Post-event','Outreach','Social media posts','Shreya Kapoor','Nikita Bhan','After the event'),
  R(date, date==='2026-09-07'?'13:15':'13:00','Both halls','Networking lunch coordination','Yadu Kathuria','Iris James',''),
]);
const runOfShow = [...runDay('2026-09-07'), ...runDay('2026-09-08')];

// ---- One-week-before readiness checklist ----
const oneWeek = [
  'Programme finalised','All session leads confirmed','All supporting persons confirmed','Two note takers assigned to every session','No overlapping note-taker assignments','Moderators confirmed','Panelists confirmed','Pending panelist follow-ups completed','Bios/photos complete','Questions complete','Presentations received','Videos received/tested','Partner logos received','Seating requirements confirmed','Room allocations confirmed','Registration process confirmed','Technical requirements confirmed','Printing requirements consolidated','Reports/materials requirements consolidated','Event-day staffing confirmed','Backups assigned','Minute-by-minute agendas prepared'
].map(l=>({ id:id('ow'), label:l, done:false }));

// ---- Normalise short names to canonical directory names across all assignments ----
sessions.forEach(s => ['lead','support','note1','note2','technical','moderator','emcee'].forEach(k => { if (s[k]) s[k] = mapName(s[k]); }));
links.forEach(l => { l.owner = mapName(l.owner); });
beforeEvent.forEach(t => { t.responsible = mapName(t.responsible); if (t.support) t.support = mapName(t.support); });
docs.forEach(d => { d.responsible = mapName(d.responsible); });
runOfShow.forEach(r => { r.responsible = mapName(r.responsible); r.backup = mapName(r.backup); });

// ---- Dropdown roster: directory names + any other names still referenced in the seed ----
const directoryNames = directory.map(p => p.name);
const referenced = new Set();
const collect = (v) => { if (v && v !== 'To be assigned') String(v).split(',').forEach(s => referenced.add(s.trim())); };
sessions.forEach(s => ['lead','support','note1','note2','technical','moderator','emcee'].forEach(k => collect(s[k])));
links.forEach(l => collect(l.owner));
beforeEvent.forEach(t => { collect(t.responsible); collect(t.support); });
docs.forEach(d => collect(d.responsible));
runOfShow.forEach(r => { collect(r.responsible); collect(r.backup); });
const extras = [...referenced].filter(n => n && !directoryNames.includes(n)).sort(); // event-day/other helpers not in the CEEW team directory
const team = ['To be assigned', ...directoryNames.slice().sort((a,b)=>a.localeCompare(b)), ...extras];

const data = {
  meta: {
    event: 'Clean Air Horizons 2026',
    tagline: 'Achieving India\u2019s Clean Air Ambition',
    dateLabel: '07\u201308 September 2026',
    startDate: '2026-09-07',
    endDate: '2026-09-08',
    venue: 'Silver Oak & Magnolia Hall, India Habitat Centre',
    location: 'New Delhi',
    time: '09:30 \u2013 18:00 IST',
    version: 1,
    updatedAt: new Date().toISOString(),
    updatedBy: 'Seed'
  },
  eventControl: {
    overall: 'Sahbaz',
    technical: 'Ajit Mishra (AV) \u00b7 central coordinator To be finalised (Viraj Joshi / Vishwas Desai)',
    outreach: 'To be assigned',
    admin: 'To be assigned',
    techCutoff: '2026-09-04'
  },
  team, directory, extras, seniorStaff, links,
  sessions, panelists: [], beforeEvent, docs,
  eventDay: { dayBeforeChecklist, runOfShow },
  oneWeek,
  issues: []
};

const outDir = path.join(__dirname, 'data');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'data.default.json'), JSON.stringify(data, null, 2));
console.log('Wrote data/data.default.json');
console.log('  sessions:', sessions.length, '| beforeEvent:', beforeEvent.length, '| docs:', docs.length, '| runOfShow:', runOfShow.length, '| team:', team.length);
