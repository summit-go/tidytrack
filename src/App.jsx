import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Clock, Camera, LogOut, ChevronRight, Plus, Pause, Play, Check,
  ArrowLeft, Users, Image as ImageIcon, Download, X, MapPin,
  Briefcase, Delete, AlertCircle, UserPlus, Building2,
  Trash2, Eye, EyeOff, LayoutDashboard, FileText, DollarSign,
  Home, Layers, User, Edit2, Copy, Printer
} from 'lucide-react';

// =================================================================
// 🔧 PASTE YOUR SUPABASE KEYS HERE
// =================================================================
const SUPABASE_URL = "https://bbaynvqnbkjyqhzhhypr.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiYXludnFuYmtqeXFoemhoeXByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NzQ2MTMsImV4cCI6MjA5MzA1MDYxM30.ZXUoHFj_IwMe6rX8RxK8Dj4kAB9AS7X9xZAhQ84wDEk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const PHOTO_BUCKET = 'task-photos';

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
      await sessionStore.set({ employeeId: employee.id });
      setSession({ employee });
    }} />;
  }
  const signOut = async () => { await sessionStore.clear(); setSession(null); };
  if (session.employee.role === 'manager') {
    return <ManagerShell employee={session.employee} onSignOut={signOut} />;
  }
  return <EmployeeApp employee={session.employee} onSignOut={signOut} />;
}

