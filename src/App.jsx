import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Clock, Camera, LogOut, ChevronRight, ChevronLeft, Plus, Pause, Play, Check,
  ArrowLeft, Users, Image as ImageIcon, Download, X, MapPin,
  Briefcase, Delete, AlertCircle, UserPlus, Building2,
  Trash2, Eye, EyeOff, LayoutDashboard, FileText, DollarSign,
  Home, Layers, User, Edit2, Copy, Printer, Calendar, HelpCircle,
  MessageCircle, Settings
} from 'lucide-react';

// =================================================================
// 🔧 PASTE YOUR SUPABASE KEYS HERE
// =================================================================
const SUPABASE_URL = "https://bbaynvqnbkjyqhzhhypr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiYXludnFuYmtqeXFoemhoeXByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NzQ2MTMsImV4cCI6MjA5MzA1MDYxM30.ZXUoHFj_IwMe6rX8RxK8Dj4kAB9AS7X9xZAhQ84wDEk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const PHOTO_BUCKET = 'task-photos';
const ASSIGNMENT_BUCKET = 'assignments';
const PM_UPLOAD_BUCKET = 'pm-uploads';
const MESSAGE_BUCKET = 'messages';
const ASSIGNMENT_MAX_SIZE_MB = 20; // sanity cap on upload size

// =================================================================
// Utilities
// =================================================================
const fmtTime = (ms) => {
  if (!ms || ms < 0) return '0:00:00';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
};
const fmtTimeShort = (ms) => {
  if (!ms || ms < 0) return '0m';
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};
const fmtMoney = (n) => {
  if (n == null || isNaN(n)) return '$0.00';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtDate = (ts) => new Date(ts).toLocaleDateString('en-US', { month:'short', day:'numeric' });
const fmtDateLong = (ts) => new Date(ts).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });
const fmtClock = (ts) => new Date(ts).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });

function useTick(active) {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setT(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
}

// Natural sort: '1-101' before '1-102' before '2-101' before '10-101'
// Splits the label into number/non-number chunks and compares chunk by chunk.
function naturalCompare(a, b) {
  const ax = String(a).split(/(\d+)/).filter(Boolean);
  const bx = String(b).split(/(\d+)/).filter(Boolean);
  for (let i = 0; i < Math.max(ax.length, bx.length); i++) {
    if (ax[i] === undefined) return -1;
    if (bx[i] === undefined) return 1;
    const an = parseInt(ax[i], 10);
    const bn = parseInt(bx[i], 10);
    if (!isNaN(an) && !isNaN(bn)) {
      if (an !== bn) return an - bn;
    } else {
      const cmp = ax[i].localeCompare(bx[i]);
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}

// Extract the building prefix from a unit label like "B3-205" → "B3"
// Falls back to first non-numeric prefix, or null if no match.
function buildingFromLabel(label) {
  if (!label) return null;
  const m = String(label).match(/^([A-Za-z]+\d+)/);
  return m ? m[1] : null;
}

const sessionStore = {
  async get() {
    try { const v = localStorage.getItem('tidytrack_session'); return v ? JSON.parse(v) : null; }
    catch { return null; }
  },
  async set(v) { try { localStorage.setItem('tidytrack_session', JSON.stringify(v)); } catch {} },
  async clear() { try { localStorage.removeItem('tidytrack_session'); } catch {} }
};

// =================================================================
// Top-level App
// =================================================================
export default function App() {
  // Hash-based routing so we can have different routes (#/portal, #/staff, etc.)
  // without setting up react-router.
  const [route, setRoute] = useState(() => window.location.hash || '');

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash || '');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Portal route — explicit URL, preserves any existing PM bookmarks
  if (route.startsWith('#/portal') || route.startsWith('#portal')) {
    return <PortalApp />;
  }

  // Staff route — explicit URL, skips landing
  if (route.startsWith('#/staff') || route.startsWith('#staff')) {
    return <StaffApp />;
  }

  // Root URL — show landing UNLESS the device remembers a previous staff sign-in,
  // in which case skip straight to staff sign-in (staff use this app constantly).
  return <RootRouter />;
}

// Decides between LandingPage and StaffApp at the root URL based on remembered choice.
function RootRouter() {
  const [view, setView] = useState(null); // 'staff' | 'landing'

  useEffect(() => {
    try {
      const choice = localStorage.getItem('tt_role_choice');
      if (choice === 'staff') {
        setView('staff');
      } else {
        setView('landing');
      }
    } catch {
      setView('landing');
    }
  }, []);

  if (view === null) return <Splash text="" />;
  if (view === 'staff') return <StaffApp />;

  // Landing page — let user pick
  return (
    <LandingPage
      onPickStaff={() => {
        try { localStorage.setItem('tt_role_choice', 'staff'); } catch {}
        setView('staff');
      }}
      onPickPortal={() => {
        // We don't remember the portal choice (PMs use it rarely, often shared devices).
        // Just navigate to the portal route.
        window.location.hash = '#/portal';
      }}
    />
  );
}

function StaffApp() {
  const [session, setSession] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
    if (SUPABASE_URL.includes('PASTE_') || SUPABASE_ANON_KEY.includes('PASTE_')) {
      setConfigError(true); setLoaded(true); return;
    }
    (async () => {
      const s = await sessionStore.get();
      if (s?.employeeId) {
        const { data } = await supabase.from('employees').select('*').eq('id', s.employeeId).maybeSingle();
        if (data) setSession({ employee: data });
        else await sessionStore.clear();
      }
      setLoaded(true);
    })();
  }, []);

  if (!loaded) return <Splash text="Loading…" />;
  if (configError) return <ConfigError />;

  if (!session) {
    return <SignIn onSignIn={async (employee) => {
      // Remember they chose staff (in case localStorage was cleared)
      try { localStorage.setItem('tt_role_choice', 'staff'); } catch {}
      await sessionStore.set({ employeeId: employee.id });
      setSession({ employee });
    }} />;
  }
  const signOut = async () => { await sessionStore.clear(); setSession(null); };
  if (session.employee.role === 'manager' || session.employee.role === 'owner') {
    return <ManagerShell employee={session.employee} onSignOut={signOut} />;
  }
  return <EmployeeApp employee={session.employee} onSignOut={signOut} />;
}

function Splash({ text }) {
  return <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-400 text-sm">{text}</div>;
}

// Landing page shown when someone hits the root URL and hasn't logged in before.
// Two big buttons: staff (PIN sign-in) or property manager (access code sign-in).
function LandingPage({ onPickStaff, onPickPortal }) {
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Dark brand header band */}
      <div className="flex flex-col items-center pt-12 pb-10 bg-stone-900">
        <img
          src="https://bbaynvqnbkjyqhzhhypr.supabase.co/storage/v1/object/public/brand/unnamed%20(2).png"
          alt="Summit Clean"
          className="w-44 h-auto mx-auto"
        />
      </div>

      <div className="flex-1 flex flex-col justify-center items-center px-6 max-w-sm mx-auto w-full pt-10 pb-12">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.25em] font-mono text-stone-500">
            Welcome
          </p>
          <h2 className="font-serif text-2xl mt-2 text-stone-900">
            Who are you?
          </h2>
        </div>

        <div className="w-full space-y-3">
          <button onClick={onPickStaff}
            style={{ touchAction: 'manipulation' }}
            className="w-full p-5 rounded-2xl bg-stone-900 text-stone-50 text-left active:scale-98 transition-transform">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-serif text-xl">Summit Clean team</div>
                <div className="text-xs text-stone-300 font-mono mt-0.5">Cleaners, managers, owners</div>
              </div>
              <ChevronRight size={20} className="text-stone-300" />
            </div>
          </button>

          <button onClick={onPickPortal}
            style={{ touchAction: 'manipulation' }}
            className="w-full p-5 rounded-2xl bg-white border-2 border-stone-300 text-stone-900 text-left active:scale-98 transition-transform hover:border-stone-900">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-serif text-xl">Property manager</div>
                <div className="text-xs text-stone-500 font-mono mt-0.5">View cleanings & send photos</div>
              </div>
              <ChevronRight size={20} className="text-stone-400" />
            </div>
          </button>
        </div>
      </div>

      <div className="text-center pb-6">
        <div className="text-xs font-mono text-stone-400">
          Summit Clean · Cleaning operations
        </div>
      </div>
    </div>
  );
}

// Reusable searchable unit picker — drop-in replacement for <select> when there are
// many units. Shows the current pick as a button; tapping opens a dropdown with a
// search box at the top. Type "B3" to narrow to Building 3, etc.
function SearchableUnitPicker({ units, value, onChange, placeholder = '— Pick a unit —', disabled }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = units.find(u => u.id === value);
  const ref = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? units.filter(u => u.label.toLowerCase().includes(q))
    : units;

  return (
    <div className="relative" ref={ref}>
      <button type="button" disabled={disabled}
        onClick={() => { setOpen(!open); setSearch(''); }}
        className={`w-full px-4 py-3 rounded-xl border border-stone-300 bg-white text-left flex items-center justify-between disabled:opacity-50 ${disabled ? '' : 'hover:border-stone-900'}`}>
        <span className={selected ? 'text-stone-900' : 'text-stone-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronRight size={16} className={`text-stone-400 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-stone-300 rounded-xl shadow-lg max-h-72 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-stone-200 bg-stone-50">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${units.length} units…`}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-sm text-stone-400">No units match "{q}".</div>
            ) : filtered.map(u => (
              <button key={u.id} type="button"
                onClick={() => { onChange(u.id); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 hover:bg-stone-50 text-sm ${u.id === value ? 'bg-amber-50 text-amber-800 font-medium' : 'text-stone-700'}`}>
                {u.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConfigError() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="max-w-md bg-white border-2 border-amber-200 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="text-amber-600" size={24} />
          <h2 className="font-serif text-2xl text-stone-900">Setup needed</h2>
        </div>
        <p className="text-stone-700 text-sm">Paste your Supabase URL and anon key into the top of the file.</p>
      </div>
    </div>
  );
}

// =================================================================
// PIN Sign In
// =================================================================
function SignIn({ onSignIn }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const press = (n) => { setError(''); if (pin.length < 4) setPin(pin + n); };
  const back = () => { setError(''); setPin(pin.slice(0, -1)); };
  useEffect(() => { if (pin.length === 4) tryLogin();
    // eslint-disable-next-line
  }, [pin]);
  const tryLogin = async () => {
    setBusy(true);
    const { data } = await supabase.from('employees').select('*').eq('pin', pin).eq('active', true).maybeSingle();
    setBusy(false);
    if (!data) {
      setError('Invalid PIN');
      setTimeout(() => { setPin(''); setError(''); }, 1200);
      return;
    }
    onSignIn(data);
  };

  // Summit Clean palette — applied inline here for the sample.
  // Gold: #C99B5C  ·  Black: #0A0A0A  ·  Cream: #FAF8F4  ·  Warm grey: #6B6258  ·  Border: #E8E3DA
  const GOLD = '#C99B5C';
  const BLACK = '#0A0A0A';
  const CREAM = '#FAF8F4';
  const BORDER = '#E8E3DA';
  const MUTED = '#6B6258';

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: CREAM }}>
      {/* Dark brand header band */}
      <div className="flex flex-col items-center pt-12 pb-10" style={{ backgroundColor: BLACK }}>
        <img
          src="https://bbaynvqnbkjyqhzhhypr.supabase.co/storage/v1/object/public/brand/unnamed%20(2).png"
          alt="Summit Clean"
          className="w-44 h-auto mx-auto"
        />
      </div>

      {/* PIN entry section */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 max-w-sm mx-auto w-full pt-10">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-[0.25em] font-mono" style={{ color: MUTED, letterSpacing: '0.25em' }}>
            Welcome back
          </p>
          <h2 className="font-serif text-2xl mt-2" style={{ color: BLACK }}>
            Enter your 4-digit PIN
          </h2>
        </div>

        {/* PIN dots */}
        <div className="flex gap-3 mb-2">
          {[0,1,2,3].map(i => (
            <div key={i}
              className="w-4 h-4 rounded-full border-2 transition-all"
              style={{
                backgroundColor: pin.length > i ? (error ? '#B23A3A' : GOLD) : 'transparent',
                borderColor: pin.length > i ? (error ? '#B23A3A' : GOLD) : BORDER
              }} />
          ))}
        </div>
        <div className="h-6 mb-6 text-xs font-mono" style={{ color: '#B23A3A' }}>{error}</div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} onClick={() => press(n)} disabled={busy}
              style={{
                backgroundColor: '#FFFFFF',
                borderColor: BORDER,
                color: BLACK,
                touchAction: 'manipulation'
              }}
              className="aspect-square rounded-2xl border text-2xl font-light active:scale-95 transition-all">
              {n}
            </button>
          ))}
          <div />
          <button onClick={() => press(0)} disabled={busy}
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: BORDER,
              color: BLACK,
              touchAction: 'manipulation'
            }}
            className="aspect-square rounded-2xl border text-2xl font-light active:scale-95 transition-all">0</button>
          <button onClick={back} disabled={busy}
            style={{ color: MUTED, touchAction: 'manipulation' }}
            className="aspect-square rounded-2xl flex items-center justify-center active:scale-95 transition-all">
            <Delete size={20} />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pb-6 space-y-2">
        <button onClick={() => {
            try { localStorage.removeItem('tt_role_choice'); } catch {}
            window.location.hash = '';
            window.location.reload();
          }}
          className="text-xs font-mono hover:underline" style={{ color: MUTED }}>
          Not staff? Sign in as a property manager →
        </button>
        <div className="text-xs font-mono" style={{ color: MUTED }}>
          Summit Clean · Cleaning operations
        </div>
      </div>
    </div>
  );
}

// Role helpers — keep this central so we never drift
const isOwner   = (e) => e?.role === 'owner';
const isManager = (e) => e?.role === 'manager' || e?.role === 'owner';
const canSeeMoney = (e) => isOwner(e); // managers don't see $

// =================================================================
// EMPLOYEE APP — three-state machine
// =================================================================
function EmployeeApp({ employee, onSignOut }) {
  const [shift, setShift] = useState(null);
  const [workBlocks, setWorkBlocks] = useState([]);
  const [activeBlock, setActiveBlock] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [photoModal, setPhotoModal] = useState(null);
  const [clockInFlow, setClockInFlow] = useState(null);
  const [blockStartFlow, setBlockStartFlow] = useState(null);
  const [newTaskName, setNewTaskName] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showMessages, setShowMessages] = useState(false);

  useTick(!!shift && !shift.end_time);
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const reload = async () => {
    const { data: activeShift } = await supabase
      .from('shifts')
      .select('*, customer:customers(*)')
      .eq('employee_id', employee.id)
      .is('end_time', null)
      .order('start_time', { ascending: false })
      .limit(1).maybeSingle();

    if (activeShift) {
      setShift(activeShift);
      if (activeShift.customer?.property_type === 'multi_unit') {
        const { data: blocks } = await supabase
          .from('work_blocks')
          .select('*, unit:units(*), party:parties(*), tasks(*, photos(*))')
          .eq('shift_id', activeShift.id)
          .order('start_time', { ascending: true });
        setWorkBlocks(blocks || []);
        const live = (blocks || []).find(b => !b.end_time);
        if (live) {
          setActiveBlock(live);
          setTasks(live.tasks || []);
          const liveTask = (live.tasks || []).find(t => !t.end_time);
          if (liveTask) setActiveTask(liveTask.id);
        }
      } else {
        const { data: ts } = await supabase
          .from('tasks').select('*, photos(*)')
          .eq('shift_id', activeShift.id)
          .is('work_block_id', null)
          .order('start_time');
        setTasks(ts || []);
        const live = (ts || []).find(t => !t.end_time);
        if (live) setActiveTask(live.id);
      }
    }
    setLoaded(true);
  };

  // Clock-in
  const startClockIn = () => setClockInFlow({ step: 'property' });

  const onPickProperty = async (property) => {
    if (property === null) { await doClockIn({ customerId: null }); return; }
    if (property.property_type === 'multi_unit') {
      await doClockIn({ customerId: property.id, propertyType: 'multi_unit' });
    } else {
      await doClockIn({
        customerId: property.id,
        billRate: property.bill_mode === 'hourly' ? property.bill_rate_hourly : property.flat_rate_amount,
        propertyType: 'simple'
      });
    }
  };

  const doClockIn = async ({ customerId, billRate, propertyType }) => {
    setBusy(true);
    const { data, error } = await supabase
      .from('shifts')
      .insert({
        employee_id: employee.id,
        customer_id: customerId || null,
        bill_rate_at_work: propertyType === 'simple' ? billRate : null
      })
      .select('*, customer:customers(*)').single();
    setBusy(false);
    if (error) { alert('Could not clock in: ' + error.message); return; }
    setShift(data); setWorkBlocks([]); setTasks([]); setClockInFlow(null);
  };

  const clockOut = async () => {
    const hasOpen = activeBlock && !activeBlock.end_time;
    const msg = hasOpen ? 'You have an active work block. End shift anyway?' : 'End your shift?';
    if (!confirm(msg)) return;
    setBusy(true);
    if (activeTask) await stopTask(activeTask, false);
    if (activeBlock && !activeBlock.end_time) {
      await supabase.from('work_blocks').update({ end_time: new Date().toISOString() }).eq('id', activeBlock.id);
    }
    await supabase.from('shifts').update({ end_time: new Date().toISOString() }).eq('id', shift.id);
    setShift(null); setWorkBlocks([]); setActiveBlock(null); setTasks([]); setActiveTask(null);
    setBusy(false);
  };

  // Switch property = clock out current shift, then drop straight on the property picker.
  // Cleaner break than clock-out → home → clock-in.
  const switchProperty = async () => {
    if (!confirm('Clock out here and pick a new property?')) return;
    setBusy(true);
    if (activeTask) await stopTask(activeTask, false);
    if (activeBlock && !activeBlock.end_time) {
      await supabase.from('work_blocks').update({ end_time: new Date().toISOString() }).eq('id', activeBlock.id);
    }
    await supabase.from('shifts').update({ end_time: new Date().toISOString() }).eq('id', shift.id);
    setShift(null); setWorkBlocks([]); setActiveBlock(null); setTasks([]); setActiveTask(null);
    setClockInFlow({ step: 'property' });  // Jump straight to the picker
    setBusy(false);
  };

  // Work blocks
  const startNewBlock = () => setBlockStartFlow({ step: 'unit' });
  const onPickBlockUnit = (unit) => setBlockStartFlow({ step: 'party', unit });

  const onPickBlockParty = async (party, workNotes) => {
    setBusy(true);
    const { unit } = blockStartFlow;
    const { data, error } = await supabase.from('work_blocks')
      .insert({
        shift_id: shift.id, unit_id: unit.id, party_id: party.id,
        bill_rate_at_work: shift.customer?.bill_rate_hourly || null,
        work_notes: workNotes || null
      })
      .select('*, unit:units(*), party:parties(*), tasks(*, photos(*))').single();
    setBusy(false);
    if (error) { alert('Could not start work block: ' + error.message); return; }
    setWorkBlocks(prev => [...prev, data]);
    setActiveBlock(data); setTasks(data.tasks || []); setBlockStartFlow(null);
  };

  const finishBlock = async () => {
    if (!confirm(`Done cleaning ${activeBlock.party?.label} in ${activeBlock.unit?.label}?`)) return;
    setBusy(true);
    if (activeTask) await stopTask(activeTask, false);
    const ts = new Date().toISOString();
    await supabase.from('work_blocks').update({ end_time: ts }).eq('id', activeBlock.id);
    const updated = { ...activeBlock, end_time: ts, tasks };
    setWorkBlocks(prev => prev.map(b => b.id === activeBlock.id ? updated : b));
    setActiveBlock(null); setTasks([]); setActiveTask(null);
    setBusy(false);
  };

  const reopenBlock = async (block) => {
    setBusy(true);
    await supabase.from('work_blocks').update({ end_time: null }).eq('id', block.id);
    const { data: blockTasks } = await supabase.from('tasks').select('*, photos(*)')
      .eq('work_block_id', block.id).order('start_time');
    const updated = { ...block, end_time: null, tasks: blockTasks || [] };
    setWorkBlocks(prev => prev.map(b => b.id === block.id ? updated : b));
    setActiveBlock(updated); setTasks(blockTasks || []);
    setBusy(false);
  };

  // Jump straight to a bedroom's work block from an assignment card.
  // - If same bedroom is already active → just open it
  // - If a different block is active → confirm switch (close current, start new)
  // - If a coworker has an open block at this bedroom → join (open the existing one)
  // - Else create a new block
  const goToBedroomForTarget = async (target) => {
    if (!target.unit_id || !target.party_id) {
      alert('This assignment isn\'t tied to a specific bedroom.');
      return;
    }

    // Already on this bedroom? Just open it.
    if (activeBlock && activeBlock.unit_id === target.unit_id && activeBlock.party_id === target.party_id && !activeBlock.end_time) {
      return; // already there
    }

    // Active block but on a different bedroom — ask before switching
    if (activeBlock && !activeBlock.end_time) {
      const switchMsg = `You're already cleaning ${activeBlock.unit?.label || ''} · ${activeBlock.party?.label || ''}. Switch to ${target.unit?.label || ''} · ${target.party?.label || ''}?`;
      if (!confirm(switchMsg)) return;
      setBusy(true);
      if (activeTask) await stopTask(activeTask, false);
      const ts = new Date().toISOString();
      await supabase.from('work_blocks').update({ end_time: ts }).eq('id', activeBlock.id);
      const updated = { ...activeBlock, end_time: ts, tasks };
      setWorkBlocks(prev => prev.map(b => b.id === activeBlock.id ? updated : b));
      setActiveBlock(null); setTasks([]); setActiveTask(null);
      // fall through to open/create logic
    } else {
      setBusy(true);
    }

    // Try to find an existing open block at this bedroom (within this shift, or by another cleaner)
    // Within THIS shift first (most likely scenario after switching)
    const myOpen = workBlocks.find(b => !b.end_time && b.unit_id === target.unit_id && b.party_id === target.party_id);
    if (myOpen) {
      // Re-fetch the block with tasks so we have fresh data
      const { data: refreshed } = await supabase.from('work_blocks')
        .select('*, unit:units(*), party:parties(*), tasks(*, photos(*))')
        .eq('id', myOpen.id).single();
      if (refreshed) {
        setWorkBlocks(prev => prev.map(b => b.id === myOpen.id ? refreshed : b));
        setActiveBlock(refreshed);
        setTasks(refreshed.tasks || []);
      }
      setBusy(false);
      return;
    }

    // Else create a new work block for this cleaner at this bedroom
    const { data, error } = await supabase.from('work_blocks')
      .insert({
        shift_id: shift.id,
        unit_id: target.unit_id,
        party_id: target.party_id,
        bill_rate_at_work: shift.customer?.bill_rate_hourly || null
      })
      .select('*, unit:units(*), party:parties(*), tasks(*, photos(*))').single();
    setBusy(false);
    if (error) { alert('Could not start work block: ' + error.message); return; }
    setWorkBlocks(prev => [...prev, data]);
    setActiveBlock(data);
    setTasks(data.tasks || []);
  };

  // Tasks
  const startTask = async () => {
    if (!newTaskName.trim()) return;
    if (activeTask) await stopTask(activeTask, false);
    const insert = { shift_id: shift.id, name: newTaskName.trim() };
    if (activeBlock) insert.work_block_id = activeBlock.id;
    const { data, error } = await supabase.from('tasks').insert(insert).select('*, photos(*)').single();
    if (error) { alert('Could not start task: ' + error.message); return; }
    setTasks(prev => [...prev, data]); setActiveTask(data.id); setNewTaskName('');
  };

  const stopTask = async (taskId, refetch = true) => {
    const ts = new Date().toISOString();
    await supabase.from('tasks').update({ end_time: ts }).eq('id', taskId);
    if (refetch) setTasks(prev => prev.map(t => t.id === taskId ? { ...t, end_time: ts } : t));
    if (activeTask === taskId) setActiveTask(null);
  };

  const resumeTask = async (taskId) => {
    if (activeTask) await stopTask(activeTask, false);
    await supabase.from('tasks').update({ end_time: null }).eq('id', taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, end_time: null } : t));
    setActiveTask(taskId);
  };

  const uploadPhoto = async (taskId, kind, file) => {
    const compressed = await compressImage(file);
    const path = `${shift.id}/${taskId}/${kind}_${Date.now()}.jpg`;
    const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, compressed, { contentType: 'image/jpeg' });
    if (upErr) { alert('Upload failed: ' + upErr.message); return; }
    const { data: { publicUrl } } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
    const { data: photo, error: pErr } = await supabase.from('photos')
      .insert({ task_id: taskId, kind, storage_path: path, public_url: publicUrl }).select().single();
    if (pErr) { alert('Could not save photo: ' + pErr.message); return; }
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, photos: [...(t.photos || []), photo] } : t));
  };

  if (!loaded) return <Splash text="Loading…" />;

  // Messages overlay — takes over the screen, regardless of where cleaner was
  if (showMessages) {
    return <StaffMessagesTab employee={employee} onClose={() => setShowMessages(false)} />;
  }

  if (!shift && clockInFlow?.step === 'property') {
    return <PropertyPicker onPick={onPickProperty} onCancel={() => setClockInFlow(null)} busy={busy} />;
  }
  if (shift && blockStartFlow?.step === 'unit') {
    return <UnitPicker property={shift.customer} onPick={onPickBlockUnit}
      onBack={() => setBlockStartFlow(null)} busy={busy} title="Which apartment?" />;
  }
  if (shift && blockStartFlow?.step === 'party') {
    return <PartyPicker property={shift.customer} unit={blockStartFlow.unit}
      onPick={onPickBlockParty} onBack={() => setBlockStartFlow({ step: 'unit' })} busy={busy} />;
  }

  if (!shift) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col">
        <Header name={employee.name} onSignOut={onSignOut} role={employee.role}
          employee={employee} onOpenMessages={() => setShowMessages(true)} />
        <div className="flex-1 flex flex-col justify-center items-center px-6">
          <div className="text-center mb-12">
            <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-3">
              {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}
            </div>
            <h2 className="text-5xl font-light text-stone-900 tracking-tight mb-2">
              Ready to <span className="font-serif italic text-amber-700">work?</span>
            </h2>
            <p className="text-stone-500">Clock in to start tracking your shift.</p>
          </div>
          <button onClick={startClockIn} disabled={busy}
            className="w-48 h-48 rounded-full bg-stone-900 text-stone-50 font-medium text-lg flex flex-col items-center justify-center gap-2 shadow-2xl active:scale-95 transition-transform disabled:opacity-50">
            <Clock size={32} />
            <span>Clock In</span>
          </button>
        </div>
      </div>
    );
  }

  const isMulti = shift.customer?.property_type === 'multi_unit';

  if (isMulti && !activeBlock) {
    return <PropertyHub shift={shift} workBlocks={workBlocks} employeeName={employee.name} employee={employee}
      onSignOut={onSignOut} onClockOut={clockOut} onSwitchProperty={switchProperty}
      onStartNew={startNewBlock} onReopen={reopenBlock} onGoToBedroom={goToBedroomForTarget}
      onOpenMessages={() => setShowMessages(true)} busy={busy} />;
  }
  if (isMulti && activeBlock) {
    return <BlockView shift={shift} block={activeBlock} tasks={tasks} activeTask={activeTask}
      employeeName={employee.name} employee={employee} onSignOut={onSignOut} onFinish={finishBlock}
      onPause={() => setActiveBlock(null)}
      newTaskName={newTaskName} setNewTaskName={setNewTaskName}
      onStartTask={startTask} onStopTask={stopTask} onResumeTask={resumeTask}
      onAddPhoto={(taskId, kind) => setPhotoModal({ taskId, kind })}
      photoModal={photoModal} onClosePhotoModal={() => setPhotoModal(null)}
      onUploadPhoto={uploadPhoto}
      onOpenMessages={() => setShowMessages(true)} busy={busy} />;
  }
  return <SimpleShiftView shift={shift} tasks={tasks} activeTask={activeTask}
    employeeName={employee.name} employee={employee} onSignOut={onSignOut} onClockOut={clockOut}
    onSwitchProperty={switchProperty}
    newTaskName={newTaskName} setNewTaskName={setNewTaskName}
    onStartTask={startTask} onStopTask={stopTask} onResumeTask={resumeTask}
    onAddPhoto={(taskId, kind) => setPhotoModal({ taskId, kind })}
    photoModal={photoModal} onClosePhotoModal={() => setPhotoModal(null)}
    onUploadPhoto={uploadPhoto}
    onOpenMessages={() => setShowMessages(true)} busy={busy} />;
}

