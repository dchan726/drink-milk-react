import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  addDoc, 
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import { 
  Clock, 
  Plus, 
  Settings, 
  BarChart3, 
  Trash2,
  Minus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Timer,
  Baby,
  TrendingUp,
  BellRing,
  History,
  CheckCircle2,
  FlaskConical,
  Lock,
  Unlock,
  Share2
} from 'lucide-react';

// --- 你的專屬 Firebase 配置 ---
const firebaseConfig = {
  apiKey: "AIzaSyCW4nUS4BWEC1dHn2eFeD-NtlTzuQYGN3U",
  authDomain: "drink-milk-hazel.firebaseapp.com",
  projectId: "drink-milk-hazel",
  storageBucket: "drink-milk-hazel.firebasestorage.app",
  messagingSenderId: "1012699852359",
  appId: "1:1012699852359:web:6020c62f541c7aab324b62"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'hazel-baby-tracker';

const getLocalDateString = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatTime24 = (dateInput) => {
  if (!dateInput) return "--:--";
  let d = (dateInput instanceof Date) ? dateInput : (dateInput?.toDate ? dateInput.toDate() : new Date(dateInput));
  return d.toLocaleTimeString('zh-HK', { hour12: false, hour: '2-digit', minute: '2-digit' });
};

const App = () => {
  const [user, setUser] = useState(null);
  const [babyInfo, setBabyInfo] = useState({
    name: '寶寶',
    intervalHours: 4,
    standardVolume: 120, 
    mlPerScoop: 30,      
    dailyTarget: 800,    
    sleepStart: "22:00",
    sleepEnd: "06:00",
    quickVolumes: [60, 120, 180, 240],
    enableNotifications: false,
    defaultMixingWater: 120 // 新增：儲存開奶水量的預設值
  });
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('status'); 
  const [showModal, setShowModal] = useState(false); 
  const [viewDate, setViewDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [inAppAlert, setInAppAlert] = useState(null);
  
  // 開奶參考狀態與鎖定控制
  const [mixingWater, setMixingWater] = useState(120);
  const [isMixingLocked, setIsMixingLocked] = useState(true);

  // 時鐘：每秒更新
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 匿名登入
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) { console.error("Auth failed:", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); });
    return () => unsubscribe();
  }, []);

  // 資料庫監聽
  useEffect(() => {
    if (!user) return;
    const babyRef = doc(db, 'artifacts', appId, 'public', 'data', 'profile', 'main');
    const unsubBaby = onSnapshot(babyRef, (s) => {
      if (s.exists()) {
        const data = s.data();
        setBabyInfo(p => ({ ...p, ...data }));
      }
    });
    const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'careLogs');
    const unsubLogs = onSnapshot(logsRef, (s) => {
      const data = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setLogs(data.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
    });
    return () => { unsubBaby(); unsubLogs(); };
  }, [user]);

  // 新增：當從 Firebase 讀取到開奶水量設定時，若目前是鎖定狀態，則更新畫面
  useEffect(() => {
    if (isMixingLocked && babyInfo?.defaultMixingWater !== undefined) {
      setMixingWater(babyInfo.defaultMixingWater);
    }
  }, [babyInfo?.defaultMixingWater, isMixingLocked]);

  // 新增：切換鎖定狀態時，若改為「鎖定」，就將數值寫入 Firebase
  const toggleMixingLock = async () => {
    const nextLocked = !isMixingLocked;
    setIsMixingLocked(nextLocked);
    
    // 如果是變成「鎖定」狀態，就把目前的水量存進 Firebase
    if (nextLocked && user) {
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', 'profile', 'main'),
        { defaultMixingWater: mixingWater },
        { merge: true } // merge: true 代表只更新這個欄位，不會覆蓋其他設定
      );
    }
  };

  const stats = useMemo(() => {
    const selectedDateStr = getLocalDateString(viewDate);
    const todayStr = getLocalDateString(currentTime);
    const isToday = selectedDateStr === todayStr;
    const isPast = viewDate < new Date(todayStr);

    // 當日紀錄
    const dayLogsRaw = logs
      .filter(l => l.type === 'milk' && l.timestamp && getLocalDateString(l.timestamp.toDate()) === selectedDateStr)
      .sort((a, b) => a.timestamp.seconds - b.timestamp.seconds);

    const dayLogsWithGap = dayLogsRaw.map((log, index) => {
      let gapText = "";
      let prevLog = (index > 0) ? dayLogsRaw[index - 1] : logs.find(l => l.timestamp.seconds < log.timestamp.seconds);
      if (prevLog) {
        const diffMs = (log.timestamp.seconds - prevLog.timestamp.seconds) * 1000;
        const totalMin = Math.floor(diffMs / 60000);
        gapText = `${Math.floor(totalMin / 60)}時${totalMin % 60}分`;
      }
      return { ...log, gapText };
    });

    let totalMl = 0;
    dayLogsRaw.forEach(l => totalMl += (Number(l.actualVolume) || 0));

    const [sH, sM] = (babyInfo.sleepStart || "22:00").split(':').map(Number);
    const [eH, eM] = (babyInfo.sleepEnd || "06:00").split(':').map(Number);
    const sStartMins = sH * 60 + sM;
    const sEndMins = eH * 60 + eM;

    const isSleeping = (date) => {
      const mins = date.getHours() * 60 + date.getMinutes();
      return sStartMins > sEndMins 
        ? (mins >= sStartMins || mins <= sEndMins) 
        : (mins >= sStartMins && mins <= sEndMins);
    };

    let timeline = [];
    const intervalMs = (Number(babyInfo.intervalHours) || 4) * 3600000;
    
    if (dayLogsRaw.length > 0) {
      dayLogsRaw.forEach(l => timeline.push({ time: l.timestamp.toDate(), isActual: true, volume: l.actualVolume }));
      let lastMeal = dayLogsRaw[dayLogsRaw.length - 1].timestamp.toDate();
      let pointer = new Date(lastMeal.getTime() + intervalMs);
      while (getLocalDateString(pointer) === selectedDateStr && timeline.length < 12) {
        if (!isSleeping(pointer)) timeline.push({ time: new Date(pointer), isActual: false });
        pointer = new Date(pointer.getTime() + intervalMs);
      }
    } else {
      let pointer = new Date(viewDate); 
      pointer.setHours(eH, eM, 0, 0);
      while (getLocalDateString(pointer) === selectedDateStr && timeline.length < 10) {
        if (!isSleeping(pointer)) timeline.push({ time: new Date(pointer), isActual: false });
        pointer = new Date(pointer.getTime() + intervalMs);
      }
    }

    const fullSchedule = timeline.sort((a,b) => a.time - b.time);

    let nextMeal = null;
    if (isToday || viewDate > new Date(todayStr)) {
      const target = fullSchedule.find(i => !i.isActual && i.time > new Date(currentTime.getTime() - 20 * 60000));
      if (target) {
        const diffMin = Math.floor((target.time - currentTime) / 60000);
        nextMeal = { 
          time: target.time, 
          label: diffMin <= 0 ? "現在請餵奶" : (diffMin <= 30 ? "請預備開奶" : `倒數 ${Math.floor(diffMin/60)}時${diffMin%60}分`),
          isUrgent: diffMin <= 30 
        };
      }
    }

    let lastMealInfo = null;
    const allSortedLogs = [...logs].filter(l => l.type === 'milk' && l.timestamp).sort((a,b) => b.timestamp.seconds - a.timestamp.seconds);
    if (allSortedLogs.length > 0 && isToday) {
       const lastActualTime = allSortedLogs[0].timestamp.toDate();
       const diffMin = Math.floor((currentTime - lastActualTime) / 60000);
       if (diffMin >= 0) {
         lastMealInfo = {
           text: `${Math.floor(diffMin/60)}時${diffMin%60}分`
         };
       }
    }

    return { dayLogs: dayLogsWithGap, dayTotal: totalMl, schedule: fullSchedule, nextMeal, isPast, lastMealInfo };
  }, [logs, babyInfo, viewDate, currentTime]);

  const shareScheduleViaWhatsApp = () => {
    const dateStr = viewDate.toLocaleDateString('zh-HK', { month: 'numeric', day: 'numeric', weekday: 'short' });
    let text = `[ ${babyInfo.name} 食奶預測行程 (${dateStr}) ]\n\n`;
    
    stats.schedule.forEach(item => {
      const tStr = formatTime24(item.time);
      if (item.isActual) {
        text += `(已食) ${tStr} - ${item.volume}ml\n`;
      } else {
        text += `(預計) ${tStr}\n`;
      }
    });
    
    text += `\n* 當日總量: ${stats.dayTotal}ml (目標: ${babyInfo.dailyTarget}ml)`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="max-w-md mx-auto h-screen bg-slate-50 flex flex-col font-sans overflow-hidden relative">
      <div className="bg-slate-800 text-slate-200 px-4 py-1.5 flex justify-between items-center text-[10px] shrink-0 z-40">
        <span className="font-bold tracking-widest uppercase">現在時間</span>
        <span className="font-mono font-black">{currentTime.toLocaleString('zh-HK', { hour12: false })}</span>
      </div>

      <header className="bg-white border-b shrink-0 z-30 shadow-sm">
        <div className="px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-2xl flex items-center justify-center text-white shadow-lg"><Baby size={22} strokeWidth={2.5} /></div>
            <h1 className="font-black text-slate-800 text-lg">{babyInfo.name}</h1>
          </div>
          <button onClick={() => setShowModal(true)} className="bg-orange-500 text-white px-5 py-2.5 rounded-2xl flex items-center gap-2 active:scale-95 transition-all shadow-md">
            <Plus size={18} strokeWidth={3} /><span className="text-sm font-black">記錄</span>
          </button>
        </div>
        {activeTab === 'status' && (
          <div className="px-6 pb-4 flex items-center justify-between">
             <button onClick={() => setViewDate(d => new Date(d.setDate(d.getDate()-1)))} className="p-2 text-slate-300 hover:text-orange-500"><ChevronLeft size={24}/></button>
             <div className="flex flex-col items-center" onClick={() => setViewDate(new Date())}>
               <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">檢視日期</p>
               <div className="flex items-center gap-2">
                 <CalendarDays size={14} className="text-orange-400"/>
                 <span className="text-sm font-black text-slate-700">{viewDate.toLocaleDateString('zh-HK', { month: 'short', day: 'numeric', weekday: 'short' })}</span>
               </div>
             </div>
             <button onClick={() => setViewDate(d => new Date(d.setDate(d.getDate()+1)))} className="p-2 text-slate-300 hover:text-orange-500"><ChevronRight size={24}/></button>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-5 space-y-6 pb-32">
        {activeTab === 'status' && (
          <>
            <section className={`rounded-[40px] p-8 shadow-sm border text-center relative overflow-hidden transition-all flex flex-col items-center justify-center min-h-[180px] ${stats.isPast ? 'bg-white border-white' : (stats.nextMeal?.isUrgent ? 'bg-red-500 border-red-400 shadow-red-200' : 'bg-white border-white')}`}>
               {stats.isPast ? (
                 <>
                   <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest mb-1">當日飲奶總量</p>
                   <h2 className="text-7xl font-black text-orange-500 tracking-tighter">{stats.dayTotal}<small className="text-xl ml-1 text-orange-400">ml</small></h2>
                 </>
               ) : (
                 stats.nextMeal ? (
                   <>
                     <p className={`text-[11px] font-black uppercase tracking-widest mb-1 ${stats.nextMeal.isUrgent ? 'text-red-100' : 'text-slate-300'}`}>下一餐預計</p>
                     <h2 className={`text-7xl font-black tracking-tighter ${stats.nextMeal.isUrgent ? 'text-white' : 'text-slate-800'}`}>{formatTime24(stats.nextMeal.time)}</h2>
                     
                     <div className="flex flex-col items-center gap-2 mt-4">
                       <div className={`inline-block px-6 py-2 rounded-full text-[11px] font-black uppercase tracking-widest ${stats.nextMeal.isUrgent ? 'bg-white text-red-600 animate-pulse' : 'bg-orange-50 text-orange-600'}`}>
                         {stats.nextMeal.label}
                       </div>
                       
                       {stats.lastMealInfo && (
                         <div className={`flex items-center gap-1 text-[10px] font-bold px-3 py-1 rounded-full ${stats.nextMeal.isUrgent ? 'bg-red-600 text-red-100' : 'bg-slate-50 text-slate-400'}`}>
                           <Timer size={10} /> 距離上餐已過 {stats.lastMealInfo.text}
                         </div>
                       )}
                     </div>
                   </>
                 ) : (
                   <div className="flex flex-col items-center gap-2">
                     <p className="font-black text-slate-300 uppercase tracking-widest">💤 寶寶長睡眠中</p>
                     <p className="text-[10px] font-bold text-slate-400">預測將於 {babyInfo.sleepEnd} 恢復</p>
                   </div>
                 )
               )}
            </section>

            <section className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-50 space-y-4">
               <div className="flex items-center justify-between">
                 <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1"><FlaskConical size={14} className="text-orange-500"/> 開奶比例參考</h3>
                 <button onClick={toggleMixingLock} className={`p-1.5 rounded-full flex items-center gap-1.5 transition-colors ${isMixingLocked ? 'bg-orange-50 text-orange-500' : 'bg-slate-100 text-slate-400'}`}>
                    {isMixingLocked ? <><Lock size={12} strokeWidth={3}/><span className="text-[9px] font-black pr-1">已鎖定</span></> : <><Unlock size={12}/><span className="text-[9px] font-black pr-1">按此儲存</span></>}
                 </button>
               </div>
               <div className="flex items-center gap-4">
                  <div className={`flex-1 flex items-center rounded-2xl p-2 transition-colors ${isMixingLocked ? 'bg-slate-50/50' : 'bg-slate-50'}`}>
                    <button disabled={isMixingLocked} onClick={() => setMixingWater(w => Math.max(0, w - (Number(babyInfo.mlPerScoop) || 30)))} className={`w-10 h-10 flex items-center justify-center transition-opacity ${isMixingLocked ? 'opacity-30 cursor-not-allowed' : 'text-slate-500'}`}><Minus size={18}/></button>
                    <div className="flex-1 text-center">
                      <span className={`text-lg font-black ${isMixingLocked ? 'text-slate-400' : 'text-slate-700'}`}>{mixingWater}</span>
                      <span className="text-[10px] font-black text-slate-400 ml-1">ML 水</span>
                    </div>
                    <button disabled={isMixingLocked} onClick={() => setMixingWater(w => w + (Number(babyInfo.mlPerScoop) || 30))} className={`w-10 h-10 flex items-center justify-center transition-opacity ${isMixingLocked ? 'opacity-30 cursor-not-allowed' : 'text-slate-500'}`}><Plus size={18}/></button>
                  </div>
                  <div className="w-px h-8 bg-slate-100"></div>
                  <div className="flex-1 text-center">
                    <p className="text-[9px] font-black text-slate-300 uppercase">需加粉</p>
                    <p className={`text-xl font-black ${isMixingLocked ? 'text-orange-400/80' : 'text-orange-500'}`}>{(mixingWater / (Number(babyInfo.mlPerScoop) || 30)).toFixed(1).replace('.0', '')} <small className="text-xs">匙</small></p>
                  </div>
               </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Clock size={14}/> 預計行程</h3>
                <button onClick={shareScheduleViaWhatsApp} className="flex items-center gap-1.5 text-[10px] font-black text-[#25D366] bg-[#25D366]/10 px-3 py-1.5 rounded-full active:scale-95 transition-transform"><Share2 size={12}/> 分享行程</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {stats.schedule.map((item, idx) => (
                  <div key={idx} className={`p-4 rounded-3xl border flex items-center justify-between ${item.isActual ? 'bg-white border-orange-100' : 'bg-slate-50 border-transparent opacity-60'}`}>
                    <span className={`text-sm font-black ${item.isActual ? 'text-slate-700' : 'text-slate-400'}`}>{formatTime24(item.time)}</span>
                    {item.isActual ? (
                      <div className="flex items-center gap-1 text-[10px] font-black text-orange-500"><CheckCircle2 size={12}/>{item.volume}ml</div>
                    ) : (
                      <span className="text-[9px] font-black text-slate-300 uppercase">預計</span>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><History size={14}/> 詳細紀錄</h3>
                {!stats.isPast && <span className="text-[10px] font-black text-orange-600 bg-orange-100 px-3 py-1 rounded-full">{stats.dayTotal} ml</span>}
              </div>
              <div className="space-y-3">
                {stats.dayLogs.length === 0 ? (
                  <div className="bg-white border-2 border-dashed border-slate-200 rounded-[40px] py-12 flex flex-col items-center text-slate-400"><p className="text-sm font-black italic">尚無資料</p></div>
                ) : (
                  [...stats.dayLogs].reverse().map((log) => (
                    <div key={log.id} className="bg-white p-5 rounded-[32px] shadow-sm border border-white flex justify-between items-center">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex flex-col items-center justify-center"><span className="text-lg font-black">{log.actualVolume}</span><span className="text-[8px] font-black uppercase">ml</span></div>
                        <div>
                           <p className="text-lg font-black text-slate-700">{formatTime24(log.timestamp)}</p>
                           {log.gapText && <p className="text-[10px] text-orange-400 font-black flex items-center gap-1"><Timer size={10}/> 距離上餐：{log.gapText}</p>}
                        </div>
                      </div>
                      <button onClick={async () => { if(user) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'careLogs', log.id)); }} className="text-slate-200 hover:text-red-500 p-3 bg-slate-50 rounded-full"><Trash2 size={18} /></button>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}

        {activeTab === 'report' && <ReportView logs={logs} babyInfo={babyInfo} />}
        {activeTab === 'settings' && <SettingsPanel babyInfo={babyInfo} onSave={async (d) => { if(user) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'profile', 'main'), d, {merge:true}); setActiveTab('status'); }} />}
      </main>

      <nav className="bg-white border-t p-4 flex justify-around pb-10 shrink-0 z-40">
        <NavBtn active={activeTab === 'status'} onClick={() => setActiveTab('status')} icon={<Clock />} label="今日" />
        <NavBtn active={activeTab === 'report'} onClick={() => setActiveTab('report')} icon={<BarChart3 />} label="統計" />
        <NavBtn active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings />} label="設定" />
      </nav>

      {showModal && (
        <MilkModal 
          babyInfo={babyInfo} 
          defaultDate={viewDate}
          onClose={() => setShowModal(false)} 
          onSubmit={async (actual, time, dateStr) => {
            if (!user) return;
            const [h, m] = time.split(':').map(Number);
            const dObj = new Date(dateStr); dObj.setHours(h, m, 0, 0);
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'careLogs'), { type: 'milk', actualVolume: Number(actual), timestamp: Timestamp.fromDate(dObj) });
            setShowModal(false);
          }} 
        />
      )}
    </div>
  );
};

const NavBtn = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1.5 flex-1 ${active ? 'text-orange-500 scale-105' : 'text-slate-300'}`}>
    {React.cloneElement(icon, { size: 22, strokeWidth: active ? 3 : 2 })}
    <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

const ReportView = ({ logs, babyInfo }) => {
  const chartData = useMemo(() => {
    const days = {};
    const last7Days = [];
    for(let i=6; i>=0; i--) {
      const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i);
      const key = getLocalDateString(d);
      last7Days.push({ key, label: `${d.getMonth()+1}/${d.getDate()}`, total: 0 });
    }
    logs.forEach(l => {
      if (!l.timestamp) return;
      const k = getLocalDateString(l.timestamp.toDate());
      if(days[k] === undefined) days[k] = 0;
      days[k] += Number(l.actualVolume) || 0;
    });
    return last7Days.map(d => ({ ...d, total: days[d.key] || 0 }));
  }, [logs]);

  const maxVal = Math.max(...chartData.map(d => d.total), babyInfo.dailyTarget, 500);

  return (
    <section className="space-y-8 animate-in fade-in pb-20">
      <div className="px-1"><h2 className="text-2xl font-black text-slate-800">數據統計</h2><p className="text-[10px] text-slate-300 font-black uppercase tracking-widest mt-1">最近 7 日趨勢</p></div>
      <div className="bg-white p-6 rounded-[40px] shadow-sm border border-white h-72 flex flex-col">
        <div className="flex justify-between items-center mb-6"><div className="flex items-center gap-2 text-orange-500"><TrendingUp size={16} /> <span className="text-xs font-black">日奶量 (ML)</span></div><div className="text-[9px] font-black text-slate-400 bg-slate-50 px-3 py-1 rounded-full">目標：{babyInfo.dailyTarget}ml</div></div>
        <div className="flex-1 flex items-end justify-around gap-2 px-2 pb-8 relative border-b border-slate-50">
           <div className="absolute left-0 w-full border-t border-dashed border-orange-200" style={{ bottom: `${(babyInfo.dailyTarget / maxVal) * 100}%` }}></div>
           {chartData.map((d, i) => {
              const heightPct = d.total > 0 ? (d.total / maxVal) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                  <div className={`w-full max-w-[20px] rounded-t-md transition-all duration-500 ${d.total >= babyInfo.dailyTarget ? 'bg-orange-500' : 'bg-orange-200'}`} style={{ height: `${Math.max(heightPct, d.total > 0 ? 5 : 0)}%` }}></div>
                  <span className="absolute top-full mt-2 text-[9px] font-black text-slate-400 whitespace-nowrap">{d.label}</span>
                </div>
              );
           })}
        </div>
      </div>
    </section>
  );
};

const SettingsPanel = ({ babyInfo, onSave }) => {
  const [f, setF] = useState({ 
    ...babyInfo, 
    quickVolumes: babyInfo.quickVolumes || [60, 120, 180, 240] 
  });
  const [statusMsg, setStatusMsg] = useState("");

  const toggleNotification = async () => {
    if (f.enableNotifications) { setF({ ...f, enableNotifications: false }); return; }
    let perm = "default";
    if ("Notification" in window) {
      try { perm = Notification.permission; if (perm !== "granted" && perm !== "denied") perm = await Notification.requestPermission(); } catch(e){}
    }
    setF({ ...f, enableNotifications: true });
    setStatusMsg(perm === "granted" ? "系統通知已開啟！" : "系統阻擋請求。已自動啟用 App 內彈窗提醒模式！");
    setTimeout(() => setStatusMsg(""), 3000);
  };

  const updateQuickVolume = (index, val) => {
    const newVols = [...f.quickVolumes];
    newVols[index] = Number(val);
    setF({ ...f, quickVolumes: newVols });
  };

  return (
    <section className="space-y-6 pb-24 animate-in fade-in">
      <div className="px-1"><h2 className="text-2xl font-black text-slate-800">設定</h2></div>
      <div className="bg-white p-7 rounded-[40px] shadow-sm space-y-6 border border-white">
        <div className="bg-orange-50 p-5 rounded-[32px] border border-orange-100 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3"><div className={`p-2 rounded-xl ${f.enableNotifications ? 'bg-orange-500 text-white' : 'bg-orange-200 text-orange-400'}`}><BellRing size={18} /></div><div><p className="text-sm font-black text-slate-700">自動倒數提醒</p><p className="text-[9px] font-bold text-orange-400">推播通知 / 畫面彈窗</p></div></div>
            <button onClick={toggleNotification} className={`w-14 h-7 rounded-full flex items-center transition-all px-1 ${f.enableNotifications ? 'bg-orange-500 justify-end' : 'bg-slate-200 justify-start'}`}><div className="w-5 h-5 bg-white rounded-full shadow-md"></div></button>
          </div>
          {statusMsg && <div className="text-[10px] font-black px-3 py-2 rounded-xl bg-white text-orange-600 border border-orange-100">{statusMsg}</div>}
        </div>

        <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase ml-1">寶寶名稱</label><input className="w-full bg-slate-50 p-4 rounded-2xl border-none font-black text-slate-700" value={f.name} onChange={e => setF({...f, name: e.target.value})} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase ml-1">建議間隔 (HR)</label><input type="number" step="0.5" className="w-full bg-slate-50 p-4 rounded-2xl border-none font-black text-slate-700" value={f.intervalHours} onChange={e => setF({...f, intervalHours: e.target.value})} /></div>
          <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase ml-1">預設奶量 (ML)</label><input type="number" className="w-full bg-orange-50 p-4 rounded-2xl border-none font-black text-orange-600" value={f.standardVolume} onChange={e => setF({...f, standardVolume: e.target.value})} /></div>
        </div>

        <div className="space-y-2 pt-2 border-t border-slate-50">
           <label className="text-[9px] font-black text-slate-300 uppercase ml-1">自訂快捷奶量按鈕 (ML)</label>
           <div className="grid grid-cols-4 gap-2">
             {f.quickVolumes.map((vol, idx) => (
               <input key={idx} type="number" className="w-full bg-slate-50 p-3 rounded-xl border-none font-black text-slate-700 text-center text-sm" value={vol} onChange={e => updateQuickVolume(idx, e.target.value)} />
             ))}
           </div>
        </div>

        <div className="space-y-4 pt-2 border-t border-slate-50">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Clock size={12}/> 長睡眠時段 (不計入行程預測)</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase ml-1">睡眠開始</label><input type="time" className="w-full bg-slate-50 p-4 rounded-2xl border-none font-black text-slate-700" value={f.sleepStart} onChange={e => setF({...f, sleepStart: e.target.value})} /></div>
            <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase ml-1">睡眠結束 (起床)</label><input type="time" className="w-full bg-slate-50 p-4 rounded-2xl border-none font-black text-slate-700" value={f.sleepEnd} onChange={e => setF({...f, sleepEnd: e.target.value})} /></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-50">
          <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase ml-1">每日目標 (ML)</label><input type="number" className="w-full bg-slate-50 p-4 rounded-2xl border-none font-black text-slate-700" value={f.dailyTarget} onChange={e => setF({...f, dailyTarget: e.target.value})} /></div>
          <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase ml-1">1匙奶粉配多少水 (ML)</label><input type="number" className="w-full bg-slate-50 p-4 rounded-2xl border-none font-black text-slate-700" value={f.mlPerScoop} onChange={e => setF({...f, mlPerScoop: e.target.value})} /></div>
        </div>
        <button onClick={() => onSave(f)} className="w-full bg-orange-500 text-white py-5 rounded-[28px] font-black shadow-lg mt-4 active:scale-95 transition-all">儲存設定</button>
      </div>
    </section>
  );
};

const MilkModal = ({ babyInfo, defaultDate, onClose, onSubmit }) => {
  const [vol, setVol] = useState(String(babyInfo?.standardVolume || 120));
  const [dStr, setDStr] = useState(getLocalDateString(defaultDate));
  const [tStr, setTStr] = useState(`${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`);

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-end sm:items-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-sm mx-auto rounded-[48px] p-8 space-y-6 animate-in slide-in-from-bottom-10" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center"><h3 className="text-2xl font-black text-slate-800">新增食奶紀錄</h3><button onClick={onClose} className="text-slate-300 font-bold">✕</button></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 p-4 rounded-2xl"><span className="text-[8px] font-black text-slate-300 uppercase block mb-1">日期</span><input type="date" className="w-full bg-transparent border-none font-black text-slate-700 p-0 text-xs" value={dStr} onChange={e => setDStr(e.target.value)} /></div>
          <div className="bg-slate-50 p-4 rounded-2xl"><span className="text-[8px] font-black text-slate-300 uppercase block mb-1">時間</span><input type="time" className="w-full bg-transparent border-none font-black text-slate-700 p-0 text-sm" value={tStr} onChange={e => setTStr(e.target.value)} /></div>
        </div>
        <div className="space-y-6 text-center">
           <div className="flex items-center justify-between gap-4">
              <button onClick={() => setVol(s => String(Math.max(0, Number(s)-10)))} className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400"><Minus size={24} strokeWidth={3} /></button>
              <div className="flex-1">
                <input type="text" className="w-full text-6xl font-black text-orange-500 bg-transparent text-center border-none p-0 outline-none" value={vol} onChange={e => setVol(e.target.value.replace(/\D/g,''))} />
              </div>
              <button onClick={() => setVol(s => String(Number(s)+10))} className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400"><Plus size={24} strokeWidth={3} /></button>
           </div>
           
           <div className="grid grid-cols-4 gap-2">
              {(babyInfo?.quickVolumes || [60, 120, 180, 240]).map(v => (
                <button key={v} onClick={() => setVol(String(v))} className={`py-4 rounded-2xl text-xs font-black ${Number(vol) === Number(v) ? 'bg-orange-500 text-white' : 'bg-slate-50 text-slate-400'}`}>{v}</button>
              ))}
           </div>
        </div>
        <button onClick={() => onSubmit(vol, tStr, dStr)} className="w-full bg-orange-600 text-white py-6 rounded-[32px] font-black text-lg shadow-xl active:scale-95 transition-all">儲存紀錄</button>
      </div>
    </div>
  );
};

export default App;