function Splash({ text }) {
  return <div className="min-h-screen bg-stone-50 flex items-center justify-center text-stone-400 text-sm">{text}</div>;
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
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      <div className="flex-1 flex flex-col justify-center items-center px-6 max-w-sm mx-auto w-full">
        <div className="mb-10 text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-stone-900 flex items-center justify-center mb-6">
            <div className="w-5 h-5 rounded-full bg-stone-50" />
          </div>
          <h1 className="text-4xl font-light text-stone-900 tracking-tight leading-none mb-2">
            Tidy<span className="font-serif italic text-amber-700">Track</span>
          </h1>
          <p className="text-stone-500 text-sm">Enter your 4-digit PIN</p>
        </div>
        <div className="flex gap-3 mb-2">
          {[0,1,2,3].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${
              pin.length > i ? error ? 'bg-red-500 border-red-500' : 'bg-stone-900 border-stone-900' : 'border-stone-300'
            }`} />
          ))}
        </div>
        <div className="h-6 mb-6 text-xs text-red-600 font-mono">{error}</div>
        <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} onClick={() => press(n)} disabled={busy}
              className="aspect-square rounded-2xl bg-white border border-stone-200 text-2xl font-light text-stone-900 active:bg-stone-100 active:scale-95 transition-all">
              {n}
            </button>
          ))}
          <div />
          <button onClick={() => press(0)} disabled={busy}
            className="aspect-square rounded-2xl bg-white border border-stone-200 text-2xl font-light text-stone-900 active:bg-stone-100 active:scale-95 transition-all">0</button>
          <button onClick={back} disabled={busy}
            className="aspect-square rounded-2xl flex items-center justify-center text-stone-500 active:bg-stone-100 active:scale-95 transition-all">
            <Delete size={20} />
          </button>
        </div>
      </div>
      <div className="text-center pb-6 text-xs text-stone-400 font-mono">v5 · work blocks</div>
    </div>
  );
}

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
    setWorkBlocks([...workBlocks, data]);
    setActiveBlock(data); setTasks(data.tasks || []); setBlockStartFlow(null);
  };

  const finishBlock = async () => {
    if (!confirm(`Done cleaning ${activeBlock.party?.label} in ${activeBlock.unit?.label}?`)) return;
    setBusy(true);
    if (activeTask) await stopTask(activeTask, false);
    const ts = new Date().toISOString();
    await supabase.from('work_blocks').update({ end_time: ts }).eq('id', activeBlock.id);
    const updated = { ...activeBlock, end_time: ts, tasks };
    setWorkBlocks(workBlocks.map(b => b.id === activeBlock.id ? updated : b));
    setActiveBlock(null); setTasks([]); setActiveTask(null);
    setBusy(false);
  };

  const reopenBlock = async (block) => {
    setBusy(true);
    await supabase.from('work_blocks').update({ end_time: null }).eq('id', block.id);
    const { data: blockTasks } = await supabase.from('tasks').select('*, photos(*)')
      .eq('work_block_id', block.id).order('start_time');
    const updated = { ...block, end_time: null, tasks: blockTasks || [] };
    setWorkBlocks(workBlocks.map(b => b.id === block.id ? updated : b));
    setActiveBlock(updated); setTasks(blockTasks || []);
    setBusy(false);
  };

  // Tasks
  const startTask = async () => {
    if (!newTaskName.trim()) return;
    if (activeTask) await stopTask(activeTask, false);
    const insert = { shift_id: shift.id, name: newTaskName.trim() };
    if (activeBlock) insert.work_block_id = activeBlock.id;
    const { data, error } = await supabase.from('tasks').insert(insert).select('*, photos(*)').single();
    if (error) { alert('Could not start task: ' + error.message); return; }
    setTasks([...tasks, data]); setActiveTask(data.id); setNewTaskName('');
  };

  const stopTask = async (taskId, refetch = true) => {
    const ts = new Date().toISOString();
    await supabase.from('tasks').update({ end_time: ts }).eq('id', taskId);
    if (refetch) setTasks(tasks.map(t => t.id === taskId ? { ...t, end_time: ts } : t));
    if (activeTask === taskId) setActiveTask(null);
  };

  const resumeTask = async (taskId) => {
    if (activeTask) await stopTask(activeTask, false);
    await supabase.from('tasks').update({ end_time: null }).eq('id', taskId);
    setTasks(tasks.map(t => t.id === taskId ? { ...t, end_time: null } : t));
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
    setTasks(tasks.map(t => t.id === taskId ? { ...t, photos: [...(t.photos || []), photo] } : t));
  };

  if (!loaded) return <Splash text="Loading…" />;

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
        <Header name={employee.name} onSignOut={onSignOut} />
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
    return <PropertyHub shift={shift} workBlocks={workBlocks} employeeName={employee.name}
      onSignOut={onSignOut} onClockOut={clockOut} onStartNew={startNewBlock} onReopen={reopenBlock} busy={busy} />;
  }
  if (isMulti && activeBlock) {
    return <BlockView shift={shift} block={activeBlock} tasks={tasks} activeTask={activeTask}
      employeeName={employee.name} onSignOut={onSignOut} onFinish={finishBlock}
      onPause={() => setActiveBlock(null)}
      newTaskName={newTaskName} setNewTaskName={setNewTaskName}
      onStartTask={startTask} onStopTask={stopTask} onResumeTask={resumeTask}
      onAddPhoto={(taskId, kind) => setPhotoModal({ taskId, kind })}
      photoModal={photoModal} onClosePhotoModal={() => setPhotoModal(null)}
      onUploadPhoto={uploadPhoto} busy={busy} />;
  }
  return <SimpleShiftView shift={shift} tasks={tasks} activeTask={activeTask}
    employeeName={employee.name} onSignOut={onSignOut} onClockOut={clockOut}
    newTaskName={newTaskName} setNewTaskName={setNewTaskName}
    onStartTask={startTask} onStopTask={stopTask} onResumeTask={resumeTask}
    onAddPhoto={(taskId, kind) => setPhotoModal({ taskId, kind })}
    photoModal={photoModal} onClosePhotoModal={() => setPhotoModal(null)}
    onUploadPhoto={uploadPhoto} busy={busy} />;
}

// =================================================================
// PROPERTY HUB (multi-unit, between work blocks)
// =================================================================
function PropertyHub({ shift, workBlocks, employeeName, onSignOut, onClockOut, onStartNew, onReopen, busy }) {
  useTick(true);
  const elapsed = Date.now() - new Date(shift.start_time).getTime();

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <Header name={employeeName} onSignOut={onSignOut} />
      <div className="bg-stone-900 text-stone-50 px-5 py-5 sticky top-0 z-10 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-stone-400 font-mono">At property</div>
            <div className="text-3xl font-mono font-light tracking-tight">{fmtTime(elapsed)}</div>
          </div>
          <button onClick={onClockOut} disabled={busy}
            className="px-4 py-2.5 rounded-full bg-amber-700 text-stone-50 text-sm font-medium flex items-center gap-2 active:scale-95 transition-transform disabled:opacity-50">
            <LogOut size={14} /> Clock out
          </button>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-amber-400 font-mono">
          <Building2 size={11} /> {shift.customer?.name}
        </div>
        <div className="mt-1 text-xs text-stone-400 font-mono">
          Started {fmtClock(shift.start_time)} · {workBlocks.length} {workBlocks.length === 1 ? 'apartment cleaned' : 'apartments cleaned'}
        </div>
      </div>

      <div className="px-4 pt-6">
        <button onClick={onStartNew} disabled={busy}
          className="w-full py-5 rounded-2xl bg-stone-900 text-stone-50 font-medium text-lg flex items-center justify-center gap-3 active:scale-98 transition-transform disabled:opacity-50 shadow-md">
          <Plus size={22} /> Start cleaning a party
        </button>

        <div className="mt-8">
          <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">
            Today's work blocks ({workBlocks.length})
          </div>
          {workBlocks.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">
              No work yet. Tap "Start cleaning a party" above.
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
function BlockView({ shift, block, tasks, activeTask, employeeName, onSignOut, onFinish, onPause,
  newTaskName, setNewTaskName, onStartTask, onStopTask, onResumeTask, onAddPhoto,
  photoModal, onClosePhotoModal, onUploadPhoto, busy }) {
  useTick(true);
  const blockElapsed = Date.now() - new Date(block.start_time).getTime();
  const activeTaskObj = tasks.find(t => t.id === activeTask);

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <Header name={employeeName} onSignOut={onSignOut} />
      <div className="bg-stone-900 text-stone-50 px-5 py-5 sticky top-0 z-10 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onPause} className="flex items-center gap-1.5 text-xs text-stone-400 font-mono hover:text-stone-50">
            <ArrowLeft size={12} /> Pause &amp; back to property
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
function SimpleShiftView({ shift, tasks, activeTask, employeeName, onSignOut, onClockOut,
  newTaskName, setNewTaskName, onStartTask, onStopTask, onResumeTask, onAddPhoto,
  photoModal, onClosePhotoModal, onUploadPhoto, busy }) {
  useTick(true);
  const elapsed = Date.now() - new Date(shift.start_time).getTime();
  const activeTaskObj = tasks.find(t => t.id === activeTask);

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      <Header name={employeeName} onSignOut={onSignOut} />
      <div className="bg-stone-900 text-stone-50 px-5 py-5 sticky top-0 z-10 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-stone-400 font-mono">On the clock</div>
            <div className="text-3xl font-mono font-light tracking-tight">{fmtTime(elapsed)}</div>
          </div>
          <button onClick={onClockOut} disabled={busy}
            className="px-4 py-2.5 rounded-full bg-amber-700 text-stone-50 text-sm font-medium flex items-center gap-2 active:scale-95 transition-transform disabled:opacity-50">
            <LogOut size={14} /> Clock out
          </button>
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
  const before = (task.photos || []).filter(p => p.kind === 'before');
  const after  = (task.photos || []).filter(p => p.kind === 'after');
  const isDone = !!task.end_time;
  return (
    <div className={`rounded-2xl p-4 border-2 transition-all ${isActive ? 'border-amber-300 bg-amber-50/50' : 'border-stone-200 bg-white'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isDone && <Check size={14} className="text-emerald-600 flex-shrink-0" />}
            {isActive && <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse flex-shrink-0" />}
            <span className="font-serif text-lg text-stone-900 truncate">{task.name}</span>
          </div>
          <div className="text-xs text-stone-500 font-mono">
            {fmtClock(task.start_time)}{task.end_time && ` — ${fmtClock(task.end_time)}`} · {fmtTimeShort(elapsed)}
          </div>
        </div>
        {isDone ? (
          <button onClick={onResume} className="ml-2 p-2 rounded-full bg-stone-100 text-stone-600 active:scale-95 transition-transform">
            <Play size={14} />
          </button>
        ) : (
          <button onClick={onStop} className="ml-2 px-3 py-1.5 rounded-full bg-stone-900 text-stone-50 text-xs font-medium flex items-center gap-1 active:scale-95 transition-transform">
            <Pause size={12} /> Done
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => onAddPhoto('before')}
          className="px-3 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-medium flex items-center justify-center gap-2 active:scale-95 transition-transform">
          <Camera size={14} /> Before {before.length > 0 && <span className="text-amber-700">({before.length})</span>}
        </button>
        <button onClick={() => onAddPhoto('after')}
          className="px-3 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-medium flex items-center justify-center gap-2 active:scale-95 transition-transform">
          <Camera size={14} /> After {after.length > 0 && <span className="text-amber-700">({after.length})</span>}
        </button>
      </div>
    </div>
  );
}

function PhotoModal({ kind, taskName, existing, onUpload, onClose }) {
  const [busy, setBusy] = useState(false);
  const handleFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true); await onUpload(file); setBusy(false);
  };
  return (
    <div className="fixed inset-0 bg-stone-900/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-stone-50 w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500 font-mono">{kind} photo</div>
            <div className="font-serif text-xl text-stone-900">{taskName}</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-stone-100"><X size={20} className="text-stone-600" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {existing.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              {existing.map(p => <img key={p.id} src={p.public_url} alt="" className="w-full aspect-square object-cover rounded-xl" />)}
            </div>
          )}
          <label className={`block w-full p-8 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-colors ${busy ? 'border-amber-300 bg-amber-50' : 'border-stone-300 hover:border-stone-900'}`}>
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
            <input type="file" accept="image/*" capture="environment" onChange={handleFile} disabled={busy} className="hidden" />
          </label>
        </div>
        <div className="p-5 border-t border-stone-200">
          <button onClick={onClose} className="w-full py-3.5 rounded-2xl bg-stone-900 text-stone-50 font-medium active:scale-98 transition-transform">Done</button>
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