// =================================================================
// PROPERTY HUB (multi-unit, between work blocks)
// =================================================================
function PropertyHub({ shift, workBlocks, employeeName, employee, onSignOut, onClockOut, onSwitchProperty, onStartNew, onReopen, onGoToBedroom, onOpenMessages, busy }) {
  useTick(true);
  const elapsed = Date.now() - new Date(shift.start_time).getTime();

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <Header name={employeeName} onSignOut={onSignOut} role={employee?.role} employee={employee} onOpenMessages={onOpenMessages} />
      <div className="bg-stone-900 text-stone-50 px-5 py-5 sticky top-0 z-10 shadow-md">
        <div className="flex items-start justify-between mb-3 gap-2">
          <div>
            <div className="text-xs uppercase tracking-widest text-stone-400 font-mono">At property</div>
            <div className="text-3xl font-mono font-light tracking-tight">{fmtTime(elapsed)}</div>
          </div>
          <div className="flex flex-col gap-1.5 items-end">
            <button onClick={onClockOut} disabled={busy}
              className="px-4 py-2.5 rounded-full bg-amber-700 text-stone-50 text-sm font-medium flex items-center gap-2 active:scale-95 transition-transform disabled:opacity-50">
              <LogOut size={14} /> Clock out
            </button>
            <button onClick={onSwitchProperty} disabled={busy}
              className="px-3 py-1.5 rounded-full bg-stone-700 hover:bg-stone-600 text-stone-50 text-xs font-medium flex items-center gap-1.5 disabled:opacity-50">
              <Home size={11} /> Switch property
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-amber-400 font-mono">
          <Building2 size={11} /> {shift.customer?.name}
        </div>
        <div className="mt-1 text-xs text-stone-400 font-mono">
          Started {fmtClock(shift.start_time)} · {workBlocks.length} {workBlocks.length === 1 ? 'apartment cleaned' : 'apartments cleaned'}
        </div>
      </div>

      <AssignmentsPanel propertyId={shift.customer_id} employee={employee} onGoToBedroom={onGoToBedroom} />

      <div className="px-4 pt-6">
        <button onClick={onStartNew} disabled={busy}
          className="w-full py-5 rounded-2xl bg-stone-900 text-stone-50 font-medium text-lg flex items-center justify-center gap-3 active:scale-98 transition-transform disabled:opacity-50 shadow-md">
          <Plus size={22} /> Start cleaning a bedroom
        </button>

        <div className="mt-8">
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">
            Today's work blocks ({workBlocks.length})
          </div>
          {workBlocks.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
              No work yet. Tap "Start cleaning a bedroom" above.
            </div>
          ) : (
            <div className="space-y-2">
              {workBlocks.map(b => {
                const dur = (b.end_time ? new Date(b.end_time) : new Date()) - new Date(b.start_time);
                const photoCount = (b.tasks || []).reduce((sum, t) => sum + (t.photos?.length || 0), 0);
                const isDone = !!b.end_time;
                return (
                  <div key={b.id} className={`rounded-2xl p-4 border ${isDone ? 'bg-white border-stone-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          {isDone && <Check size={14} className="text-emerald-600 flex-shrink-0" />}
                          <span className="font-serif text-lg text-stone-900 truncate">
                            {b.unit?.label} · {b.party?.label}
                          </span>
                        </div>
                        <div className="text-xs text-stone-500 font-mono">
                          {fmtClock(b.start_time)}{b.end_time && ` — ${fmtClock(b.end_time)}`} · {fmtTimeShort(dur)}
                          {(b.tasks?.length > 0 || photoCount > 0) && (
                            <span> · {b.tasks?.length || 0} tasks{photoCount > 0 && `, ${photoCount} photos`}</span>
                          )}
                        </div>
                        {b.work_notes && <div className="text-xs text-stone-600 mt-1 italic">"{b.work_notes}"</div>}
                      </div>
                      {isDone && (
                        <button onClick={() => onReopen(b)} disabled={busy}
                          className="ml-2 px-3 py-1.5 rounded-full bg-stone-100 text-stone-700 text-xs font-medium flex items-center gap-1 active:scale-95 disabled:opacity-50">
                          <Play size={11} /> Resume
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =================================================================
// BLOCK VIEW (active work block, multi-unit)
// =================================================================
function BlockView({ shift, block, tasks, activeTask, employeeName, employee, onSignOut, onFinish, onPause,
  newTaskName, setNewTaskName, onStartTask, onStopTask, onResumeTask, onAddPhoto,
  photoModal, onClosePhotoModal, onUploadPhoto, onOpenMessages, busy }) {
  useTick(true);
  const blockElapsed = Date.now() - new Date(block.start_time).getTime();
  const activeTaskObj = tasks.find(t => t.id === activeTask);

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <Header name={employeeName} onSignOut={onSignOut} role={employee?.role} employee={employee} onOpenMessages={onOpenMessages} />
      <div className="bg-stone-900 text-stone-50 px-5 py-5 sticky top-0 z-10 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onPause}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-50 text-xs font-medium">
            <Home size={12} /> Property home
          </button>
          <button onClick={onFinish} disabled={busy}
            className="px-4 py-2 rounded-full bg-amber-700 text-stone-50 text-sm font-medium flex items-center gap-2 active:scale-95 transition-transform disabled:opacity-50">
            <Check size={14} /> Done with this party
          </button>
        </div>
        <div className="text-xs uppercase tracking-widest text-stone-400 font-mono">Working on</div>
        <div className="font-serif text-2xl text-stone-50 leading-tight">
          {block.unit?.label} · <span className="italic text-amber-400">{block.party?.label}</span>
        </div>
        {block.party?.full_name && <div className="text-xs text-stone-400 mt-0.5">{block.party.full_name}</div>}
        <div className="mt-2 font-mono text-xl text-stone-50">{fmtTime(blockElapsed)}</div>
        {block.work_notes && (
          <div className="mt-2 px-3 py-2 rounded-lg bg-stone-800 text-stone-300 text-xs italic">"{block.work_notes}"</div>
        )}
      </div>

      <AssignmentBanner propertyId={shift.customer_id} unitId={block.unit_id} partyId={block.party_id} employee={employee} />

      {activeTaskObj && (
        <div className="mx-4 mt-4 p-4 rounded-2xl bg-amber-50 border-2 border-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-amber-700 animate-pulse" />
            <span className="text-xs uppercase tracking-wider text-amber-800 font-mono">In progress</span>
          </div>
          <div className="font-serif text-2xl text-stone-900 mb-2">{activeTaskObj.name}</div>
          <div className="text-stone-600 font-mono text-sm">
            {fmtTime(Date.now() - new Date(activeTaskObj.start_time).getTime())}
          </div>
        </div>
      )}

      <div className="mx-4 mt-4">
        <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Start a new task</label>
        <div className="flex gap-2">
          <input type="text" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)}
            placeholder="e.g. Master bathroom, Kitchen…"
            className="flex-1 px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900"
            onKeyDown={(e) => e.key === 'Enter' && onStartTask()} />
          <button onClick={onStartTask} disabled={!newTaskName.trim()}
            className="px-4 rounded-xl bg-stone-900 text-stone-50 disabled:opacity-30 active:scale-95 transition-transform">
            <Plus size={20} />
          </button>
        </div>
      </div>

      <div className="mx-4 mt-6">
        <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">Tasks for this party</div>
        {tasks.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            Add a task above when you start cleaning.
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map(t => (
              <TaskCard key={t.id} task={t} isActive={activeTask === t.id}
                onStop={() => onStopTask(t.id)} onResume={() => onResumeTask(t.id)}
                onAddPhoto={(kind) => onAddPhoto(t.id, kind)} />
            ))}
          </div>
        )}
      </div>

      {photoModal && (
        <PhotoModal kind={photoModal.kind}
          taskName={tasks.find(t => t.id === photoModal.taskId)?.name}
          existing={(tasks.find(t => t.id === photoModal.taskId)?.photos || []).filter(p => p.kind === photoModal.kind)}
          onUpload={(file) => onUploadPhoto(photoModal.taskId, photoModal.kind, file)}
          onClose={onClosePhotoModal} />
      )}
    </div>
  );
}

// =================================================================
// SIMPLE SHIFT VIEW (single-bill properties)
// =================================================================
function SimpleShiftView({ shift, tasks, activeTask, employeeName, employee, onSignOut, onClockOut, onSwitchProperty,
  newTaskName, setNewTaskName, onStartTask, onStopTask, onResumeTask, onAddPhoto,
  photoModal, onClosePhotoModal, onUploadPhoto, onOpenMessages, busy }) {
  useTick(true);
  const elapsed = Date.now() - new Date(shift.start_time).getTime();
  const activeTaskObj = tasks.find(t => t.id === activeTask);

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <Header name={employeeName} onSignOut={onSignOut} role={employee?.role} employee={employee} onOpenMessages={onOpenMessages} />
      <div className="bg-stone-900 text-stone-50 px-5 py-5 sticky top-0 z-10 shadow-md">
        <div className="flex items-start justify-between mb-3 gap-2">
          <div>
            <div className="text-xs uppercase tracking-widest text-stone-400 font-mono">On the clock</div>
            <div className="text-3xl font-mono font-light tracking-tight">{fmtTime(elapsed)}</div>
          </div>
          <div className="flex flex-col gap-1.5 items-end">
            <button onClick={onClockOut} disabled={busy}
              className="px-4 py-2.5 rounded-full bg-amber-700 text-stone-50 text-sm font-medium flex items-center gap-2 active:scale-95 transition-transform disabled:opacity-50">
              <LogOut size={14} /> Clock out
            </button>
            {shift.customer_id && (
              <button onClick={onSwitchProperty} disabled={busy}
                className="px-3 py-1.5 rounded-full bg-stone-700 hover:bg-stone-600 text-stone-50 text-xs font-medium flex items-center gap-1.5 disabled:opacity-50">
                <Home size={11} /> Switch property
              </button>
            )}
          </div>
        </div>
        {shift.customer?.name && (
          <div className="flex items-center gap-1.5 text-xs text-amber-400 font-mono">
            <Building2 size={11} /> {shift.customer.name}
          </div>
        )}
        <div className="mt-1 text-xs text-stone-400 font-mono">
          Started {fmtClock(shift.start_time)} · {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
        </div>
      </div>

      {shift.customer_id && (
        <AssignmentBanner propertyId={shift.customer_id} unitId={null} partyId={null} employee={employee} />
      )}

      {activeTaskObj && (
        <div className="mx-4 mt-4 p-4 rounded-2xl bg-amber-50 border-2 border-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-amber-700 animate-pulse" />
            <span className="text-xs uppercase tracking-wider text-amber-800 font-mono">In progress</span>
          </div>
          <div className="font-serif text-2xl text-stone-900 mb-2">{activeTaskObj.name}</div>
          <div className="text-stone-600 font-mono text-sm">
            {fmtTime(Date.now() - new Date(activeTaskObj.start_time).getTime())}
          </div>
        </div>
      )}

      <div className="mx-4 mt-4">
        <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Start a new task</label>
        <div className="flex gap-2">
          <input type="text" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)}
            placeholder="e.g. Master bathroom, Kitchen…"
            className="flex-1 px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900"
            onKeyDown={(e) => e.key === 'Enter' && onStartTask()} />
          <button onClick={onStartTask} disabled={!newTaskName.trim()}
            className="px-4 rounded-xl bg-stone-900 text-stone-50 disabled:opacity-30 active:scale-95 transition-transform">
            <Plus size={20} />
          </button>
        </div>
      </div>

      <div className="mx-4 mt-6">
        <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">Today's tasks</div>
        {tasks.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            No tasks yet.
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map(t => (
              <TaskCard key={t.id} task={t} isActive={activeTask === t.id}
                onStop={() => onStopTask(t.id)} onResume={() => onResumeTask(t.id)}
                onAddPhoto={(kind) => onAddPhoto(t.id, kind)} />
            ))}
          </div>
        )}
      </div>

      {photoModal && (
        <PhotoModal kind={photoModal.kind}
          taskName={tasks.find(t => t.id === photoModal.taskId)?.name}
          existing={(tasks.find(t => t.id === photoModal.taskId)?.photos || []).filter(p => p.kind === photoModal.kind)}
          onUpload={(file) => onUploadPhoto(photoModal.taskId, photoModal.kind, file)}
          onClose={onClosePhotoModal} />
      )}
    </div>
  );
}

// =================================================================
// Pickers
// =================================================================
function PropertyPicker({ onPick, onCancel, busy }) {
  const [properties, setProperties] = useState([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { (async () => {
    const { data } = await supabase.from('customers').select('*').eq('active', true).order('name');
    setProperties(data || []); setLoaded(true);
  })(); }, []);
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button onClick={onCancel} className="p-2 -ml-2 rounded-full hover:bg-stone-100">
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div>
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">Clock in</div>
          <div className="font-serif text-xl text-stone-900">Pick a property</div>
        </div>
      </div>
      <div className="flex-1 px-5 py-6 overflow-y-auto">
        {!loaded ? <Splash text="Loading…" /> : (
          <>
            {properties.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-sm">No properties yet.</div>
            ) : (
              <div className="space-y-2 mb-6">
                {properties.map(p => (
                  <button key={p.id} onClick={() => onPick(p)} disabled={busy}
                    className="w-full text-left p-4 rounded-2xl bg-white border-2 border-stone-200 hover:border-stone-900 active:scale-98 transition-all disabled:opacity-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-serif text-lg text-stone-900">{p.name}</span>
                          {p.property_type === 'multi_unit' && (
                            <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Multi-unit</span>
                          )}
                        </div>
                        {p.address && (
                          <div className="text-xs text-stone-500 font-mono flex items-center gap-1">
                            <MapPin size={11} /> {p.address}
                          </div>
                        )}
                      </div>
                      <ChevronRight size={16} className="text-stone-400" />
                    </div>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => onPick(null)} disabled={busy}
              className="w-full p-4 rounded-2xl border-2 border-dashed border-stone-300 text-stone-600 text-sm hover:border-stone-500 disabled:opacity-50">
              Skip — clock in without a property
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function UnitPicker({ property, onPick, onBack, busy, title = "Pick a unit" }) {
  const [units, setUnits] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  useEffect(() => { (async () => {
    const { data } = await supabase.from('units').select('*')
      .eq('customer_id', property.id).eq('active', true)
      .order('sort_order').order('label');
    // Apply natural sort client-side so '10-101' comes after '9-101'
    const sorted = (data || []).slice().sort((a, b) => naturalCompare(a.label, b.label));
    setUnits(sorted); setLoaded(true);
  })(); }, [property.id]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? units.filter(u => u.label.toLowerCase().includes(q) || (u.notes || '').toLowerCase().includes(q))
    : units;

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-stone-100">
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div>
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">{property.name}</div>
          <div className="font-serif text-xl text-stone-900">{title}</div>
        </div>
      </div>

      {/* Search bar — only shows up when there are enough units to make it useful */}
      {units.length >= 8 && (
        <div className="px-5 pt-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${units.length} units (e.g. "1-1" for Building 1, floor 1)…`}
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900"
            autoFocus
          />
        </div>
      )}

      <div className="flex-1 px-5 py-4 overflow-y-auto">
        {!loaded ? <Splash text="Loading…" /> : units.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            No units configured for this property yet.
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            No units match "{search}".
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(u => (
              <button key={u.id} onClick={() => onPick(u)} disabled={busy}
                className="w-full text-left p-4 rounded-2xl bg-white border-2 border-stone-200 hover:border-stone-900 active:scale-98 transition-all disabled:opacity-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-serif text-lg text-stone-900">{u.label}</div>
                    {u.notes && <div className="text-xs text-stone-500 mt-1">{u.notes}</div>}
                  </div>
                  <ChevronRight size={16} className="text-stone-400" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PartyPicker({ property, unit, onPick, onBack, busy }) {
  const [parties, setParties] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [picked, setPicked] = useState(null);
  const [notes, setNotes] = useState('');
  useEffect(() => { (async () => {
    const { data } = await supabase.from('parties').select('*')
      .eq('unit_id', unit.id).eq('active', true)
      .order('sort_order').order('label');
    setParties(data || []); setLoaded(true);
  })(); }, [unit.id]);

  if (picked) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
          <button onClick={() => setPicked(null)} className="p-2 -ml-2 rounded-full hover:bg-stone-100">
            <ArrowLeft size={20} className="text-stone-700" />
          </button>
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">{property.name} · {unit.label}</div>
            <div className="font-serif text-xl text-stone-900">{picked.label}</div>
          </div>
        </div>
        <div className="flex-1 px-5 py-6">
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
            What was assigned this week?
          </label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            rows={4} placeholder="e.g. Kitchen, master bath, vacuum living room"
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 resize-none" />
          <p className="text-xs text-stone-500 mt-2 mb-6">Optional. Appears on the invoice.</p>
          <button onClick={() => onPick(picked, notes)} disabled={busy}
            className="w-full py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium active:scale-98 transition-transform disabled:opacity-50">
            Start cleaning {picked.label}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-stone-100">
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div>
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">{property.name} · {unit.label}</div>
          <div className="font-serif text-xl text-stone-900">Whose portion?</div>
        </div>
      </div>
      <div className="flex-1 px-5 py-6 overflow-y-auto">
        {!loaded ? <Splash text="Loading…" /> : parties.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            No parties configured for this unit yet.
          </div>
        ) : (
          <div className="space-y-2">
            {parties.map(p => (
              <button key={p.id} onClick={() => setPicked(p)} disabled={busy}
                className="w-full text-left p-4 rounded-2xl bg-white border-2 border-stone-200 hover:border-stone-900 active:scale-98 transition-all disabled:opacity-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-serif text-lg text-stone-900">{p.label}</div>
                    {p.full_name && <div className="text-sm text-stone-600">{p.full_name}</div>}
                    {p.notes && <div className="text-xs text-stone-500 mt-1 italic line-clamp-1">{p.notes}</div>}
                  </div>
                  <ChevronRight size={16} className="text-stone-400" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =================================================================
// Task Card / Photo Modal / Image compress / Header
// =================================================================
function TaskCard({ task, isActive, onStop, onResume, onAddPhoto }) {
  useTick(isActive);
  const elapsed = task.end_time
    ? new Date(task.end_time).getTime() - new Date(task.start_time).getTime()
    : Date.now() - new Date(task.start_time).getTime();
  const photos = task.photos || [];
  const before = photos.filter(p => p.kind === 'before');
  const after  = photos.filter(p => p.kind === 'after');
  const damage = photos.filter(p => p.kind === 'damage');
  const isDone = !!task.end_time;
  return (
    <div className={`rounded-2xl p-4 border-2 transition-all ${isActive ? 'border-amber-300 bg-amber-50/50' : 'border-stone-200 bg-white'}`}
      style={{ touchAction: 'manipulation' }}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isDone && <Check size={14} className="text-emerald-600 flex-shrink-0" />}
            {isActive && <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse flex-shrink-0" />}
            <span className="font-serif text-lg text-stone-900 truncate">{task.name}</span>
            {damage.length > 0 && (
              <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex-shrink-0">
                ⚠ {damage.length}
              </span>
            )}
          </div>
          <div className="text-xs text-stone-500 font-mono">
            {fmtClock(task.start_time)}{task.end_time && ` — ${fmtClock(task.end_time)}`} · {fmtTimeShort(elapsed)}
          </div>
        </div>
        {isDone ? (
          <button onClick={onResume}
            style={{ touchAction: 'manipulation' }}
            className="ml-2 p-3 rounded-full bg-stone-100 text-stone-600 active:scale-95 transition-transform">
            <Play size={14} />
          </button>
        ) : (
          <button onClick={onStop}
            style={{ touchAction: 'manipulation' }}
            className="ml-2 px-4 py-2.5 rounded-full bg-stone-900 text-stone-50 text-sm font-medium flex items-center gap-1 active:scale-95 transition-transform">
            <Pause size={14} /> Done
          </button>
        )}
      </div>
      {/* Spacer so the Done button is well-separated from the photo grid below — prevents ghost taps on iOS */}
      <div className="grid grid-cols-3 gap-2 mt-2">
        <button onClick={() => onAddPhoto('before')}
          style={{ touchAction: 'manipulation' }}
          className="px-2 py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
          <Camera size={13} /> Before {before.length > 0 && <span className="text-amber-700 font-mono">({before.length})</span>}
        </button>
        <button onClick={() => onAddPhoto('after')}
          style={{ touchAction: 'manipulation' }}
          className="px-2 py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
          <Camera size={13} /> After {after.length > 0 && <span className="text-amber-700 font-mono">({after.length})</span>}
        </button>
        <button onClick={() => onAddPhoto('damage')}
          style={{ touchAction: 'manipulation' }}
          className="px-2 py-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
          <Camera size={13} /> Damage {damage.length > 0 && <span className="font-mono">({damage.length})</span>}
        </button>
      </div>
    </div>
  );
}

function PhotoModal({ kind, taskName, existing, onUpload, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const existingPhotos = Array.isArray(existing) ? existing : [];

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file twice still triggers
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      await onUpload(file);
    } catch (err) {
      setError(err?.message || 'Upload failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="bg-stone-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[85vh] flex flex-col"
        style={{ touchAction: 'manipulation' }}>
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">{kind} photo</div>
            <div className="font-serif text-xl text-stone-900">{taskName}</div>
          </div>
          <button onClick={onClose} disabled={busy}
            className="p-2 rounded-full hover:bg-stone-100 disabled:opacity-50">
            <X size={20} className="text-stone-600" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {existingPhotos.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              {existingPhotos.map(p => (
                <img key={p.id} src={p.public_url} alt="" loading="lazy"
                  className="w-full aspect-square object-cover rounded-xl" />
              ))}
            </div>
          )}
          {error && (
            <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}
          <label className={`block w-full p-8 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-colors ${busy ? 'border-amber-300 bg-amber-50 pointer-events-none' : 'border-stone-300 hover:border-stone-900'}`}>
            {busy ? (
              <>
                <div className="w-8 h-8 mx-auto mb-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                <div className="text-stone-700 font-medium">Uploading…</div>
              </>
            ) : (
              <>
                <Camera size={32} className="mx-auto mb-3 text-stone-400" />
                <div className="text-stone-700 font-medium mb-1">Take or upload photo</div>
                <div className="text-xs text-stone-500">Tap to open camera</div>
              </>
            )}
            <input ref={inputRef} type="file" accept="image/*" capture="environment"
              onChange={handleFile} disabled={busy} className="hidden" />
          </label>
        </div>
        <div className="p-5 border-t border-stone-200">
          <button onClick={onClose} disabled={busy}
            className="w-full py-3.5 rounded-2xl bg-stone-900 text-stone-50 font-medium active:scale-98 transition-transform disabled:opacity-50">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1280;
        let { width, height } = img;
        if (width > height && width > maxDim) { height = (height * maxDim) / width; width = maxDim; }
        else if (height > maxDim) { width = (width * maxDim) / height; height = maxDim; }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(b => resolve(b), 'image/jpeg', 0.75);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Status helpers for assignment_targets
const ASSIGNMENT_STATUSES = {
  pending:      { label: 'Pending',     color: 'bg-stone-100 text-stone-700 border-stone-300' },
  in_progress:  { label: 'In progress', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  done:         { label: 'Done',        color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  blocked:      { label: 'Blocked',     color: 'bg-red-100 text-red-700 border-red-300' },
};

// Upload an assignment file. Compresses images, leaves PDFs as-is.
async function uploadAssignmentFile(file, customerId) {
  if (file.size > ASSIGNMENT_MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`File too large. Max ${ASSIGNMENT_MAX_SIZE_MB}MB.`);
  }
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isImage = file.type.startsWith('image/');
  if (!isPdf && !isImage) {
    throw new Error('Only PDFs and images are supported.');
  }
  let uploadBody = file;
  let contentType = file.type || (isPdf ? 'application/pdf' : 'image/jpeg');
  let ext = isPdf ? 'pdf' : 'jpg';
  if (isImage) {
    uploadBody = await compressImage(file);
    contentType = 'image/jpeg';
    ext = 'jpg';
  }
  const path = `${customerId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage.from(ASSIGNMENT_BUCKET)
    .upload(path, uploadBody, { contentType });
  if (upErr) throw upErr;
  const { data: { publicUrl } } = supabase.storage.from(ASSIGNMENT_BUCKET).getPublicUrl(path);
  return { path, publicUrl, kind: isPdf ? 'pdf' : 'image' };
}

// Upload to the PM bucket — used for both PM photo uploads and PM assignment uploads
async function uploadPmFile(file, customerId) {
  if (file.size > ASSIGNMENT_MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`File too large. Max ${ASSIGNMENT_MAX_SIZE_MB}MB.`);
  }
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isImage = file.type.startsWith('image/');
  if (!isPdf && !isImage) {
    throw new Error('Only PDFs and images are supported.');
  }
  let uploadBody = file;
  let contentType = file.type || (isPdf ? 'application/pdf' : 'image/jpeg');
  let ext = isPdf ? 'pdf' : 'jpg';
  if (isImage) {
    uploadBody = await compressImage(file);
    contentType = 'image/jpeg';
    ext = 'jpg';
  }
  const path = `${customerId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage.from(PM_UPLOAD_BUCKET)
    .upload(path, uploadBody, { contentType });
  if (upErr) throw upErr;
  const { data: { publicUrl } } = supabase.storage.from(PM_UPLOAD_BUCKET).getPublicUrl(path);
  return { path, publicUrl, kind: isPdf ? 'pdf' : 'image' };
}

// Delete a file from PM uploads bucket (used when PM edits to swap the file, or rejects)
async function deletePmFile(path) {
  if (!path) return;
  await supabase.storage.from(PM_UPLOAD_BUCKET).remove([path]);
}

// Upload a photo attachment for a message. Returns { path, publicUrl }.
async function uploadMessagePhoto(file, conversationId) {
  if (file.size > ASSIGNMENT_MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`Photo too large. Max ${ASSIGNMENT_MAX_SIZE_MB}MB.`);
  }
  if (!file.type.startsWith('image/')) throw new Error('Only images can be attached.');
  const compressed = await compressImage(file);
  const path = `${conversationId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error: upErr } = await supabase.storage.from(MESSAGE_BUCKET)
    .upload(path, compressed, { contentType: 'image/jpeg' });
  if (upErr) throw upErr;
  const { data: { publicUrl } } = supabase.storage.from(MESSAGE_BUCKET).getPublicUrl(path);
  return { path, publicUrl };
}

async function deleteMessagePhoto(path) {
  if (!path) return;
  try { await supabase.storage.from(MESSAGE_BUCKET).remove([path]); } catch {}
}

function Header({ name, onSignOut, role, employee, onOpenMessages }) {
  // Cleaners get a messages icon in the header (managers/owners have the Messages tab in bottom nav)
  const showMessagesIcon = onOpenMessages && employee && role !== 'owner' && role !== 'manager';
  const unread = useUnreadCount({ employee: showMessagesIcon ? employee : null });
  return (
    <div className="flex items-center justify-between px-5 py-3 bg-stone-900 border-b border-stone-900">
      <div className="flex items-center gap-3">
        <img
          src="https://bbaynvqnbkjyqhzhhypr.supabase.co/storage/v1/object/public/brand/unnamed%20(2).png"
          alt="Summit Clean"
          className="h-10 w-auto object-contain"
        />
        <div className="text-stone-50">
          <div className="text-xs font-mono flex items-center gap-1.5" style={{ color: '#FAF8F4' }}>
            {name}
            {role === 'owner' && (
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500 text-stone-900">Owner</span>
            )}
            {role === 'manager' && (
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-stone-700 text-stone-50">Manager</span>
            )}
          </div>
          <div className="text-[10px] font-mono opacity-60">TidyTrack</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {showMessagesIcon && (
          <button onClick={onOpenMessages}
            className="relative p-2 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-50">
            <MessageCircle size={18} />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-600 text-white text-[10px] font-mono font-bold flex items-center justify-center border-2 border-stone-900">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>
        )}
        <button onClick={onSignOut} className="text-xs text-stone-300 font-mono hover:text-stone-50">Sign out</button>
      </div>
    </div>
  );
}

// =================================================================
// MANAGER SHELL
// =================================================================

function ManagerShell({ employee, onSignOut }) {
  const [tab, setTab] = useState('daily');
  const showMoneyTabs = canSeeMoney(employee); // owner only
  const unread = useUnreadCount({ employee });

  // If a manager somehow lands on a money tab (e.g. via stale state), bounce them home
  useEffect(() => {
    if (!showMoneyTabs && (tab === 'invoice' || tab === 'payroll')) setTab('daily');
  }, [showMoneyTabs, tab]);

  const colCount = (showMoneyTabs ? 6 : 4) + 1; // +1 for messages

  return (
    <div className="min-h-screen bg-stone-50">
      {tab === 'daily'     && <DailyView        employee={employee} onSignOut={onSignOut} />}
      {tab === 'dashboard' && <ManagerDashboard employee={employee} onSignOut={onSignOut} />}
      {tab === 'team'      && <EmployeeAdmin   employee={employee} onSignOut={onSignOut} />}
      {tab === 'props'     && <PropertyAdmin   employee={employee} onSignOut={onSignOut} />}
      {tab === 'messages'  && <StaffMessagesTab employee={employee} />}
      {showMoneyTabs && tab === 'invoice'   && <InvoiceView     employee={employee} onSignOut={onSignOut} />}
      {showMoneyTabs && tab === 'payroll'   && <ExportView      employee={employee} onSignOut={onSignOut} />}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-1 py-2 z-30">
        <div className="max-w-md mx-auto grid gap-0.5" style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}>
          <TabButton active={tab==='daily'}     onClick={() => setTab('daily')}     icon={<Calendar size={18} />} label="Daily" />
          <TabButton active={tab==='dashboard'} onClick={() => setTab('dashboard')} icon={<LayoutDashboard size={18} />} label="Shifts" />
          <TabButton active={tab==='messages'}  onClick={() => setTab('messages')}  icon={<MessageCircle size={18} />} label="Messages" badge={unread} />
          <TabButton active={tab==='team'}      onClick={() => setTab('team')}      icon={<Users size={18} />} label="Team" />
          <TabButton active={tab==='props'}     onClick={() => setTab('props')}     icon={<Building2 size={18} />} label="Properties" />
          {showMoneyTabs && <TabButton active={tab==='invoice'} onClick={() => setTab('invoice')} icon={<FileText size={18} />} label="Invoices" />}
          {showMoneyTabs && <TabButton active={tab==='payroll'} onClick={() => setTab('payroll')} icon={<DollarSign size={18} />} label="Payroll" />}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, badge }) {
  return (
    <button onClick={onClick}
      className={`relative flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-xl transition-colors ${active ? 'bg-stone-900 text-stone-50' : 'text-stone-500 hover:text-stone-900'}`}>
      {icon}
      <span className="text-[9px] font-mono uppercase tracking-wider">{label}</span>
      {badge > 0 && (
        <span className="absolute top-0 right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-600 text-white text-[9px] font-mono font-bold flex items-center justify-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

// =================================================================
// MANAGER DASHBOARD
// =================================================================
function ManagerDashboard({ employee, onSignOut }) {
  const [shifts, setShifts] = useState([]);
  const [view, setView] = useState('shifts');
  const [selectedShift, setSelectedShift] = useState(null);
  const [filter, setFilter] = useState('week');
  const [subView, setSubView] = useState('list'); // 'list' | 'today'
  const [loaded, setLoaded] = useState(false);
  const [liveSheetOpen, setLiveSheetOpen] = useState(false);
  const showMoney = canSeeMoney(employee);

  const load = useCallback(async () => {
    const sinceDays = filter === 'today' ? 1 : filter === 'week' ? 7 : 365;
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('shifts')
      .select('*, employee:employees(id,name), customer:customers(id,name,property_type,bill_rate_hourly), work_blocks(id, end_time, start_time, bill_rate_at_work, unit:units(label), party:parties(label))')
      .gte('start_time', since)
      .order('start_time', { ascending: false });
    setShifts(data || []); setLoaded(true);
  }, [filter]);
  useEffect(() => { load(); }, [load, view]);

  if (!loaded) return <Splash text="Loading dashboard…" />;
  if (view === 'detail' && selectedShift) {
    return <ShiftDetail shiftId={selectedShift.id} viewerRole={employee.role}
      onBack={() => { setView('shifts'); setSelectedShift(null); load(); }} />;
  }

  const activeCount = shifts.filter(s => !s.end_time).length;
  const totalHours = shifts.filter(s => s.end_time)
    .reduce((sum, s) => sum + (new Date(s.end_time) - new Date(s.start_time)), 0);
  // Total billable across all shifts (only used if showMoney)
  let totalBillable = 0;
  if (showMoney) {
    shifts.forEach(s => {
      if (!s.end_time) return;
      if (s.customer?.property_type === 'multi_unit') {
        (s.work_blocks || []).forEach(b => {
          if (!b.end_time) return;
          const h = (new Date(b.end_time) - new Date(b.start_time)) / 1000 / 3600;
          totalBillable += h * (b.bill_rate_at_work || s.customer?.bill_rate_hourly || 0);
        });
      } else if (s.bill_rate_at_work) {
        const h = (new Date(s.end_time) - new Date(s.start_time)) / 1000 / 3600;
        totalBillable += h * s.bill_rate_at_work;
      }
    });
  }

  return (
    <div className="pb-24">
      <Header name={employee.name} onSignOut={onSignOut} role={employee.role} />
      <div className="px-5 pt-6">
        <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-3">
          {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}
        </div>
        <h1 className="text-4xl font-light text-stone-900 tracking-tight mb-6">
          Dash<span className="font-serif italic text-amber-700">board</span>
        </h1>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard label="On the clock" value={activeCount} unit="now" highlight={activeCount > 0}
            onClick={() => setLiveSheetOpen(true)} />
          <StatCard label={`${filter === 'today' ? 'Today' : filter === 'week' ? 'Week' : 'Total'} hours`} value={fmtTimeShort(totalHours)} />
          {showMoney ? (
            <StatCard label="Billable" value={fmtMoney(totalBillable)} accent />
          ) : (
            <StatCard label="Shifts" value={shifts.length} unit="logged" />
          )}
          <StatCard label="Active" value={activeCount} unit="cleaners"
            onClick={() => setLiveSheetOpen(true)} />
        </div>
      </div>
      <div className="px-5 mb-4 flex gap-2">
        {[{ id:'today', label:'Today' }, { id:'week', label:'This week' }, { id:'all', label:'All time' }].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === f.id ? 'bg-stone-900 text-stone-50' : 'bg-stone-100 text-stone-600'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* New: sub-view toggle (List of shifts vs grouped-by-apartment) */}
      <div className="px-5 mb-4 flex gap-2 border-b border-stone-200 pb-3">
        <button onClick={() => setSubView('list')}
          className={`px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider transition-colors ${subView === 'list' ? 'bg-stone-200 text-stone-900' : 'text-stone-500'}`}>
          Shift list
        </button>
        <button onClick={() => setSubView('today')}
          className={`px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider transition-colors ${subView === 'today' ? 'bg-stone-200 text-stone-900' : 'text-stone-500'}`}>
          By apartment / party
        </button>
      </div>

      {subView === 'today' ? (
        <GroupedByPartyView shifts={shifts} showMoney={showMoney}
          onOpenShift={(s) => { setSelectedShift(s); setView('detail'); }} />
      ) : (
        <ShiftList shifts={shifts} showMoney={showMoney}
          onOpen={(s) => { setSelectedShift(s); setView('detail'); }} />
      )}

      {liveSheetOpen && (
        <LiveCleanersSheet
          onClose={() => setLiveSheetOpen(false)}
          onOpenShift={(s) => { setLiveSheetOpen(false); setSelectedShift(s); setView('detail'); }} />
      )}
    </div>
  );
}

// Plain shift list (existing behavior, just extracted)
function ShiftList({ shifts, showMoney, onOpen }) {
  return (
    <div className="px-5">
      <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">Shifts ({shifts.length})</div>
      {shifts.length === 0 ? (
        <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">No shifts in this period.</div>
      ) : (
        <div className="space-y-2">
          {shifts.map(s => {
            const dur = (s.end_time ? new Date(s.end_time) : new Date()) - new Date(s.start_time);
            const blockCount = s.work_blocks?.length || 0;
            // Per-shift billable
            let billable = 0;
            if (showMoney && s.end_time) {
              if (s.customer?.property_type === 'multi_unit') {
                billable = (s.work_blocks || []).reduce((sum, b) => {
                  if (!b.end_time) return sum;
                  const h = (new Date(b.end_time) - new Date(b.start_time)) / 1000 / 3600;
                  return sum + h * (b.bill_rate_at_work || s.customer?.bill_rate_hourly || 0);
                }, 0);
              } else if (s.bill_rate_at_work) {
                billable = (dur / 1000 / 3600) * s.bill_rate_at_work;
              }
            }
            return (
              <button key={s.id} onClick={() => onOpen(s)}
                className="w-full text-left p-4 rounded-2xl bg-white border border-stone-200 hover:border-stone-400 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {!s.end_time && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                    <span className="font-serif text-lg text-stone-900">{s.employee?.name}</span>
                  </div>
                  <span className="text-xs text-stone-500 font-mono">{fmtDate(s.start_time)}</span>
                </div>
                {s.customer && (
                  <div className="text-xs text-amber-700 font-mono mb-2 flex items-center gap-1.5">
                    <Building2 size={11} /> {s.customer.name}
                    {blockCount > 0 && <span className="text-stone-500">· {blockCount} {blockCount === 1 ? 'block' : 'blocks'}</span>}
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-stone-500 font-mono">
                  <span>{fmtClock(s.start_time)} {s.end_time ? `— ${fmtClock(s.end_time)}` : '— active'} · {fmtTimeShort(dur)}</span>
                  <span className="flex items-center gap-2">
                    {showMoney && billable > 0 && <span className="text-emerald-700 font-medium">{fmtMoney(billable)}</span>}
                    <ChevronRight size={14} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// New: groups all work into Property → Unit → Party rows showing who worked it and for how long
function GroupedByPartyView({ shifts, showMoney, onOpenShift }) {
  // Flatten every work_block from every shift into a list, plus simple-property shifts as standalone rows
  const rows = [];
  shifts.forEach(s => {
    if (s.customer?.property_type === 'multi_unit' && s.work_blocks?.length) {
      s.work_blocks.forEach(b => {
        rows.push({
          kind: 'block',
          shift: s,
          block: b,
          property: s.customer?.name || 'Unknown',
          unit: b.unit?.label || '—',
          party: b.party?.label || '—',
          employee: s.employee?.name || '—',
          start: b.start_time,
          end: b.end_time,
          rate: b.bill_rate_at_work || s.customer?.bill_rate_hourly || 0
        });
      });
    } else {
      rows.push({
        kind: 'shift',
        shift: s,
        property: s.customer?.name || 'No property',
        unit: '—',
        party: '—',
        employee: s.employee?.name || '—',
        start: s.start_time,
        end: s.end_time,
        rate: s.bill_rate_at_work || 0
      });
    }
  });

  // Group by property + unit + party
  const groups = {};
  rows.forEach(r => {
    const key = `${r.property}::${r.unit}::${r.party}`;
    if (!groups[key]) groups[key] = { property: r.property, unit: r.unit, party: r.party, entries: [] };
    groups[key].entries.push(r);
  });

  // Group those further by property for display
  const byProperty = {};
  Object.values(groups).forEach(g => {
    if (!byProperty[g.property]) byProperty[g.property] = [];
    byProperty[g.property].push(g);
  });

  // Sort each property's entries naturally by unit then party
  Object.values(byProperty).forEach(arr => {
    arr.sort((a, b) => naturalCompare(a.unit, b.unit) || naturalCompare(a.party, b.party));
  });

  const propertyNames = Object.keys(byProperty).sort();

  if (propertyNames.length === 0) {
    return (
      <div className="px-5">
        <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
          No work in this period.
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 space-y-6">
      {propertyNames.map(propName => {
        const propGroups = byProperty[propName];
        const propTotalMs = propGroups.reduce((sum, g) =>
          sum + g.entries.reduce((s, e) => s + ((e.end ? new Date(e.end) : new Date()) - new Date(e.start)), 0), 0);
        const propTotalBillable = !showMoney ? 0 : propGroups.reduce((sum, g) =>
          sum + g.entries.reduce((s, e) => {
            if (!e.end) return s;
            const h = (new Date(e.end) - new Date(e.start)) / 1000 / 3600;
            return s + h * (e.rate || 0);
          }, 0), 0);

        return (
          <div key={propName}>
            <div className="flex items-baseline justify-between mb-2 pb-2 border-b border-stone-200">
              <h3 className="font-serif text-xl text-stone-900 flex items-center gap-2">
                <Building2 size={16} /> {propName}
              </h3>
              <div className="font-mono text-xs text-stone-500">
                {fmtTimeShort(propTotalMs)}
                {showMoney && propTotalBillable > 0 && (
                  <> · <span className="text-emerald-700">{fmtMoney(propTotalBillable)}</span></>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {propGroups.map(g => {
                const totalMs = g.entries.reduce((s, e) =>
                  s + ((e.end ? new Date(e.end) : new Date()) - new Date(e.start)), 0);
                const totalBillable = !showMoney ? 0 : g.entries.reduce((s, e) => {
                  if (!e.end) return s;
                  const h = (new Date(e.end) - new Date(e.start)) / 1000 / 3600;
                  return s + h * (e.rate || 0);
                }, 0);
                const hasLive = g.entries.some(e => !e.end);

                return (
                  <div key={`${g.unit}::${g.party}`} className="bg-white border border-stone-200 rounded-2xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-serif text-base text-stone-900 flex items-center gap-2 flex-wrap">
                          {g.unit !== '—' && <span>{g.unit}</span>}
                          {g.party !== '—' && <span className="italic text-amber-700">· {g.party}</span>}
                          {hasLive && (
                            <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                              live
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-stone-500 font-mono mt-0.5">
                          Total: {fmtTimeShort(totalMs)}
                          {showMoney && totalBillable > 0 && (
                            <> · <span className="text-emerald-700 font-medium">{fmtMoney(totalBillable)}</span></>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Per-employee rows */}
                    <div className="mt-3 space-y-1.5">
                      {g.entries.map((e, i) => {
                        const dur = (e.end ? new Date(e.end) : new Date()) - new Date(e.start);
                        const billable = showMoney && e.end ? (dur / 1000 / 3600) * (e.rate || 0) : 0;
                        return (
                          <button key={i} onClick={() => onOpenShift(e.shift)}
                            className="w-full text-left flex items-center justify-between p-2 -m-2 rounded-lg hover:bg-stone-50 transition-colors">
                            <div className="flex items-center gap-2 min-w-0">
                              <User size={12} className="text-stone-400 flex-shrink-0" />
                              <span className="text-sm text-stone-900 truncate">{e.employee}</span>
                              <span className="text-xs text-stone-500 font-mono flex-shrink-0">
                                {fmtClock(e.start)}{e.end ? `–${fmtClock(e.end)}` : ' →'}
                              </span>
                            </div>
                            <div className="text-xs font-mono text-stone-700 flex items-center gap-2 flex-shrink-0">
                              {fmtTimeShort(dur)}
                              {showMoney && billable > 0 && <span className="text-emerald-700">{fmtMoney(billable)}</span>}
                              <ChevronRight size={12} className="text-stone-400" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ label, value, unit, highlight, accent, onClick }) {
  const className = `p-4 rounded-2xl text-left w-full transition-transform ${highlight ? 'bg-stone-900 text-stone-50' : accent ? 'bg-amber-50 border border-amber-200' : 'bg-white border border-stone-200'} ${onClick ? 'active:scale-98 hover:opacity-90 cursor-pointer' : ''}`;
  const content = (
    <>
      <div className={`text-xs uppercase tracking-wider font-mono mb-1 flex items-center justify-between ${highlight ? 'text-stone-400' : accent ? 'text-amber-700' : 'text-stone-500'}`}>
        <span>{label}</span>
        {onClick && <ChevronRight size={11} className="opacity-60" />}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-serif ${accent ? 'text-amber-900' : ''}`}>{value}</span>
        {unit && <span className={`text-xs font-mono ${highlight ? 'text-stone-400' : 'text-stone-500'}`}>{unit}</span>}
      </div>
    </>
  );
  if (onClick) return <button onClick={onClick} className={className}>{content}</button>;
  return <div className={className}>{content}</div>;
}

// =================================================================
// SHIFT DETAIL (shows work blocks for multi-unit)
// =================================================================
function ShiftDetail({ shiftId, viewerRole, onBack }) {
  const showMoney = viewerRole === 'owner';
  const canEdit = viewerRole === 'owner' || viewerRole === 'manager';
  const [shift, setShift] = useState(null);
  const [workBlocks, setWorkBlocks] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [editingShift, setEditingShift] = useState(false);
  const [deletingShift, setDeletingShift] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null); // block obj
  const [deletingBlock, setDeletingBlock] = useState(null); // block obj
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const { data: s } = await supabase
      .from('shifts').select('*, employee:employees(name), customer:customers(name,address,property_type,bill_rate_hourly)')
      .eq('id', shiftId).single();
    setShift(s);
    if (s?.customer?.property_type === 'multi_unit') {
      const { data: wbs } = await supabase
        .from('work_blocks')
        .select('*, unit:units(label), party:parties(label,full_name), tasks(*, photos(*))')
        .eq('shift_id', shiftId).order('start_time');
      setWorkBlocks(wbs || []);
    } else {
      const { data: ts } = await supabase
        .from('tasks').select('*, photos(*)')
        .eq('shift_id', shiftId).is('work_block_id', null)
        .order('start_time');
      setTasks(ts || []);
    }
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [shiftId]);

  const saveShiftTimes = async (startISO, endISO) => {
    setBusy(true);
    const { error } = await supabase.from('shifts')
      .update({ start_time: startISO, end_time: endISO || null })
      .eq('id', shiftId);
    setBusy(false);
    if (error) { alert('Could not save: ' + error.message); return; }
    setEditingShift(false);
    reload();
  };

  const deleteShift = async () => {
    setBusy(true);
    // Cascade should handle work_blocks/tasks/photos via the original schema
    const { error } = await supabase.from('shifts').delete().eq('id', shiftId);
    setBusy(false);
    if (error) { alert('Could not delete: ' + error.message); return; }
    setDeletingShift(false);
    onBack();
  };

  const saveBlockTimes = async (block, startISO, endISO) => {
    setBusy(true);
    const { error } = await supabase.from('work_blocks')
      .update({ start_time: startISO, end_time: endISO || null })
      .eq('id', block.id);
    setBusy(false);
    if (error) { alert('Could not save: ' + error.message); return; }
    setEditingBlock(null);
    reload();
  };

  const deleteBlock = async (block) => {
    setBusy(true);
    const { error } = await supabase.from('work_blocks').delete().eq('id', block.id);
    setBusy(false);
    if (error) { alert('Could not delete: ' + error.message); return; }
    setDeletingBlock(null);
    reload();
  };

  if (!shift) return <Splash text="Loading…" />;
  const dur = (shift.end_time ? new Date(shift.end_time) : new Date()) - new Date(shift.start_time);
  const isMulti = shift.customer?.property_type === 'multi_unit';

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <div className="bg-stone-900 text-stone-50 px-5 pt-5 pb-8">
        <button onClick={onBack} className="flex items-center gap-2 text-stone-400 text-sm mb-4 hover:text-stone-50">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-2">
          Shift detail · {fmtDate(shift.start_time)}
        </div>
        <h1 className="text-3xl font-light tracking-tight mb-2">
          <span className="font-serif italic text-amber-500">{shift.employee?.name}</span>
        </h1>
        {shift.customer && (
          <div className="text-sm text-stone-300 mb-2 flex items-center gap-1.5">
            <Building2 size={14} /> {shift.customer.name}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 text-sm mt-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-400 font-mono mb-1">Total</div>
            <div className="font-mono text-lg">{fmtTimeShort(dur)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-400 font-mono mb-1">{isMulti ? 'Blocks' : 'Tasks'}</div>
            <div className="font-mono text-lg">{isMulti ? workBlocks.length : tasks.length}</div>
          </div>
        </div>
      </div>
      <div className="px-5 pt-6">
        {isMulti ? (
          <>
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">Work blocks</div>
            {workBlocks.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">No work blocks.</div>
            ) : (
              <div className="space-y-3">
                {workBlocks.map(b => <WorkBlockDetail key={b.id} block={b} rate={shift.customer?.bill_rate_hourly} showMoney={showMoney}
                  canEdit={canEdit}
                  onEdit={() => setEditingBlock(b)}
                  onDelete={() => setDeletingBlock(b)} />)}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">Task log</div>
            {tasks.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">No tasks logged.</div>
            ) : (
              <div className="space-y-3">{tasks.map(t => <TaskDetail key={t.id} task={t} />)}</div>
            )}
          </>
        )}

        {/* Owner/manager-only edit & delete actions for the whole shift */}
        {canEdit && (
          <div className="mt-8 pt-6 border-t border-stone-200 space-y-2">
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">Shift actions</div>
            <button onClick={() => setEditingShift(true)}
              className="w-full py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              disabled={busy}>
              <Edit2 size={14} /> Edit clock-in / clock-out times
            </button>
            <button onClick={() => setDeletingShift(true)}
              className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-700 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              disabled={busy}>
              <Trash2 size={14} /> Delete shift
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {editingShift && shift && (
        <TimeEditModal
          title="Edit shift times"
          subtitle={`${shift.employee?.name} · ${shift.customer?.name || 'No property'}`}
          startTime={shift.start_time}
          endTime={shift.end_time}
          busy={busy}
          onSave={saveShiftTimes}
          onClose={() => setEditingShift(false)} />
      )}
      {deletingShift && shift && (
        <DeleteConfirmModal
          title="Delete this shift?"
          description="This will permanently delete the entire shift, including all work blocks, tasks, and photos. This cannot be undone."
          itemSummary={`${shift.employee?.name} · ${fmtDate(shift.start_time)} · ${shift.customer?.name || 'No property'}`}
          busy={busy}
          onConfirm={deleteShift}
          onClose={() => setDeletingShift(false)} />
      )}
      {editingBlock && (
        <TimeEditModal
          title="Edit work block times"
          subtitle={`${editingBlock.unit?.label || ''} · ${editingBlock.party?.label || ''}`}
          startTime={editingBlock.start_time}
          endTime={editingBlock.end_time}
          busy={busy}
          onSave={(s, e) => saveBlockTimes(editingBlock, s, e)}
          onClose={() => setEditingBlock(null)} />
      )}
      {deletingBlock && (
        <DeleteConfirmModal
          title="Delete this work block?"
          description="This removes the work block and all its tasks and photos, but keeps the rest of the shift intact."
          itemSummary={`${deletingBlock.unit?.label || ''} · ${deletingBlock.party?.label || ''}`}
          busy={busy}
          onConfirm={() => deleteBlock(deletingBlock)}
          onClose={() => setDeletingBlock(null)} />
      )}
    </div>
  );
}

// =================================================================
// Edit/delete modals
// =================================================================

// Convert an ISO timestamp into the value format the <input type="datetime-local"> expects:
// YYYY-MM-DDTHH:MM in *local* time (no timezone suffix).
function isoToLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// And the reverse: convert "YYYY-MM-DDTHH:MM" local-time string into a UTC ISO string.
function localInputToISO(local) {
  if (!local) return null;
  // new Date('YYYY-MM-DDTHH:MM') is interpreted as local time
  return new Date(local).toISOString();
}

function TimeEditModal({ title, subtitle, startTime, endTime, busy, onSave, onClose }) {
  const [startVal, setStartVal] = useState(isoToLocalInput(startTime));
  const [endVal, setEndVal] = useState(isoToLocalInput(endTime));
  const [error, setError] = useState('');

  const handleSave = () => {
    setError('');
    if (!startVal) { setError('Start time is required.'); return; }
    const startISO = localInputToISO(startVal);
    const endISO = endVal ? localInputToISO(endVal) : null;
    if (endISO && new Date(endISO) <= new Date(startISO)) {
      setError('End time must be after start time.');
      return;
    }
    onSave(startISO, endISO);
  };

  const clearEnd = () => setEndVal('');

  return (
    <div className="fixed inset-0 bg-stone-900/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-stone-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <div>
            <div className="font-serif text-xl text-stone-900">{title}</div>
            {subtitle && <div className="text-xs text-stone-500 font-mono mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-stone-100">
            <X size={20} className="text-stone-600" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Start time</label>
            <input type="datetime-local" value={startVal} onChange={(e) => setStartVal(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 font-mono" />
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="text-xs uppercase tracking-wider text-stone-500 font-mono">End time</label>
              {endVal && (
                <button onClick={clearEnd} type="button"
                  className="text-xs font-mono text-stone-500 hover:text-stone-900">Clear (still active)</button>
              )}
            </div>
            <input type="datetime-local" value={endVal} onChange={(e) => setEndVal(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 font-mono" />
            {!endVal && (
              <p className="text-xs text-stone-500 mt-1">Empty = still active (no clock-out yet).</p>
            )}
          </div>
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}
        </div>
        <div className="p-5 border-t border-stone-200 flex gap-2">
          <button onClick={onClose} disabled={busy}
            className="flex-1 py-3 rounded-2xl bg-stone-100 text-stone-700 font-medium disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={busy}
            className="flex-1 py-3 rounded-2xl bg-stone-900 text-stone-50 font-medium disabled:opacity-50">
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ title, description, itemSummary, busy, onConfirm, onClose }) {
  const [typed, setTyped] = useState('');
  const matches = typed.trim().toUpperCase() === 'DELETE';

  return (
    <div className="fixed inset-0 bg-stone-900/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-stone-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="text-red-600" size={20} />
            <div className="font-serif text-xl text-stone-900">{title}</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-stone-100">
            <X size={20} className="text-stone-600" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {itemSummary && (
            <div className="p-3 rounded-xl bg-stone-100 text-stone-800 text-sm font-mono">
              {itemSummary}
            </div>
          )}
          <p className="text-sm text-stone-700">{description}</p>
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
              Type <code className="font-mono bg-stone-200 px-1.5 py-0.5 rounded">DELETE</code> to confirm
            </label>
            <input type="text" value={typed} onChange={(e) => setTyped(e.target.value)}
              placeholder="DELETE"
              className="w-full px-4 py-3 rounded-xl border-2 border-stone-300 bg-white focus:outline-none focus:border-red-500 text-stone-900 font-mono uppercase tracking-widest" />
          </div>
        </div>
        <div className="p-5 border-t border-stone-200 flex gap-2">
          <button onClick={onClose} disabled={busy}
            className="flex-1 py-3 rounded-2xl bg-stone-100 text-stone-700 font-medium disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={busy || !matches}
            className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed">
            {busy ? 'Deleting…' : 'Delete forever'}
          </button>
        </div>
      </div>
    </div>
  );
}

function WorkBlockDetail({ block, rate, showMoney, canEdit, onEdit, onDelete }) {
  const dur = (block.end_time ? new Date(block.end_time) : new Date()) - new Date(block.start_time);
  const blockRate = block.bill_rate_at_work || rate || 0;
  const billable = block.end_time ? (dur / 1000 / 3600) * blockRate : 0;
  return (
    <div className="p-4 rounded-2xl bg-white border border-stone-200">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-serif text-lg text-stone-900">
            {block.unit?.label} · <span className="italic text-amber-700">{block.party?.label}</span>
          </div>
          {block.party?.full_name && <div className="text-xs text-stone-500">{block.party.full_name}</div>}
          <div className="text-xs text-stone-500 font-mono mt-1">
            {fmtClock(block.start_time)}{block.end_time && ` — ${fmtClock(block.end_time)}`} · {fmtTimeShort(dur)}
          </div>
        </div>
        {showMoney && billable > 0 && (
          <div className="text-right ml-2">
            <div className="font-mono text-sm text-emerald-700 font-medium">{fmtMoney(billable)}</div>
          </div>
        )}
      </div>
      {block.work_notes && <div className="text-xs text-stone-600 italic mt-2">"{block.work_notes}"</div>}
      {block.tasks?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-stone-100 space-y-3">
          {block.tasks.map(t => <TaskDetail key={t.id} task={t} compact />)}
        </div>
      )}
      {canEdit && (onEdit || onDelete) && (
        <div className="mt-3 pt-3 border-t border-stone-100 flex gap-2">
          {onEdit && (
            <button onClick={onEdit}
              className="flex-1 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-medium flex items-center justify-center gap-1.5">
              <Edit2 size={12} /> Edit times
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete}
              className="flex-1 py-2 rounded-xl border border-red-200 text-red-700 text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-red-50">
              <Trash2 size={12} /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TaskDetail({ task, compact }) {
  const before = (task.photos || []).filter(p => p.kind === 'before');
  const after  = (task.photos || []).filter(p => p.kind === 'after');
  const damage = (task.photos || []).filter(p => p.kind === 'damage');
  const dur = (task.end_time ? new Date(task.end_time) : new Date()) - new Date(task.start_time);
  return (
    <div className={compact ? '' : 'p-4 rounded-2xl bg-white border border-stone-200'}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-serif text-base text-stone-900">{task.name}</div>
            {damage.length > 0 && (
              <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                ⚠ Damage reported
              </span>
            )}
          </div>
          <div className="text-xs text-stone-500 font-mono">
            {fmtClock(task.start_time)}{task.end_time && ` — ${fmtClock(task.end_time)}`} · {fmtTimeShort(dur)}
          </div>
        </div>
        {!task.end_time && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-mono">live</span>}
      </div>
      {(before.length > 0 || after.length > 0 || damage.length > 0) && (
        <div className="grid grid-cols-3 gap-2 mt-2">
          <PhotoColumn label="Before" photos={before} />
          <PhotoColumn label="After"  photos={after} />
          <PhotoColumn label="Damage" photos={damage} highlight="red" />
        </div>
      )}
    </div>
  );
}

function PhotoColumn({ label, photos, highlight }) {
  const [zoom, setZoom] = useState(null);
  const isDamage = highlight === 'red';
  return (
    <div>
      <div className={`text-xs uppercase tracking-wider font-mono mb-1 flex items-center gap-1.5 ${isDamage ? 'text-red-700 font-semibold' : 'text-stone-500'}`}>
        {label}
        <span className={`font-mono ${isDamage ? 'text-red-700' : 'text-stone-400'}`}>({photos.length})</span>
      </div>
      {photos.length === 0 ? (
        <div className={`aspect-square rounded-lg border-2 border-dashed flex items-center justify-center ${isDamage ? 'border-red-200 text-red-200' : 'border-stone-200 text-stone-300'}`}>
          <Camera size={18} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1">
          {photos.slice(0, 4).map((p, i) => (
            <button key={p.id} onClick={() => setZoom(p.public_url)}
              className={`aspect-square rounded overflow-hidden relative ${isDamage ? 'ring-2 ring-red-400' : ''}`}>
              <img loading="lazy" src={p.public_url} alt="" className="w-full h-full object-cover" />
              {/* If we hide some, show a "+N" overlay on the last visible thumbnail */}
              {i === 3 && photos.length > 4 && (
                <div className="absolute inset-0 bg-stone-900/70 flex items-center justify-center text-stone-50 font-mono text-sm">
                  +{photos.length - 4}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
      {zoom && (
        <PhotoZoomViewer photos={photos} initialUrl={zoom} onClose={() => setZoom(null)} />
      )}
    </div>
  );
}

// Photo viewer that lets you swipe through all photos in a bucket
function PhotoZoomViewer({ photos, initialUrl, onClose }) {
  const startIdx = Math.max(0, photos.findIndex(p => p.public_url === initialUrl));
  const [idx, setIdx] = useState(startIdx);
  const photo = photos[idx];
  if (!photo) return null;
  return (
    <div className="fixed inset-0 bg-stone-900/95 z-50 flex flex-col items-center justify-center p-4">
      <button onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-stone-800 text-stone-50 z-10">
        <X size={20} />
      </button>
      <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-stone-800 text-stone-50 text-xs font-mono z-10">
        {idx + 1} / {photos.length}
      </div>
      <img loading="lazy" src={photo.public_url} alt="" className="max-w-full max-h-[85vh] rounded-xl" />
      {photos.length > 1 && (
        <div className="mt-4 flex items-center gap-3">
          <button onClick={() => setIdx((idx - 1 + photos.length) % photos.length)}
            className="px-4 py-2 rounded-full bg-stone-800 text-stone-50 text-sm">← Prev</button>
          <button onClick={() => setIdx((idx + 1) % photos.length)}
            className="px-4 py-2 rounded-full bg-stone-800 text-stone-50 text-sm">Next →</button>
        </div>
      )}
    </div>
  );
}

// =================================================================
// EMPLOYEE ADMIN
// =================================================================
function EmployeeAdmin({ employee, onSignOut }) {
  const [employees, setEmployees] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  const load = async () => {
    const { data } = await supabase.from('employees').select('*').order('active', { ascending: false }).order('name');
    setEmployees(data || []); setLoaded(true);
  };
  useEffect(() => { load(); }, []);
  if (!loaded) return <Splash text="Loading…" />;
  if (editing) {
    return <EmployeeForm employee={editing === 'new' ? null : editing} currentUserId={employee.id} currentUserRole={employee.role}
      onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />;
  }
  const visible = employees.filter(e => showInactive || e.active);
  const activeCount = employees.filter(e => e.active).length;
  return (
    <div className="pb-24">
      <Header name={employee.name} onSignOut={onSignOut} />
      <div className="px-5 pt-6">
        <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-3">Admin</div>
        <h1 className="text-4xl font-light text-stone-900 tracking-tight mb-2">
          Your <span className="font-serif italic text-amber-700">team</span>
        </h1>
        <p className="text-stone-500 text-sm mb-6">{activeCount} active</p>
        <button onClick={() => setEditing('new')}
          className="w-full mb-4 p-4 rounded-2xl bg-stone-900 text-stone-50 font-medium flex items-center justify-center gap-2 active:scale-98">
          <UserPlus size={18} /> Add employee
        </button>
        <button onClick={() => setShowInactive(!showInactive)} className="text-xs font-mono text-stone-500 mb-4 flex items-center gap-1.5">
          {showInactive ? <EyeOff size={12} /> : <Eye size={12} />}
          {showInactive ? 'Hide' : 'Show'} inactive ({employees.length - activeCount})
        </button>
        <div className="space-y-2">
          {visible.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">No employees yet.</div>
          ) : visible.map(e => (
            <button key={e.id} onClick={() => setEditing(e)}
              className={`w-full text-left p-4 rounded-2xl border ${e.active ? 'bg-white border-stone-200 hover:border-stone-400' : 'bg-stone-100 border-stone-200 opacity-60'}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-serif text-lg text-stone-900">{e.name}</span>
                    {e.role === 'owner' && <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Owner</span>}
                    {e.role === 'manager' && <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-stone-200 text-stone-700">Manager</span>}
                    {!e.active && <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-stone-200 text-stone-600">Inactive</span>}
                  </div>
                  <div className="text-xs text-stone-500 font-mono">PIN: •••• {e.id === employee.id && '· (you)'}</div>
                </div>
                <ChevronRight size={16} className="text-stone-400" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmployeeForm({ employee, currentUserId, currentUserRole, onCancel, onSaved }) {
  const isNew = !employee;
  const [name, setName] = useState(employee?.name || '');
  const [pin, setPin] = useState(employee?.pin || '');
  const [role, setRole] = useState(employee?.role || 'employee');
  const [active, setActive] = useState(employee?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isSelf = employee?.id === currentUserId;
  const canEditOwner = currentUserRole === 'owner';
  const save = async () => {
    setError('');
    if (!name.trim()) { setError('Name is required'); return; }
    if (!/^\d{4}$/.test(pin)) { setError('PIN must be exactly 4 digits'); return; }
    setBusy(true);
    const payload = { name: name.trim(), pin, role, active };
    const { error: e } = isNew
      ? await supabase.from('employees').insert(payload)
      : await supabase.from('employees').update(payload).eq('id', employee.id);
    setBusy(false);
    if (e) { setError(e.message.includes('duplicate') ? 'That PIN is already in use' : e.message); return; }
    onSaved();
  };
  const remove = async () => {
    if (isSelf) { alert("You can't delete your own account."); return; }
    if (!confirm(`Delete ${employee.name}? This will also delete all shift history.`)) return;
    setBusy(true);
    const { error: e } = await supabase.from('employees').delete().eq('id', employee.id);
    setBusy(false);
    if (e) { alert('Could not delete: ' + e.message); return; }
    onSaved();
  };
  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button onClick={onCancel} className="p-2 -ml-2 rounded-full hover:bg-stone-100">
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div>
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">{isNew ? 'Add' : 'Edit'} employee</div>
          <div className="font-serif text-xl text-stone-900">{isNew ? 'New person' : employee.name}</div>
        </div>
      </div>
      <div className="px-5 pt-6 space-y-5">
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maria S."
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">4-digit PIN</label>
          <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={4} value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="0000"
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 font-mono text-2xl tracking-widest" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Role</label>
          <div className={`grid gap-2 ${canEditOwner ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <button onClick={() => setRole('employee')} type="button"
              className={`p-3 rounded-xl border-2 text-left ${role === 'employee' ? 'border-stone-900 bg-white' : 'border-stone-200 bg-white/50'}`}>
              <div className="font-medium text-stone-900 text-sm">Employee</div>
            </button>
            <button onClick={() => setRole('manager')} type="button"
              className={`p-3 rounded-xl border-2 text-left ${role === 'manager' ? 'border-stone-900 bg-white' : 'border-stone-200 bg-white/50'}`}>
              <div className="font-medium text-stone-900 text-sm">Manager</div>
            </button>
            {canEditOwner && (
              <button onClick={() => setRole('owner')} type="button"
                className={`p-3 rounded-xl border-2 text-left ${role === 'owner' ? 'border-amber-700 bg-amber-50' : 'border-stone-200 bg-white/50'}`}>
                <div className="font-medium text-stone-900 text-sm">Owner</div>
              </button>
            )}
          </div>
          {role === 'owner' && (
            <p className="text-xs text-amber-700 mt-2">⚠ Owners have full admin access including bill rates and pay info.</p>
          )}
        </div>
        <div className="p-4 rounded-2xl bg-white border border-stone-200">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-medium text-stone-900 text-sm">Active</div>
              <div className="text-xs text-stone-500">Inactive employees can't sign in</div>
            </div>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}
              className="w-5 h-5 rounded accent-stone-900" />
          </label>
        </div>
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}
        <button onClick={save} disabled={busy}
          className="w-full py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium active:scale-98 disabled:opacity-50">
          {busy ? 'Saving…' : isNew ? 'Add employee' : 'Save changes'}
        </button>
        {!isNew && !isSelf && (
          <button onClick={remove} disabled={busy}
            className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-700 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50">
            <Trash2 size={14} /> Delete employee
          </button>
        )}
      </div>
    </div>
  );
}

// =================================================================
// PROPERTY ADMIN
// =================================================================
function PropertyAdmin({ employee, onSignOut }) {
  const [view, setView] = useState({ kind: 'list' });
  const [props, setProps] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const load = async () => {
    const { data } = await supabase.from('customers').select('*').order('active', { ascending: false }).order('name');
    setProps(data || []); setLoaded(true);
  };
  useEffect(() => { load(); }, []);
  if (!loaded) return <Splash text="Loading…" />;
  if (view.kind === 'property-edit') {
    return <PropertyForm property={view.property} currentUserRole={employee.role}
      onCancel={() => setView({ kind: 'list' })}
      onSaved={() => { setView({ kind: 'list' }); load(); }}
      onManageAssignments={view.property
        ? () => setView({ kind: 'assignment-list', property: view.property })
        : null} />;
  }
  if (view.kind === 'unit-list') {
    return <UnitList property={view.property}
      onBack={() => { setView({ kind: 'list' }); load(); }}
      onEditProperty={() => setView({ kind: 'property-edit', property: view.property })}
      onUnitOpen={(unit) => setView({ kind: 'party-list', property: view.property, unit })}
      onUnitEdit={(unit) => setView({ kind: 'unit-edit', property: view.property, unit })}
      onUnitNew={() => setView({ kind: 'unit-edit', property: view.property, unit: null })}
      onBulkNew={() => setView({ kind: 'bulk-create', property: view.property })}
      onAssignments={() => setView({ kind: 'assignment-list', property: view.property })} />;
  }
  if (view.kind === 'bulk-create') {
    return <BulkCreateUnits property={view.property}
      onCancel={() => setView({ kind: 'unit-list', property: view.property })}
      onSaved={() => setView({ kind: 'unit-list', property: view.property })} />;
  }
  if (view.kind === 'unit-edit') {
    return <UnitForm property={view.property} unit={view.unit}
      onCancel={() => setView({ kind: 'unit-list', property: view.property })}
      onSaved={() => setView({ kind: 'unit-list', property: view.property })} />;
  }
  if (view.kind === 'party-list') {
    return <PartyList property={view.property} unit={view.unit}
      onBack={() => setView({ kind: 'unit-list', property: view.property })}
      onPartyEdit={(party) => setView({ kind: 'party-edit', property: view.property, unit: view.unit, party })}
      onPartyNew={() => setView({ kind: 'party-edit', property: view.property, unit: view.unit, party: null })} />;
  }
  if (view.kind === 'party-edit') {
    return <PartyForm property={view.property} unit={view.unit} party={view.party}
      onCancel={() => setView({ kind: 'party-list', property: view.property, unit: view.unit })}
      onSaved={() => setView({ kind: 'party-list', property: view.property, unit: view.unit })} />;
  }
  if (view.kind === 'assignment-list') {
    return <AssignmentList property={view.property} employee={employee}
      onBack={() => {
        if (view.property.property_type === 'multi_unit') setView({ kind: 'unit-list', property: view.property });
        else setView({ kind: 'list' });
      }}
      onNew={() => setView({ kind: 'assignment-new', property: view.property })}
      onOpen={(a) => setView({ kind: 'assignment-detail', property: view.property, assignment: a })} />;
  }
  if (view.kind === 'assignment-new') {
    return <AssignmentForm property={view.property} employee={employee}
      onCancel={() => setView({ kind: 'assignment-list', property: view.property })}
      onSaved={() => setView({ kind: 'assignment-list', property: view.property })} />;
  }
  if (view.kind === 'assignment-detail') {
    return <AssignmentDetail property={view.property} assignment={view.assignment} employee={employee}
      onBack={() => setView({ kind: 'assignment-list', property: view.property })} />;
  }
  if (view.kind === 'all-open-assignments') {
    return <AllOpenAssignments employee={employee}
      onBack={() => setView({ kind: 'list' })}
      onOpenAssignment={(property, assignment) =>
        setView({ kind: 'assignment-detail', property, assignment })} />;
  }
  const visible = props.filter(p => showInactive || p.active);
  const activeCount = props.filter(p => p.active).length;
  return (
    <div className="pb-24">
      <Header name={employee.name} onSignOut={onSignOut} />
      <div className="px-5 pt-6">
        <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-3">Admin</div>
        <h1 className="text-4xl font-light text-stone-900 tracking-tight mb-2">
          Your <span className="font-serif italic text-amber-700">properties</span>
        </h1>
        <p className="text-stone-500 text-sm mb-6">{activeCount} active</p>
        <button onClick={() => setView({ kind: 'property-edit', property: null })}
          className="w-full mb-2 p-4 rounded-2xl bg-stone-900 text-stone-50 font-medium flex items-center justify-center gap-2 active:scale-98">
          <Plus size={18} /> Add property
        </button>
        <button onClick={() => setView({ kind: 'all-open-assignments' })}
          className="w-full mb-4 p-3 rounded-2xl bg-white border-2 border-stone-300 text-stone-800 text-sm font-medium flex items-center justify-center gap-2 active:scale-98 hover:border-stone-900">
          <FileText size={16} /> View all open assignments
        </button>
        <button onClick={() => setShowInactive(!showInactive)} className="text-xs font-mono text-stone-500 mb-4 flex items-center gap-1.5">
          {showInactive ? <EyeOff size={12} /> : <Eye size={12} />}
          {showInactive ? 'Hide' : 'Show'} inactive ({props.length - activeCount})
        </button>
        <div className="space-y-2">
          {visible.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">No properties yet.</div>
          ) : visible.map(p => (
            <button key={p.id}
              onClick={() => p.property_type === 'multi_unit' ? setView({ kind: 'unit-list', property: p }) : setView({ kind: 'property-edit', property: p })}
              className={`w-full text-left p-4 rounded-2xl border transition-colors ${p.active ? 'bg-white border-stone-200 hover:border-stone-400' : 'bg-stone-100 border-stone-200 opacity-60'}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-serif text-lg text-stone-900">{p.name}</span>
                    {p.property_type === 'multi_unit' && (
                      <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Multi-unit</span>
                    )}
                    {!p.active && <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-stone-200 text-stone-600">Inactive</span>}
                  </div>
                  {p.address && (
                    <div className="text-xs text-stone-500 font-mono flex items-center gap-1">
                      <MapPin size={11} /> {p.address}
                    </div>
                  )}
                  {canSeeMoney(employee) && (
                  <div className="flex items-center gap-3 mt-2 text-xs text-stone-600">
                    {p.bill_mode === 'hourly' && p.bill_rate_hourly && (
                      <span className="flex items-center gap-1"><DollarSign size={11} />{Number(p.bill_rate_hourly).toFixed(2)}/hr</span>
                    )}
                    {p.bill_mode === 'flat' && p.flat_rate_amount && (
                      <span className="flex items-center gap-1"><DollarSign size={11} />{Number(p.flat_rate_amount).toFixed(2)} flat</span>
                    )}
                  </div>
                  )}
                </div>
                <ChevronRight size={16} className="text-stone-400 flex-shrink-0 ml-2 mt-1" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PropertyForm({ property, currentUserRole, onCancel, onSaved, onManageAssignments }) {
  const isNew = !property;
  const [name, setName] = useState(property?.name || '');
  const [address, setAddress] = useState(property?.address || '');
  const [notes, setNotes] = useState(property?.notes || '');
  const [type, setType] = useState(property?.property_type || 'simple');
  const [billMode, setBillMode] = useState(property?.bill_mode || 'hourly');
  const [hourlyRate, setHourlyRate] = useState(property?.bill_rate_hourly?.toString() || '');
  const [flatAmount, setFlatAmount] = useState(property?.flat_rate_amount?.toString() || '');
  const [portalCode, setPortalCode] = useState(property?.portal_code || '');
  const [portalStartDate, setPortalStartDate] = useState(property?.portal_start_date || '');
  const [active, setActive] = useState(property?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canEditMoney = currentUserRole === 'owner';
  useEffect(() => {
    if (type === 'multi_unit' && billMode === 'flat') setBillMode('hourly');
  }, [type, billMode]);

  // Generate a memorable portal code: word + 4 digits
  const generatePortalCode = () => {
    const words = ['sunset','meadow','cedar','river','maple','ridge','vista','grove','summit','aspen','willow','birch'];
    const w = words[Math.floor(Math.random() * words.length)];
    const n = String(Math.floor(1000 + Math.random() * 9000));
    setPortalCode(`${w}${n}`);
  };
  const save = async () => {
    setError('');
    if (!name.trim()) { setError('Name is required'); return; }
    setBusy(true);
    const payload = {
      name: name.trim(), address: address.trim() || null, notes: notes.trim() || null,
      property_type: type, bill_mode: billMode,
      bill_rate_hourly: billMode === 'hourly' && hourlyRate ? parseFloat(hourlyRate) : null,
      flat_rate_amount: billMode === 'flat' && flatAmount ? parseFloat(flatAmount) : null,
      portal_code: portalCode.trim() || null,
      portal_start_date: portalStartDate || null,
      active
    };
    const { error: e } = isNew
      ? await supabase.from('customers').insert(payload)
      : await supabase.from('customers').update(payload).eq('id', property.id);
    setBusy(false);
    if (e) {
      setError(e.message.includes('duplicate') && e.message.includes('portal_code')
        ? 'That portal code is already in use by another property — pick another.'
        : e.message);
      return;
    }
    onSaved();
  };
  const remove = async () => {
    if (!confirm(`Delete "${property.name}"? All units, parties, and shift history will be removed.`)) return;
    setBusy(true);
    const { error: e } = await supabase.from('customers').delete().eq('id', property.id);
    setBusy(false);
    if (e) { alert('Could not delete: ' + e.message); return; }
    onSaved();
  };
  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button onClick={onCancel} className="p-2 -ml-2 rounded-full hover:bg-stone-100">
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div>
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">{isNew ? 'Add' : 'Edit'} property</div>
          <div className="font-serif text-xl text-stone-900">{isNew ? 'New property' : property.name}</div>
        </div>
      </div>
      <div className="px-5 pt-6 space-y-5">
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Property name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunset Apartments"
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setType('simple')} type="button"
              className={`p-3 rounded-xl border-2 text-left ${type === 'simple' ? 'border-stone-900 bg-white' : 'border-stone-200 bg-white/50'}`}>
              <div className="font-medium text-stone-900 text-sm">Simple</div>
              <div className="text-xs text-stone-500">One bill, one place</div>
            </button>
            <button onClick={() => setType('multi_unit')} type="button"
              className={`p-3 rounded-xl border-2 text-left ${type === 'multi_unit' ? 'border-stone-900 bg-white' : 'border-stone-200 bg-white/50'}`}>
              <div className="font-medium text-stone-900 text-sm">Multi-unit</div>
              <div className="text-xs text-stone-500">Apartments with bedrooms</div>
            </button>
          </div>
        </div>
        {canEditMoney && (
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Bill mode</label>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button onClick={() => setBillMode('hourly')} type="button"
              className={`p-3 rounded-xl border-2 text-left ${billMode === 'hourly' ? 'border-stone-900 bg-white' : 'border-stone-200 bg-white/50'}`}>
              <div className="font-medium text-stone-900 text-sm">Hourly</div>
            </button>
            <button onClick={() => setBillMode('flat')} type="button" disabled={type === 'multi_unit'}
              className={`p-3 rounded-xl border-2 text-left ${billMode === 'flat' && type !== 'multi_unit' ? 'border-stone-900 bg-white' : 'border-stone-200 bg-white/50'} ${type === 'multi_unit' ? 'opacity-40 cursor-not-allowed' : ''}`}>
              <div className="font-medium text-stone-900 text-sm">Flat rate</div>
            </button>
          </div>
          {billMode === 'hourly' ? (
            <div>
              <label className="text-xs text-stone-600 mb-1 block">$ per hour</label>
              <input type="text" inputMode="decimal" value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)} placeholder="47.50"
                className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 font-mono" />
            </div>
          ) : (
            <div>
              <label className="text-xs text-stone-600 mb-1 block">Flat amount per shift</label>
              <input type="text" inputMode="decimal" value={flatAmount}
                onChange={(e) => setFlatAmount(e.target.value)} placeholder="200.00"
                className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 font-mono" />
            </div>
          )}
        </div>
        )}
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Address</label>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Pine St, Draper, UT"
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Gate code, contact info…" rows={3}
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 resize-none" />
        </div>

        <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
          <div className="flex items-baseline justify-between mb-2">
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono">Property manager portal code</label>
            <button type="button" onClick={generatePortalCode}
              className="text-xs font-mono text-amber-700 hover:text-amber-800">Generate</button>
          </div>
          <input type="text" value={portalCode} onChange={(e) => setPortalCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
            placeholder="e.g. sunset2024 (lowercase letters & numbers only)"
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 font-mono" />
          <p className="text-xs text-stone-500 mt-2">
            {portalCode
              ? <>Share this code with the property manager. They can sign in at <code className="font-mono bg-white px-1.5 py-0.5 rounded">/#/portal</code> to see cleaning photos. Leave empty to disable portal access.</>
              : <>Optional. If set, the property manager can sign in at <code className="font-mono bg-white px-1.5 py-0.5 rounded">/#/portal</code> with this code to see cleaning photos for this property only.</>}
          </p>

          {/* Portal start date — only show if portal is enabled */}
          {portalCode && (
            <div className="mt-4 pt-4 border-t border-stone-200">
              <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Portal start date (optional)</label>
              <div className="flex gap-2">
                <input type="date" value={portalStartDate} onChange={(e) => setPortalStartDate(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 font-mono" />
                {portalStartDate && (
                  <button type="button" onClick={() => setPortalStartDate('')}
                    className="px-3 rounded-xl border border-stone-300 bg-white text-stone-500 text-sm hover:bg-stone-100">
                    Clear
                  </button>
                )}
              </div>
              <p className="text-xs text-stone-500 mt-2">
                {portalStartDate
                  ? <>The property manager will only see cleanings from <strong>{new Date(portalStartDate + 'T12:00:00').toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}</strong> forward.</>
                  : <>If set, only cleanings from this date forward will be visible to the property manager. Useful for hiding old test data or starting fresh with a new client.</>}
              </p>
            </div>
          )}
        </div>

        <div className="p-4 rounded-2xl bg-white border border-stone-200">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-medium text-stone-900 text-sm">Active</div>
              <div className="text-xs text-stone-500">Inactive properties don't show in the picker</div>
            </div>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}
              className="w-5 h-5 rounded accent-stone-900" />
          </label>
        </div>
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}
        <button onClick={save} disabled={busy}
          className="w-full py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium active:scale-98 disabled:opacity-50">
          {busy ? 'Saving…' : isNew ? 'Add property' : 'Save changes'}
        </button>
        {!isNew && type === 'multi_unit' && (
          <button onClick={() => onSaved()}
            className="w-full py-3 rounded-2xl bg-amber-100 text-amber-900 text-sm font-medium flex items-center justify-center gap-2">
            <Layers size={14} /> Manage units &amp; parties
          </button>
        )}
        {!isNew && onManageAssignments && (
          <button onClick={onManageAssignments}
            className="w-full py-3 rounded-2xl bg-white border-2 border-stone-300 text-stone-800 text-sm font-medium flex items-center justify-center gap-2 hover:border-stone-900">
            <FileText size={14} /> Manage assignments
          </button>
        )}
        {!isNew && (
          <button onClick={remove} disabled={busy}
            className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-700 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50">
            <Trash2 size={14} /> Delete property
          </button>
        )}
      </div>
    </div>
  );
}

function UnitList({ property, onBack, onEditProperty, onUnitOpen, onUnitEdit, onUnitNew, onBulkNew, onAssignments }) {
  const [units, setUnits] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const load = async () => {
    const { data } = await supabase.from('units').select('*, parties(id)')
      .eq('customer_id', property.id).order('sort_order').order('label');
    const sorted = (data || []).slice().sort((a, b) => naturalCompare(a.label, b.label));
    setUnits(sorted); setLoaded(true);
  };
  useEffect(() => { load(); }, [property.id]);

  const q = search.trim().toLowerCase();
  const filtered = q ? units.filter(u => u.label.toLowerCase().includes(q)) : units;

  return (
    <div className="pb-24">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-stone-200">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-stone-100">
            <ArrowLeft size={20} className="text-stone-700" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">Property</div>
            <div className="font-serif text-xl text-stone-900 truncate">{property.name}</div>
          </div>
        </div>
        <button onClick={onEditProperty} className="p-2 rounded-full hover:bg-stone-100">
          <Edit2 size={16} className="text-stone-600" />
        </button>
      </div>
      <div className="px-5 pt-6">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-serif text-2xl text-stone-900">Units</h2>
          <span className="text-xs font-mono text-stone-500">{units.length} total</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <button onClick={onUnitNew}
            className="p-3 rounded-2xl bg-stone-900 text-stone-50 font-medium text-sm flex items-center justify-center gap-2 active:scale-98">
            <Plus size={16} /> Add one
          </button>
          <button onClick={onBulkNew}
            className="p-3 rounded-2xl bg-amber-700 text-stone-50 font-medium text-sm flex items-center justify-center gap-2 active:scale-98">
            <Layers size={16} /> Bulk create
          </button>
        </div>
        <button onClick={onAssignments}
          className="w-full mb-4 p-3 rounded-2xl bg-white border-2 border-stone-300 text-stone-800 font-medium text-sm flex items-center justify-center gap-2 active:scale-98 hover:border-stone-900">
          <FileText size={16} /> Manage assignments
        </button>

        {units.length >= 8 && (
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${units.length} units…`}
            className="w-full mb-3 px-4 py-2.5 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 text-sm" />
        )}

        {!loaded ? <Splash text="Loading…" /> : units.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            No units yet. Use "Bulk create" to set up many at once.
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            No units match "{search}".
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(u => (
              <div key={u.id} className={`rounded-2xl border ${u.active ? 'bg-white border-stone-200' : 'bg-stone-100 border-stone-200 opacity-60'}`}>
                <button onClick={() => onUnitOpen(u)} className="w-full text-left p-4 hover:border-stone-400 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-serif text-lg text-stone-900">{u.label}</div>
                      <div className="text-xs text-stone-500 font-mono">
                        {(u.parties?.length || 0)} {u.parties?.length === 1 ? 'party' : 'parties'}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-stone-400" />
                  </div>
                </button>
                <div className="px-4 pb-3 pt-0">
                  <button onClick={() => onUnitEdit(u)} className="text-xs font-mono text-stone-500 hover:text-stone-900 flex items-center gap-1">
                    <Edit2 size={11} /> Edit unit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UnitForm({ property, unit, onCancel, onSaved }) {
  const isNew = !unit;
  const [label, setLabel] = useState(unit?.label || '');
  const [notes, setNotes] = useState(unit?.notes || '');
  const [active, setActive] = useState(unit?.active ?? true);
  const [partyCount, setPartyCount] = useState(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setError('');
    if (!label.trim()) { setError('Label is required'); return; }
    setBusy(true);
    if (isNew) {
      const { data: created, error: e } = await supabase.from('units')
        .insert({ customer_id: property.id, label: label.trim(), notes: notes.trim() || null, active })
        .select().single();
      if (e) { setBusy(false); setError(e.message); return; }
      if (partyCount > 0) {
        const parties = Array.from({ length: partyCount }, (_, i) => ({
          unit_id: created.id, label: `Bedroom ${i + 1}`, sort_order: i + 1
        }));
        await supabase.from('parties').insert(parties);
      }
    } else {
      const { error: e } = await supabase.from('units').update({ label: label.trim(), notes: notes.trim() || null, active })
        .eq('id', unit.id);
      if (e) { setBusy(false); setError(e.message); return; }
    }
    setBusy(false);
    onSaved();
  };
  const remove = async () => {
    if (!confirm(`Delete "${unit.label}"?`)) return;
    setBusy(true);
    const { error: e } = await supabase.from('units').delete().eq('id', unit.id);
    setBusy(false);
    if (e) { alert('Could not delete: ' + e.message); return; }
    onSaved();
  };
  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button onClick={onCancel} className="p-2 -ml-2 rounded-full hover:bg-stone-100">
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div>
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">{property.name}</div>
          <div className="font-serif text-xl text-stone-900">{isNew ? 'New unit' : `Edit ${unit.label}`}</div>
        </div>
      </div>
      <div className="px-5 pt-6 space-y-5">
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Unit label</label>
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Apt 101"
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900" />
        </div>
        {isNew && (
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Auto-create how many parties?</label>
            <div className="grid grid-cols-5 gap-2">
              {[0, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setPartyCount(n)} type="button"
                  className={`py-3 rounded-xl border-2 font-mono text-sm transition-all ${partyCount === n ? 'border-stone-900 bg-stone-900 text-stone-50' : 'border-stone-200 bg-white text-stone-700'}`}>
                  {n === 0 ? '—' : n}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Gate code, parking…" rows={2}
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 resize-none" />
        </div>
        <div className="p-4 rounded-2xl bg-white border border-stone-200">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-medium text-stone-900 text-sm">Active</div>
              <div className="text-xs text-stone-500">Inactive units don't show in the picker</div>
            </div>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}
              className="w-5 h-5 rounded accent-stone-900" />
          </label>
        </div>
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}
        <button onClick={save} disabled={busy}
          className="w-full py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium active:scale-98 disabled:opacity-50">
          {busy ? 'Saving…' : isNew ? 'Add unit' : 'Save changes'}
        </button>
        {!isNew && (
          <button onClick={remove} disabled={busy}
            className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-700 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50">
            <Trash2 size={14} /> Delete unit
          </button>
        )}
      </div>
    </div>
  );
}

function BulkCreateUnits({ property, onCancel, onSaved }) {
  const [buildings, setBuildings] = useState(10);
  const [floors, setFloors] = useState(3);
  const [unitsPerFloor, setUnitsPerFloor] = useState(4);
  const [partiesPerUnit, setPartiesPerUnit] = useState(4);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  // Compute the preview labels.
  // Pattern: unit numbers cumulate across buildings (don't reset per building).
  // Floor digit goes in the hundreds place.
  // e.g. B1 floor 1 unit 1 = 101; B2 floor 1 unit 1 = 105; B10 floor 3 unit 4 = 340
  const computePreview = () => {
    const labels = [];
    for (let b = 1; b <= buildings; b++) {
      for (let f = 1; f <= floors; f++) {
        for (let u = 1; u <= unitsPerFloor; u++) {
          // Unit's position on this floor across the whole complex
          const unitOnFloor = (b - 1) * unitsPerFloor + u;
          const aptNum = f * 100 + unitOnFloor;
          labels.push(`B${b}-${aptNum}`);
        }
      }
    }
    return labels;
  };

  const preview = computePreview();
  const totalUnits = preview.length;
  const totalParties = totalUnits * partiesPerUnit;

  const create = async () => {
    if (totalUnits === 0) return;
    if (!confirm(`Create ${totalUnits} units and ${totalParties} bedrooms under "${property.name}"? This can't be undone in bulk — you'd have to delete units one-by-one or delete the whole property.`)) return;

    setBusy(true); setError(''); setProgress('Creating units…');

    // Build the unit rows. sort_order encodes the natural order.
    const unitRows = [];
    let order = 0;
    for (let b = 1; b <= buildings; b++) {
      for (let f = 1; f <= floors; f++) {
        for (let u = 1; u <= unitsPerFloor; u++) {
          const unitOnFloor = (b - 1) * unitsPerFloor + u;
          const aptNum = f * 100 + unitOnFloor;
          unitRows.push({
            customer_id: property.id,
            label: `B${b}-${aptNum}`,
            sort_order: order++,
            active: true
          });
        }
      }
    }

    // Insert in chunks so we don't blow past any single-request limits
    const CHUNK = 50;
    const createdUnits = [];
    for (let i = 0; i < unitRows.length; i += CHUNK) {
      const slice = unitRows.slice(i, i + CHUNK);
      setProgress(`Creating units ${i + 1}–${Math.min(i + CHUNK, unitRows.length)} of ${unitRows.length}…`);
      const { data, error: e } = await supabase.from('units').insert(slice).select();
      if (e) { setBusy(false); setError(`Failed at unit batch ${i + 1}: ${e.message}`); return; }
      createdUnits.push(...(data || []));
    }

    // Now build the party rows for every unit we just made
    if (partiesPerUnit > 0) {
      const partyRows = [];
      for (const u of createdUnits) {
        for (let p = 1; p <= partiesPerUnit; p++) {
          partyRows.push({
            unit_id: u.id,
            label: `Bedroom ${p}`,
            sort_order: p,
            active: true
          });
        }
      }
      for (let i = 0; i < partyRows.length; i += CHUNK) {
        const slice = partyRows.slice(i, i + CHUNK);
        setProgress(`Creating parties ${i + 1}–${Math.min(i + CHUNK, partyRows.length)} of ${partyRows.length}…`);
        const { error: e } = await supabase.from('parties').insert(slice);
        if (e) { setBusy(false); setError(`Failed at party batch ${i + 1}: ${e.message}`); return; }
      }
    }

    setBusy(false);
    onSaved();
  };

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button onClick={onCancel} className="p-2 -ml-2 rounded-full hover:bg-stone-100">
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div>
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">{property.name}</div>
          <div className="font-serif text-xl text-stone-900">Bulk create units</div>
        </div>
      </div>

      <div className="px-5 pt-6 space-y-5">
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
          <strong>How it works:</strong> labels follow <code className="font-mono bg-white/60 px-1 rounded">B<em>X</em>-<em>FUU</em></code> where X is the building, F is the floor, and UU is the unit number. Unit numbers cumulate across buildings — Building 1 floor 1 is <code className="font-mono bg-white/60 px-1 rounded">B1-101</code> through <code className="font-mono bg-white/60 px-1 rounded">B1-104</code>, Building 2 floor 1 is <code className="font-mono bg-white/60 px-1 rounded">B2-105</code> through <code className="font-mono bg-white/60 px-1 rounded">B2-108</code>, and so on.
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Buildings</label>
            <input type="number" min="1" max="99" value={buildings}
              onChange={(e) => setBuildings(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 font-mono text-center text-lg" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Floors each</label>
            <input type="number" min="1" max="9" value={floors}
              onChange={(e) => setFloors(Math.max(1, Math.min(9, parseInt(e.target.value) || 1)))}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 font-mono text-center text-lg" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Units/floor</label>
            <input type="number" min="1" max="99" value={unitsPerFloor}
              onChange={(e) => setUnitsPerFloor(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 font-mono text-center text-lg" />
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Bedrooms per unit</label>
          <div className="grid grid-cols-4 gap-2">
            {[0, 2, 3, 4, 5, 6, 7, 8].map(n => (
              <button key={n} onClick={() => setPartiesPerUnit(n)} type="button"
                className={`py-3 rounded-xl border-2 font-mono text-sm transition-all ${
                  partiesPerUnit === n ? 'border-stone-900 bg-stone-900 text-stone-50' : 'border-stone-200 bg-white text-stone-700'
                }`}>
                {n === 0 ? '—' : n}
              </button>
            ))}
          </div>
          <p className="text-xs text-stone-500 mt-2">
            Each unit gets "Bedroom 1" through "Bedroom N". You can rename them later.
          </p>
        </div>

        {/* Preview */}
        <div className="p-4 rounded-2xl bg-white border border-stone-200">
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">Preview</div>
            <div className="font-mono text-sm">
              <span className="text-stone-900 font-medium">{totalUnits}</span>
              <span className="text-stone-500"> units · </span>
              <span className="text-stone-900 font-medium">{totalParties}</span>
              <span className="text-stone-500"> bedrooms</span>
            </div>
          </div>
          <div className="font-mono text-sm text-stone-700 space-y-0.5 max-h-48 overflow-y-auto">
            {preview.length <= 30 ? (
              preview.map(label => <div key={label}>{label}</div>)
            ) : (
              <>
                {preview.slice(0, 6).map(label => <div key={label}>{label}</div>)}
                <div className="text-stone-400">…and {preview.length - 12} more…</div>
                {preview.slice(-6).map(label => <div key={label}>{label}</div>)}
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}

        {busy && progress && (
          <div className="p-3 rounded-xl bg-stone-100 text-stone-700 text-sm font-mono flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-stone-700 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            {progress}
          </div>
        )}

        <button onClick={create} disabled={busy || totalUnits === 0}
          className="w-full py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2">
          {busy ? 'Creating…' : <>Create {totalUnits} units &amp; {totalParties} bedrooms</>}
        </button>

        <p className="text-xs text-stone-500 text-center">
          ⚠️ Existing units with duplicate labels will cause errors. Run this on an empty property.
        </p>
      </div>
    </div>
  );
}

function PartyList({ property, unit, onBack, onPartyEdit, onPartyNew }) {
  const [parties, setParties] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const load = async () => {
    const { data } = await supabase.from('parties').select('*')
      .eq('unit_id', unit.id).order('sort_order').order('label');
    setParties(data || []); setLoaded(true);
  };
  useEffect(() => { load(); }, [unit.id]);
  return (
    <div className="pb-24">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-stone-100">
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono truncate">{property.name}</div>
          <div className="font-serif text-xl text-stone-900">{unit.label}</div>
        </div>
      </div>
      <div className="px-5 pt-6">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-serif text-2xl text-stone-900">Parties</h2>
          <span className="text-xs font-mono text-stone-500">{parties.length} total</span>
        </div>
        <button onClick={onPartyNew}
          className="w-full mb-4 p-3 rounded-2xl bg-stone-900 text-stone-50 font-medium text-sm flex items-center justify-center gap-2 active:scale-98">
          <Plus size={16} /> Add party
        </button>
        {!loaded ? <Splash text="Loading…" /> : parties.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">No parties yet.</div>
        ) : (
          <div className="space-y-2">
            {parties.map(p => (
              <button key={p.id} onClick={() => onPartyEdit(p)}
                className={`w-full text-left p-4 rounded-2xl border ${p.active ? 'bg-white border-stone-200 hover:border-stone-400' : 'bg-stone-100 border-stone-200 opacity-60'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-serif text-lg text-stone-900">{p.label}</div>
                    {p.full_name && <div className="text-sm text-stone-600">{p.full_name}</div>}
                  </div>
                  <ChevronRight size={16} className="text-stone-400" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PartyForm({ property, unit, party, onCancel, onSaved }) {
  const isNew = !party;
  const [label, setLabel] = useState(party?.label || '');
  const [fullName, setFullName] = useState(party?.full_name || '');
  const [email, setEmail] = useState(party?.email || '');
  const [notes, setNotes] = useState(party?.notes || '');
  const [active, setActive] = useState(party?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setError('');
    if (!label.trim()) { setError('Label is required'); return; }
    setBusy(true);
    const payload = { label: label.trim(), full_name: fullName.trim() || null, email: email.trim() || null, notes: notes.trim() || null, active };
    if (isNew) payload.unit_id = unit.id;
    const { error: e } = isNew
      ? await supabase.from('parties').insert(payload)
      : await supabase.from('parties').update(payload).eq('id', party.id);
    setBusy(false);
    if (e) { setError(e.message); return; }
    onSaved();
  };
  const remove = async () => {
    if (!confirm(`Delete "${party.label}"?`)) return;
    setBusy(true);
    const { error: e } = await supabase.from('parties').delete().eq('id', party.id);
    setBusy(false);
    if (e) { alert('Could not delete: ' + e.message); return; }
    onSaved();
  };
  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button onClick={onCancel} className="p-2 -ml-2 rounded-full hover:bg-stone-100">
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div>
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">{property.name} · {unit.label}</div>
          <div className="font-serif text-xl text-stone-900">{isNew ? 'New party' : `Edit ${party.label}`}</div>
        </div>
      </div>
      <div className="px-5 pt-6 space-y-5">
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Label</label>
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Bedroom 1, Student 3"
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Full name (optional)</label>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Sarah Johnson"
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Email (optional)</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="for invoices"
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 resize-none" />
        </div>
        <div className="p-4 rounded-2xl bg-white border border-stone-200">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-medium text-stone-900 text-sm">Active</div>
            </div>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}
              className="w-5 h-5 rounded accent-stone-900" />
          </label>
        </div>
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}
        <button onClick={save} disabled={busy}
          className="w-full py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium active:scale-98 disabled:opacity-50">
          {busy ? 'Saving…' : isNew ? 'Add party' : 'Save changes'}
        </button>
        {!isNew && (
          <button onClick={remove} disabled={busy}
            className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-700 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50">
            <Trash2 size={14} /> Delete party
          </button>
        )}
      </div>
    </div>
  );
}

// =================================================================
// INVOICE VIEW (uses work blocks)
// =================================================================
function InvoiceView({ employee, onSignOut }) {
  const today = new Date().toISOString().split('T')[0];
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [properties, setProperties] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [start, setStart] = useState(twoWeeksAgo);
  const [end, setEnd] = useState(today);
  const [invoice, setInvoice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showZeros, setShowZeros] = useState(true);
  useEffect(() => { (async () => {
    const { data } = await supabase.from('customers').select('*')
      .eq('property_type', 'multi_unit').eq('active', true).order('name');
    setProperties(data || []);
  })(); }, []);
  const generate = async () => {
    if (!selectedId) return;
    setBusy(true);
    const property = properties.find(p => p.id === selectedId);
    const { data: units } = await supabase.from('units').select('*, parties(*)')
      .eq('customer_id', selectedId).order('sort_order').order('label');
    const { data: blocks } = await supabase
      .from('work_blocks')
      .select('*, shift:shifts!inner(employee:employees(name), customer_id), unit:units(label), party:parties(*)')
      .gte('start_time', start + 'T00:00:00')
      .lte('start_time', end + 'T23:59:59')
      .not('end_time', 'is', null);
    const propBlocks = (blocks || []).filter(b => b.shift?.customer_id === selectedId);
    const blocksByParty = {};
    propBlocks.forEach(b => {
      const key = b.party_id || 'unassigned';
      if (!blocksByParty[key]) blocksByParty[key] = [];
      blocksByParty[key].push(b);
    });
    const invoiceUnits = (units || []).map(u => ({
      ...u,
      parties: (u.parties || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map(p => {
        const partyBlocks = blocksByParty[p.id] || [];
        const totalMs = partyBlocks.reduce((sum, b) => sum + (new Date(b.end_time) - new Date(b.start_time)), 0);
        const hours = totalMs / 1000 / 3600;
        const totalAmount = partyBlocks.reduce((sum, b) => {
          const h = (new Date(b.end_time) - new Date(b.start_time)) / 1000 / 3600;
          return sum + h * (b.bill_rate_at_work || property.bill_rate_hourly || 0);
        }, 0);
        return { ...p, blocks: partyBlocks, hours, amount: totalAmount, hasWork: partyBlocks.length > 0 };
      })
    }));
    const grandTotal = invoiceUnits.reduce((sum, u) => sum + u.parties.reduce((s, p) => s + p.amount, 0), 0);
    const totalHours = invoiceUnits.reduce((sum, u) => sum + u.parties.reduce((s, p) => s + p.hours, 0), 0);
    setInvoice({ property, units: invoiceUnits, grandTotal, totalHours, start, end });
    setBusy(false);
  };
  if (invoice) {
    return <InvoicePreview invoice={invoice} showZeros={showZeros} setShowZeros={setShowZeros}
      onBack={() => setInvoice(null)} onPrint={() => window.print()} />;
  }
  return (
    <div className="pb-24">
      <Header name={employee.name} onSignOut={onSignOut} />
      <div className="px-5 pt-6">
        <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-3">Billing</div>
        <h1 className="text-4xl font-light text-stone-900 tracking-tight mb-6">
          Generate <span className="font-serif italic text-amber-700">invoice</span>
        </h1>
        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Property</label>
            {properties.length === 0 ? (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
                No multi-unit properties yet.
              </div>
            ) : (
              <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900">
                <option value="">— Pick a property —</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Start</label>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">End</label>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white" />
            </div>
          </div>
          <button onClick={generate} disabled={!selectedId || busy}
            className="w-full py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2">
            <FileText size={18} /> {busy ? 'Generating…' : 'Generate invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}

function InvoicePreview({ invoice, showZeros, setShowZeros, onBack, onPrint }) {
  const { property, units, grandTotal, totalHours, start, end } = invoice;
  return (
    <div className="pb-24 bg-stone-50">
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .invoice-page { max-width: 100% !important; box-shadow: none !important; border: none !important; }
        }
      `}</style>
      <div className="no-print flex items-center justify-between gap-3 px-5 py-4 border-b border-stone-200 bg-white sticky top-0 z-10">
        <button onClick={onBack} className="flex items-center gap-2 text-stone-700 text-sm">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-mono text-stone-600 cursor-pointer">
            <input type="checkbox" checked={showZeros} onChange={(e) => setShowZeros(e.target.checked)} className="w-4 h-4 rounded accent-stone-900" />
            Show $0
          </label>
          <button onClick={onPrint}
            className="ml-2 px-4 py-2 rounded-full bg-stone-900 text-stone-50 text-sm font-medium flex items-center gap-2">
            <Printer size={14} /> Print / PDF
          </button>
        </div>
      </div>
      <div className="invoice-page max-w-3xl mx-auto bg-white border border-stone-200 my-6 mx-4 sm:mx-auto p-8 sm:p-12 rounded-2xl shadow-sm">
        <div className="flex items-start justify-between mb-8 pb-8 border-b border-stone-200">
          <div>
            <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-2">Invoice</div>
            <h1 className="font-serif text-3xl text-stone-900 mb-1">{property.name}</h1>
            {property.address && <div className="text-sm text-stone-600">{property.address}</div>}
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-2">Period</div>
            <div className="font-mono text-sm text-stone-900">{fmtDateLong(start)}</div>
            <div className="font-mono text-sm text-stone-900">to {fmtDateLong(end)}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-8 p-4 bg-stone-50 rounded-xl">
          <div>
            <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1">Total hours</div>
            <div className="font-serif text-2xl text-stone-900">{totalHours.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1">Rate</div>
            <div className="font-serif text-2xl text-stone-900">{fmtMoney(property.bill_rate_hourly)}/hr</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-mono text-stone-500 mb-1">Amount due</div>
            <div className="font-serif text-2xl text-amber-700">{fmtMoney(grandTotal)}</div>
          </div>
        </div>
        <div className="space-y-6">
          {units.map(unit => {
            const visibleParties = unit.parties.filter(p => showZeros || p.hasWork);
            const unitTotal = unit.parties.reduce((sum, p) => sum + p.amount, 0);
            const unitHours = unit.parties.reduce((sum, p) => sum + p.hours, 0);
            if (visibleParties.length === 0 && !showZeros) return null;
            return (
              <div key={unit.id}>
                <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-stone-200">
                  <h3 className="font-serif text-xl text-stone-900">{unit.label}</h3>
                  <div className="font-mono text-sm text-stone-700">
                    {unitHours.toFixed(2)} hrs · {fmtMoney(unitTotal)}
                  </div>
                </div>
                {visibleParties.length === 0 ? (
                  <div className="text-sm text-stone-400 italic py-2">No work this period.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider font-mono text-stone-500 text-left">
                        <th className="font-normal pb-2">Bedroom</th>
                        <th className="font-normal pb-2 text-right">Hours</th>
                        <th className="font-normal pb-2 text-right">Rate</th>
                        <th className="font-normal pb-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleParties.map(party => (
                        <tr key={party.id} className={`border-t border-stone-100 ${!party.hasWork ? 'text-stone-400' : ''}`}>
                          <td className="py-2.5">
                            <div className="font-medium">{party.label}</div>
                            {party.full_name && <div className="text-xs text-stone-500">{party.full_name}</div>}
                            {party.blocks?.length > 0 && (
                              <div className="text-[10px] text-stone-500 font-mono mt-0.5">
                                {party.blocks.length} block{party.blocks.length === 1 ? '' : 's'} · {[...new Set(party.blocks.map(b => b.shift?.employee?.name).filter(Boolean))].join(', ')}
                              </div>
                            )}
                            {party.blocks?.[0]?.work_notes && (
                              <div className="text-[10px] text-stone-500 italic mt-0.5">"{party.blocks[0].work_notes}"</div>
                            )}
                          </td>
                          <td className="py-2.5 text-right font-mono">{party.hours.toFixed(2)}</td>
                          <td className="py-2.5 text-right font-mono">{fmtMoney(property.bill_rate_hourly)}</td>
                          <td className="py-2.5 text-right font-mono font-medium">{fmtMoney(party.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-8 pt-6 border-t-2 border-stone-900">
          <div className="flex items-baseline justify-between">
            <div className="font-serif text-xl text-stone-900">Total due</div>
            <div className="font-serif text-3xl text-stone-900">{fmtMoney(grandTotal)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =================================================================
// PAYROLL EXPORT
// =================================================================
function ExportView({ employee, onSignOut }) {
  const today = new Date().toISOString().split('T')[0];
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [start, setStart] = useState(twoWeeksAgo);
  const [end, setEnd] = useState(today);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const fetchData = async () => {
    setBusy(true);
    const { data } = await supabase
      .from('shifts')
      .select('start_time, end_time, bill_rate_at_work, employee:employees(name), customer:customers(name, property_type, bill_rate_hourly), work_blocks(start_time, end_time, bill_rate_at_work)')
      .gte('start_time', start + 'T00:00:00')
      .lte('start_time', end + 'T23:59:59')
      .not('end_time', 'is', null)
      .order('start_time');
    const rows = (data || []).map(s => {
      const hours = (new Date(s.end_time) - new Date(s.start_time)) / 1000 / 3600;
      let billable = null;
      if (s.customer?.property_type === 'multi_unit') {
        billable = (s.work_blocks || []).reduce((sum, b) => {
          if (!b.end_time) return sum;
          const h = (new Date(b.end_time) - new Date(b.start_time)) / 1000 / 3600;
          return sum + h * (b.bill_rate_at_work || s.customer?.bill_rate_hourly || 0);
        }, 0);
      } else if (s.bill_rate_at_work) {
        billable = hours * s.bill_rate_at_work;
      }
      return {
        employee: s.employee?.name || '',
        date: new Date(s.start_time).toLocaleDateString('en-US'),
        clock_in: new Date(s.start_time).toLocaleTimeString('en-US'),
        clock_out: new Date(s.end_time).toLocaleTimeString('en-US'),
        hours: hours.toFixed(2),
        property: s.customer?.name || '',
        billable: billable != null ? billable.toFixed(2) : '',
      };
    });
    setPreview(rows); setBusy(false);
  };
  const downloadCSV = () => {
    if (!preview || preview.length === 0) return;
    const headers = ['Employee','Date','Clock In','Clock Out','Hours','Property','Billable'];
    const csv = [
      headers.join(','),
      ...preview.map(r => [`"${r.employee}"`, r.date, r.clock_in, r.clock_out, r.hours, `"${r.property}"`, r.billable].join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `tidytrack-payroll-${start}-to-${end}.csv`; a.click();
    URL.revokeObjectURL(url);
  };
  const byEmployee = {};
  (preview || []).forEach(r => {
    if (!byEmployee[r.employee]) byEmployee[r.employee] = { hours: 0, shifts: 0, billable: 0 };
    byEmployee[r.employee].hours += parseFloat(r.hours);
    byEmployee[r.employee].shifts += 1;
    if (r.billable) byEmployee[r.employee].billable += parseFloat(r.billable);
  });
  return (
    <div className="pb-24">
      <Header name={employee.name} onSignOut={onSignOut} />
      <div className="px-5 pt-6">
        <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-3">Payroll</div>
        <h1 className="text-4xl font-light text-stone-900 tracking-tight mb-6">
          Export <span className="font-serif italic text-amber-700">hours</span>
        </h1>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Start</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">End</label>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white" />
          </div>
        </div>
        <button onClick={fetchData} disabled={busy}
          className="w-full py-3 rounded-xl bg-stone-900 text-stone-50 font-medium mb-6 disabled:opacity-50">
          {busy ? 'Loading…' : 'Generate report'}
        </button>
        {preview && preview.length === 0 && (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            No completed shifts in this date range.
          </div>
        )}
        {preview && preview.length > 0 && (
          <>
            <div className="mb-6">
              <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">By employee</div>
              <div className="space-y-2">
                {Object.entries(byEmployee).map(([name, d]) => (
                  <div key={name} className="flex items-center justify-between p-3 bg-white border border-stone-200 rounded-xl">
                    <span className="font-serif text-base text-stone-900">{name}</span>
                    <div className="text-right">
                      <div className="font-mono text-sm text-stone-900">{d.hours.toFixed(2)} hrs</div>
                      <div className="font-mono text-xs text-stone-500">
                        {d.shifts} shifts {d.billable > 0 && <>· <span className="text-emerald-700">{fmtMoney(d.billable)}</span> billed</>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={downloadCSV}
              className="w-full py-4 rounded-2xl bg-amber-700 text-stone-50 font-medium flex items-center justify-center gap-2 active:scale-98">
              <Download size={18} />
              Download CSV ({preview.length} shifts)
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// =================================================================
// =================================================================
// PM WELCOME MODAL — shown on first sign-in and from the "How this works" button
// =================================================================
function WelcomeModal({ propertyName, onClose }) {
  return (
    <div className="fixed inset-0 bg-stone-900/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-stone-50 w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">Welcome to Summit Clean</div>
            <div className="font-serif text-2xl text-stone-900 truncate">How this works</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-stone-100 flex-shrink-0">
            <X size={20} className="text-stone-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="text-stone-700 leading-relaxed">
            We're so glad to have you on board! Summit Clean is excited to be cleaning <span className="font-medium text-stone-900">{propertyName}</span> for you. This portal is your way to stay involved — see what's been cleaned, send us photos when something needs attention, and request assignments for the team.
          </div>

          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-stone-900 text-stone-50 flex items-center justify-center font-mono text-sm font-bold">
                1
              </div>
              <div>
                <div className="font-serif text-lg text-stone-900 leading-tight">History</div>
                <div className="text-sm text-stone-600 mt-0.5">See every cleaning, with photos and damage reports. Tap any day or unit to see the details.</div>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-stone-900 text-stone-50 flex items-center justify-center font-mono text-sm font-bold">
                2
              </div>
              <div>
                <div className="font-serif text-lg text-stone-900 leading-tight">Upload photo</div>
                <div className="text-sm text-stone-600 mt-0.5">Send us photos of damage, items left behind, or anything else worth flagging. We see them right away.</div>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-stone-900 text-stone-50 flex items-center justify-center font-mono text-sm font-bold">
                3
              </div>
              <div>
                <div className="font-serif text-lg text-stone-900 leading-tight">Assignments</div>
                <div className="text-sm text-stone-600 mt-0.5">Request specific work — like a deep clean on a particular bedroom. Submit it for approval, and once Summit Clean approves it, the team sees it on their next visit.</div>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <div className="text-xs uppercase tracking-wider font-mono text-amber-700 mb-1">A quick note</div>
            <div className="text-sm text-stone-800">
              Assignments you create start as <span className="font-medium">drafts</span>. Once you submit one, Summit Clean reviews and approves it before the cleaning team sees it. You can always come back to this overview by tapping <span className="font-mono">"How this works"</span> at the top.
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-stone-200">
          <button onClick={onClose}
            className="w-full py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium active:scale-98 transition-transform">
            Got it — let's go
          </button>
        </div>
      </div>
    </div>
  );
}

// =================================================================
// PORTAL APP — separate flow for property managers (clients)
// They sign in with a per-property code. They see only that property's
// photos, dates, and units. No cleaner names, no $ amounts.
// =================================================================
function PortalApp() {
  const [property, setProperty] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Auto-restore previous portal session
    (async () => {
      try {
        const stored = localStorage.getItem('tidytrack_portal');
        if (stored) {
          const { propertyId, code } = JSON.parse(stored);
          const { data } = await supabase.from('customers')
            .select('*').eq('id', propertyId).eq('portal_code', code).maybeSingle();
          if (data) setProperty(data);
          else localStorage.removeItem('tidytrack_portal');
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const onSignIn = async (prop) => {
    localStorage.setItem('tidytrack_portal', JSON.stringify({ propertyId: prop.id, code: prop.portal_code }));
    setProperty(prop);
  };

  const onSignOut = () => {
    localStorage.removeItem('tidytrack_portal');
    setProperty(null);
  };

  if (!loaded) return <Splash text="Loading…" />;
  if (!property) return <PortalSignIn onSignIn={onSignIn} />;
  return <PortalDashboard property={property} onSignOut={onSignOut} />;
}

function PortalSignIn({ onSignIn }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const tryLogin = async () => {
    if (!code.trim()) return;
    setError(''); setBusy(true);
    const { data } = await supabase.from('customers')
      .select('*').eq('portal_code', code.trim().toLowerCase()).eq('active', true).maybeSingle();
    setBusy(false);
    if (!data) {
      setError('That code didn\'t match any property. Check with your cleaning company.');
      return;
    }
    onSignIn(data);
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Dark brand header band */}
      <div className="flex flex-col items-center pt-12 pb-10 bg-stone-900">
        <img
          src="https://bbaynvqnbkjyqhzhhypr.supabase.co/storage/v1/object/public/brand/unnamed%20(2).png"
          alt="Summit Clean"
          className="w-44 h-auto mx-auto"
        />
      </div>

      <div className="flex-1 flex flex-col justify-center items-center px-6 max-w-sm mx-auto w-full pt-10">
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-[0.25em] font-mono text-stone-500">
            Welcome
          </p>
          <h2 className="font-serif text-2xl mt-2 text-stone-900">
            Property manager portal
          </h2>
        </div>

        <div className="w-full">
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Access code</label>
          <input type="text" value={code} onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
            placeholder="e.g. sunset2024"
            onKeyDown={(e) => e.key === 'Enter' && tryLogin()}
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 font-mono text-lg tracking-wide" />

          {error && (
            <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}

          <button onClick={tryLogin} disabled={busy || !code.trim()}
            className="w-full mt-4 py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium active:scale-98 disabled:opacity-50">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-xs text-stone-500 mt-6 text-center">
            Don't have a code? Ask Summit Clean for access.
          </p>
        </div>
      </div>
      <div className="text-center pb-6 text-xs text-stone-400 font-mono">
        <button onClick={() => {
            // Clear any remembered choice so they get to the landing page
            try { localStorage.removeItem('tt_role_choice'); } catch {}
            window.location.hash = '';
          }}
          className="hover:text-stone-600">
          ← Back
        </button>
      </div>
    </div>
  );
}

function PortalDashboard({ property, onSignOut }) {
  const [view, setView] = useState({ kind: 'home' });
  // 'home' (recent activity), 'unit-day' (drill into one unit's day), 'all-photos' (gallery)

  if (view.kind === 'unit-day') {
    return <PortalUnitDay property={property} unitId={view.unitId} date={view.date}
      onBack={() => setView({ kind: 'home' })} />;
  }

  return <PortalHome property={property} onSignOut={onSignOut}
    onOpenUnitDay={(unitId, date) => setView({ kind: 'unit-day', unitId, date })} />;
}

function PortalHome({ property, onSignOut, onOpenUnitDay }) {
  const [tab, setTab] = useState('history'); // 'history' | 'messages' | 'upload-photo' | 'assignments'
  const [groups, setGroups] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState('30d');
  const [showWelcome, setShowWelcome] = useState(false);
  const pmUnread = useUnreadCount({ customer: property });

  // Show welcome modal on first sign-in for this property.
  // We track per-property since one PM might manage multiple properties.
  useEffect(() => {
    try {
      const key = `tt_pm_welcomed_${property.id}`;
      if (!localStorage.getItem(key)) setShowWelcome(true);
    } catch {}
  }, [property.id]);

  const dismissWelcome = () => {
    try { localStorage.setItem(`tt_pm_welcomed_${property.id}`, '1'); } catch {}
    setShowWelcome(false);
  };

  useEffect(() => { (async () => {
    if (tab !== 'history') return;
    setLoaded(false);
    const days = filter === '7d' ? 7 : filter === '30d' ? 30 : 365;
    let since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    if (property.portal_start_date) {
      const portalStart = `${property.portal_start_date}T00:00:00Z`;
      if (portalStart > since) since = portalStart;
    }
    console.log('[Portal] filtering from:', since, '| portal_start_date:', property.portal_start_date);

    if (property.property_type === 'multi_unit') {
      const { data: blocks } = await supabase
        .from('work_blocks')
        .select('id, start_time, end_time, unit:units(id, label), shift:shifts!inner(customer_id), tasks(id, photos(kind))')
        .gte('start_time', since)
        .order('start_time', { ascending: false });
      const filtered = (blocks || []).filter(b => b.shift?.customer_id === property.id && b.unit);
      const byDate = {};
      filtered.forEach(b => {
        const date = new Date(b.start_time).toISOString().split('T')[0];
        if (!byDate[date]) byDate[date] = {};
        const u = b.unit;
        if (!byDate[date][u.id]) byDate[date][u.id] = { unitId: u.id, label: u.label, photoCount: 0, hasDamage: false };
        (b.tasks || []).forEach(t => (t.photos || []).forEach(p => {
          if (p.kind === 'damage') byDate[date][u.id].hasDamage = true;
          byDate[date][u.id].photoCount++;
        }));
      });
      const out = Object.entries(byDate)
        .map(([date, byUnit]) => ({
          date,
          units: Object.values(byUnit).sort((a, b) => naturalCompare(a.label, b.label))
        }))
        .sort((a, b) => b.date.localeCompare(a.date));
      setGroups(out);
    } else {
      // Simple property
      const { data: shifts } = await supabase.from('shifts')
        .select('id, start_time, end_time, tasks(id, photos(kind))')
        .eq('customer_id', property.id)
        .gte('start_time', since)
        .order('start_time', { ascending: false });
      const out = (shifts || []).map(s => {
        let photoCount = 0, hasDamage = false;
        (s.tasks || []).forEach(t => (t.photos || []).forEach(p => {
          photoCount++;
          if (p.kind === 'damage') hasDamage = true;
        }));
        return {
          date: new Date(s.start_time).toISOString().split('T')[0],
          units: [{ unitId: null, label: 'Cleaning visit', photoCount, hasDamage }]
        };
      });
      setGroups(out);
    }
    setLoaded(true);
  })(); }, [property.id, filter, tab]);

  return (
    <div className="min-h-screen bg-stone-50 pb-12">
      <div className="bg-stone-900 text-stone-50 px-5 pt-5 pb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <img
              src="https://bbaynvqnbkjyqhzhhypr.supabase.co/storage/v1/object/public/brand/unnamed%20(2).png"
              alt="Summit Clean"
              className="h-10 w-auto object-contain"
            />
            <div>
              <div className="text-xs text-stone-400 font-mono uppercase tracking-wider">Property portal</div>
              <div className="text-[10px] text-stone-500 font-mono opacity-60">TidyTrack</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowWelcome(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-50 text-xs font-mono active:scale-95 transition-all">
              <HelpCircle size={14} /> How this works
            </button>
            <button onClick={onSignOut} className="text-xs text-stone-400 font-mono hover:text-stone-50">Sign out</button>
          </div>
        </div>
        <h1 className="text-3xl font-light tracking-tight mt-2">{property.name}</h1>
        {property.address && (
          <div className="text-sm text-stone-300 mt-1 flex items-center gap-1.5">
            <MapPin size={13} /> {property.address}
          </div>
        )}
        {property.portal_start_date && (
          <div className="text-xs text-amber-400 font-mono mt-2">
            Showing cleanings from {new Date(property.portal_start_date + 'T12:00:00').toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })} forward
          </div>
        )}
      </div>

      {/* Tab switcher */}
      <div className="px-5 pt-4">
        <div className="flex gap-1 bg-stone-100 p-1 rounded-xl">
          <button onClick={() => setTab('history')}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium ${tab === 'history' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'}`}>
            History
          </button>
          <button onClick={() => setTab('messages')}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium relative ${tab === 'messages' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'}`}>
            Messages
            {pmUnread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-600 text-white text-[9px] font-mono font-bold flex items-center justify-center">
                {pmUnread > 99 ? '99+' : pmUnread}
              </span>
            )}
          </button>
          <button onClick={() => setTab('upload-photo')}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium ${tab === 'upload-photo' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'}`}>
            Upload
          </button>
          <button onClick={() => setTab('assignments')}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium ${tab === 'assignments' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'}`}>
            Assignments
          </button>
        </div>
      </div>

      {tab === 'history' && (
        <PortalHistoryTab property={property} groups={groups} loaded={loaded}
          filter={filter} setFilter={setFilter} onOpenUnitDay={onOpenUnitDay} />
      )}
      {tab === 'messages' && (
        <PortalMessagesTab property={property} onPropertyRefresh={() => setTab('history')} />
      )}
      {tab === 'upload-photo' && (
        <PortalPhotoUploadTab property={property} />
      )}
      {tab === 'assignments' && (
        <PortalAssignmentsTab property={property} />
      )}

      {showWelcome && (
        <WelcomeModal propertyName={property.name} onClose={dismissWelcome} />
      )}
    </div>
  );
}

// History tab — the original PortalHome content extracted
function PortalHistoryTab({ property, groups, loaded, filter, setFilter, onOpenUnitDay }) {
  const totalPhotos = groups.reduce((sum, g) => sum + g.units.reduce((s, u) => s + u.photoCount, 0), 0);
  const damageCount = groups.reduce((sum, g) => sum + g.units.filter(u => u.hasDamage).length, 0);
  const totalCleanings = groups.reduce((sum, g) => sum + g.units.length, 0);

  return (
    <div className="px-5 pt-6">
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="p-4 rounded-2xl bg-white border border-stone-200">
          <div className="text-xs uppercase tracking-wider font-mono text-stone-500 mb-1">Cleanings</div>
          <div className="text-2xl font-serif">{totalCleanings}</div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-stone-200">
          <div className="text-xs uppercase tracking-wider font-mono text-stone-500 mb-1">Photos</div>
          <div className="text-2xl font-serif">{totalPhotos}</div>
        </div>
        <div className={`p-4 rounded-2xl border ${damageCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-stone-200'}`}>
          <div className={`text-xs uppercase tracking-wider font-mono mb-1 ${damageCount > 0 ? 'text-red-700' : 'text-stone-500'}`}>Damage</div>
          <div className={`text-2xl font-serif ${damageCount > 0 ? 'text-red-800' : ''}`}>{damageCount}</div>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        {[{ id: '7d', label: '7 days' }, { id: '30d', label: '30 days' }, { id: '1y', label: '1 year' }].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filter === f.id ? 'bg-stone-900 text-stone-50' : 'bg-stone-100 text-stone-600'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {!loaded ? <Splash text="Loading…" /> : groups.length === 0 ? (
        <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
          No cleanings in this period.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(g => (
            <div key={g.date}>
              <div className="text-sm font-mono text-stone-500 mb-2 uppercase tracking-wider">
                {new Date(g.date + 'T12:00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}
              </div>
              <div className="space-y-2">
                {g.units.map(u => (
                  <button key={`${g.date}-${u.unitId || 'simple'}`}
                    onClick={() => onOpenUnitDay(u.unitId, g.date)}
                    className={`w-full text-left p-4 rounded-2xl border transition-colors ${
                      u.hasDamage ? 'bg-red-50/50 border-red-200 hover:border-red-400' : 'bg-white border-stone-200 hover:border-stone-400'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-serif text-lg text-stone-900">{u.label}</span>
                          {u.hasDamage && (
                            <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                              ⚠ Damage reported
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-stone-500 font-mono mt-1">
                          {u.photoCount} {u.photoCount === 1 ? 'photo' : 'photos'}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-stone-400 flex-shrink-0 ml-2" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// Detail screen: one unit, one day. Shows all parties cleaned with photos.
function PortalUnitDay({ property, unitId, date, onBack }) {
  const [unit, setUnit] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { (async () => {
    setLoaded(false);

    // Enforce portal start date — refuse to load anything before it
    if (property.portal_start_date && date < property.portal_start_date) {
      setBlocks([]); setLoaded(true);
      return;
    }

    const dayStart = `${date}T00:00:00`;
    const dayEnd = `${date}T23:59:59`;

    if (unitId) {
      const { data: u } = await supabase.from('units').select('*').eq('id', unitId).maybeSingle();
      setUnit(u);
      const { data: bs } = await supabase
        .from('work_blocks')
        .select('*, party:parties(label,full_name), shift:shifts!inner(customer_id), tasks(*, photos(*))')
        .eq('unit_id', unitId)
        .gte('start_time', dayStart).lte('start_time', dayEnd)
        .order('start_time');
      const filtered = (bs || []).filter(b => b.shift?.customer_id === property.id);
      setBlocks(filtered);
    } else {
      // Simple property: pull tasks for shifts on this date
      const { data: shifts } = await supabase
        .from('shifts')
        .select('*, tasks(*, photos(*))')
        .eq('customer_id', property.id)
        .gte('start_time', dayStart).lte('start_time', dayEnd)
        .order('start_time');
      // Wrap each shift as a "block" for uniform display
      const fakeBlocks = (shifts || []).map(s => ({
        id: s.id,
        start_time: s.start_time, end_time: s.end_time,
        party: null,
        tasks: s.tasks || []
      }));
      setBlocks(fakeBlocks);
    }
    setLoaded(true);
  })(); }, [unitId, date, property.id]);

  if (!loaded) return <Splash text="Loading…" />;

  // Aggregate all photos for this unit/day, separated by kind
  const allBefore = [];
  const allAfter = [];
  const allDamage = [];
  blocks.forEach(b => (b.tasks || []).forEach(t => (t.photos || []).forEach(p => {
    if (p.kind === 'before') allBefore.push({ ...p, taskName: t.name, partyLabel: b.party?.label });
    else if (p.kind === 'after') allAfter.push({ ...p, taskName: t.name, partyLabel: b.party?.label });
    else if (p.kind === 'damage') allDamage.push({ ...p, taskName: t.name, partyLabel: b.party?.label });
  })));

  return (
    <div className="min-h-screen bg-stone-50 pb-12">
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="no-print bg-stone-900 text-stone-50 px-5 py-4 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-stone-400 text-sm hover:text-stone-50">
          <ArrowLeft size={16} /> Back
        </button>
        <button onClick={() => window.print()}
          className="px-4 py-2 rounded-full bg-stone-50 text-stone-900 text-sm font-medium flex items-center gap-2">
          <Printer size={14} /> Print
        </button>
      </div>

      <div className="px-5 pt-6">
        <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-2">
          {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}
        </div>
        <h1 className="font-serif text-3xl text-stone-900 mb-1">{unit?.label || property.name}</h1>
        <div className="text-sm text-stone-600 mb-2">{property.name}</div>
        {(() => {
          // List of distinct bedrooms/parties cleaned on this day
          const partyLabels = [...new Set(blocks.map(b => b.party?.label).filter(Boolean))];
          if (partyLabels.length === 0) return null;
          return (
            <div className="flex items-center flex-wrap gap-1.5 mt-3">
              <span className="text-xs uppercase tracking-wider font-mono text-stone-500">Cleaned:</span>
              {partyLabels.map(label => (
                <span key={label} className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  {label}
                </span>
              ))}
            </div>
          );
        })()}
      </div>

      <div className="px-5 pt-6 space-y-6">
        {allDamage.length > 0 && (
          <PortalPhotoSection
            label="Damage report"
            photos={allDamage}
            highlight="red"
            description="Issues identified during cleaning. Please review."
          />
        )}
        <PortalPhotoSection label="Before cleaning" photos={allBefore} />
        <PortalPhotoSection label="After cleaning"  photos={allAfter} />

        {/* Per-party breakdown (no cleaner names — only labels and notes) */}
        {blocks.length > 0 && blocks.some(b => b.party || b.tasks?.length) && (
          <div className="mt-6">
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">Cleaning breakdown</div>
            <div className="space-y-3">
              {blocks.map(b => (
                <div key={b.id} className="p-4 rounded-2xl bg-white border border-stone-200">
                  {b.party && (
                    <div className="font-serif text-base text-stone-900 mb-1">
                      {b.party.label}{b.party.full_name && ` · ${b.party.full_name}`}
                    </div>
                  )}
                  {b.work_notes && (
                    <div className="text-sm text-stone-600 italic mb-2">"{b.work_notes}"</div>
                  )}
                  {b.tasks?.length > 0 && (
                    <ul className="text-sm text-stone-700 space-y-0.5">
                      {b.tasks.map(t => <li key={t.id} className="flex items-center gap-2">
                        <Check size={12} className="text-emerald-600 flex-shrink-0" /> {t.name}
                      </li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {allBefore.length === 0 && allAfter.length === 0 && allDamage.length === 0 && (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            No photos recorded for this date.
          </div>
        )}
      </div>
    </div>
  );
}

function PortalPhotoSection({ label, photos, highlight, description }) {
  const [zoom, setZoom] = useState(null);
  const isDamage = highlight === 'red';
  if (photos.length === 0 && !isDamage) {
    return (
      <div>
        <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2">{label}</div>
        <div className="text-sm text-stone-400 italic">No {label.toLowerCase()} photos.</div>
      </div>
    );
  }
  return (
    <div>
      <div className={`flex items-baseline justify-between mb-3 ${isDamage ? 'pb-2 border-b-2 border-red-200' : ''}`}>
        <h3 className={`font-serif text-xl flex items-center gap-2 ${isDamage ? 'text-red-800' : 'text-stone-900'}`}>
          {isDamage && '⚠'} {label}
        </h3>
        <span className="text-xs font-mono text-stone-500">{photos.length}</span>
      </div>
      {description && <p className="text-sm text-stone-600 mb-3">{description}</p>}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {photos.map(p => (
          <button key={p.id} onClick={() => setZoom(p)}
            className={`aspect-square rounded-lg overflow-hidden ${isDamage ? 'ring-2 ring-red-400' : ''}`}>
            <img loading="lazy" src={p.public_url} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
      {zoom && (
        <PhotoZoomViewer photos={photos} initialUrl={zoom.public_url} onClose={() => setZoom(null)} />
      )}
    </div>
  );
}

// =================================================================
// DAILY VIEW — calendar-first drill-down
// Calendar month → pick a date → see units cleaned that day → pick a unit → full detail
// =================================================================
function DailyView({ employee, onSignOut }) {
  const [view, setView] = useState({ kind: 'calendar' });
  const showMoney = canSeeMoney(employee);

  if (view.kind === 'day') {
    return <DailyDayDetail date={view.date} employee={employee} showMoney={showMoney}
      onBack={() => setView({ kind: 'calendar' })}
      onOpenUnit={(propertyId, unitId, unitLabel, propertyName) =>
        setView({ kind: 'unit-day', date: view.date, propertyId, unitId, unitLabel, propertyName })} />;
  }
  if (view.kind === 'unit-day') {
    return <DailyUnitDayDetail date={view.date} propertyId={view.propertyId} unitId={view.unitId}
      unitLabel={view.unitLabel} propertyName={view.propertyName}
      employee={employee} showMoney={showMoney}
      onBack={() => setView({ kind: 'day', date: view.date })} />;
  }
  if (view.kind === 'inbox') {
    return <InboxView employee={employee}
      onBack={() => setView({ kind: 'calendar' })} />;
  }

  return <DailyCalendar employee={employee} onSignOut={onSignOut}
    onPickDay={(date) => setView({ kind: 'day', date })}
    onOpenInbox={() => setView({ kind: 'inbox' })} />;
}

// Helpers — local-time YYYY-MM-DD (avoids UTC midnight bugs)
const toDateKey = (d) => {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
};

function DailyCalendar({ employee, onSignOut, onPickDay, onOpenInbox }) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [activity, setActivity] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [inboxCounts, setInboxCounts] = useState({ pendingAssignments: 0, newPhotos: 0 });

  // Load inbox counts
  useEffect(() => {
    (async () => {
      const { count: pAssign } = await supabase.from('assignments')
        .select('id', { count: 'exact', head: true })
        .eq('source', 'pm').eq('pm_status', 'pending');
      const { count: pPhotos } = await supabase.from('pm_photos')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'new');
      setInboxCounts({ pendingAssignments: pAssign || 0, newPhotos: pPhotos || 0 });
    })();
  }, []);
  const inboxTotal = inboxCounts.pendingAssignments + inboxCounts.newPhotos;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoaded(false);
      // Pull just shift summary for this month (3-month buffer)
      const start = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1).toISOString();
      const end   = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 2, 1).toISOString();

      // Lightweight: just shift IDs, start, property — no nested rows
      const { data: shifts, error: sErr } = await supabase
        .from('shifts')
        .select('id, start_time, customer_id')
        .gte('start_time', start)
        .lt('start_time', end);
      if (sErr) { console.error('[DailyCalendar] shifts error:', sErr); }
      if (cancelled) return;

      // Separately: which days in this window have damage photos? One query, ID-only.
      // We get all damage photos created in the window, then map their task → shift → date.
      // This is far lighter than nesting on the main shifts query.
      const { data: damagePhotos } = await supabase
        .from('photos')
        .select('task_id, tasks!inner(shift_id, work_block_id, shifts(start_time), work_blocks(shift_id, shifts(start_time)))')
        .eq('kind', 'damage');
      if (cancelled) return;

      // Build a set of date keys that have at least one damage photo
      const damageDays = new Set();
      (damagePhotos || []).forEach(p => {
        const startTime = p.tasks?.shifts?.start_time
          || p.tasks?.work_blocks?.shifts?.start_time;
        if (startTime) damageDays.add(toDateKey(new Date(startTime)));
      });

      // Build per-day counts from shifts alone
      const map = {};
      (shifts || []).forEach(s => {
        const key = toDateKey(new Date(s.start_time));
        if (!map[key]) map[key] = { shiftCount: 0, properties: new Set() };
        map[key].shiftCount++;
        if (s.customer_id) map[key].properties.add(s.customer_id);
      });

      const final = {};
      Object.entries(map).forEach(([k, v]) => {
        final[k] = {
          shiftCount: v.shiftCount,
          propertyCount: v.properties.size,
          hasDamage: damageDays.has(k)
        };
      });
      if (cancelled) return;
      setActivity(final);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [viewMonth]);

  // Build the calendar grid
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstDay.getDay(); // 0 = Sunday

  const cells = [];
  // Leading blanks
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  // Days of the month
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    cells.push({ day: d, key: toDateKey(date), date });
  }
  // Trailing blanks to fill last row
  while (cells.length % 7 !== 0) cells.push(null);

  const monthName = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const todayKey = toDateKey(today);

  const goPrev = () => setViewMonth(new Date(year, month - 1, 1));
  const goNext = () => setViewMonth(new Date(year, month + 1, 1));
  const goToday = () => setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));

  return (
    <div className="pb-24">
      <Header name={employee.name} onSignOut={onSignOut} role={employee.role} />
      <div className="px-5 pt-6">
        {inboxTotal > 0 && (
          <button onClick={onOpenInbox}
            className="w-full mb-5 p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 hover:border-amber-500 active:scale-98 transition-all flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-600 text-white flex items-center justify-center font-mono text-sm font-bold">
                {inboxTotal}
              </div>
              <div className="text-left">
                <div className="font-serif text-base text-stone-900">
                  Inbox — needs review
                </div>
                <div className="text-xs text-stone-600 font-mono">
                  {inboxCounts.pendingAssignments > 0 && `${inboxCounts.pendingAssignments} ${inboxCounts.pendingAssignments === 1 ? 'assignment' : 'assignments'}`}
                  {inboxCounts.pendingAssignments > 0 && inboxCounts.newPhotos > 0 && ' · '}
                  {inboxCounts.newPhotos > 0 && `${inboxCounts.newPhotos} ${inboxCounts.newPhotos === 1 ? 'photo' : 'photos'}`}
                  {' from property managers'}
                </div>
              </div>
            </div>
            <ChevronRight size={18} className="text-stone-400 flex-shrink-0" />
          </button>
        )}
        <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-3">
          Daily browser
        </div>
        <h1 className="text-4xl font-light text-stone-900 tracking-tight mb-6">
          By <span className="font-serif italic text-amber-700">date</span>
        </h1>

        {/* Month navigator */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={goPrev}
            className="p-2 rounded-full bg-stone-100 hover:bg-stone-200 active:scale-95 transition-all">
            <ChevronLeft size={18} className="text-stone-700" />
          </button>
          <div className="text-center">
            <div className="font-serif text-xl text-stone-900">{monthName}</div>
            <button onClick={goToday} className="text-xs font-mono text-amber-700 hover:text-amber-800 mt-0.5">
              Jump to today
            </button>
          </div>
          <button onClick={goNext}
            className="p-2 rounded-full bg-stone-100 hover:bg-stone-200 active:scale-95 transition-all">
            <ChevronRight size={18} className="text-stone-700" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <div key={i} className="text-center text-[10px] font-mono uppercase tracking-wider text-stone-400 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            if (!cell) return <div key={i} />;
            const a = activity[cell.key];
            const isToday = cell.key === todayKey;
            const isFuture = cell.date > today;
            return (
              <button key={i}
                disabled={!a}
                onClick={() => a && onPickDay(cell.key)}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm relative transition-all ${
                  !a ? (isFuture ? 'text-stone-300' : 'text-stone-400 hover:bg-stone-50') :
                  a.hasDamage ? 'bg-red-50 border-2 border-red-300 text-red-900 hover:border-red-500 active:scale-95' :
                  'bg-amber-50 border-2 border-amber-300 text-amber-900 hover:border-amber-500 active:scale-95'
                } ${isToday ? 'ring-2 ring-stone-900 ring-offset-1' : ''}`}>
                <div className={`font-mono ${a ? 'font-bold' : ''}`}>{cell.day}</div>
                {a && (
                  <div className="text-[9px] font-mono mt-0.5 leading-none">
                    {a.shiftCount} {a.shiftCount === 1 ? 'shift' : 'shifts'}
                  </div>
                )}
                {a?.hasDamage && (
                  <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-red-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-stone-500 font-mono">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-amber-50 border-2 border-amber-300" />
            Cleaned
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-50 border-2 border-red-300" />
            Damage
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded ring-2 ring-stone-900" />
            Today
          </div>
        </div>

        {!loaded && <div className="text-center mt-6 text-xs text-stone-400 font-mono">Loading…</div>}
        {loaded && Object.keys(activity).length === 0 && (
          <div className="mt-6 text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            No cleanings recorded this month.
          </div>
        )}
      </div>
    </div>
  );
}

// Day detail: shows all properties + units cleaned on this date
function DailyDayDetail({ date, employee, showMoney, onBack, onOpenUnit }) {
  const [data, setData] = useState(null);

  useEffect(() => { (async () => {
    const dayStart = `${date}T00:00:00`;
    const dayEnd   = `${date}T23:59:59`;

    // Get all shifts that started this day
    const { data: shifts } = await supabase
      .from('shifts')
      .select('*, employee:employees(id,name), customer:customers(id,name,property_type,bill_rate_hourly), work_blocks(id, start_time, end_time, bill_rate_at_work, unit:units(id, label), party:parties(id, label, full_name), tasks(*, photos(*)))')
      .gte('start_time', dayStart)
      .lte('start_time', dayEnd)
      .order('start_time');

    // Group by property → unit
    // For multi_unit shifts we use work_blocks. For simple shifts, group by property only.
    const groups = {};  // { propertyId: { property, units: { unitId: { unitLabel, employees: Set, totalMs, hasDamage, photoCount } } } }

    (shifts || []).forEach(s => {
      if (!s.customer_id) return;
      const propId = s.customer_id;
      if (!groups[propId]) {
        groups[propId] = { property: s.customer, units: {}, simpleShifts: [] };
      }
      const propGroup = groups[propId];

      if (s.customer.property_type === 'multi_unit') {
        (s.work_blocks || []).forEach(b => {
          if (!b.unit) return;
          const uId = b.unit.id;
          if (!propGroup.units[uId]) {
            propGroup.units[uId] = {
              unitId: uId, unitLabel: b.unit.label,
              employees: new Set(), totalMs: 0, hasDamage: false, photoCount: 0, blocks: []
            };
          }
          const ug = propGroup.units[uId];
          ug.employees.add(s.employee?.name || '?');
          ug.blocks.push({ block: b, employee: s.employee, rate: s.customer.bill_rate_hourly });
          if (b.end_time) {
            ug.totalMs += new Date(b.end_time) - new Date(b.start_time);
          } else {
            ug.totalMs += new Date() - new Date(b.start_time);
          }
          (b.tasks || []).forEach(t => (t.photos || []).forEach(p => {
            ug.photoCount++;
            if (p.kind === 'damage') ug.hasDamage = true;
          }));
        });
      } else {
        propGroup.simpleShifts.push(s);
      }
    });

    setData({ groups, shifts: shifts || [] });
  })(); }, [date]);

  if (!data) return <Splash text="Loading…" />;

  const dateObj = new Date(date + 'T12:00:00');
  const propIds = Object.keys(data.groups);
  const totalShifts = data.shifts.length;
  const totalProperties = propIds.length;

  return (
    <div className="pb-24">
      <div className="bg-stone-900 text-stone-50 px-5 pt-5 pb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-stone-400 text-sm mb-4 hover:text-stone-50">
          <ArrowLeft size={16} /> Back to calendar
        </button>
        <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-2">
          {dateObj.toLocaleDateString('en-US', { weekday:'long' })}
        </div>
        <h1 className="font-serif text-3xl mb-1">
          {dateObj.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}
        </h1>
        <div className="text-sm text-stone-300 mt-2">
          {totalShifts} {totalShifts === 1 ? 'shift' : 'shifts'} across {totalProperties} {totalProperties === 1 ? 'property' : 'properties'}
        </div>
      </div>

      <div className="px-5 pt-6">
        {propIds.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            No cleanings on this date.
          </div>
        ) : (
          <div className="space-y-6">
            {propIds.map(propId => {
              const pg = data.groups[propId];
              const unitIds = Object.keys(pg.units);
              const sortedUnits = unitIds.map(id => pg.units[id])
                .sort((a, b) => naturalCompare(a.unitLabel, b.unitLabel));

              return (
                <div key={propId}>
                  <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-stone-200">
                    <h3 className="font-serif text-xl text-stone-900 flex items-center gap-2">
                      <Building2 size={16} /> {pg.property.name}
                    </h3>
                    <span className="text-xs font-mono text-stone-500">
                      {sortedUnits.length || pg.simpleShifts.length} {(sortedUnits.length || pg.simpleShifts.length) === 1 ? 'cleaning' : 'cleanings'}
                    </span>
                  </div>

                  {/* Multi-unit: list of units */}
                  {sortedUnits.length > 0 && (
                    <div className="space-y-2">
                      {sortedUnits.map(u => (
                        <button key={u.unitId}
                          onClick={() => onOpenUnit(propId, u.unitId, u.unitLabel, pg.property.name)}
                          className={`w-full text-left p-4 rounded-2xl border transition-colors ${
                            u.hasDamage ? 'bg-red-50/50 border-red-200 hover:border-red-400' : 'bg-white border-stone-200 hover:border-stone-400'
                          }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-serif text-lg text-stone-900">{u.unitLabel}</span>
                                {u.hasDamage && (
                                  <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                    ⚠ Damage
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-stone-500 font-mono">
                                {fmtTimeShort(u.totalMs)} total · {u.employees.size} {u.employees.size === 1 ? 'cleaner' : 'cleaners'} · {u.photoCount} {u.photoCount === 1 ? 'photo' : 'photos'}
                              </div>
                              <div className="text-xs text-stone-600 mt-1">
                                {[...u.employees].join(', ')}
                              </div>
                            </div>
                            <ChevronRight size={16} className="text-stone-400 flex-shrink-0 ml-2" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Simple-property shifts: just list them as-is */}
                  {pg.simpleShifts.length > 0 && (
                    <div className="space-y-2">
                      {pg.simpleShifts.map(s => {
                        const dur = (s.end_time ? new Date(s.end_time) : new Date()) - new Date(s.start_time);
                        return (
                          <div key={s.id} className="p-4 rounded-2xl bg-white border border-stone-200">
                            <div className="font-serif text-base text-stone-900">{s.employee?.name}</div>
                            <div className="text-xs text-stone-500 font-mono mt-1">
                              {fmtClock(s.start_time)}{s.end_time && ` — ${fmtClock(s.end_time)}`} · {fmtTimeShort(dur)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // Helper hoisted so we can call it inside the JSX above
  // (onOpenUnit comes in as a prop from the parent — see DailyView)
}

// Unit + day detail — full breakdown of who cleaned what at that unit on that date, with photos
function DailyUnitDayDetail({ date, propertyId, unitId, unitLabel, propertyName, employee, showMoney, onBack }) {
  const canEdit = employee?.role === 'owner' || employee?.role === 'manager';
  const [blocks, setBlocks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);
  const [deletingBlock, setDeletingBlock] = useState(null);
  const [deletingShift, setDeletingShift] = useState(null); // shift obj
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setLoaded(false);
    const dayStart = `${date}T00:00:00`;
    const dayEnd   = `${date}T23:59:59`;
    const { data } = await supabase
      .from('work_blocks')
      .select('*, party:parties(label, full_name), shift:shifts!inner(id, customer_id, start_time, end_time, employee:employees(id,name), bill_rate_at_work, customer:customers(bill_rate_hourly, name)), tasks(*, photos(*))')
      .eq('unit_id', unitId)
      .gte('start_time', dayStart)
      .lte('start_time', dayEnd)
      .order('start_time');
    const filtered = (data || []).filter(b => b.shift?.customer_id === propertyId);
    setBlocks(filtered);
    setLoaded(true);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [date, unitId, propertyId]);

  const saveBlockTimes = async (block, startISO, endISO) => {
    setBusy(true);
    const { error } = await supabase.from('work_blocks')
      .update({ start_time: startISO, end_time: endISO || null })
      .eq('id', block.id);
    setBusy(false);
    if (error) { alert('Could not save: ' + error.message); return; }
    setEditingBlock(null);
    reload();
  };

  const deleteBlock = async (block) => {
    setBusy(true);
    const { error } = await supabase.from('work_blocks').delete().eq('id', block.id);
    setBusy(false);
    if (error) { alert('Could not delete: ' + error.message); return; }
    setDeletingBlock(null);
    reload();
  };

  const deleteShift = async (shift) => {
    setBusy(true);
    const { error } = await supabase.from('shifts').delete().eq('id', shift.id);
    setBusy(false);
    if (error) { alert('Could not delete: ' + error.message); return; }
    setDeletingShift(null);
    reload();
  };

  if (!loaded) return <Splash text="Loading…" />;

  // Aggregate stats
  const employeeTimes = {}; // name -> totalMs
  let totalMs = 0;
  let totalBillable = 0;
  const allTasks = [];
  blocks.forEach(b => {
    const dur = (b.end_time ? new Date(b.end_time) : new Date()) - new Date(b.start_time);
    totalMs += dur;
    const empName = b.shift?.employee?.name || '?';
    employeeTimes[empName] = (employeeTimes[empName] || 0) + dur;
    if (showMoney && b.end_time) {
      const rate = b.bill_rate_at_work || b.shift?.customer?.bill_rate_hourly || 0;
      totalBillable += (dur / 1000 / 3600) * rate;
    }
    (b.tasks || []).forEach(t => allTasks.push({ ...t, employee: empName, party: b.party }));
  });

  // Group tasks by party for display
  const partyGroups = {};
  blocks.forEach(b => {
    const partyKey = b.party?.id || 'no-party';
    if (!partyGroups[partyKey]) {
      partyGroups[partyKey] = { party: b.party, blocks: [] };
    }
    partyGroups[partyKey].blocks.push(b);
  });

  const dateObj = new Date(date + 'T12:00:00');

  return (
    <div className="pb-24">
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print bg-stone-900 text-stone-50 px-5 py-4 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-stone-400 text-sm hover:text-stone-50">
          <ArrowLeft size={16} /> Back
        </button>
        <button onClick={() => window.print()}
          className="px-4 py-2 rounded-full bg-stone-50 text-stone-900 text-sm font-medium flex items-center gap-2">
          <Printer size={14} /> Print
        </button>
      </div>

      <div className="px-5 pt-6">
        <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-2">
          {dateObj.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}
        </div>
        <h1 className="font-serif text-3xl text-stone-900 mb-1">{unitLabel}</h1>
        <div className="text-sm text-stone-600 flex items-center gap-1.5">
          <Building2 size={13} /> {propertyName}
        </div>

        {/* Stats summary */}
        <div className={`grid ${showMoney ? 'grid-cols-3' : 'grid-cols-2'} gap-3 mt-6 mb-6`}>
          <div className="p-4 rounded-2xl bg-white border border-stone-200">
            <div className="text-xs uppercase tracking-wider font-mono text-stone-500 mb-1">Total time</div>
            <div className="text-2xl font-serif">{fmtTimeShort(totalMs)}</div>
          </div>
          <div className="p-4 rounded-2xl bg-white border border-stone-200">
            <div className="text-xs uppercase tracking-wider font-mono text-stone-500 mb-1">Cleaners</div>
            <div className="text-2xl font-serif">{Object.keys(employeeTimes).length}</div>
          </div>
          {showMoney && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
              <div className="text-xs uppercase tracking-wider font-mono text-amber-700 mb-1">Billable</div>
              <div className="text-2xl font-serif text-amber-900">{fmtMoney(totalBillable)}</div>
            </div>
          )}
        </div>

        {/* Per-employee summary */}
        <div className="mb-6">
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">Time by cleaner</div>
          <div className="space-y-2">
            {Object.entries(employeeTimes)
              .sort((a, b) => b[1] - a[1])
              .map(([name, ms]) => (
                <div key={name} className="flex items-center justify-between p-3 bg-white border border-stone-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-stone-400" />
                    <span className="text-stone-900">{name}</span>
                  </div>
                  <span className="font-mono text-sm text-stone-700">{fmtTimeShort(ms)}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Per-party detail */}
        <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">Cleaning details</div>
        {blocks.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            No work blocks recorded.
          </div>
        ) : (
          <div className="space-y-4">
            {Object.values(partyGroups).map((pg, i) => (
              <div key={i} className="p-4 rounded-2xl bg-white border border-stone-200">
                {pg.party && (
                  <div className="font-serif text-lg text-stone-900 mb-2">
                    {pg.party.label}
                    {pg.party.full_name && <span className="text-sm text-stone-500 ml-2">{pg.party.full_name}</span>}
                  </div>
                )}
                <div className="space-y-3">
                  {pg.blocks.map(b => {
                    const dur = (b.end_time ? new Date(b.end_time) : new Date()) - new Date(b.start_time);
                    const billable = showMoney && b.end_time
                      ? (dur / 1000 / 3600) * (b.bill_rate_at_work || b.shift?.customer?.bill_rate_hourly || 0)
                      : 0;
                    return (
                      <div key={b.id} className="pb-3 border-b border-stone-100 last:border-b-0 last:pb-0">
                        <div className="flex items-start justify-between mb-2 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <User size={13} className="text-stone-400" />
                            <span className="font-medium text-stone-900 text-sm">{b.shift?.employee?.name}</span>
                          </div>
                          <div className="text-xs font-mono text-stone-500">
                            {fmtClock(b.start_time)}{b.end_time && ` — ${fmtClock(b.end_time)}`} · {fmtTimeShort(dur)}
                            {showMoney && billable > 0 && <span className="text-emerald-700 ml-2">{fmtMoney(billable)}</span>}
                          </div>
                        </div>
                        {b.work_notes && (
                          <div className="text-xs text-stone-600 italic mb-2 pl-5">"{b.work_notes}"</div>
                        )}
                        {b.tasks?.length > 0 && (
                          <div className="pl-5 space-y-2">
                            {b.tasks.map(t => <TaskDetail key={t.id} task={t} compact />)}
                          </div>
                        )}
                        {/* Per-block edit/delete actions */}
                        {canEdit && (
                          <div className="mt-3 pl-5 flex gap-2 no-print">
                            <button onClick={() => setEditingBlock(b)}
                              className="px-3 py-1.5 rounded-lg bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-medium flex items-center gap-1.5">
                              <Edit2 size={11} /> Edit times
                            </button>
                            <button onClick={() => setDeletingBlock(b)}
                              className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-medium flex items-center gap-1.5 hover:bg-red-50">
                              <Trash2 size={11} /> Delete block
                            </button>
                            <button onClick={() => setDeletingShift(b.shift)}
                              className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-medium flex items-center gap-1.5 hover:bg-red-50 ml-auto">
                              <Trash2 size={11} /> Delete this shift
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals (reused from ShiftDetail) */}
      {editingBlock && (
        <TimeEditModal
          title="Edit work block times"
          subtitle={`${unitLabel} · ${editingBlock.party?.label || ''}`}
          startTime={editingBlock.start_time}
          endTime={editingBlock.end_time}
          busy={busy}
          onSave={(s, e) => saveBlockTimes(editingBlock, s, e)}
          onClose={() => setEditingBlock(null)} />
      )}
      {deletingBlock && (
        <DeleteConfirmModal
          title="Delete this work block?"
          description="This removes the work block and all its tasks and photos, but keeps the rest of the shift intact."
          itemSummary={`${unitLabel} · ${deletingBlock.party?.label || ''} · ${deletingBlock.shift?.employee?.name || ''}`}
          busy={busy}
          onConfirm={() => deleteBlock(deletingBlock)}
          onClose={() => setDeletingBlock(null)} />
      )}
      {deletingShift && (
        <DeleteConfirmModal
          title="Delete this entire shift?"
          description="This permanently deletes the whole shift for this cleaner, including ALL work blocks (other apartments too, not just this one), tasks, and photos. This cannot be undone."
          itemSummary={`${deletingShift.employee?.name} · ${fmtDate(deletingShift.start_time)} · ${deletingShift.customer?.name || ''}`}
          busy={busy}
          onConfirm={() => deleteShift(deletingShift)}
          onClose={() => setDeletingShift(null)} />
      )}
    </div>
  );
}

// =================================================================
// ASSIGNMENT LIST — owner/manager view of all assignments for a property
// =================================================================
function AssignmentList({ property, employee, onBack, onNew, onOpen }) {
  const [assignments, setAssignments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState('open'); // open | all

  const load = async () => {
    const { data } = await supabase
      .from('assignments')
      .select('*, targets:assignment_targets(id, status, unit:units(label), party:parties(label))')
      .eq('customer_id', property.id)
      .order('created_at', { ascending: false });
    setAssignments(data || []); setLoaded(true);
  };
  useEffect(() => { load(); }, [property.id]);

  // Aggregate status per assignment
  const decorated = (assignments || []).map(a => {
    const total = a.targets?.length || 0;
    const done = (a.targets || []).filter(t => t.status === 'done').length;
    const inProgress = (a.targets || []).filter(t => t.status === 'in_progress').length;
    const blocked = (a.targets || []).filter(t => t.status === 'blocked').length;
    const allDone = total > 0 && done === total;
    return { ...a, total, done, inProgress, blocked, allDone };
  });

  const visible = filter === 'open'
    ? decorated.filter(a => !a.allDone && a.active)
    : decorated;

  return (
    <div className="pb-24">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-stone-100">
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono truncate">{property.name}</div>
          <div className="font-serif text-xl text-stone-900">Assignments</div>
        </div>
      </div>
      <div className="px-5 pt-6">
        <button onClick={onNew}
          className="w-full mb-4 p-4 rounded-2xl bg-stone-900 text-stone-50 font-medium flex items-center justify-center gap-2 active:scale-98">
          <Plus size={18} /> Upload new assignment
        </button>

        <div className="flex gap-2 mb-4">
          <button onClick={() => setFilter('open')}
            className={`px-4 py-2 rounded-full text-sm font-medium ${filter === 'open' ? 'bg-stone-900 text-stone-50' : 'bg-stone-100 text-stone-600'}`}>
            Open ({decorated.filter(a => !a.allDone && a.active).length})
          </button>
          <button onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium ${filter === 'all' ? 'bg-stone-900 text-stone-50' : 'bg-stone-100 text-stone-600'}`}>
            All ({decorated.length})
          </button>
        </div>

        {!loaded ? <Splash text="Loading…" /> : visible.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            {filter === 'open' ? 'No open assignments. Tap "Upload new assignment" to add one.' : 'No assignments yet.'}
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map(a => (
              <button key={a.id} onClick={() => onOpen(a)}
                className={`w-full text-left p-4 rounded-2xl border ${a.allDone ? 'bg-stone-100 border-stone-200 opacity-70' : a.blocked > 0 ? 'bg-red-50/50 border-red-200' : 'bg-white border-stone-200'} hover:border-stone-400 transition-colors`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {a.file_kind === 'pdf'
                        ? <FileText size={14} className="text-stone-500 flex-shrink-0" />
                        : <ImageIcon size={14} className="text-stone-500 flex-shrink-0" />}
                      <span className="font-serif text-lg text-stone-900 truncate">{a.title}</span>
                      {a.allDone && <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Done</span>}
                      {a.blocked > 0 && <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-red-100 text-red-700">⚠ Blocked</span>}
                    </div>
                    <div className="text-xs text-stone-500 font-mono">
                      {fmtDate(a.created_at)} · {a.done}/{a.total} done{a.inProgress > 0 && `, ${a.inProgress} in progress`}
                    </div>
                    {a.notes && <div className="text-xs text-stone-600 mt-1 line-clamp-1">{a.notes}</div>}
                  </div>
                  <ChevronRight size={16} className="text-stone-400 flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =================================================================
// ASSIGNMENT FORM — bulk multi-file uploader
//
// Lets the owner/manager pick multiple files at once and configure
// each one individually (title, notes, property/unit/party target)
// before saving them all in one batch.
//
// `property` is the *default* property (where they came from). Each
// file can be retargeted to a different property if needed.
// =================================================================
function AssignmentForm({ property, employee, onCancel, onSaved }) {
  // Each row: { id, file, title, notes, propertyId, scope, unitId, partyId, multipleTargets }
  const [rows, setRows] = useState([]);
  const [allProperties, setAllProperties] = useState([]);
  // Cache of units per property: { [propertyId]: [{id, label, parties:[...]}] }
  const [unitsByProperty, setUnitsByProperty] = useState({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('customers').select('*')
        .eq('active', true).order('name');
      setAllProperties(data || []);
    })();
  }, []);

  // Load units for a property on demand (and cache)
  const ensureUnitsLoaded = async (propertyId) => {
    if (unitsByProperty[propertyId]) return unitsByProperty[propertyId];
    const { data } = await supabase.from('units')
      .select('*, parties(id, label, full_name, active, sort_order)')
      .eq('customer_id', propertyId).eq('active', true)
      .order('sort_order').order('label');
    const sorted = (data || []).slice().sort((a, b) => naturalCompare(a.label, b.label));
    setUnitsByProperty(prev => ({ ...prev, [propertyId]: sorted }));
    return sorted;
  };

  // When a property is set/changed on a row, prefetch its units
  useEffect(() => {
    const ids = [...new Set(rows.map(r => r.propertyId).filter(Boolean))];
    ids.forEach(id => { if (!unitsByProperty[id]) ensureUnitsLoaded(id); });
    // eslint-disable-next-line
  }, [rows]);

  const addFiles = (files) => {
    const newRows = Array.from(files).map(f => {
      // Pre-strip extension for a sensible default title
      const baseName = (f.name || '').replace(/\.[a-z0-9]+$/i, '');
      const defaultProperty = property?.id || (allProperties[0]?.id || '');
      const isMulti = allProperties.find(p => p.id === defaultProperty)?.property_type === 'multi_unit';
      return {
        id: `${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
        file: f,
        title: baseName.slice(0, 80),
        notes: '',
        propertyId: defaultProperty,
        scope: isMulti ? 'specific' : 'property',
        unitId: '',
        partyId: '',
        multipleTargets: []  // [{ unitId, partyId }]
      };
    });
    setRows(prev => [...prev, ...newRows]);
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = ''; // reset so picking the same file again re-fires
    }
  };

  const updateRow = (id, patch) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const removeRow = (id) => {
    setRows(prev => prev.filter(r => r.id !== id));
  };

  // Auto-build a title prefix from the target selection, e.g. "B3-205 · Bedroom 2 — "
  // Called when unit/party changes on a row. Replaces any existing auto-prefix but
  // keeps anything the user manually typed after it.
  const autoPrefixFor = (rowId, unitIdNew, partyIdNew) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const units = unitsByProperty[r.propertyId] || [];
      const unit = units.find(u => u.id === unitIdNew);
      const party = (unit?.parties || []).find(p => p.id === partyIdNew);
      const prefix = unit
        ? `${unit.label}${party ? ` · ${party.label}` : ''} — `
        : '';
      // Strip the OLD prefix off the title if it was previously set, so we replace cleanly.
      // The old prefix looks like "<unit> · <party> — " — match it generically.
      let manualPart = r.title;
      const oldPrefixMatch = manualPart.match(/^[^—]+ — /);
      if (oldPrefixMatch) manualPart = manualPart.slice(oldPrefixMatch[0].length);
      return { ...r, unitId: unitIdNew, partyId: partyIdNew, title: prefix + manualPart };
    }));
  };

  // When the property on a row changes, reset its scope/targets
  const changeRowProperty = (id, newPropId) => {
    const isMulti = allProperties.find(p => p.id === newPropId)?.property_type === 'multi_unit';
    updateRow(id, {
      propertyId: newPropId,
      scope: isMulti ? 'specific' : 'property',
      unitId: '', partyId: '', multipleTargets: []
    });
  };

  const toggleTarget = (rowId, uId, pId) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const exists = r.multipleTargets.some(t => t.unitId === uId && (t.partyId || null) === (pId || null));
      const next = exists
        ? r.multipleTargets.filter(t => !(t.unitId === uId && (t.partyId || null) === (pId || null)))
        : [...r.multipleTargets, { unitId: uId, partyId: pId || null }];
      return { ...r, multipleTargets: next };
    }));
  };

  // Select / deselect every active party inside a unit, for one row
  const toggleAllInUnit = (rowId, unit) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const activeParties = (unit.parties || []).filter(p => p.active);
      const allSelected = activeParties.every(p =>
        r.multipleTargets.some(t => t.unitId === unit.id && (t.partyId || null) === p.id));
      const next = allSelected
        ? r.multipleTargets.filter(t => t.unitId !== unit.id)
        : [
            ...r.multipleTargets.filter(t => t.unitId !== unit.id),
            ...activeParties.map(p => ({ unitId: unit.id, partyId: p.id }))
          ];
      return { ...r, multipleTargets: next };
    }));
  };

  // Per-row search text for the multi-select
  const [unitSearches, setUnitSearches] = useState({}); // { [rowId]: 'searchString' }
  const setUnitSearch = (rowId, q) => setUnitSearches(prev => ({ ...prev, [rowId]: q }));

  const validateRows = () => {
    if (rows.length === 0) return 'Add at least one file.';
    for (const r of rows) {
      if (!r.title.trim()) return `One of the files is missing a title.`;
      if (!r.propertyId) return `One of the files has no property set.`;
      const prop = allProperties.find(p => p.id === r.propertyId);
      const isMulti = prop?.property_type === 'multi_unit';
      if (isMulti) {
        if (!r.unitId || !r.partyId) {
          return `"${r.title}" needs a unit and bedroom.`;
        }
      }
    }
    return null;
  };

  const saveAll = async () => {
    setError('');
    const v = validateRows();
    if (v) { setError(v); return; }
    setBusy(true);
    try {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        setProgress(`Uploading file ${i + 1} of ${rows.length}…`);
        const { path, publicUrl, kind } = await uploadAssignmentFile(r.file, r.propertyId);

        const { data: created, error: e } = await supabase.from('assignments')
          .insert({
            customer_id: r.propertyId,
            title: r.title.trim(),
            notes: r.notes.trim() || null,
            file_path: path,
            file_url: publicUrl,
            file_kind: kind,
            uploaded_by: employee.id,
            active: true
          }).select().single();
        if (e) throw e;

        const prop = allProperties.find(p => p.id === r.propertyId);
        const isMulti = prop?.property_type === 'multi_unit';
        // Single target only: either the picked unit+bedroom, or the whole property for simple
        const targetRows = isMulti
          ? [{ assignment_id: created.id, unit_id: r.unitId, party_id: r.partyId, status: 'pending' }]
          : [{ assignment_id: created.id, unit_id: null, party_id: null, status: 'pending' }];
        const { error: te } = await supabase.from('assignment_targets').insert(targetRows);
        if (te) throw te;
      }
      setProgress(`Done — ${rows.length} assignment${rows.length === 1 ? '' : 's'} created.`);
      setTimeout(() => onSaved(), 400);
    } catch (err) {
      setError(err.message || String(err));
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200 sticky top-0 bg-stone-50 z-10">
        <button onClick={onCancel} className="p-2 -ml-2 rounded-full hover:bg-stone-100">
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div>
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">New assignments</div>
          <div className="font-serif text-xl text-stone-900">Upload &amp; assign</div>
        </div>
      </div>

      <div className="px-5 pt-6">
        {/* File picker — always available, can add more */}
        <label className="block w-full p-6 border-2 border-dashed border-stone-300 rounded-2xl text-center cursor-pointer hover:border-stone-900 transition-colors mb-4">
          <Plus size={28} className="mx-auto mb-2 text-stone-500" />
          <div className="text-stone-700 font-medium text-sm">
            {rows.length === 0 ? 'Pick one or more PDFs / images' : 'Add more files'}
          </div>
          <div className="text-xs text-stone-500 mt-0.5">You can configure each one below before saving</div>
          <input type="file" accept="application/pdf,image/*" multiple onChange={handleFileInput} className="hidden" />
        </label>

        {rows.length === 0 && (
          <div className="text-center py-8 text-stone-400 text-sm">
            No files yet. Pick some files to get started.
          </div>
        )}

        {/* Per-file configuration rows */}
        <div className="space-y-3">
          {rows.map((row, idx) => {
            const prop = allProperties.find(p => p.id === row.propertyId);
            const isMulti = prop?.property_type === 'multi_unit';
            const units = unitsByProperty[row.propertyId] || [];
            const rowParties = (units.find(u => u.id === row.unitId)?.parties || [])
              .filter(p => p.active).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            const isPdf = row.file.type === 'application/pdf' || /\.pdf$/i.test(row.file.name);

            return (
              <div key={row.id} className="p-4 rounded-2xl bg-white border border-stone-200">
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center">
                    {isPdf ? <FileText size={18} className="text-stone-600" /> : <ImageIcon size={18} className="text-stone-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-stone-500 truncate">{row.file.name}</div>
                    <div className="text-[10px] font-mono text-stone-400">
                      {(row.file.size / 1024).toFixed(0)} KB · #{idx + 1}
                    </div>
                  </div>
                  <button onClick={() => removeRow(row.id)} disabled={busy}
                    className="p-2 rounded-full hover:bg-stone-100 text-stone-500">
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1 block">Title</label>
                    <input type="text" value={row.title} onChange={(e) => updateRow(row.id, { title: e.target.value })}
                      placeholder="e.g. Week of May 13 — kitchen + bath"
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm" />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1 block">Notes (optional)</label>
                    <textarea value={row.notes} onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                      rows={2} placeholder="Standing instructions or context…"
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm resize-none" />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1 block">Property</label>
                    <select value={row.propertyId} onChange={(e) => changeRowProperty(row.id, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm">
                      {allProperties.map(p => <option key={p.id} value={p.id}>{p.name}{p.property_type === 'multi_unit' ? ' (multi-unit)' : ''}</option>)}
                    </select>
                  </div>

                  {isMulti && (
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-stone-500 font-mono mb-1 block">Bedroom</label>
                      <div className="grid grid-cols-2 gap-2">
                        <SearchableUnitPicker
                          units={units}
                          value={row.unitId}
                          placeholder="Pick a unit…"
                          onChange={(newUnitId) => autoPrefixFor(row.id, newUnitId, '')} />
                        <select value={row.partyId} onChange={(e) => autoPrefixFor(row.id, row.unitId, e.target.value)}
                          disabled={!row.unitId}
                          className="px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm disabled:opacity-50">
                          <option value="">Bedroom…</option>
                          {rowParties.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            );
          })}
        </div>

        {/* Inline submit area at bottom of the page (NOT fixed — avoids overlap with the manager nav bar) */}
        {rows.length > 0 && (
          <div className="mt-6 space-y-3">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
              </div>
            )}
            {busy && progress && (
              <div className="p-3 rounded-xl bg-stone-100 text-stone-700 text-sm font-mono flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-stone-700 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                {progress}
              </div>
            )}
            <button onClick={saveAll} disabled={busy}
              className="w-full py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium disabled:opacity-50">
              {busy ? 'Uploading…' : `Save ${rows.length} assignment${rows.length === 1 ? '' : 's'}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// =================================================================
// ASSIGNMENT DETAIL — full view for owner/manager
// =================================================================
function AssignmentDetail({ property, assignment: assignmentInit, employee, onBack }) {
  const [assignment, setAssignment] = useState(assignmentInit);
  const [targets, setTargets] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const reload = async () => {
    const { data: a } = await supabase.from('assignments').select('*').eq('id', assignmentInit.id).maybeSingle();
    if (a) setAssignment(a);
    const { data: ts, error: tErr } = await supabase
      .from('assignment_targets')
      .select('*, unit:units(label), party:parties(label, full_name), completer:employees!completed_by(name)')
      .eq('assignment_id', assignmentInit.id);
    if (tErr) console.error('[AssignmentDetail] targets load error:', tErr);
    setTargets(ts || []);
    setLoaded(true);
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const deleteAssignment = async () => {
    setBusy(true);
    // Delete file from storage first
    if (assignment.file_path) {
      await supabase.storage.from(ASSIGNMENT_BUCKET).remove([assignment.file_path]);
    }
    const { error } = await supabase.from('assignments').delete().eq('id', assignment.id);
    setBusy(false);
    if (error) { alert('Could not delete: ' + error.message); return; }
    onBack();
  };

  const sortedTargets = (targets || []).slice().sort((a, b) => {
    const ua = a.unit?.label || ''; const ub = b.unit?.label || '';
    if (ua !== ub) return naturalCompare(ua, ub);
    return naturalCompare(a.party?.label || '', b.party?.label || '');
  });

  return (
    <div className="pb-24">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-stone-100">
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono truncate">{property.name}</div>
          <div className="font-serif text-xl text-stone-900 truncate">{assignment.title}</div>
        </div>
      </div>
      <div className="px-5 pt-6 space-y-5">
        {/* Document preview/link */}
        <div className="p-4 rounded-2xl bg-white border border-stone-200">
          <div className="flex items-center gap-3 mb-3">
            {assignment.file_kind === 'pdf'
              ? <FileText size={20} className="text-stone-600" />
              : <ImageIcon size={20} className="text-stone-600" />}
            <div className="flex-1">
              <div className="font-serif text-base text-stone-900">Assignment file</div>
              <div className="text-xs text-stone-500 font-mono">{assignment.file_kind?.toUpperCase()} · uploaded {fmtDate(assignment.created_at)}</div>
            </div>
          </div>
          {assignment.file_kind === 'image' && (
            <img loading="lazy" src={assignment.file_url} alt="" className="w-full rounded-xl mb-3" />
          )}
          <a href={assignment.file_url} target="_blank" rel="noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-stone-900 text-stone-50 text-sm font-medium">
            <Eye size={14} /> Open in new tab
          </a>
        </div>

        {/* Notes */}
        {assignment.notes && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <div className="text-xs uppercase tracking-wider font-mono text-amber-700 mb-1">Notes</div>
            <div className="text-sm text-stone-800 whitespace-pre-wrap">{assignment.notes}</div>
          </div>
        )}

        {/* Targets list */}
        <div>
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">
            Targets ({targets.length})
          </div>
          {!loaded ? <Splash text="Loading…" /> : sortedTargets.length === 0 ? (
            <div className="text-center py-8 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
              No targets.
            </div>
          ) : (
            <div className="space-y-2">
              {sortedTargets.map(t => {
                const s = ASSIGNMENT_STATUSES[t.status] || ASSIGNMENT_STATUSES.pending;
                return (
                  <div key={t.id} className="p-3 rounded-xl bg-white border border-stone-200">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="font-serif text-base text-stone-900">
                          {t.unit?.label ? <>{t.unit.label}{t.party?.label ? ` · ${t.party.label}` : ''}</> : 'Whole property'}
                        </div>
                        {t.party?.full_name && <div className="text-xs text-stone-500">{t.party.full_name}</div>}
                        {t.status_notes && (
                          <div className="text-xs text-stone-600 italic mt-1">"{t.status_notes}"</div>
                        )}
                        {t.completed_at && (
                          <div className="text-xs text-stone-500 font-mono mt-1">
                            Done {fmtDate(t.completed_at)}{t.completer?.name && ` by ${t.completer.name}`}
                          </div>
                        )}
                      </div>
                      <span className={`text-[10px] uppercase tracking-wider font-mono px-2 py-1 rounded-full border ${s.color}`}>
                        {s.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Delete */}
        <div className="pt-4 border-t border-stone-200">
          {!confirmingDelete ? (
            <button onClick={() => setConfirmingDelete(true)}
              className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-700 text-sm font-medium flex items-center justify-center gap-2">
              <Trash2 size={14} /> Delete this assignment
            </button>
          ) : (
            <DeleteConfirmModal
              title="Delete this assignment?"
              description="This removes the assignment document, all its target records, and the file from storage. Cleaners will no longer see it."
              itemSummary={assignment.title}
              busy={busy}
              onConfirm={deleteAssignment}
              onClose={() => setConfirmingDelete(false)} />
          )}
        </div>
      </div>
    </div>
  );
}

// =================================================================
// CLEANER-SIDE: AssignmentBanner shows pending assignments for the
// current context (unit + party, or whole property).
// onUpdate is called after a status change so parent can refresh.
// =================================================================
// AssignmentBanner — inline list of assignments for a given context.
// Props:
//   propertyId, unitId, partyId — what context to filter by
//   employee — current user
//   showDone — if true, includes done assignments
//   onUpdate — called after any status change so parent can refresh
function AssignmentBanner({ propertyId, unitId, partyId, employee, showDone = false, onUpdate }) {
  const [targets, setTargets] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [opened, setOpened] = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [reassignTarget, setReassignTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    let q = supabase
      .from('assignment_targets')
      .select('*, assignment:assignments!inner(id, title, notes, file_url, file_kind, customer_id, active, source, pm_status), unit:units(id, label), party:parties(id, label), starter:employees!started_by(name), completer:employees!completed_by(name)');

    if (!showDone) q = q.neq('status', 'done');

    if (unitId && partyId) {
      q = q.or(`and(unit_id.eq.${unitId},party_id.eq.${partyId}),and(unit_id.is.null,party_id.is.null)`);
    } else if (unitId) {
      q = q.or(`unit_id.eq.${unitId},and(unit_id.is.null,party_id.is.null)`);
    } else {
      q = q.is('unit_id', null).is('party_id', null);
    }

    const { data, error } = await q;
    if (error) {
      console.error('[AssignmentBanner] load error:', error);
    }
    // Hide non-approved PM assignments from cleaners — they should only see what's approved
    const filtered = (data || []).filter(t =>
      t.assignment?.customer_id === propertyId &&
      t.assignment?.active &&
      (t.assignment?.source !== 'pm' || t.assignment?.pm_status === 'approved')
    );
    setTargets(filtered);
    setLoaded(true);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [propertyId, unitId, partyId, showDone]);

  const updateStatus = async (target, newStatus, statusNotes) => {
    setBusy(true);
    const patch = { status: newStatus };
    if (newStatus === 'in_progress') {
      if (!target.started_at) patch.started_at = new Date().toISOString();
      patch.started_by = employee?.id || null;
    }
    if (newStatus === 'done') {
      patch.completed_at = new Date().toISOString();
      patch.completed_by = employee?.id || null;
    } else if (target.status === 'done') {
      patch.completed_at = null;
      patch.completed_by = null;
    }
    if (statusNotes !== undefined) patch.status_notes = statusNotes || null;

    const { error } = await supabase.from('assignment_targets').update(patch).eq('id', target.id);
    setBusy(false);
    if (error) { alert('Could not update: ' + error.message); return; }
    setStatusModal(null);
    load();
    if (onUpdate) onUpdate();
  };

  if (!loaded || targets.length === 0) return null;

  return (
    <div className="mx-4 mt-4 p-4 rounded-2xl bg-blue-50 border-2 border-blue-200">
      <div className="flex items-center gap-2 mb-3">
        <FileText size={16} className="text-blue-700" />
        <span className="text-xs uppercase tracking-wider text-blue-800 font-mono">
          {targets.length} assignment{targets.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="space-y-2">
        {targets.map(t => (
          <AssignmentCard key={t.id} target={t} busy={busy} propertyId={propertyId}
            onView={() => setOpened(t)}
            onStart={() => updateStatus(t, 'in_progress')}
            onDone={() => updateStatus(t, 'done')}
            onReopen={() => updateStatus(t, 'pending')}
            onBlocked={() => setStatusModal({ target: t })}
            onReassign={() => setReassignTarget(t)} />
        ))}
      </div>

      {opened && <AssignmentViewer target={opened} onClose={() => setOpened(null)} />}
      {statusModal && (
        <BlockedNoteModal target={statusModal.target}
          onSave={(notes) => updateStatus(statusModal.target, 'blocked', notes)}
          onClose={() => setStatusModal(null)}
          busy={busy} />
      )}
      {reassignTarget && (
        <ReassignModal target={reassignTarget} propertyId={propertyId}
          onSaved={() => { setReassignTarget(null); load(); if (onUpdate) onUpdate(); }}
          onClose={() => setReassignTarget(null)} />
      )}
    </div>
  );
}

// Reusable card for one assignment target, used in banner + panel
function AssignmentCard({ target, busy, onView, onStart, onDone, onReopen, onBlocked, onReassign, onGoToBedroom, propertyId }) {
  const t = target;
  const s = ASSIGNMENT_STATUSES[t.status] || ASSIGNMENT_STATUSES.pending;
  const isDone = t.status === 'done';
  const canGo = onGoToBedroom && t.unit_id && t.party_id && !isDone;
  const [activeCleaners, setActiveCleaners] = useState([]);

  // Pull who's currently working at this target's unit+party (active work blocks today)
  useEffect(() => {
    if (!t.unit_id || !t.party_id || isDone) { setActiveCleaners([]); return; }
    (async () => {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from('work_blocks')
        .select('id, end_time, shift:shifts!inner(employee:employees(id, name), customer_id)')
        .eq('unit_id', t.unit_id).eq('party_id', t.party_id)
        .gte('start_time', todayStart.toISOString())
        .is('end_time', null);
      const cleaners = (data || [])
        .filter(b => b.shift?.customer_id === propertyId)
        .map(b => b.shift?.employee?.name)
        .filter(Boolean);
      // dedupe
      setActiveCleaners([...new Set(cleaners)]);
    })();
  }, [t.unit_id, t.party_id, isDone, propertyId, t.status]);

  return (
    <div className={`p-3 rounded-xl border ${isDone ? 'bg-stone-50 border-stone-200 opacity-90' : 'bg-white border-stone-200'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-serif text-base text-stone-900 truncate">{t.assignment?.title}</div>
          {(t.unit?.label || t.party?.label) && (
            <div className="text-xs font-mono text-stone-500 mt-0.5">
              {t.unit?.label}{t.party?.label && ` · ${t.party.label}`}
            </div>
          )}
          {t.assignment?.notes && (
            <div className="text-xs text-stone-600 mt-1 line-clamp-2">{t.assignment.notes}</div>
          )}
          {t.status === 'in_progress' && t.starter?.name && (
            <div className="text-xs text-amber-700 font-mono mt-1">
              Started by {t.starter.name}{t.started_at && ` · ${fmtClock(t.started_at)}`}
            </div>
          )}
          {activeCleaners.length > 0 && (
            <div className="text-xs text-emerald-700 font-mono mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {activeCleaners.length === 1 ? `${activeCleaners[0]} is here` : `${activeCleaners.length} cleaners here: ${activeCleaners.join(', ')}`}
            </div>
          )}
          {isDone && t.completer?.name && (
            <div className="text-xs text-emerald-700 font-mono mt-1">
              Done by {t.completer.name}{t.completed_at && ` · ${fmtClock(t.completed_at)}`}
            </div>
          )}
          {t.status_notes && (
            <div className="text-xs text-red-700 italic mt-1">"{t.status_notes}"</div>
          )}
        </div>
        <span className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full border ${s.color} flex-shrink-0`}>
          {s.label}
        </span>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button onClick={onView}
          className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium flex items-center gap-1">
          <Eye size={12} /> View doc
        </button>
        {(t.status === 'pending' || t.status === 'blocked' || t.status === 'in_progress') && (
          <button onClick={onStart} disabled={busy}
            className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium flex items-center gap-1 disabled:opacity-50">
            <Play size={12} /> {t.status === 'in_progress' ? 'I\'m on it too' : 'Start'}
          </button>
        )}
        {(t.status === 'pending' || t.status === 'in_progress' || t.status === 'blocked') && (
          <button onClick={onDone} disabled={busy}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium flex items-center gap-1 disabled:opacity-50">
            <Check size={12} /> Done
          </button>
        )}
        {isDone && (
          <button onClick={onReopen} disabled={busy}
            className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 text-xs font-medium flex items-center gap-1 disabled:opacity-50">
            <Play size={12} /> Reopen
          </button>
        )}
        {(t.status === 'pending' || t.status === 'in_progress') && (
          <button onClick={onBlocked} disabled={busy}
            className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-medium flex items-center gap-1 disabled:opacity-50">
            <AlertCircle size={12} /> Blocked
          </button>
        )}
        {onReassign && (t.unit_id || t.party_id) && (
          <button onClick={onReassign} disabled={busy}
            className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-600 text-xs font-medium flex items-center gap-1 disabled:opacity-50 ml-auto">
            <Edit2 size={12} /> Reassign
          </button>
        )}
      </div>
      {canGo && (
        <button onClick={onGoToBedroom} disabled={busy}
          className="mt-2 w-full px-3 py-2.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-50 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50">
          Go to this bedroom <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}

// AssignmentsPanel — full tabbed view for the property hub.
// Tabs: Pending | In Progress | Done
function AssignmentsPanel({ propertyId, employee, refreshKey, onGoToBedroom }) {
  const [tab, setTab] = useState('pending');
  const [counts, setCounts] = useState({ pending: 0, in_progress: 0, done: 0, blocked: 0 });

  const loadCounts = async () => {
    const { data } = await supabase
      .from('assignment_targets')
      .select('status, assignment:assignments!inner(customer_id, active)');
    const filtered = (data || []).filter(t => t.assignment?.customer_id === propertyId && t.assignment?.active);
    const c = { pending: 0, in_progress: 0, done: 0, blocked: 0 };
    filtered.forEach(t => { c[t.status] = (c[t.status] || 0) + 1; });
    setCounts(c);
  };
  useEffect(() => { loadCounts(); }, [propertyId, refreshKey]);

  return (
    <div className="px-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText size={14} className="text-stone-500" />
        <span className="text-xs uppercase tracking-wider text-stone-500 font-mono">Assignments</span>
      </div>
      <div className="flex gap-1 mb-3 bg-stone-100 p-1 rounded-xl">
        <button onClick={() => setTab('pending')}
          className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors ${tab === 'pending' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'}`}>
          Pending{counts.pending > 0 && ` (${counts.pending})`}
        </button>
        <button onClick={() => setTab('in_progress')}
          className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors ${tab === 'in_progress' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'}`}>
          In progress{counts.in_progress > 0 && ` (${counts.in_progress})`}
        </button>
        <button onClick={() => setTab('done')}
          className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors ${tab === 'done' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'}`}>
          Done{counts.done > 0 && ` (${counts.done})`}
        </button>
      </div>
      <AssignmentTabContent propertyId={propertyId} employee={employee} statusFilter={tab}
        onUpdate={loadCounts} onGoToBedroom={onGoToBedroom} />
    </div>
  );
}

function AssignmentTabContent({ propertyId, employee, statusFilter, onUpdate, onGoToBedroom }) {
  const [targets, setTargets] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [opened, setOpened] = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [reassignTarget, setReassignTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [buildingFilter, setBuildingFilter] = useState('all'); // 'all' or a building prefix like 'B3'
  const [collapsedBuildings, setCollapsedBuildings] = useState({}); // { B3: true } = collapsed

  const [loadError, setLoadError] = useState(null);

  const load = async () => {
    setLoadError(null);
    const { data, error } = await supabase
      .from('assignment_targets')
      .select('*, assignment:assignments!inner(id, title, notes, file_url, file_kind, customer_id, active, source, pm_status), unit:units(id, label), party:parties(id, label), starter:employees!started_by(name), completer:employees!completed_by(name)')
      .eq('status', statusFilter);
    if (error) {
      console.error('[Assignments] load error:', error);
      setLoadError(error.message);
      setTargets([]); setLoaded(true);
      return;
    }
    // Hide non-approved PM assignments from cleaners
    const filtered = (data || []).filter(t =>
      t.assignment?.customer_id === propertyId &&
      t.assignment?.active &&
      (t.assignment?.source !== 'pm' || t.assignment?.pm_status === 'approved')
    );
    if (statusFilter === 'done') {
      filtered.sort((a, b) => new Date(b.completed_at || 0) - new Date(a.completed_at || 0));
    } else {
      filtered.sort((a, b) => naturalCompare(a.unit?.label || '', b.unit?.label || '') || naturalCompare(a.party?.label || '', b.party?.label || ''));
    }
    setTargets(filtered);
    setLoaded(true);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [propertyId, statusFilter]);

  const updateStatus = async (target, newStatus, statusNotes) => {
    setBusy(true);
    const patch = { status: newStatus };
    if (newStatus === 'in_progress') {
      if (!target.started_at) patch.started_at = new Date().toISOString();
      patch.started_by = employee?.id || null;
    }
    if (newStatus === 'done') {
      patch.completed_at = new Date().toISOString();
      patch.completed_by = employee?.id || null;
    } else if (target.status === 'done') {
      patch.completed_at = null; patch.completed_by = null;
    }
    if (statusNotes !== undefined) patch.status_notes = statusNotes || null;
    const { error } = await supabase.from('assignment_targets').update(patch).eq('id', target.id);
    setBusy(false);
    if (error) { alert('Could not update: ' + error.message); return; }
    setStatusModal(null);
    load();
    if (onUpdate) onUpdate();
  };

  if (!loaded) return <div className="text-center py-8 text-stone-400 text-xs">Loading…</div>;
  if (loadError) {
    return (
      <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm">
        <div className="flex items-start gap-2 mb-1">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span className="font-medium">Couldn't load assignments</span>
        </div>
        <div className="text-xs font-mono mt-2">{loadError}</div>
      </div>
    );
  }
  if (targets.length === 0) {
    const empties = {
      pending: 'No pending assignments.',
      in_progress: 'No assignments are in progress.',
      done: 'No completed assignments yet.'
    };
    return (
      <div className="text-center py-8 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
        {empties[statusFilter]}
      </div>
    );
  }

  // Group targets by building, derived from the unit label (e.g. "B3-205" -> "B3")
  // Targets without a unit go into a "No unit" bucket
  const buildings = {};
  targets.forEach(t => {
    const b = buildingFromLabel(t.unit?.label) || '—';
    if (!buildings[b]) buildings[b] = [];
    buildings[b].push(t);
  });
  const buildingKeys = Object.keys(buildings).sort(naturalCompare);
  const visibleBuildings = buildingFilter === 'all' ? buildingKeys : buildingKeys.filter(k => k === buildingFilter);
  const toggleCollapse = (b) => setCollapsedBuildings(prev => ({ ...prev, [b]: !prev[b] }));

  // For Done tab: bucket by age — Recent (<24hr), Older (24hr–1 week), Archived (>1 week)
  // These nest INSIDE building groups when there are multiple buildings.
  const now = Date.now();
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  const bucketByAge = (items) => {
    const buckets = { recent: [], older: [], archived: [] };
    items.forEach(t => {
      const ts = t.completed_at ? new Date(t.completed_at).getTime() : 0;
      const age = now - ts;
      if (age < DAY) buckets.recent.push(t);
      else if (age < 7 * DAY) buckets.older.push(t);
      else buckets.archived.push(t);
    });
    return buckets;
  };

  const renderAssignmentList = (items) => (
    <div className="space-y-2">
      {items.map(t => (
        <AssignmentCard key={t.id} target={t} busy={busy} propertyId={propertyId}
          onView={() => setOpened(t)}
          onStart={() => updateStatus(t, 'in_progress')}
          onDone={() => updateStatus(t, 'done')}
          onReopen={() => updateStatus(t, 'pending')}
          onBlocked={() => setStatusModal({ target: t })}
          onReassign={() => setReassignTarget(t)}
          onGoToBedroom={onGoToBedroom ? () => onGoToBedroom(t) : null} />
      ))}
    </div>
  );

  // For Done: collapsed by default for Older and Archived
  const renderDoneBuckets = (items) => {
    const buckets = bucketByAge(items);
    const sections = [
      { id: 'recent', label: 'Recent', subtitle: 'Last 24 hours', items: buckets.recent, defaultCollapsed: false },
      { id: 'older', label: 'Older', subtitle: '1–7 days ago', items: buckets.older, defaultCollapsed: true },
      { id: 'archived', label: 'Archived', subtitle: 'More than 1 week ago', items: buckets.archived, defaultCollapsed: true },
    ];
    return (
      <div className="space-y-3">
        {sections.map(s => {
          if (s.items.length === 0) return null;
          const key = `done-${s.id}`;
          // Use collapsedBuildings state to track these too (separate keys)
          const collapsed = collapsedBuildings[key] === undefined ? s.defaultCollapsed : collapsedBuildings[key];
          return (
            <div key={s.id}>
              <button onClick={() => setCollapsedBuildings(prev => ({ ...prev, [key]: !collapsed }))}
                className="w-full flex items-center justify-between mb-2 px-1 py-1 hover:bg-stone-50 rounded">
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-stone-500" />
                  <span className="text-xs uppercase tracking-wider font-mono text-stone-600">{s.label}</span>
                  <span className="text-[10px] font-mono text-stone-400">{s.subtitle}</span>
                  <span className="text-xs font-mono text-stone-400">({s.items.length})</span>
                </div>
                <ChevronRight size={14} className={`text-stone-400 transition-transform ${collapsed ? '' : 'rotate-90'}`} />
              </button>
              {!collapsed && renderAssignmentList(s.items)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      {/* Building filter pills — only show if there's more than 1 building */}
      {buildingKeys.length > 1 && (
        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 -mx-1 px-1">
          <button onClick={() => setBuildingFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-mono whitespace-nowrap ${buildingFilter === 'all' ? 'bg-stone-900 text-stone-50' : 'bg-stone-100 text-stone-600'}`}>
            All ({targets.length})
          </button>
          {buildingKeys.map(b => (
            <button key={b} onClick={() => setBuildingFilter(b)}
              className={`px-3 py-1 rounded-full text-xs font-mono whitespace-nowrap ${buildingFilter === b ? 'bg-stone-900 text-stone-50' : 'bg-stone-100 text-stone-600'}`}>
              {b} ({buildings[b].length})
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {visibleBuildings.map(b => {
          const items = buildings[b];
          const collapsed = !!collapsedBuildings[b];
          // Only show group header if there's more than 1 building total
          const showHeader = buildingKeys.length > 1;
          return (
            <div key={b}>
              {showHeader && (
                <button onClick={() => toggleCollapse(b)}
                  className="w-full flex items-center justify-between mb-2 px-1 py-1 hover:bg-stone-50 rounded">
                  <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-stone-500" />
                    <span className="text-xs uppercase tracking-wider font-mono text-stone-600">
                      {b === '—' ? 'No unit' : `Building ${b.replace(/^B/i, '')}`}
                    </span>
                    <span className="text-xs font-mono text-stone-400">({items.length})</span>
                  </div>
                  <ChevronRight size={14} className={`text-stone-400 transition-transform ${collapsed ? '' : 'rotate-90'}`} />
                </button>
              )}
              {!collapsed && (
                statusFilter === 'done'
                  ? renderDoneBuckets(items)
                  : renderAssignmentList(items)
              )}
            </div>
          );
        })}
      </div>

      {opened && <AssignmentViewer target={opened} onClose={() => setOpened(null)} />}
      {statusModal && (
        <BlockedNoteModal target={statusModal.target}
          onSave={(notes) => updateStatus(statusModal.target, 'blocked', notes)}
          onClose={() => setStatusModal(null)}
          busy={busy} />
      )}
      {reassignTarget && (
        <ReassignModal target={reassignTarget} propertyId={propertyId}
          onSaved={() => { setReassignTarget(null); load(); if (onUpdate) onUpdate(); }}
          onClose={() => setReassignTarget(null)} />
      )}
    </div>
  );
}

// ReassignModal — change unit/party for an assignment target
function ReassignModal({ target, propertyId, onSaved, onClose }) {
  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState(target.unit_id || '');
  const [partyId, setPartyId] = useState(target.party_id || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { (async () => {
    const { data } = await supabase.from('units')
      .select('*, parties(id, label, full_name, active, sort_order)')
      .eq('customer_id', propertyId).eq('active', true)
      .order('sort_order').order('label');
    setUnits((data || []).slice().sort((a, b) => naturalCompare(a.label, b.label)));
  })(); }, [propertyId]);

  const parties = (units.find(u => u.id === unitId)?.parties || [])
    .filter(p => p.active).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const save = async () => {
    if (!unitId || !partyId) { setError('Pick a unit and a party.'); return; }
    setBusy(true);
    const { error: e } = await supabase.from('assignment_targets')
      .update({ unit_id: unitId, party_id: partyId })
      .eq('id', target.id);
    setBusy(false);
    if (e) { setError(e.message); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-stone-900/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-stone-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <div>
            <div className="font-serif text-xl text-stone-900">Reassign</div>
            <div className="text-xs text-stone-500 font-mono mt-0.5 truncate">{target.assignment?.title}</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-stone-100">
            <X size={20} className="text-stone-600" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-stone-600">
            Currently assigned to <strong>{target.unit?.label || '?'}{target.party?.label && ` · ${target.party.label}`}</strong>. Pick where this should go instead:
          </p>
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Unit</label>
            <select value={unitId} onChange={(e) => { setUnitId(e.target.value); setPartyId(''); }}
              className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white">
              <option value="">— Pick a unit —</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </div>
          {unitId && (
            <div>
              <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Bedroom</label>
              <select value={partyId} onChange={(e) => setPartyId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white">
                <option value="">— Pick a bedroom —</option>
                {parties.map(p => <option key={p.id} value={p.id}>{p.label}{p.full_name ? ` (${p.full_name})` : ''}</option>)}
              </select>
            </div>
          )}
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}
        </div>
        <div className="p-5 border-t border-stone-200 flex gap-2">
          <button onClick={onClose} disabled={busy}
            className="flex-1 py-3 rounded-2xl bg-stone-100 text-stone-700 font-medium">Cancel</button>
          <button onClick={save} disabled={busy}
            className="flex-1 py-3 rounded-2xl bg-stone-900 text-stone-50 font-medium disabled:opacity-50">
            {busy ? 'Saving…' : 'Reassign'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignmentViewer({ target, onClose }) {
  const a = target.assignment;
  return (
    <div className="fixed inset-0 bg-stone-900/95 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 text-stone-50 bg-stone-900">
        <div className="flex-1 min-w-0">
          <div className="font-serif text-lg truncate">{a.title}</div>
          {a.notes && <div className="text-xs text-stone-400 mt-0.5 line-clamp-1">{a.notes}</div>}
        </div>
        <button onClick={onClose} className="p-2 ml-2 rounded-full bg-stone-800">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-auto bg-stone-100">
        {a.file_kind === 'image' ? (
          <img loading="lazy" src={a.file_url} alt="" className="w-full" />
        ) : (
          <iframe src={a.file_url} className="w-full h-full" title={a.title} />
        )}
      </div>
      <div className="p-4 bg-stone-900">
        <a href={a.file_url} target="_blank" rel="noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-stone-50 text-stone-900 text-sm font-medium">
          <Download size={14} /> Open / download
        </a>
      </div>
    </div>
  );
}

function BlockedNoteModal({ target, onSave, onClose, busy }) {
  const [note, setNote] = useState(target.status_notes || '');
  return (
    <div className="fixed inset-0 bg-stone-900/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-stone-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <div className="font-serif text-xl text-stone-900">What's blocking?</div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-stone-100">
            <X size={20} className="text-stone-600" />
          </button>
        </div>
        <div className="p-5">
          <textarea value={note} onChange={(e) => setNote(e.target.value)}
            rows={4} placeholder="e.g. Tenant home, couldn't get in. Need new key."
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:border-stone-900 text-stone-900 resize-none" />
          <p className="text-xs text-stone-500 mt-2">
            This note will be visible to managers so they can resolve the issue.
          </p>
        </div>
        <div className="p-5 border-t border-stone-200 flex gap-2">
          <button onClick={onClose} disabled={busy}
            className="flex-1 py-3 rounded-2xl bg-stone-100 text-stone-700 font-medium">
            Cancel
          </button>
          <button onClick={() => onSave(note)} disabled={busy}
            className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-medium disabled:opacity-50">
            {busy ? 'Saving…' : 'Mark blocked'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =================================================================
// LIVE CLEANERS SHEET — bottom sheet shown when manager taps
// "On the clock" stat card. Lists all active shifts with what each
// cleaner is doing right now.
// =================================================================
function LiveCleanersSheet({ onClose, onOpenShift }) {
  const [shifts, setShifts] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from('shifts')
        .select('*, employee:employees(id, name), customer:customers(id, name), work_blocks(id, start_time, end_time, unit:units(label), party:parties(label))')
        .is('end_time', null)
        .order('start_time', { ascending: true });
      if (cancelled) return;
      setShifts(data || []);
      setLoaded(true);
    };
    load();
    // Refresh every 15 seconds to keep the durations live
    const id = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  useTick(true);

  return (
    <div className="fixed inset-0 bg-stone-900/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-stone-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">Live</div>
            <div className="font-serif text-xl text-stone-900">On the clock right now</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-stone-100">
            <X size={20} className="text-stone-600" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {!loaded ? (
            <div className="text-center py-12 text-stone-400 text-sm">Loading…</div>
          ) : shifts.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
              Nobody on the clock right now.
            </div>
          ) : (
            <div className="space-y-2">
              {shifts.map(s => {
                const shiftDur = Date.now() - new Date(s.start_time).getTime();
                // Find current active work block (no end_time)
                const activeBlock = (s.work_blocks || []).find(b => !b.end_time);
                const blockDur = activeBlock ? Date.now() - new Date(activeBlock.start_time).getTime() : 0;
                const completedBlocks = (s.work_blocks || []).filter(b => b.end_time).length;
                return (
                  <button key={s.id} onClick={() => onOpenShift(s)}
                    className="w-full text-left p-4 rounded-2xl bg-white border border-stone-200 hover:border-stone-400 transition-colors">
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                        <span className="font-serif text-lg text-stone-900 truncate">{s.employee?.name}</span>
                      </div>
                      <span className="text-xs font-mono text-stone-500 flex-shrink-0">
                        {fmtTimeShort(shiftDur)}
                      </span>
                    </div>
                    {s.customer && (
                      <div className="text-xs text-amber-700 font-mono mb-1 flex items-center gap-1.5">
                        <Building2 size={11} /> {s.customer.name}
                      </div>
                    )}
                    {activeBlock ? (
                      <div className="text-xs text-stone-700 font-mono flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] uppercase tracking-wider">
                          Cleaning
                        </span>
                        <span>{activeBlock.unit?.label}{activeBlock.party?.label && ` · ${activeBlock.party.label}`}</span>
                        <span className="text-stone-500">· {fmtTimeShort(blockDur)}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-stone-500 font-mono">
                        At property
                        {completedBlocks > 0 && ` · ${completedBlocks} ${completedBlocks === 1 ? 'apt cleaned' : 'apts cleaned'}`}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="p-3 text-center text-[10px] font-mono text-stone-400 border-t border-stone-200">
          Auto-refreshes every 15 seconds · tap a cleaner to see their shift
        </div>
      </div>
    </div>
  );
}

// =================================================================
// ALL OPEN ASSIGNMENTS — cross-property overview for owners/managers
// Lists every assignment with at least one non-done target,
// grouped by property, with status counts and a "what's still open" summary.
// =================================================================
function AllOpenAssignments({ employee, onBack, onOpenAssignment }) {
  const [data, setData] = useState([]);   // grouped: [{ property, assignments: [...] }]
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all'); // all | pending | in_progress | blocked

  const load = async () => {
    setLoadError(null);
    const { data: aData, error: aErr } = await supabase
      .from('assignments')
      .select('*, property:customers(id, name, property_type), targets:assignment_targets(id, status, unit:units(label), party:parties(label), starter:employees!started_by(name), completer:employees!completed_by(name))')
      .eq('active', true)
      .order('created_at', { ascending: false });
    if (aErr) {
      console.error('[AllOpenAssignments] load error:', aErr);
      setLoadError(aErr.message);
      setData([]); setLoaded(true);
      return;
    }

    // Keep only assignments with at least one non-done target
    const openOnly = (aData || []).filter(a => (a.targets || []).some(t => t.status !== 'done'));

    // Group by property
    const byProp = {};
    openOnly.forEach(a => {
      const pId = a.property?.id;
      if (!pId) return;
      if (!byProp[pId]) byProp[pId] = { property: a.property, assignments: [] };
      // Decorate with counts
      const counts = { pending: 0, in_progress: 0, done: 0, blocked: 0 };
      (a.targets || []).forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });
      byProp[pId].assignments.push({ ...a, counts });
    });

    const grouped = Object.values(byProp).sort((x, y) =>
      naturalCompare(x.property.name, y.property.name));
    setData(grouped);
    setLoaded(true);
  };
  useEffect(() => { load(); }, []);

  // Filter at the per-target level for the status filter (visual only)
  const filterMatch = (a) => {
    if (statusFilter === 'all') return true;
    return (a.targets || []).some(t => t.status === statusFilter);
  };

  const totalOpen = data.reduce((s, g) => s + g.assignments.filter(filterMatch).length, 0);

  return (
    <div className="pb-24">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-stone-100">
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div>
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">All properties</div>
          <div className="font-serif text-xl text-stone-900">Open assignments</div>
        </div>
      </div>

      <div className="px-5 pt-6">
        <div className="text-stone-500 text-sm mb-4">
          {totalOpen === 0 ? 'Nothing open right now' : `${totalOpen} ${totalOpen === 1 ? 'assignment' : 'assignments'} with open work`}
        </div>

        {/* Status filter pills */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
          {[
            { id: 'all', label: 'All open' },
            { id: 'pending', label: 'Pending' },
            { id: 'in_progress', label: 'In progress' },
            { id: 'blocked', label: 'Blocked' },
          ].map(f => (
            <button key={f.id} onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${statusFilter === f.id ? 'bg-stone-900 text-stone-50' : 'bg-stone-100 text-stone-600'}`}>
              {f.label}
            </button>
          ))}
        </div>

        {loadError && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm mb-4">
            <div className="flex items-start gap-2 mb-1">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span className="font-medium">Couldn't load</span>
            </div>
            <div className="text-xs font-mono mt-2">{loadError}</div>
          </div>
        )}

        {!loaded ? <Splash text="Loading…" /> : totalOpen === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
            {statusFilter === 'all'
              ? 'No open assignments across any property. Everything is done!'
              : `No assignments are currently ${statusFilter.replace('_', ' ')}.`}
          </div>
        ) : (
          <div className="space-y-6">
            {data.map(group => {
              const filtered = group.assignments.filter(filterMatch);
              if (filtered.length === 0) return null;

              // Sub-group filtered assignments by building (derived from first target's unit label)
              const isMulti = group.property.property_type === 'multi_unit';
              const buildings = {};
              filtered.forEach(a => {
                const firstUnit = (a.targets || []).find(t => t.unit?.label)?.unit?.label;
                const b = isMulti ? (buildingFromLabel(firstUnit) || '—') : '—';
                if (!buildings[b]) buildings[b] = [];
                buildings[b].push(a);
              });
              const buildingKeys = Object.keys(buildings).sort(naturalCompare);
              const showSubGroups = isMulti && buildingKeys.length > 1;

              return (
                <div key={group.property.id}>
                  <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-stone-200">
                    <h3 className="font-serif text-lg text-stone-900 flex items-center gap-2">
                      <Building2 size={14} /> {group.property.name}
                    </h3>
                    <span className="text-xs font-mono text-stone-500">
                      {filtered.length} {filtered.length === 1 ? 'open' : 'open'}
                    </span>
                  </div>

                  {buildingKeys.map(b => {
                    const items = buildings[b];
                    return (
                      <div key={b} className="mb-4">
                        {showSubGroups && (
                          <div className="text-xs uppercase tracking-wider font-mono text-stone-500 mb-2 px-1 flex items-center gap-1.5">
                            <Building2 size={11} />
                            {b === '—' ? 'No unit' : `Building ${b.replace(/^B/i, '')}`}
                            <span className="text-stone-400">({items.length})</span>
                          </div>
                        )}
                        <div className="space-y-2">
                          {items.map(a => {
                            const openTargets = (a.targets || []).filter(t => t.status !== 'done');
                            const inProgressBy = openTargets
                              .filter(t => t.status === 'in_progress' && t.starter?.name)
                              .map(t => t.starter.name);
                            const uniqStarters = [...new Set(inProgressBy)];
                            const hasBlocked = a.counts.blocked > 0;
                            return (
                              <button key={a.id} onClick={() => onOpenAssignment(group.property, a)}
                                className={`w-full text-left p-4 rounded-2xl border transition-colors ${hasBlocked ? 'bg-red-50/50 border-red-200 hover:border-red-400' : 'bg-white border-stone-200 hover:border-stone-400'}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      {a.file_kind === 'pdf'
                                        ? <FileText size={13} className="text-stone-500 flex-shrink-0" />
                                        : <ImageIcon size={13} className="text-stone-500 flex-shrink-0" />}
                                      <span className="font-serif text-base text-stone-900 truncate">{a.title}</span>
                                      {hasBlocked && (
                                        <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                          ⚠ Blocked
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-stone-500 font-mono">
                                      {a.counts.done}/{a.targets?.length || 0} done
                                      {a.counts.in_progress > 0 && ` · ${a.counts.in_progress} in progress`}
                                      {a.counts.pending > 0 && ` · ${a.counts.pending} pending`}
                                      {a.counts.blocked > 0 && ` · ${a.counts.blocked} blocked`}
                                    </div>
                                    {uniqStarters.length > 0 && (
                                      <div className="text-xs text-amber-700 mt-1">
                                        {uniqStarters.length === 1
                                          ? `${uniqStarters[0]} is working on this`
                                          : `${uniqStarters.length} cleaners: ${uniqStarters.join(', ')}`}
                                      </div>
                                    )}
                                  </div>
                                  <ChevronRight size={16} className="text-stone-400 flex-shrink-0" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// =================================================================
// PORTAL — PM PHOTO UPLOAD TAB
// Property manager uploads a photo (or set of photos) for owner review.
// =================================================================
function PortalPhotoUploadTab({ property }) {
  const isMulti = property.property_type === 'multi_unit';
  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState('');
  const [parties, setParties] = useState([]);
  const [partyId, setPartyId] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [zoomPhoto, setZoomPhoto] = useState(null);

  useEffect(() => {
    if (!isMulti) return;
    (async () => {
      const { data } = await supabase.from('units')
        .select('*, parties(id, label, full_name, active, sort_order)')
        .eq('customer_id', property.id).eq('active', true)
        .order('sort_order').order('label');
      setUnits((data || []).slice().sort((a, b) => naturalCompare(a.label, b.label)));
    })();
  }, [property.id, isMulti]);

  useEffect(() => {
    if (!unitId) { setParties([]); return; }
    const u = units.find(x => x.id === unitId);
    setParties((u?.parties || []).filter(p => p.active).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
  }, [unitId, units]);

  // Load history of PM photos for this property
  const loadHistory = async () => {
    const { data } = await supabase.from('pm_photos')
      .select('*, unit:units(label), party:parties(label)')
      .eq('customer_id', property.id)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .limit(20);
    setHistory(data || []);
  };
  useEffect(() => { loadHistory(); }, [property.id]);

  const reset = () => {
    setTitle(''); setNotes(''); setFile(null);
    setUnitId(''); setPartyId('');
    setError(''); setProgress('');
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (f && !f.type.startsWith('image/')) {
      setError('Please choose an image file (JPG, PNG, etc).');
      return;
    }
    setFile(f || null);
    setError('');
  };

  const save = async () => {
    setError('');
    if (!file) { setError('Choose a photo first.'); return; }
    setBusy(true);
    try {
      setProgress('Uploading photo…');
      const { path, publicUrl } = await uploadPmFile(file, property.id);
      setProgress('Saving…');
      const { error: e } = await supabase.from('pm_photos').insert({
        customer_id: property.id,
        unit_id: unitId || null,
        party_id: partyId || null,
        title: title.trim() || null,
        notes: notes.trim() || null,
        photo_url: publicUrl,
        photo_path: path,
        status: 'new'
      });
      if (e) throw e;
      setSuccess(true);
      reset();
      loadHistory();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false); setProgress('');
    }
  };

  return (
    <div className="px-5 pt-6 space-y-5">
      <div>
        <h2 className="font-serif text-2xl text-stone-900 mb-1">Send a photo</h2>
        <p className="text-sm text-stone-600">
          Upload photos you want the cleaning team to see — damage, items left behind, anything worth flagging.
        </p>
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Title (optional)</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Damage in master bath" maxLength={120}
          className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white text-stone-900" />
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Notes (optional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          placeholder="Add any context the cleaners should know…"
          className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white text-stone-900 resize-none" />
      </div>

      {isMulti && (
        <>
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Unit (optional)</label>
            <SearchableUnitPicker
              units={units}
              value={unitId}
              placeholder="— Whole property —"
              onChange={(newUnitId) => {
                setUnitId(newUnitId); setPartyId('');
                const u = units.find(x => x.id === newUnitId);
                if (u) {
                  const stripped = title.replace(/^[^—]+ — /, '');
                  setTitle(`${u.label} — ${stripped}`);
                }
              }} />
            {unitId && (
              <button type="button" onClick={() => { setUnitId(''); setPartyId(''); }}
                className="text-xs font-mono text-stone-500 mt-1 hover:text-stone-900">
                ← Clear (apply to whole property)
              </button>
            )}
          </div>
          {unitId && parties.length > 0 && (
            <div>
              <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Bedroom (optional)</label>
              <select value={partyId} onChange={(e) => {
                  const newPartyId = e.target.value;
                  setPartyId(newPartyId);
                  const u = units.find(x => x.id === unitId);
                  const p = (u?.parties || []).find(x => x.id === newPartyId);
                  if (u) {
                    const stripped = title.replace(/^[^—]+ — /, '');
                    setTitle(`${u.label}${p ? ` · ${p.label}` : ''} — ${stripped}`);
                  }
                }}
                className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white">
                <option value="">— Any —</option>
                {parties.map(p => <option key={p.id} value={p.id}>{p.label}{p.full_name ? ` (${p.full_name})` : ''}</option>)}
              </select>
            </div>
          )}
        </>
      )}

      <div>
        <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Photo</label>
        <label className={`block w-full p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-colors ${file ? 'border-emerald-300 bg-emerald-50' : 'border-stone-300 hover:border-stone-900'}`}>
          {file ? (
            <>
              <Check size={28} className="mx-auto mb-2 text-emerald-600" />
              <div className="text-stone-900 font-medium text-sm">{file.name}</div>
              <div className="text-xs text-stone-500 mt-0.5">{(file.size / 1024).toFixed(1)} KB · tap to change</div>
            </>
          ) : (
            <>
              <Camera size={28} className="mx-auto mb-2 text-stone-400" />
              <div className="text-stone-700 font-medium text-sm">Choose a photo</div>
              <div className="text-xs text-stone-500 mt-0.5">Max {ASSIGNMENT_MAX_SIZE_MB}MB</div>
            </>
          )}
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </label>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}
      {busy && progress && (
        <div className="p-3 rounded-xl bg-stone-100 text-stone-700 text-sm font-mono flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-stone-700 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          {progress}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <Check size={16} /> Photo sent. The cleaning team will see it.
        </div>
      )}

      <button onClick={save} disabled={busy || !file}
        className="w-full py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium disabled:opacity-50">
        {busy ? 'Sending…' : 'Send photo'}
      </button>

      {/* Recent uploads */}
      {history.length > 0 && (
        <div className="pt-6 border-t border-stone-200">
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">
            Recently sent ({history.length})
          </div>
          <div className="space-y-3">
            {history.map(p => (
              <div key={p.id} className="p-3 rounded-2xl bg-white border border-stone-200">
                <div className="flex gap-3">
                  <button onClick={() => setZoomPhoto(p)}
                    className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-stone-100">
                    <img loading="lazy" src={p.photo_url} alt={p.title || ''} className="w-full h-full object-cover" />
                  </button>
                  <div className="flex-1 min-w-0">
                    {p.title && (
                      <div className="font-serif text-sm text-stone-900 truncate mb-0.5">{p.title}</div>
                    )}
                    {(p.unit?.label || p.party?.label) && (
                      <div className="text-[10px] font-mono text-stone-500 mb-1">
                        {p.unit?.label}{p.party?.label && ` · ${p.party.label}`}
                      </div>
                    )}
                    {p.notes && (
                      <div className="text-xs text-stone-600 line-clamp-2 mb-1">{p.notes}</div>
                    )}
                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      <span className="text-stone-400">{fmtDate(p.created_at)}</span>
                      <span className={`px-1.5 py-0.5 rounded-full ${p.status === 'seen' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {p.status === 'seen' ? 'Seen by owner' : 'Awaiting review'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Photo zoom modal */}
      {zoomPhoto && (
        <div className="fixed inset-0 bg-stone-900/95 z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 text-stone-50 bg-stone-900 flex-shrink-0">
            <div className="text-sm font-mono truncate flex-1">{zoomPhoto.title || 'Photo'}</div>
            <button onClick={() => setZoomPhoto(null)} className="p-2 rounded-full bg-stone-800 ml-2 flex-shrink-0">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <img loading="lazy" src={zoomPhoto.photo_url} alt="" className="w-full h-auto rounded-xl" />
            {zoomPhoto.notes && (
              <div className="mt-3 p-3 rounded-xl bg-stone-800 text-stone-200 text-sm whitespace-pre-wrap">
                {zoomPhoto.notes}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =================================================================
// PORTAL — PM ASSIGNMENTS TAB
// Property manager creates/edits/submits assignment drafts; once
// approved they become read-only.
// =================================================================
function PortalAssignmentsTab({ property }) {
  const [assignments, setAssignments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState({ kind: 'list' });

  const load = async () => {
    const { data } = await supabase.from('assignments')
      .select('*, targets:assignment_targets(id, status, unit:units(label), party:parties(label))')
      .eq('customer_id', property.id)
      .eq('source', 'pm')
      .order('created_at', { ascending: false });
    setAssignments(data || []);
    setLoaded(true);
  };
  useEffect(() => { load(); }, [property.id]);

  if (view.kind === 'new') {
    return <PortalAssignmentForm property={property}
      onCancel={() => setView({ kind: 'list' })}
      onSaved={() => { setView({ kind: 'list' }); load(); }} />;
  }
  if (view.kind === 'edit') {
    return <PortalAssignmentForm property={property} assignment={view.assignment}
      onCancel={() => setView({ kind: 'list' })}
      onSaved={() => { setView({ kind: 'list' }); load(); }} />;
  }
  if (view.kind === 'detail') {
    return <PortalAssignmentDetail property={property} assignment={view.assignment}
      onBack={() => { setView({ kind: 'list' }); load(); }}
      onEdit={() => setView({ kind: 'edit', assignment: view.assignment })} />;
  }

  const groups = {
    draft: assignments.filter(a => a.pm_status === 'draft'),
    pending: assignments.filter(a => a.pm_status === 'pending'),
    approved: assignments.filter(a => a.pm_status === 'approved'),
    rejected: assignments.filter(a => a.pm_status === 'rejected'),
  };

  return (
    <div className="px-5 pt-6 space-y-5">
      <div>
        <h2 className="font-serif text-2xl text-stone-900 mb-1">Your assignments</h2>
        <p className="text-sm text-stone-600">
          Create assignments for the cleaning team. They take effect once approved.
        </p>
      </div>

      <button onClick={() => setView({ kind: 'new' })}
        className="w-full py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium flex items-center justify-center gap-2">
        <Plus size={18} /> New assignment
      </button>

      {!loaded ? <Splash text="Loading…" /> : assignments.length === 0 ? (
        <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
          You haven't created any assignments yet.
        </div>
      ) : (
        <>
          <PortalAssignmentSection title="Drafts" subtitle="You can still edit these" items={groups.draft}
            color="stone" onOpen={(a) => setView({ kind: 'detail', assignment: a })} />
          <PortalAssignmentSection title="Pending review" subtitle="Waiting for the owner to approve" items={groups.pending}
            color="amber" onOpen={(a) => setView({ kind: 'detail', assignment: a })} />
          <PortalAssignmentSection title="Needs changes" subtitle="Owner asked for changes — edit and resubmit" items={groups.rejected}
            color="red" onOpen={(a) => setView({ kind: 'detail', assignment: a })} />
          <PortalAssignmentSection title="Approved" subtitle="Active — visible to the cleaning team" items={groups.approved}
            color="emerald" onOpen={(a) => setView({ kind: 'detail', assignment: a })} />
        </>
      )}
    </div>
  );
}

function PortalAssignmentSection({ title, subtitle, items, color, onOpen }) {
  if (items.length === 0) return null;
  const colors = {
    stone: 'border-stone-300 bg-stone-50',
    amber: 'border-amber-300 bg-amber-50',
    red: 'border-red-300 bg-red-50',
    emerald: 'border-emerald-300 bg-emerald-50',
  };
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2">
        {title} ({items.length})
      </div>
      <p className="text-xs text-stone-500 mb-3">{subtitle}</p>
      <div className="space-y-2">
        {items.map(a => (
          <button key={a.id} onClick={() => onOpen(a)}
            className={`w-full text-left p-4 rounded-2xl border-2 hover:border-stone-900 transition-colors ${colors[color]}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {a.file_kind === 'pdf'
                    ? <FileText size={14} className="text-stone-600 flex-shrink-0" />
                    : <ImageIcon size={14} className="text-stone-600 flex-shrink-0" />}
                  <span className="font-serif text-base text-stone-900 truncate">{a.title}</span>
                </div>
                <div className="text-xs text-stone-500 font-mono">
                  {fmtDate(a.created_at)} · {a.targets?.length || 0} {a.targets?.length === 1 ? 'target' : 'targets'}
                </div>
                {a.pm_rejection_reason && (
                  <div className="text-xs text-red-700 italic mt-1">"{a.pm_rejection_reason}"</div>
                )}
              </div>
              <ChevronRight size={16} className="text-stone-400 flex-shrink-0" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// PM-side form for creating or editing an assignment
function PortalAssignmentForm({ property, assignment, onCancel, onSaved }) {
  const isMulti = property.property_type === 'multi_unit';
  const isEdit = !!assignment;
  const [title, setTitle] = useState(assignment?.title || '');
  const [notes, setNotes] = useState(assignment?.notes || '');
  const [file, setFile] = useState(null); // a NEW file (replaces existing)
  const [keepExistingFile, setKeepExistingFile] = useState(isEdit);
  const [scope, setScope] = useState(isMulti ? 'specific' : 'property');
  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState('');
  const [partyId, setPartyId] = useState('');
  const [parties, setParties] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  // Load units for multi-unit properties
  useEffect(() => {
    if (!isMulti) return;
    (async () => {
      const { data } = await supabase.from('units')
        .select('*, parties(id, label, full_name, active, sort_order)')
        .eq('customer_id', property.id).eq('active', true)
        .order('sort_order').order('label');
      setUnits((data || []).slice().sort((a, b) => naturalCompare(a.label, b.label)));
    })();
  }, [property.id, isMulti]);

  // If editing, load the existing target so dropdowns are pre-populated
  useEffect(() => {
    if (!isEdit || !assignment) return;
    (async () => {
      const { data } = await supabase.from('assignment_targets')
        .select('unit_id, party_id').eq('assignment_id', assignment.id).limit(1).maybeSingle();
      if (data) {
        if (data.unit_id) { setUnitId(data.unit_id); setScope('specific'); }
        if (data.party_id) setPartyId(data.party_id);
        if (!data.unit_id && !data.party_id) setScope('property');
      }
    })();
  }, [isEdit, assignment]);

  useEffect(() => {
    if (!unitId) { setParties([]); return; }
    const u = units.find(x => x.id === unitId);
    setParties((u?.parties || []).filter(p => p.active).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
  }, [unitId, units]);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const isOk = f.type === 'application/pdf' || f.type.startsWith('image/');
    if (!isOk) { setError('Only PDFs and images.'); return; }
    setFile(f); setKeepExistingFile(false); setError('');
  };

  const save = async (submitForApproval) => {
    setError('');
    if (!title.trim()) { setError('Add a title.'); return; }
    if (!keepExistingFile && !file) { setError('Pick a PDF or image.'); return; }
    if (isMulti && scope === 'specific' && (!unitId || !partyId)) {
      setError('Pick a unit and party.'); return;
    }
    setBusy(true);
    try {
      let filePayload = null;
      if (file) {
        setProgress('Uploading file…');
        const { path, publicUrl, kind } = await uploadPmFile(file, property.id);
        filePayload = { file_path: path, file_url: publicUrl, file_kind: kind };
      }

      const newStatus = submitForApproval ? 'pending' : 'draft';

      if (isEdit) {
        setProgress('Saving changes…');
        const patch = {
          title: title.trim(),
          notes: notes.trim() || null,
          pm_status: newStatus,
          pm_rejection_reason: null  // clear any prior rejection note on resubmit
        };
        if (filePayload) {
          // delete the old file before replacing
          if (assignment.file_path) await deletePmFile(assignment.file_path);
          Object.assign(patch, filePayload);
        }
        const { error: e1 } = await supabase.from('assignments').update(patch).eq('id', assignment.id);
        if (e1) throw e1;

        // Replace targets with the new selection
        await supabase.from('assignment_targets').delete().eq('assignment_id', assignment.id);
        const targetRow = {
          assignment_id: assignment.id,
          unit_id: !isMulti || scope === 'property' ? null : unitId,
          party_id: !isMulti || scope === 'property' ? null : partyId,
          status: 'pending'
        };
        const { error: e2 } = await supabase.from('assignment_targets').insert(targetRow);
        if (e2) throw e2;
      } else {
        setProgress('Creating assignment…');
        const { data: created, error: e1 } = await supabase.from('assignments').insert({
          customer_id: property.id,
          title: title.trim(),
          notes: notes.trim() || null,
          source: 'pm',
          pm_status: newStatus,
          active: true,
          ...filePayload
        }).select().single();
        if (e1) throw e1;
        const targetRow = {
          assignment_id: created.id,
          unit_id: !isMulti || scope === 'property' ? null : unitId,
          party_id: !isMulti || scope === 'property' ? null : partyId,
          status: 'pending'
        };
        const { error: e2 } = await supabase.from('assignment_targets').insert(targetRow);
        if (e2) throw e2;
      }
      onSaved();
    } catch (err) {
      setError(err.message || String(err));
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 pb-12">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button onClick={onCancel} className="p-2 -ml-2 rounded-full hover:bg-stone-100">
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div>
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">{property.name}</div>
          <div className="font-serif text-xl text-stone-900">
            {isEdit ? 'Edit assignment' : 'New assignment'}
          </div>
        </div>
      </div>

      <div className="px-5 pt-6 space-y-5">
        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Deep clean Apt 301-2 — Tuesday"
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white" />
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Notes / instructions</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4}
            placeholder="What needs to be done…"
            className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white resize-none" />
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">File (PDF or image)</label>
          {keepExistingFile && assignment?.file_url && (
            <div className="mb-2 p-3 rounded-xl bg-stone-100 flex items-center gap-2 text-sm">
              {assignment.file_kind === 'pdf' ? <FileText size={16} /> : <ImageIcon size={16} />}
              <span className="flex-1 truncate text-stone-700">Existing file</span>
              <a href={assignment.file_url} target="_blank" rel="noreferrer"
                className="text-xs text-amber-700 font-mono">View</a>
              <button type="button" onClick={() => setKeepExistingFile(false)}
                className="text-xs text-stone-500 font-mono">Replace</button>
            </div>
          )}
          {!keepExistingFile && (
            <label className={`block w-full p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer ${file ? 'border-emerald-300 bg-emerald-50' : 'border-stone-300'}`}>
              {file ? (
                <>
                  <Check size={24} className="mx-auto mb-1 text-emerald-600" />
                  <div className="text-sm text-stone-900">{file.name}</div>
                  <div className="text-xs text-stone-500">{(file.size / 1024).toFixed(1)} KB</div>
                </>
              ) : (
                <>
                  <FileText size={24} className="mx-auto mb-1 text-stone-400" />
                  <div className="text-sm text-stone-700">Choose PDF or image</div>
                </>
              )}
              <input type="file" accept="application/pdf,image/*" onChange={handleFile} className="hidden" />
            </label>
          )}
        </div>

        {isMulti && (
          <>
            <div>
              <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Where?</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setScope('specific')}
                  className={`p-3 rounded-xl border-2 text-left ${scope === 'specific' ? 'border-stone-900 bg-white' : 'border-stone-200 bg-white/50'}`}>
                  <div className="font-medium text-sm">One party</div>
                </button>
                <button type="button" onClick={() => setScope('property')}
                  className={`p-3 rounded-xl border-2 text-left ${scope === 'property' ? 'border-stone-900 bg-white' : 'border-stone-200 bg-white/50'}`}>
                  <div className="font-medium text-sm">Whole property</div>
                </button>
              </div>
            </div>
            {scope === 'specific' && (
              <>
                <div>
                  <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Unit</label>
                  <SearchableUnitPicker
                    units={units}
                    value={unitId}
                    placeholder="— Pick a unit —"
                    onChange={(newUnitId) => {
                      setUnitId(newUnitId); setPartyId('');
                      const u = units.find(x => x.id === newUnitId);
                      if (u) {
                        const stripped = title.replace(/^[^—]+ — /, '');
                        setTitle(`${u.label} — ${stripped}`);
                      }
                    }} />
                </div>
                {unitId && (
                  <div>
                    <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Bedroom</label>
                    <select value={partyId} onChange={(e) => {
                        const newPartyId = e.target.value;
                        setPartyId(newPartyId);
                        const u = units.find(x => x.id === unitId);
                        const p = (u?.parties || []).find(x => x.id === newPartyId);
                        if (u) {
                          const stripped = title.replace(/^[^—]+ — /, '');
                          setTitle(`${u.label}${p ? ` · ${p.label}` : ''} — ${stripped}`);
                        }
                      }}
                      className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white">
                      <option value="">— Pick a bedroom —</option>
                      {parties.map(p => <option key={p.id} value={p.id}>{p.label}{p.full_name ? ` (${p.full_name})` : ''}</option>)}
                    </select>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}
        {busy && progress && (
          <div className="p-3 rounded-xl bg-stone-100 text-stone-700 text-sm font-mono flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-stone-700 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            {progress}
          </div>
        )}

        <div className="space-y-2 pt-2">
          <button onClick={() => save(true)} disabled={busy}
            className="w-full py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium disabled:opacity-50">
            {busy ? 'Working…' : 'Submit for approval'}
          </button>
          <button onClick={() => save(false)} disabled={busy}
            className="w-full py-3 rounded-2xl bg-stone-100 text-stone-700 text-sm font-medium disabled:opacity-50">
            Save as draft
          </button>
        </div>
        <p className="text-xs text-stone-500 text-center">
          Drafts can be edited freely. Once you submit for approval, you can't edit until the owner reviews.
        </p>
      </div>
    </div>
  );
}

// PM-side detail/view of one of their assignments
function PortalAssignmentDetail({ property, assignment, onBack, onEdit }) {
  const [busy, setBusy] = useState(false);
  const canEdit = assignment.pm_status === 'draft' || assignment.pm_status === 'rejected';
  const canDelete = canEdit;

  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.from('assignments')
      .update({ pm_status: 'pending', pm_rejection_reason: null })
      .eq('id', assignment.id);
    setBusy(false);
    if (error) { alert('Could not submit: ' + error.message); return; }
    onBack();
  };

  const remove = async () => {
    if (!confirm('Delete this assignment? This cannot be undone.')) return;
    setBusy(true);
    if (assignment.file_path) await deletePmFile(assignment.file_path);
    await supabase.from('assignments').delete().eq('id', assignment.id);
    setBusy(false);
    onBack();
  };

  const statusLabels = {
    draft: { text: 'Draft', color: 'bg-stone-200 text-stone-700' },
    pending: { text: 'Pending approval', color: 'bg-amber-100 text-amber-800' },
    approved: { text: 'Approved — visible to team', color: 'bg-emerald-100 text-emerald-800' },
    rejected: { text: 'Needs changes', color: 'bg-red-100 text-red-700' },
  };
  const s = statusLabels[assignment.pm_status] || statusLabels.draft;

  return (
    <div className="min-h-screen bg-stone-50 pb-12">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-stone-100">
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono truncate">{property.name}</div>
          <div className="font-serif text-xl text-stone-900 truncate">{assignment.title}</div>
        </div>
      </div>
      <div className="px-5 pt-6 space-y-5">
        <div className={`p-3 rounded-xl text-sm flex items-center gap-2 ${s.color}`}>
          <Check size={14} /> {s.text}
        </div>

        {assignment.pm_rejection_reason && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200">
            <div className="text-xs uppercase tracking-wider font-mono text-red-700 mb-1">Owner's note</div>
            <div className="text-sm text-red-900 whitespace-pre-wrap">{assignment.pm_rejection_reason}</div>
          </div>
        )}

        {assignment.file_url && (
          <div className="p-4 rounded-2xl bg-white border border-stone-200">
            <div className="flex items-center gap-3 mb-3">
              {assignment.file_kind === 'pdf'
                ? <FileText size={20} className="text-stone-600" />
                : <ImageIcon size={20} className="text-stone-600" />}
              <div className="flex-1">
                <div className="font-serif text-base text-stone-900">Attached file</div>
                <div className="text-xs text-stone-500 font-mono">{assignment.file_kind?.toUpperCase()}</div>
              </div>
            </div>
            {assignment.file_kind === 'image' && (
              <img loading="lazy" src={assignment.file_url} alt="" className="w-full rounded-xl mb-3" />
            )}
            <a href={assignment.file_url} target="_blank" rel="noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-stone-900 text-stone-50 text-sm font-medium">
              <Eye size={14} /> Open
            </a>
          </div>
        )}

        {assignment.notes && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <div className="text-xs uppercase tracking-wider font-mono text-amber-700 mb-1">Notes</div>
            <div className="text-sm text-stone-800 whitespace-pre-wrap">{assignment.notes}</div>
          </div>
        )}

        {canEdit ? (
          <div className="space-y-2 pt-2">
            <button onClick={submit} disabled={busy}
              className="w-full py-4 rounded-2xl bg-stone-900 text-stone-50 font-medium disabled:opacity-50">
              {busy ? 'Working…' : 'Submit for approval'}
            </button>
            <button onClick={onEdit} disabled={busy}
              className="w-full py-3 rounded-2xl bg-stone-100 text-stone-700 text-sm font-medium flex items-center justify-center gap-2">
              <Edit2 size={14} /> Edit
            </button>
            {canDelete && (
              <button onClick={remove} disabled={busy}
                className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-700 text-sm font-medium flex items-center justify-center gap-2">
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
        ) : assignment.pm_status === 'pending' ? (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-stone-700">
            This assignment is locked while waiting for the owner to review. You'll be able to edit again if changes are requested.
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm text-stone-700">
            This assignment is active and visible to the cleaning team. It can't be edited from here.
          </div>
        )}
      </div>
    </div>
  );
}

// =================================================================
// INBOX VIEW — owner/manager review of PM uploads
// Two tabs: Pending assignments + New photos
// =================================================================
function InboxView({ employee, onBack }) {
  const [tab, setTab] = useState('assignments');
  const [pendingAssignments, setPendingAssignments] = useState([]);
  const [reviewedAssignments, setReviewedAssignments] = useState([]);
  const [newPhotos, setNewPhotos] = useState([]);
  const [reviewedPhotos, setReviewedPhotos] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [reviewAssignment, setReviewAssignment] = useState(null);
  const [reviewPhoto, setReviewPhoto] = useState(null);

  const load = async () => {
    setLoaded(false);
    // Pending assignments
    const { data: aData } = await supabase.from('assignments')
      .select('*, property:customers(id, name, property_type), targets:assignment_targets(id, unit:units(label), party:parties(label))')
      .eq('source', 'pm').eq('pm_status', 'pending')
      .order('created_at', { ascending: false });
    setPendingAssignments(aData || []);

    // Already-reviewed PM assignments (approved or rejected) — for the "Reviewed" tab
    const { data: rData } = await supabase.from('assignments')
      .select('*, property:customers(id, name, property_type), targets:assignment_targets(id, unit:units(label), party:parties(label))')
      .eq('source', 'pm').in('pm_status', ['approved', 'rejected'])
      .order('approved_at', { ascending: false, nullsFirst: false })
      .limit(50);
    setReviewedAssignments(rData || []);

    // New photos
    const { data: pData } = await supabase.from('pm_photos')
      .select('*, property:customers(id, name), unit:units(label), party:parties(label)')
      .eq('status', 'new')
      .order('created_at', { ascending: false });
    setNewPhotos(pData || []);

    // Reviewed photos (seen or archived)
    const { data: rpData } = await supabase.from('pm_photos')
      .select('*, property:customers(id, name), unit:units(label), party:parties(label)')
      .in('status', ['seen', 'archived'])
      .order('reviewed_at', { ascending: false, nullsFirst: false })
      .limit(50);
    setReviewedPhotos(rpData || []);

    setLoaded(true);
  };
  useEffect(() => { load(); }, []);

  const markPhotoSeen = async (photo) => {
    await supabase.from('pm_photos').update({
      status: 'seen',
      reviewed_by: employee.id,
      reviewed_at: new Date().toISOString()
    }).eq('id', photo.id);
    load();
  };
  const archivePhoto = async (photo) => {
    if (!confirm('Archive this photo? It will no longer appear in your inbox.')) return;
    await supabase.from('pm_photos').update({
      status: 'archived',
      reviewed_by: employee.id,
      reviewed_at: new Date().toISOString()
    }).eq('id', photo.id);
    load();
  };
  const restorePhoto = async (photo) => {
    await supabase.from('pm_photos').update({
      status: 'new',
      reviewed_by: null,
      reviewed_at: null
    }).eq('id', photo.id);
    load();
  };
  const deletePhoto = async (photo) => {
    if (!confirm('Permanently delete this photo? This cannot be undone.')) return;
    if (photo.photo_path) await supabase.storage.from(PM_UPLOAD_BUCKET).remove([photo.photo_path]);
    await supabase.from('pm_photos').delete().eq('id', photo.id);
    load();
  };

  return (
    <div className="pb-24">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-stone-100">
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div>
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">From property managers</div>
          <div className="font-serif text-xl text-stone-900">Inbox</div>
        </div>
      </div>

      <div className="px-5 pt-4">
        <div className="flex gap-1 bg-stone-100 p-1 rounded-xl mb-5 overflow-x-auto">
          <button onClick={() => setTab('assignments')}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium whitespace-nowrap ${tab === 'assignments' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'}`}>
            Assignments ({pendingAssignments.length})
          </button>
          <button onClick={() => setTab('photos')}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium whitespace-nowrap ${tab === 'photos' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'}`}>
            Photos ({newPhotos.length})
          </button>
          <button onClick={() => setTab('reviewed')}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium whitespace-nowrap ${tab === 'reviewed' ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'}`}>
            Reviewed
          </button>
        </div>

        {!loaded ? <Splash text="Loading…" /> : tab === 'assignments' ? (
          pendingAssignments.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
              No assignments waiting for review.
            </div>
          ) : (
            <div className="space-y-2">
              {pendingAssignments.map(a => (
                <button key={a.id} onClick={() => setReviewAssignment(a)}
                  className="w-full text-left p-4 rounded-2xl bg-white border-2 border-amber-200 hover:border-amber-500 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {a.file_kind === 'pdf'
                          ? <FileText size={14} className="text-stone-500 flex-shrink-0" />
                          : <ImageIcon size={14} className="text-stone-500 flex-shrink-0" />}
                        <span className="font-serif text-base text-stone-900 truncate">{a.title}</span>
                      </div>
                      <div className="text-xs text-stone-600 font-mono mb-1 flex items-center gap-1.5">
                        <Building2 size={11} /> {a.property?.name}
                      </div>
                      {a.targets?.[0] && (a.targets[0].unit?.label || a.targets[0].party?.label) && (
                        <div className="text-xs text-stone-500 font-mono">
                          {a.targets[0].unit?.label}{a.targets[0].party?.label && ` · ${a.targets[0].party.label}`}
                        </div>
                      )}
                      <div className="text-xs text-stone-400 font-mono mt-1">
                        Submitted {fmtDate(a.created_at)}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-stone-400 flex-shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          )
        ) : tab === 'photos' ? (
          newPhotos.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
              No new photos.
            </div>
          ) : (
            <div className="space-y-3">
              {newPhotos.map(p => (
                <div key={p.id} className="p-4 rounded-2xl bg-white border-2 border-amber-200">
                  <div className="text-xs text-stone-600 font-mono mb-2 flex items-center gap-1.5">
                    <Building2 size={11} /> {p.property?.name}
                    {p.unit?.label && <span>· {p.unit.label}</span>}
                    {p.party?.label && <span>· {p.party.label}</span>}
                  </div>
                  {p.title && <div className="font-serif text-base text-stone-900 mb-1">{p.title}</div>}
                  {p.notes && <div className="text-sm text-stone-700 mb-2 whitespace-pre-wrap">{p.notes}</div>}
                  <button onClick={() => setReviewPhoto(p)} className="block w-full rounded-xl overflow-hidden bg-stone-100 mb-3">
                    <img loading="lazy" src={p.photo_url} alt={p.title || ''} className="w-full max-h-96 object-contain" />
                  </button>
                  <div className="text-[10px] text-stone-400 font-mono mb-3">
                    Sent {fmtDate(p.created_at)}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => markPhotoSeen(p)}
                      className="flex-1 py-2 rounded-xl bg-stone-900 text-stone-50 text-sm font-medium flex items-center justify-center gap-2">
                      <Check size={14} /> Mark seen
                    </button>
                    <button onClick={() => archivePhoto(p)}
                      className="py-2 px-3 rounded-xl border border-stone-300 text-stone-600 text-sm font-medium flex items-center justify-center gap-1">
                      <X size={14} /> Archive
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Reviewed tab — combines reviewed photos and reviewed assignments */
          <div className="space-y-6">
            {reviewedPhotos.length === 0 && reviewedAssignments.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
                Nothing reviewed yet. Once you review photos or approve/reject assignments they show up here.
              </div>
            ) : (
              <>
                {reviewedAssignments.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">
                      Reviewed assignments ({reviewedAssignments.length})
                    </div>
                    <div className="space-y-2">
                      {reviewedAssignments.map(a => {
                        const isApproved = a.pm_status === 'approved';
                        return (
                          <div key={a.id} className={`p-4 rounded-2xl border ${isApproved ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {a.file_kind === 'pdf'
                                ? <FileText size={14} className="text-stone-600 flex-shrink-0" />
                                : <ImageIcon size={14} className="text-stone-600 flex-shrink-0" />}
                              <span className="font-serif text-base text-stone-900 truncate flex-1">{a.title}</span>
                              <span className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full ${isApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
                                {isApproved ? 'Approved' : 'Rejected'}
                              </span>
                            </div>
                            <div className="text-xs text-stone-600 font-mono mb-1 flex items-center gap-1.5">
                              <Building2 size={11} /> {a.property?.name}
                            </div>
                            {a.pm_rejection_reason && (
                              <div className="text-xs text-red-700 italic mt-1">"{a.pm_rejection_reason}"</div>
                            )}
                            <div className="flex gap-2 mt-2">
                              {a.file_url && (
                                <a href={a.file_url} target="_blank" rel="noreferrer"
                                  className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium flex items-center gap-1">
                                  <Eye size={12} /> Open file
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {reviewedPhotos.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">
                      Reviewed photos ({reviewedPhotos.length})
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {reviewedPhotos.map(p => (
                        <div key={p.id} className="relative">
                          <button onClick={() => setReviewPhoto(p)}
                            className="block w-full aspect-square rounded-xl overflow-hidden bg-stone-100">
                            <img loading="lazy" src={p.photo_url} alt={p.title || ''} className="w-full h-full object-cover" />
                          </button>
                          <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
                            <span className={`text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded-full ${p.status === 'seen' ? 'bg-emerald-600 text-white' : 'bg-stone-700 text-white'}`}>
                              {p.status}
                            </span>
                          </div>
                          <div className="mt-1 px-1 text-[10px] font-mono text-stone-500 truncate">
                            {p.property?.name}{p.unit?.label && ` · ${p.unit.label}`}
                          </div>
                          <div className="px-1 flex gap-2 mt-1">
                            <button onClick={() => restorePhoto(p)}
                              className="text-[10px] font-mono text-stone-600 hover:text-stone-900">
                              Restore
                            </button>
                            <button onClick={() => deletePhoto(p)}
                              className="text-[10px] font-mono text-red-600 hover:text-red-800">
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {reviewAssignment && (
        <ReviewAssignmentModal assignment={reviewAssignment} employee={employee}
          onDone={() => { setReviewAssignment(null); load(); }}
          onClose={() => setReviewAssignment(null)} />
      )}
      {reviewPhoto && (
        <div className="fixed inset-0 bg-stone-900/95 z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 text-stone-50 bg-stone-900 flex-shrink-0">
            <div className="text-sm font-mono truncate flex-1">{reviewPhoto.title || 'Photo from PM'}</div>
            <button onClick={() => setReviewPhoto(null)} className="p-2 rounded-full bg-stone-800 ml-2 flex-shrink-0">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <img loading="lazy" src={reviewPhoto.photo_url} alt="" className="w-full h-auto rounded-xl" />
            {reviewPhoto.notes && (
              <div className="mt-3 p-3 rounded-xl bg-stone-800 text-stone-200 text-sm whitespace-pre-wrap">
                {reviewPhoto.notes}
              </div>
            )}
          </div>
          <div className="p-3 bg-stone-900 flex-shrink-0">
            <a href={reviewPhoto.photo_url} target="_blank" rel="noreferrer"
              className="block w-full text-center py-3 rounded-xl bg-stone-50 text-stone-900 text-sm font-medium">
              Open full-size in new tab
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// Modal for owner/manager to approve or reject a PM assignment
function ReviewAssignmentModal({ assignment, employee, onDone, onClose }) {
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const approve = async () => {
    setBusy(true); setError('');
    const { error: e } = await supabase.from('assignments').update({
      pm_status: 'approved',
      approved_by: employee.id,
      approved_at: new Date().toISOString(),
      pm_rejection_reason: null
    }).eq('id', assignment.id);
    setBusy(false);
    if (e) { setError(e.message); return; }
    onDone();
  };

  const reject = async () => {
    if (!rejectReason.trim()) { setError('Please tell the PM what to change.'); return; }
    setBusy(true); setError('');
    const { error: e } = await supabase.from('assignments').update({
      pm_status: 'rejected',
      pm_rejection_reason: rejectReason.trim()
    }).eq('id', assignment.id);
    setBusy(false);
    if (e) { setError(e.message); return; }
    onDone();
  };

  return (
    <div className="fixed inset-0 bg-stone-900/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-stone-50 w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">Review submission</div>
            <div className="font-serif text-xl text-stone-900 truncate">{assignment.title}</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-stone-100">
            <X size={20} className="text-stone-600" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {assignment.notes && (
            <div className="p-3 rounded-xl bg-stone-100 text-sm text-stone-800 whitespace-pre-wrap">
              {assignment.notes}
            </div>
          )}
          {assignment.file_url && (
            <div>
              {assignment.file_kind === 'image' ? (
                <img loading="lazy" src={assignment.file_url} alt="" className="w-full rounded-xl" />
              ) : (
                <a href={assignment.file_url} target="_blank" rel="noreferrer"
                  className="block p-4 rounded-xl bg-white border border-stone-200 hover:border-stone-400">
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-stone-600" />
                    <span className="text-sm text-stone-800 flex-1">Open PDF</span>
                    <Eye size={14} className="text-stone-500" />
                  </div>
                </a>
              )}
            </div>
          )}

          {rejectMode && (
            <div>
              <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">
                Tell the PM what needs to change
              </label>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={4}
                placeholder="e.g. Wrong apartment — should be B3-205 instead of B3-105"
                className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white resize-none" />
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}
        </div>
        <div className="p-5 border-t border-stone-200 space-y-2">
          {rejectMode ? (
            <>
              <button onClick={reject} disabled={busy}
                className="w-full py-3 rounded-2xl bg-red-600 text-white font-medium disabled:opacity-50">
                {busy ? 'Sending…' : 'Send back to PM with note'}
              </button>
              <button onClick={() => { setRejectMode(false); setError(''); }} disabled={busy}
                className="w-full py-2 rounded-2xl text-stone-600 text-sm font-medium">
                Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={approve} disabled={busy}
                className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50">
                <Check size={16} /> {busy ? 'Approving…' : 'Approve & make visible to cleaners'}
              </button>
              <button onClick={() => setRejectMode(true)} disabled={busy}
                className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-700 text-sm font-medium">
                Send back for changes
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// =================================================================
// MESSAGING — Deploy 1
//
// - Staff DMs (1-to-1 between staff)
// - Property threads (PM ↔ owners/managers, one per portal-enabled property)
// - Photo attachments
// - Realtime delivery via Supabase Realtime
// - Owners can read any DM for oversight; managers cannot
// =================================================================

// ---- Hook: unread message count ----
function useUnreadCount({ employee = null, customer = null, refreshKey = 0 }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (employee) {
          // Staff: count unread across all conversations they're in
          // For owners: also include property threads (they implicitly see all)
          // For everyone: count DMs they're a participant in
          const { data: parts } = await supabase
            .from('conversation_participants')
            .select('conversation_id, last_read_at')
            .eq('employee_id', employee.id);
          if (!parts || cancelled) return;
          let unread = 0;
          for (const p of parts) {
            const since = p.last_read_at || '1970-01-01';
            const { count: c } = await supabase
              .from('messages')
              .select('id', { count: 'exact', head: true })
              .eq('conversation_id', p.conversation_id)
              .gt('created_at', since)
              .neq('sender_employee_id', employee.id);
            unread += c || 0;
          }
          // For owners and managers, also count unread property threads
          if (employee.role === 'owner' || employee.role === 'manager') {
            const { data: convs } = await supabase
              .from('conversations')
              .select('id, last_message_at')
              .eq('kind', 'property_thread');
            const since = (await supabase.from('employees').select('messages_last_read_at').eq('id', employee.id).maybeSingle()).data?.messages_last_read_at || '1970-01-01';
            for (const c of (convs || [])) {
              if (c.last_message_at && c.last_message_at > since) {
                const { count: cc } = await supabase
                  .from('messages')
                  .select('id', { count: 'exact', head: true })
                  .eq('conversation_id', c.id)
                  .gt('created_at', since)
                  .eq('sender_is_pm', true);
                unread += cc || 0;
              }
            }
          }
          if (!cancelled) setCount(unread);
        } else if (customer) {
          // PM: their property thread
          const { data: conv } = await supabase
            .from('conversations')
            .select('id, last_message_at')
            .eq('customer_id', customer.id)
            .eq('kind', 'property_thread')
            .maybeSingle();
          if (!conv) { if (!cancelled) setCount(0); return; }
          const since = customer.pm_last_read_at || '1970-01-01';
          const { count: c } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .gt('created_at', since)
            .eq('sender_is_pm', false);
          if (!cancelled) setCount(c || 0);
        }
      } catch (e) { console.error('[unread]', e); }
    };
    load();
    const interval = setInterval(load, 20000); // poll every 20s as a backup to realtime
    return () => { cancelled = true; clearInterval(interval); };
  }, [employee?.id, customer?.id, refreshKey]);
  return count;
}


// ---- Main Messages tab (staff side) ----
function StaffMessagesTab({ employee, onClose }) {
  const [view, setView] = useState({ kind: 'list' });

  if (view.kind === 'thread') {
    return <MessageThread
      conversationId={view.conversationId}
      otherName={view.otherName}
      asEmployee={employee}
      isPropertyThread={view.isPropertyThread}
      propertyName={view.propertyName}
      onBack={() => setView({ kind: 'list' })} />;
  }

  if (view.kind === 'new-dm') {
    return <NewDmPicker employee={employee}
      onBack={() => setView({ kind: 'list' })}
      onPicked={(conversationId, otherName) =>
        setView({ kind: 'thread', conversationId, otherName, isPropertyThread: false })} />;
  }

  return <ConversationList employee={employee}
    onOpen={(c) => setView({ kind: 'thread', ...c })}
    onNewDm={() => setView({ kind: 'new-dm' })}
    onClose={onClose} />;
}

function ConversationList({ employee, onOpen, onNewDm, onClose }) {
  const [dms, setDms] = useState([]);
  const [threads, setThreads] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const canSeeThreads = employee.role === 'owner' || employee.role === 'manager';

  const load = async () => {
    setLoaded(false);
    // DMs the employee is a participant in
    const { data: parts } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at, conversation:conversations!inner(id, kind, last_message_at, last_message_preview)')
      .eq('employee_id', employee.id);
    const dmConvs = (parts || []).filter(p => p.conversation?.kind === 'staff_dm');
    // For each, find the OTHER participant's name
    const dmList = [];
    for (const p of dmConvs) {
      const { data: others } = await supabase
        .from('conversation_participants')
        .select('employee:employees(id, name)')
        .eq('conversation_id', p.conversation_id)
        .neq('employee_id', employee.id);
      const other = others?.[0]?.employee;
      if (other) {
        // Compute unread for this convo
        const since = p.last_read_at || '1970-01-01';
        const { count: unread } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', p.conversation_id)
          .gt('created_at', since)
          .neq('sender_employee_id', employee.id);
        dmList.push({
          conversationId: p.conversation_id,
          otherId: other.id,
          otherName: other.name,
          lastMessageAt: p.conversation.last_message_at,
          preview: p.conversation.last_message_preview,
          unread: unread || 0
        });
      }
    }
    dmList.sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''));
    setDms(dmList);

    // Property threads (only owners/managers see these)
    if (canSeeThreads) {
      const { data: convs } = await supabase
        .from('conversations')
        .select('id, customer_id, last_message_at, last_message_preview, customer:customers(name)')
        .eq('kind', 'property_thread')
        .order('last_message_at', { ascending: false, nullsFirst: false });
      // For unread, we use employee.messages_last_read_at — but as a simple v1,
      // we'll just always show a "new" dot if the last message is from a PM and recent.
      // (Per-employee read state on property threads can come in Deploy 2.)
      const threadList = (convs || []).map(c => ({
        conversationId: c.id,
        customerId: c.customer_id,
        propertyName: c.customer?.name || 'Unknown',
        lastMessageAt: c.last_message_at,
        preview: c.last_message_preview
      }));
      setThreads(threadList);
    }
    setLoaded(true);
  };

  useEffect(() => { load(); }, [employee.id]);

  // Realtime: refresh on any new message
  useEffect(() => {
    const channel = supabase.channel('msg-list-' + employee.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => load())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [employee.id]);

  return (
    <div className="pb-24">
      {onClose ? (
        <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200 bg-white">
          <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-stone-100">
            <ArrowLeft size={20} className="text-stone-700" />
          </button>
          <div className="font-serif text-xl text-stone-900">Messages</div>
        </div>
      ) : (
        <Header name={employee.name} onSignOut={() => {}} role={employee.role} />
      )}
      <div className="px-5 pt-6">
        <div className="flex items-center justify-between mb-4">
          {!onClose && <h2 className="font-serif text-2xl text-stone-900">Messages</h2>}
          <button onClick={onNewDm}
            className={`px-3 py-2 rounded-full bg-stone-900 text-stone-50 text-xs font-mono flex items-center gap-1.5 ${onClose ? 'ml-auto' : ''}`}>
            <Plus size={14} /> New
          </button>
        </div>

        {!loaded ? <Splash text="Loading…" /> : (
          <>
            {canSeeThreads && threads.length > 0 && (
              <div className="mb-6">
                <div className="text-xs uppercase tracking-wider font-mono text-stone-500 mb-2">
                  Property threads
                </div>
                <div className="space-y-2">
                  {threads.map(t => (
                    <button key={t.conversationId}
                      onClick={() => onOpen({ conversationId: t.conversationId, otherName: t.propertyName, isPropertyThread: true, propertyName: t.propertyName })}
                      className="w-full text-left p-3 rounded-2xl bg-white border border-stone-200 hover:border-stone-400 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Building2 size={14} className="text-amber-700 flex-shrink-0" />
                            <span className="font-serif text-base text-stone-900 truncate">{t.propertyName}</span>
                          </div>
                          {t.preview && (
                            <div className="text-xs text-stone-600 truncate mt-1">{t.preview}</div>
                          )}
                          {t.lastMessageAt && (
                            <div className="text-[10px] font-mono text-stone-400 mt-0.5">{fmtDate(t.lastMessageAt)}</div>
                          )}
                        </div>
                        <ChevronRight size={14} className="text-stone-400 flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-xs uppercase tracking-wider font-mono text-stone-500 mb-2">
                Direct messages
              </div>
              {dms.length === 0 ? (
                <div className="text-center py-10 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
                  No direct messages yet. Tap "New" to start one.
                </div>
              ) : (
                <div className="space-y-2">
                  {dms.map(d => (
                    <button key={d.conversationId}
                      onClick={() => onOpen({ conversationId: d.conversationId, otherName: d.otherName, isPropertyThread: false })}
                      className={`w-full text-left p-3 rounded-2xl border transition-colors ${d.unread > 0 ? 'bg-amber-50 border-amber-200 hover:border-amber-500' : 'bg-white border-stone-200 hover:border-stone-400'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <User size={14} className="text-stone-500 flex-shrink-0" />
                            <span className="font-serif text-base text-stone-900 truncate">{d.otherName}</span>
                            {d.unread > 0 && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-amber-600 text-white">
                                {d.unread}
                              </span>
                            )}
                          </div>
                          {d.preview && (
                            <div className="text-xs text-stone-600 truncate mt-1">{d.preview}</div>
                          )}
                          {d.lastMessageAt && (
                            <div className="text-[10px] font-mono text-stone-400 mt-0.5">{fmtDate(d.lastMessageAt)}</div>
                          )}
                        </div>
                        <ChevronRight size={14} className="text-stone-400 flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function NewDmPicker({ employee, onBack, onPicked }) {
  const [staff, setStaff] = useState([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('employees')
        .select('id, name, role, active')
        .eq('active', true)
        .neq('id', employee.id)
        .order('name');
      setStaff(data || []);
    })();
  }, [employee.id]);

  const startDm = async (other) => {
    setBusy(true);
    try {
      // See if a DM already exists between these two
      const { data: myParts } = await supabase.from('conversation_participants')
        .select('conversation_id, conversation:conversations!inner(kind)')
        .eq('employee_id', employee.id);
      const myDmConvIds = (myParts || []).filter(p => p.conversation?.kind === 'staff_dm').map(p => p.conversation_id);
      let foundConvId = null;
      if (myDmConvIds.length > 0) {
        const { data: theirParts } = await supabase.from('conversation_participants')
          .select('conversation_id')
          .eq('employee_id', other.id)
          .in('conversation_id', myDmConvIds);
        if (theirParts && theirParts.length > 0) foundConvId = theirParts[0].conversation_id;
      }
      if (foundConvId) {
        onPicked(foundConvId, other.name);
        return;
      }
      // Create a new conversation
      const { data: conv, error } = await supabase.from('conversations')
        .insert({ kind: 'staff_dm' })
        .select().single();
      if (error) throw error;
      await supabase.from('conversation_participants').insert([
        { conversation_id: conv.id, employee_id: employee.id },
        { conversation_id: conv.id, employee_id: other.id }
      ]);
      onPicked(conv.id, other.name);
    } catch (e) {
      alert('Could not start DM: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const filtered = search
    ? staff.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    : staff;

  return (
    <div className="pb-24">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-stone-100">
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div className="font-serif text-xl text-stone-900">New direct message</div>
      </div>
      <div className="px-5 pt-4">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search staff…"
          className="w-full px-4 py-3 rounded-xl border border-stone-300 bg-white mb-4" />
        <div className="space-y-1">
          {filtered.map(s => (
            <button key={s.id} disabled={busy} onClick={() => startDm(s)}
              className="w-full text-left px-4 py-3 rounded-xl hover:bg-stone-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center text-sm font-medium text-stone-700">
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-stone-900">{s.name}</div>
                  <div className="text-xs text-stone-500 font-mono uppercase tracking-wider">{s.role}</div>
                </div>
              </div>
              <ChevronRight size={16} className="text-stone-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}


// ---- The conversation/thread view ----
function MessageThread({ conversationId, otherName, asEmployee = null, asPmCustomer = null, isPropertyThread = false, propertyName, onBack }) {
  const [messages, setMessages] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [zoomPhoto, setZoomPhoto] = useState(null);
  const scrollRef = useRef(null);

  const load = async () => {
    const { data } = await supabase.from('messages')
      .select('*, sender:employees(id, name)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setLoaded(true);
    // Mark conversation as read for this person
    if (asEmployee) {
      await supabase.from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('employee_id', asEmployee.id);
    } else if (asPmCustomer) {
      await supabase.from('customers')
        .update({ pm_last_read_at: new Date().toISOString() })
        .eq('id', asPmCustomer.id);
    }
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
  };

  useEffect(() => { load(); }, [conversationId]);

  // Realtime subscription for new messages in this conversation
  useEffect(() => {
    const channel = supabase.channel('msg-' + conversationId)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, () => load())
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  const send = async () => {
    if (sending) return;
    if (!text.trim() && !photoFile) { setError('Type a message or attach a photo.'); return; }
    setError('');
    setSending(true);
    try {
      let photoUrl = null, photoPath = null;
      if (photoFile) {
        const r = await uploadMessagePhoto(photoFile, conversationId);
        photoUrl = r.publicUrl; photoPath = r.path;
      }
      const insert = {
        conversation_id: conversationId,
        content: text.trim() || null,
        photo_url: photoUrl,
        photo_path: photoPath,
      };
      if (asEmployee) {
        insert.sender_employee_id = asEmployee.id;
        insert.sender_is_pm = false;
      } else {
        insert.sender_employee_id = null;
        insert.sender_is_pm = true;
      }
      const { error: e } = await supabase.from('messages').insert(insert);
      if (e) throw e;
      setText(''); setPhotoFile(null);
      // load() will be triggered by realtime, but call it anyway for instant response
      load();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (m) => {
    if (!confirm('Delete this message? This cannot be undone.')) return;
    if (m.photo_path) await deleteMessagePhoto(m.photo_path);
    await supabase.from('messages').delete().eq('id', m.id);
    // Realtime will refresh
  };

  // Decide who counts as "me" for bubble alignment
  const isMine = (m) => {
    if (asEmployee) return m.sender_employee_id === asEmployee.id;
    if (asPmCustomer) return m.sender_is_pm === true;
    return false;
  };

  // Decide the displayed sender name
  const senderName = (m) => {
    if (m.sender_is_pm) return 'Property manager';
    if (!isPropertyThread) return m.sender?.name || 'Unknown';
    // Property thread + staff sender → show as Summit Clean to the PM
    if (asPmCustomer) return 'Summit Clean';
    // Property thread + viewing as staff → show real name
    return m.sender?.name || 'Summit Clean';
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200 bg-white">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-stone-100">
          <ArrowLeft size={20} className="text-stone-700" />
        </button>
        <div className="flex-1 min-w-0">
          {isPropertyThread && <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">Property thread</div>}
          <div className="font-serif text-xl text-stone-900 truncate">{otherName}</div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2" style={{ minHeight: 0 }}>
        {!loaded ? <div className="text-center text-stone-400 text-sm">Loading…</div> : messages.length === 0 ? (
          <div className="text-center text-stone-400 text-sm py-12">No messages yet. Say hi!</div>
        ) : messages.map(m => {
          const mine = isMine(m);
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                {!mine && (
                  <div className="text-[10px] font-mono text-stone-500 mb-0.5 px-1">{senderName(m)}</div>
                )}
                <div className={`px-3 py-2 rounded-2xl ${mine ? 'bg-stone-900 text-stone-50' : 'bg-white border border-stone-200 text-stone-900'}`}>
                  {m.photo_url && (
                    <button onClick={() => setZoomPhoto(m.photo_url)} className="block mb-1">
                      <img src={m.photo_url} alt="" loading="lazy"
                        className="rounded-xl max-w-full max-h-60 object-cover" />
                    </button>
                  )}
                  {m.content && <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>}
                </div>
                <div className="flex items-center gap-2 mt-0.5 px-1">
                  <div className="text-[10px] font-mono text-stone-400">{fmtClock(m.created_at)}</div>
                  {mine && (
                    <button onClick={() => deleteMessage(m)}
                      className="text-[10px] font-mono text-stone-400 hover:text-red-600">
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle size={16} /><span>{error}</span>
        </div>
      )}

      {photoFile && (
        <div className="px-4 py-2 bg-stone-100 border-t border-stone-200 flex items-center gap-2">
          <ImageIcon size={16} className="text-stone-600" />
          <span className="text-xs text-stone-700 flex-1 truncate">{photoFile.name}</span>
          <button onClick={() => setPhotoFile(null)} className="p-1 rounded-full hover:bg-stone-200">
            <X size={14} className="text-stone-600" />
          </button>
        </div>
      )}

      <div className="px-4 py-3 border-t border-stone-200 bg-white flex items-end gap-2" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <label className="p-2 rounded-full hover:bg-stone-100 cursor-pointer flex-shrink-0">
          <Camera size={20} className="text-stone-600" />
          <input type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhotoFile(f); }} />
        </label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1}
          placeholder="Type a message…" disabled={sending}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          className="flex-1 px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm resize-none max-h-32" />
        <button onClick={send} disabled={sending || (!text.trim() && !photoFile)}
          className="p-2.5 rounded-full bg-stone-900 text-stone-50 disabled:opacity-40 flex-shrink-0">
          {sending ? <div className="w-4 h-4 border-2 border-stone-50 border-t-transparent rounded-full animate-spin" /> : <ChevronRight size={16} />}
        </button>
      </div>

      {zoomPhoto && (
        <div className="fixed inset-0 bg-stone-900/95 z-50 flex flex-col" onClick={() => setZoomPhoto(null)}>
          <div className="flex justify-end p-4">
            <button className="p-2 rounded-full bg-stone-800">
              <X size={20} className="text-stone-50" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <img src={zoomPhoto} alt="" className="w-full h-auto rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
}


// ---- PM-side Messages tab ----
function PortalMessagesTab({ property, onPropertyRefresh }) {
  const [conversationId, setConversationId] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      // Find or create the property thread for this property
      const { data: existing } = await supabase.from('conversations')
        .select('id').eq('customer_id', property.id).eq('kind', 'property_thread').maybeSingle();
      if (existing) {
        setConversationId(existing.id);
      } else {
        const { data: created } = await supabase.from('conversations')
          .insert({ kind: 'property_thread', customer_id: property.id })
          .select().single();
        if (created) setConversationId(created.id);
      }
      setLoaded(true);
    })();
  }, [property.id]);

  if (!loaded) return <div className="px-5 pt-6"><Splash text="Loading…" /></div>;
  if (!conversationId) return <div className="px-5 pt-6 text-stone-400">Could not load messages.</div>;

  return <MessageThread
    conversationId={conversationId}
    otherName="Summit Clean team"
    asPmCustomer={property}
    isPropertyThread={true}
    propertyName={property.name}
    onBack={() => onPropertyRefresh && onPropertyRefresh()} />;
}