function Header({ name, onSignOut }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 bg-stone-50 border-b border-stone-200">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-stone-900 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-stone-50" />
        </div>
        <div>
          <div className="font-serif text-base text-stone-900 leading-none">
            Tidy<span className="italic text-amber-700">Track</span>
          </div>
          <div className="text-xs text-stone-500 font-mono">{name}</div>
        </div>
      </div>
      <button onClick={onSignOut} className="text-xs text-stone-500 font-mono hover:text-stone-900">Sign out</button>
    </div>
  );
}

// =================================================================
// MANAGER SHELL
// =================================================================
function ManagerShell({ employee, onSignOut }) {
  const [tab, setTab] = useState('dashboard');
  return (
    <div className="min-h-screen bg-stone-50">
      {tab === 'dashboard' && <ManagerDashboard employee={employee} onSignOut={onSignOut} />}
      {tab === 'team'      && <EmployeeAdmin   employee={employee} onSignOut={onSignOut} />}
      {tab === 'props'     && <PropertyAdmin   employee={employee} onSignOut={onSignOut} />}
      {tab === 'invoice'   && <InvoiceView     employee={employee} onSignOut={onSignOut} />}
      {tab === 'payroll'   && <ExportView      employee={employee} onSignOut={onSignOut} />}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-1 py-2 z-30">
        <div className="max-w-md mx-auto grid grid-cols-5 gap-0.5">
          <TabButton active={tab==='dashboard'} onClick={() => setTab('dashboard')} icon={<LayoutDashboard size={18} />} label="Shifts" />
          <TabButton active={tab==='team'}      onClick={() => setTab('team')}      icon={<Users size={18} />} label="Team" />
          <TabButton active={tab==='props'}     onClick={() => setTab('props')}     icon={<Building2 size={18} />} label="Properties" />
          <TabButton active={tab==='invoice'}   onClick={() => setTab('invoice')}   icon={<FileText size={18} />} label="Invoices" />
          <TabButton active={tab==='payroll'}   onClick={() => setTab('payroll')}   icon={<DollarSign size={18} />} label="Payroll" />
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-xl transition-colors ${active ? 'bg-stone-900 text-stone-50' : 'text-stone-500 hover:text-stone-900'}`}>
      {icon}
      <span className="text-[9px] font-mono uppercase tracking-wider">{label}</span>
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
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const sinceDays = filter === 'today' ? 1 : filter === 'week' ? 7 : 365;
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('shifts')
      .select('*, employee:employees(id,name), customer:customers(id,name,property_type,bill_rate_hourly), work_blocks(id, end_time)')
      .gte('start_time', since)
      .order('start_time', { ascending: false });
    setShifts(data || []); setLoaded(true);
  }, [filter]);
  useEffect(() => { load(); }, [load, view]);

  if (!loaded) return <Splash text="Loading dashboard…" />;
  if (view === 'detail' && selectedShift) {
    return <ShiftDetail shiftId={selectedShift.id}
      onBack={() => { setView('shifts'); setSelectedShift(null); load(); }} />;
  }

  const activeCount = shifts.filter(s => !s.end_time).length;
  const totalHours = shifts.filter(s => s.end_time)
    .reduce((sum, s) => sum + (new Date(s.end_time) - new Date(s.start_time)), 0);

  return (
    <div className="pb-24">
      <Header name={employee.name} onSignOut={onSignOut} />
      <div className="px-5 pt-6">
        <div className="text-xs uppercase tracking-widest text-stone-400 font-mono mb-3">
          {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}
        </div>
        <h1 className="text-4xl font-light text-stone-900 tracking-tight mb-6">
          Dash<span className="font-serif italic text-amber-700">board</span>
        </h1>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard label="On the clock" value={activeCount} unit="now" highlight={activeCount > 0} />
          <StatCard label={`${filter === 'today' ? 'Today' : filter === 'week' ? 'Week' : 'Total'} hours`} value={fmtTimeShort(totalHours)} />
          <StatCard label="Shifts" value={shifts.length} unit="logged" />
          <StatCard label="Active" value={activeCount} unit="cleaners" />
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
      <div className="px-5">
        <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-3">Shifts ({shifts.length})</div>
        {shifts.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-2xl">No shifts in this period.</div>
        ) : (
          <div className="space-y-2">
            {shifts.map(s => {
              const dur = (s.end_time ? new Date(s.end_time) : new Date()) - new Date(s.start_time);
              const blockCount = s.work_blocks?.length || 0;
              return (
                <button key={s.id} onClick={() => { setSelectedShift(s); setView('detail'); }}
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
                    <ChevronRight size={14} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, highlight, accent }) {
  return (
    <div className={`p-4 rounded-2xl ${highlight ? 'bg-stone-900 text-stone-50' : accent ? 'bg-amber-50 border border-amber-200' : 'bg-white border border-stone-200'}`}>
      <div className={`text-xs uppercase tracking-wider font-mono mb-1 ${highlight ? 'text-stone-400' : accent ? 'text-amber-700' : 'text-stone-500'}`}>{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-serif ${accent ? 'text-amber-900' : ''}`}>{value}</span>
        {unit && <span className={`text-xs font-mono ${highlight ? 'text-stone-400' : 'text-stone-500'}`}>{unit}</span>}
      </div>
    </div>
  );
}

// =================================================================
// SHIFT DETAIL (shows work blocks for multi-unit)
// =================================================================
function ShiftDetail({ shiftId, onBack }) {
  const [shift, setShift] = useState(null);
  const [workBlocks, setWorkBlocks] = useState([]);
  const [tasks, setTasks] = useState([]);
  useEffect(() => { (async () => {
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
  })(); }, [shiftId]);

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
                {workBlocks.map(b => <WorkBlockDetail key={b.id} block={b} rate={shift.customer?.bill_rate_hourly} />)}
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
      </div>
    </div>
  );
}

function WorkBlockDetail({ block, rate }) {
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
        {billable > 0 && (
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
    </div>
  );
}

function TaskDetail({ task, compact }) {
  const before = (task.photos || []).filter(p => p.kind === 'before');
  const after  = (task.photos || []).filter(p => p.kind === 'after');
  const dur = (task.end_time ? new Date(task.end_time) : new Date()) - new Date(task.start_time);
  return (
    <div className={compact ? '' : 'p-4 rounded-2xl bg-white border border-stone-200'}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-serif text-base text-stone-900">{task.name}</div>
          <div className="text-xs text-stone-500 font-mono">
            {fmtClock(task.start_time)}{task.end_time && ` — ${fmtClock(task.end_time)}`} · {fmtTimeShort(dur)}
          </div>
        </div>
        {!task.end_time && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-mono">live</span>}
      </div>
      {(before.length > 0 || after.length > 0) && (
        <div className="grid grid-cols-2 gap-3 mt-2">
          <PhotoColumn label="Before" photos={before} />
          <PhotoColumn label="After"  photos={after} />
        </div>
      )}
    </div>
  );
}

function PhotoColumn({ label, photos }) {
  const [zoom, setZoom] = useState(null);
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-1">{label} ({photos.length})</div>
      {photos.length === 0 ? (
        <div className="aspect-square rounded-lg border-2 border-dashed border-stone-200 flex items-center justify-center text-stone-300">
          <Camera size={18} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1">
          {photos.map(p => (
            <button key={p.id} onClick={() => setZoom(p.public_url)} className="aspect-square rounded overflow-hidden">
              <img src={p.public_url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {zoom && (
        <div onClick={() => setZoom(null)} className="fixed inset-0 bg-stone-900/90 z-50 flex items-center justify-center p-4 cursor-pointer">
          <img src={zoom} alt="" className="max-w-full max-h-full rounded-xl" />
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
    return <EmployeeForm employee={editing === 'new' ? null : editing} currentUserId={employee.id}
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
                    {e.role === 'manager' && <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Manager</span>}
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

function EmployeeForm({ employee, currentUserId, onCancel, onSaved }) {
  const isNew = !employee;
  const [name, setName] = useState(employee?.name || '');
  const [pin, setPin] = useState(employee?.pin || '');
  const [role, setRole] = useState(employee?.role || 'employee');
  const [active, setActive] = useState(employee?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isSelf = employee?.id === currentUserId;
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
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setRole('employee')} type="button"
              className={`p-3 rounded-xl border-2 text-left ${role === 'employee' ? 'border-stone-900 bg-white' : 'border-stone-200 bg-white/50'}`}>
              <div className="font-medium text-stone-900 text-sm">Employee</div>
            </button>
            <button onClick={() => setRole('manager')} type="button"
              className={`p-3 rounded-xl border-2 text-left ${role === 'manager' ? 'border-stone-900 bg-white' : 'border-stone-200 bg-white/50'}`}>
              <div className="font-medium text-stone-900 text-sm">Manager</div>
            </button>
          </div>
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
    return <PropertyForm property={view.property}
      onCancel={() => setView({ kind: 'list' })}
      onSaved={() => { setView({ kind: 'list' }); load(); }} />;
  }
  if (view.kind === 'unit-list') {
    return <UnitList property={view.property}
      onBack={() => { setView({ kind: 'list' }); load(); }}
      onEditProperty={() => setView({ kind: 'property-edit', property: view.property })}
      onUnitOpen={(unit) => setView({ kind: 'party-list', property: view.property, unit })}
      onUnitEdit={(unit) => setView({ kind: 'unit-edit', property: view.property, unit })}
      onUnitNew={() => setView({ kind: 'unit-edit', property: view.property, unit: null })}
      onBulkNew={() => setView({ kind: 'bulk-create', property: view.property })} />;
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
          className="w-full mb-4 p-4 rounded-2xl bg-stone-900 text-stone-50 font-medium flex items-center justify-center gap-2 active:scale-98">
          <Plus size={18} /> Add property
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
                  <div className="flex items-center gap-3 mt-2 text-xs text-stone-600">
                    {p.bill_mode === 'hourly' && p.bill_rate_hourly && (
                      <span className="flex items-center gap-1"><DollarSign size={11} />{Number(p.bill_rate_hourly).toFixed(2)}/hr</span>
                    )}
                    {p.bill_mode === 'flat' && p.flat_rate_amount && (
                      <span className="flex items-center gap-1"><DollarSign size={11} />{Number(p.flat_rate_amount).toFixed(2)} flat</span>
                    )}
                  </div>
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

function PropertyForm({ property, onCancel, onSaved }) {
  const isNew = !property;
  const [name, setName] = useState(property?.name || '');
  const [address, setAddress] = useState(property?.address || '');
  const [notes, setNotes] = useState(property?.notes || '');
  const [type, setType] = useState(property?.property_type || 'simple');
  const [billMode, setBillMode] = useState(property?.bill_mode || 'hourly');
  const [hourlyRate, setHourlyRate] = useState(property?.bill_rate_hourly?.toString() || '');
  const [flatAmount, setFlatAmount] = useState(property?.flat_rate_amount?.toString() || '');
  const [active, setActive] = useState(property?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (type === 'multi_unit' && billMode === 'flat') setBillMode('hourly');
  }, [type, billMode]);
  const save = async () => {
    setError('');
    if (!name.trim()) { setError('Name is required'); return; }
    setBusy(true);
    const payload = {
      name: name.trim(), address: address.trim() || null, notes: notes.trim() || null,
      property_type: type, bill_mode: billMode,
      bill_rate_hourly: billMode === 'hourly' && hourlyRate ? parseFloat(hourlyRate) : null,
      flat_rate_amount: billMode === 'flat' && flatAmount ? parseFloat(flatAmount) : null,
      active
    };
    const { error: e } = isNew
      ? await supabase.from('customers').insert(payload)
      : await supabase.from('customers').update(payload).eq('id', property.id);
    setBusy(false);
    if (e) { setError(e.message); return; }
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
              <div className="text-xs text-stone-500">Apartments with parties</div>
            </button>
          </div>
        </div>
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

function UnitList({ property, onBack, onEditProperty, onUnitOpen, onUnitEdit, onUnitNew, onBulkNew }) {
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

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button onClick={onUnitNew}
            className="p-3 rounded-2xl bg-stone-900 text-stone-50 font-medium text-sm flex items-center justify-center gap-2 active:scale-98">
            <Plus size={16} /> Add one
          </button>
          <button onClick={onBulkNew}
            className="p-3 rounded-2xl bg-amber-700 text-stone-50 font-medium text-sm flex items-center justify-center gap-2 active:scale-98">
            <Layers size={16} /> Bulk create
          </button>
        </div>

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
          unit_id: created.id, label: `Person ${i + 1}`, sort_order: i + 1
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
    if (!confirm(`Create ${totalUnits} units and ${totalParties} parties under "${property.name}"? This can't be undone in bulk — you'd have to delete units one-by-one or delete the whole property.`)) return;

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
            label: `Person ${p}`,
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
          <label className="text-xs uppercase tracking-wider text-stone-500 font-mono mb-2 block">Parties per unit</label>
          <div className="grid grid-cols-5 gap-2">
            {[0, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setPartiesPerUnit(n)} type="button"
                className={`py-3 rounded-xl border-2 font-mono text-sm transition-all ${
                  partiesPerUnit === n ? 'border-stone-900 bg-stone-900 text-stone-50' : 'border-stone-200 bg-white text-stone-700'
                }`}>
                {n === 0 ? '—' : n}
              </button>
            ))}
          </div>
          <p className="text-xs text-stone-500 mt-2">
            Each unit gets "Person 1" through "Person N". You can rename them later.
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
              <span className="text-stone-500"> parties</span>
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
          {busy ? 'Creating…' : <>Create {totalUnits} units &amp; {totalParties} parties</>}
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
            placeholder="e.g. Person 1, Student 3"
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
                        <th className="font-normal pb-2">Party</th>
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
