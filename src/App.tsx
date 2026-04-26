import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  addDoc, 
  deleteDoc,
  updateDoc,
  Timestamp
} from 'firebase/firestore';
import { 
  Clock, Plus, Settings, BarChart3, Trash2, Minus, ChevronLeft, ChevronRight, 
  CalendarDays, Timer, Baby, TrendingUp, BellRing, History, CheckCircle2, 
  FlaskConical, Lock, Unlock, Share2, LogOut, Mail, KeyRound, AlertCircle, MessageSquareText,
  Edit2, Scale, ListPlus, PlusCircle
} from 'lucide-react';

// --- 解決 Vercel TypeScript 編譯錯誤 ---
declare const __firebase_config: any;
declare const __app_id: any;
declare const __initial_auth_token: any;

let firebaseConfig: any;
if (typeof __firebase_config !== 'undefined') {
  firebaseConfig = JSON.parse(__firebase_config);
} else {
  firebaseConfig = {
    apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || "",
    authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: import.meta.env?.VITE_FIREBASE_APP_ID || ""
  };
}

let app: any = null;
let auth: any = null;
let db: any = null;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase 初始化失敗，請檢查是否已設定環境變數", error);
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'hazel-baby-tracker';

const getLocalDateString = (date: any) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatTime24 = (dateInput: any) => {
  if (!dateInput) return "--:--";
  let d = (dateInput instanceof Date) ? dateInput : (dateInput?.toDate ? dateInput.toDate() : new Date(dateInput));
  return d.toLocaleTimeString('zh-HK', { hour12: false, hour: '2-digit', minute: '2-digit' });
};

const getAgeString = (dobStr: string, targetDateStr?: string) => {
  if (!dobStr) return "";
  const dob = new Date(dobStr);
  const now = targetDateStr ? new Date(targetDateStr) : new Date();
  if (dob > now) return '尚未出生';

  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();
  let days = now.getDate() - dob.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  if (years === 0) {
    return `${months}個月 ${days}日`;
  } else {
    return `${years}歲 ${months}個月`;
  }
};

const getAgeInMonthsDecimal = (dobStr: string, targetDateStr: string) => {
  if (!dobStr) return 0;
  const bDate = new Date(dobStr);
  const tDate = new Date(targetDateStr);
  if (tDate < bDate) return 0;
  const diffMs = tDate.getTime() - bDate.getTime();
  return diffMs / (1000 * 60 * 60 * 24 * 30.4375);
};

// HK2020 女孩體重 (0-2歲)
const hk2020GirlsWeight = [
  { m: 0, p: [2.3, 2.5, 2.7, 2.9, 3.2, 3.5, 3.7, 3.9, 4.1] },
  { m: 1, p: [3.1, 3.3, 3.6, 3.9, 4.2, 4.6, 4.9, 5.2, 5.5] },
  { m: 2, p: [3.8, 4.1, 4.4, 4.8, 5.2, 5.6, 6.0, 6.4, 6.7] },
  { m: 3, p: [4.4, 4.7, 5.1, 5.5, 5.9, 6.4, 6.8, 7.2, 7.6] },
  { m: 4, p: [4.9, 5.3, 5.7, 6.1, 6.5, 7.1, 7.5, 7.9, 8.3] },
  { m: 5, p: [5.3, 5.7, 6.1, 6.6, 7.0, 7.6, 8.1, 8.5, 9.0] },
  { m: 6, p: [5.7, 6.1, 6.5, 7.0, 7.5, 8.1, 8.6, 9.1, 9.6] },
  { m: 8, p: [6.3, 6.7, 7.2, 7.7, 8.2, 8.9, 9.5, 10.0, 10.6] },
  { m: 10, p: [6.7, 7.2, 7.7, 8.2, 8.8, 9.5, 10.2, 10.8, 11.3] },
  { m: 12, p: [7.1, 7.6, 8.1, 8.7, 9.4, 10.1, 10.8, 11.5, 12.0] },
  { m: 14, p: [7.5, 8.0, 8.6, 9.2, 9.8, 10.6, 11.3, 12.1, 12.7] },
  { m: 16, p: [7.8, 8.3, 8.9, 9.6, 10.3, 11.1, 11.9, 12.7, 13.3] },
  { m: 18, p: [8.1, 8.7, 9.3, 10.0, 10.7, 11.6, 12.4, 13.2, 13.8] },
  { m: 20, p: [8.4, 9.0, 9.6, 10.4, 11.1, 12.0, 12.9, 13.7, 14.4] },
  { m: 22, p: [8.6, 9.3, 10.0, 10.7, 11.5, 12.4, 13.4, 14.2, 14.9] },
  { m: 24, p: [8.9, 9.6, 10.3, 11.1, 11.9, 12.9, 13.8, 14.6, 15.3] }
];
const percentilesLabels = ["0.4th", "2nd", "9th", "25th", "50th", "75th", "91st", "98th", "99.6th"];

const calculatePercentile = (ageMonths: number, weight: number) => {
  if (ageMonths < 0) return "時間錯誤";
  if (ageMonths > 24) return "超出生長線範圍(0-2歲)";
  
  let lower = hk2020GirlsWeight[0];
  let upper = hk2020GirlsWeight[hk2020GirlsWeight.length - 1];
  
  for (let i = 0; i < hk2020GirlsWeight.length - 1; i++) {
    if (ageMonths >= hk2020GirlsWeight[i].m && ageMonths <= hk2020GirlsWeight[i+1].m) {
      lower = hk2020GirlsWeight[i];
      upper = hk2020GirlsWeight[i+1];
      break;
    }
  }
  
  const ratio = upper.m === lower.m ? 0 : (ageMonths - lower.m) / (upper.m - lower.m);
  const interpP = lower.p.map((val, idx) => val + (upper.p[idx] - val) * ratio);
  
  if (weight < interpP[0]) return "< 0.4th";
  if (weight > interpP[8]) return "> 99.6th";
  
  for (let i = 0; i < 8; i++) {
    if (weight >= interpP[i] && weight <= interpP[i+1]) {
      const d1 = weight - interpP[i];
      const d2 = interpP[i+1] - weight;
      return d1 < d2 ? percentilesLabels[i] : percentilesLabels[i+1];
    }
  }
  return "計算異常";
};

const GrowthChart = ({ weightLogs }: { weightLogs: any[] }) => {
  const W = 600;
  const H = 400;
  const padL = 35;
  const padR = 45;
  const padT = 20;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const getX = (m: number) => padL + (m / 24) * innerW;
  const getY = (w: number) => H - padB - ((w - 2) / 14) * innerH;

  const xTicks = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];
  const yTicks = [2, 4, 6, 8, 10, 12, 14, 16];

  const validLogs = weightLogs
    .filter(l => l.ageMonths !== undefined && l.ageMonths >= 0 && l.ageMonths <= 24)
    .sort((a, b) => a.ageMonths - b.ageMonths);

  return (
    <div className="bg-white p-4 rounded-[32px] shadow-sm border border-slate-50 mb-6 overflow-x-auto">
      <div className="min-w-[450px]">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto font-sans">
          {yTicks.map(y => (
            <g key={`y-${y}`}>
              <line x1={padL} y1={getY(y)} x2={W - padR + 10} y2={getY(y)} stroke="#f1f5f9" strokeWidth="1" />
              <text x={padL - 5} y={getY(y)} fill="#94a3b8" fontSize="10" textAnchor="end" dominantBaseline="middle">{y}</text>
            </g>
          ))}
          {xTicks.map(x => (
            <g key={`x-${x}`}>
              <line x1={getX(x)} y1={padT} x2={getX(x)} y2={H - padB} stroke="#f1f5f9" strokeWidth="1" />
              <text x={getX(x)} y={H - padB + 15} fill="#94a3b8" fontSize="10" textAnchor="middle">{x}</text>
            </g>
          ))}
          
          <text x={padL + innerW / 2} y={H - 5} fill="#94a3b8" fontSize="10" textAnchor="middle" fontWeight="bold">年齡 (月)</text>
          <text x={15} y={padT - 5} fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle">體重(kg)</text>

          {percentilesLabels.map((label, pIdx) => {
            const points = hk2020GirlsWeight.map(d => `${getX(d.m)},${getY(d.p[pIdx])}`).join(' L ');
            const is50th = pIdx === 4;
            return (
              <g key={label}>
                <path d={`M ${points}`} fill="none" stroke={is50th ? '#f472b6' : '#fbcfe8'} strokeWidth={is50th ? 2 : 1} />
                <text x={getX(24) + 4} y={getY(hk2020GirlsWeight[hk2020GirlsWeight.length - 1].p[pIdx])} fill={is50th ? '#ec4899' : '#f9a8d4'} fontSize="9" dominantBaseline="middle" fontWeight={is50th ? 'bold' : 'normal'}>{label}</text>
              </g>
            );
          })}

          {validLogs.length > 0 && (
            <path d={`M ${validLogs.map(l => `${getX(l.ageMonths)},${getY(l.weight)}`).join(' L ')}`} fill="none" stroke="#10b981" strokeWidth="2.5" />
          )}
          {validLogs.map(log => (
            <circle key={log.id} cx={getX(log.ageMonths)} cy={getY(log.weight)} r="4.5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
          ))}
        </svg>
      </div>
    </div>
  );
};

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!firebaseConfig.apiKey && typeof __firebase_config === 'undefined') {
    return (
      <div className="w-full h-[100dvh] bg-red-50 flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-red-700 mb-2">系統錯誤：缺少 Firebase 金鑰</h2>
        <p className="text-sm text-red-500 font-bold max-w-xs">
          請在 Vercel 後台設定 <code>VITE_FIREBASE_API_KEY</code> 等環境變數。
        </p>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setError('');
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error(err);
      setError('登入失敗，請檢查帳號密碼是否正確。');
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-[100dvh] bg-orange-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm bg-white rounded-[40px] p-8 shadow-xl border border-orange-100 space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 bg-orange-500 rounded-[28px] flex items-center justify-center text-white shadow-lg shadow-orange-200">
            <Baby size={48} strokeWidth={2} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">專屬育兒紀錄</h1>
            <p className="text-xs font-bold text-slate-400 mt-1">請登入家庭專屬帳號</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold border border-red-100">
            <AlertCircle size={16} className="shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">電子郵件</label>
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="email" 
                required
                className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 font-bold text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                placeholder="family@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">密碼</label>
            <div className="relative">
              <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="password" 
                required
                className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-4 font-bold text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-orange-200 active:scale-95 transition-all mt-4 disabled:opacity-50"
          >
            {isLoading ? '登入中...' : '登入系統'}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- 主應用程式 ---
const App = () => {
  const [user, setUser] = useState<any>(undefined);
  const [babyInfo, setBabyInfo] = useState<any>({
    name: '寶寶',
    birthDate: '', 
    intervalHours: 4,
    standardVolume: 120, 
    mlPerScoop: 30,      
    dailyTarget: 800,    
    sleepStart: "22:00",
    sleepEnd: "06:00",
    quickVolumes: [60, 120, 180, 240],
    enableNotifications: false,
    defaultMixingWater: 120
  });
  const [logs, setLogs] = useState<any[]>([]);
  const [weightLogs, setWeightLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('status'); 
  
  const [showModal, setShowModal] = useState(false); 
  const [showBulkModal, setShowBulkModal] = useState(false); 
  const [editingLog, setEditingLog] = useState<any>(null);
  
  const [viewDate, setViewDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [mixingWater, setMixingWater] = useState(120);
  const [isMixingLocked, setIsMixingLocked] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!auth) {
      setUser(null);
      return;
    }
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try { await signInWithCustomToken(auth, __initial_auth_token); } catch(e){}
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (u: any) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;

    const babyRef = doc(db, 'artifacts', appId, 'public', 'data', 'profile', 'main');
    const unsubBaby = onSnapshot(babyRef, (s: any) => {
      if (s.exists()) setBabyInfo((p: any) => ({ ...p, ...s.data() }));
    });

    const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'careLogs');
    const unsubLogs = onSnapshot(logsRef, (s: any) => {
      const data = s.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      setLogs(data.sort((a: any, b: any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
    }, (error: any) => console.error("Firestore Error:", error));

    const weightsRef = collection(db, 'artifacts', appId, 'public', 'data', 'weightLogs');
    const unsubWeights = onSnapshot(weightsRef, (s: any) => {
      const data = s.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      setWeightLogs(data.sort((a: any, b: any) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
    }, (error: any) => console.error("Firestore Weight Error:", error));

    return () => { unsubBaby(); unsubLogs(); unsubWeights(); };
  }, [user]);

  useEffect(() => {
    if (isMixingLocked && babyInfo?.defaultMixingWater !== undefined) {
      setMixingWater(babyInfo.defaultMixingWater);
    }
  }, [babyInfo?.defaultMixingWater, isMixingLocked]);

  const toggleMixingLock = async () => {
    const nextLocked = !isMixingLocked;
    setIsMixingLocked(nextLocked);
    if (nextLocked && user && db) {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'profile', 'main'), { defaultMixingWater: mixingWater }, { merge: true });
    }
  };

  const handleLogout = async () => {
    if(auth && window.confirm("確定要登出嗎？")) await signOut(auth);
  };

  const handleOpenAddModal = () => {
    setEditingLog(null);
    setShowModal(true);
  };

  const handleEditLog = (log: any) => {
    setEditingLog(log);
    setShowModal(true);
  };

  const stats = useMemo(() => {
    const selectedDateStr = getLocalDateString(viewDate);
    const todayStr = getLocalDateString(currentTime);
    const isToday = selectedDateStr === todayStr;
    const isPast = viewDate < new Date(todayStr);

    const dayLogsRaw = logs
      .filter(l => l.type === 'milk' && l.timestamp && getLocalDateString(l.timestamp.toDate()) === selectedDateStr)
      .sort((a, b) => a.timestamp.seconds - b.timestamp.seconds);

    const dayLogsWithGap = dayLogsRaw.map((log, index) => {
      let gapText = "";
      let prevLog = (index > 0) ? dayLogsRaw[index - 1] : logs.find(l => l.timestamp && l.timestamp.seconds < log.timestamp.seconds);
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

    const isSleeping = (date: Date) => {
      const mins = date.getHours() * 60 + date.getMinutes();
      return sStartMins > sEndMins 
        ? (mins >= sStartMins || mins <= sEndMins) 
        : (mins >= sStartMins && mins <= sEndMins);
    };

    let timeline: any[] = [];
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

    const fullSchedule = timeline.sort((a,b) => a.time.getTime() - b.time.getTime());

    let nextMeal = null;
    if (isToday || viewDate > new Date(todayStr)) {
      const target = fullSchedule.find(i => !i.isActual && i.time > new Date(currentTime.getTime() - 20 * 60000));
      if (target) {
        const diffMin = Math.floor((target.time.getTime() - currentTime.getTime()) / 60000);
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
       const diffMin = Math.floor((currentTime.getTime() - lastActualTime.getTime()) / 60000);
       if (diffMin >= 0) {
         lastMealInfo = { text: `${Math.floor(diffMin/60)}時${diffMin%60}分` };
       }
    }

    return { dayLogs: dayLogsWithGap, dayTotal: totalMl, schedule: fullSchedule, nextMeal, isPast, lastMealInfo };
  }, [logs, babyInfo, viewDate, currentTime]);

  const shareScheduleViaWhatsApp = () => {
    const dateStr = viewDate.toLocaleDateString('zh-HK', { month: 'numeric', day: 'numeric', weekday: 'short' });
    let text = `[ ${babyInfo.name} 食奶預測行程 (${dateStr}) ]\n\n`;
    stats.schedule.forEach(item => {
      const tStr = formatTime24(item.time);
      if (item.isActual) text += `(已食) ${tStr} - ${item.volume}ml\n`;
      else text += `(預計) ${tStr}\n`;
    });
    text += `\n* 當日總量: ${stats.dayTotal}ml (目標: ${babyInfo.dailyTarget}ml)`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareScheduleViaWhatsAppEN = () => {
    const dateStr = viewDate.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', weekday: 'short' });
    let text = `[ ${babyInfo.name}'s Milk Schedule (${dateStr}) ]\n\n`;
    stats.schedule.forEach(item => {
      const tStr = formatTime24(item.time);
      if (item.isActual) text += `(Fed) ${tStr} - ${item.volume}ml\n`;
      else text += `(Est.) ${tStr}\n`;
    });
    text += `\n* Daily Total: ${stats.dayTotal}ml (Target: ${babyInfo.dailyTarget}ml)`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (user === undefined) return <div className="w-full h-[100dvh] bg-orange-50 flex items-center justify-center"><Baby className="text-orange-500 animate-bounce" size={48} /></div>;
  if (user === null) return <LoginScreen />;

  return (
    <div className="w-full md:max-w-md mx-auto h-[100dvh] bg-slate-50 flex flex-col font-sans overflow-hidden relative shadow-2xl">
      <div className="bg-slate-800 text-slate-200 px-4 py-1.5 flex justify-between items-center text-[10px] shrink-0 z-40">
        <span className="font-bold tracking-widest uppercase">現在時間</span>
        <span className="font-mono font-black">{currentTime.toLocaleString('zh-HK', { hour12: false })}</span>
      </div>

      <header className="bg-white border-b shrink-0 z-30 shadow-sm">
        <div className="px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-2xl flex items-center justify-center text-white shadow-lg"><Baby size={22} strokeWidth={2.5} /></div>
            <div>
              <h1 className="font-black text-slate-800 text-lg flex items-center gap-2">
                {babyInfo.name}
                {babyInfo.birthDate && (
                  <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-md leading-none">
                    {getAgeString(babyInfo.birthDate)}
                  </span>
                )}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowBulkModal(true)} className="p-2.5 text-slate-400 bg-slate-50 hover:bg-orange-50 hover:text-orange-500 rounded-xl transition-colors active:scale-95">
              <ListPlus size={20} strokeWidth={2.5} />
            </button>
            <button onClick={handleOpenAddModal} className="bg-orange-500 text-white px-4 py-2.5 rounded-xl flex items-center gap-1.5 active:scale-95 transition-all shadow-md">
              <Plus size={18} strokeWidth={3} /><span className="text-sm font-black">單筆</span>
            </button>
          </div>
        </div>
        {activeTab === 'status' && (
          <div className="px-6 pb-4 flex items-center justify-between">
             <button onClick={() => setViewDate(d => new Date(d.setDate(d.getDate()-1)))} className="p-2 text-slate-300 hover:text-orange-500"><ChevronLeft size={24}/></button>
             <div className="flex flex-col items-center cursor-pointer active:scale-95 transition-transform" onClick={() => setViewDate(new Date())}>
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
          <div className="animate-in fade-in space-y-6">
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
                <div className="flex items-center gap-2">
                  <button onClick={shareScheduleViaWhatsAppEN} className="flex items-center gap-1 text-[10px] font-black text-[#25D366] bg-[#25D366]/10 px-2 py-1.5 rounded-full active:scale-95 transition-transform"><Share2 size={12}/> EN</button>
                  <button onClick={shareScheduleViaWhatsApp} className="flex items-center gap-1.5 text-[10px] font-black text-[#25D366] bg-[#25D366]/10 px-3 py-1.5 rounded-full active:scale-95 transition-transform"><Share2 size={12}/> 中</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {stats.schedule.map((item: any, idx: number) => (
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
                  [...stats.dayLogs].reverse().map((log: any) => (
                    <div key={log.id} className="bg-white p-5 rounded-[32px] shadow-sm border border-white flex justify-between items-center gap-2">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-14 h-14 shrink-0 bg-orange-50 text-orange-600 rounded-2xl flex flex-col items-center justify-center gap-0.5">
                          <span className="text-xl font-black leading-none">{log.actualVolume}</span>
                          <span className="text-[9px] font-black uppercase leading-none">ml</span>
                        </div>
                        <div className="flex flex-col gap-1 min-w-0">
                           <p className="text-lg font-black text-slate-700 leading-none">{formatTime24(log.timestamp)}</p>
                           {log.gapText && <p className="text-[10px] text-orange-400 font-black flex items-center gap-1"><Timer size={10}/> 距離上餐：{log.gapText}</p>}
                           {log.remarks && (
                             <p className="text-[11px] font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 flex items-center gap-1.5 mt-0.5 truncate">
                               <MessageSquareText size={12} className="shrink-0 text-slate-400" /> 
                               <span className="truncate">{log.remarks}</span>
                             </p>
                           )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button 
                          onClick={() => handleEditLog(log)} 
                          className="text-slate-400 hover:text-orange-500 p-2.5 bg-slate-50 hover:bg-orange-50 rounded-full transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={async () => { if(window.confirm('確定刪除此紀錄？') && db) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'careLogs', log.id)); }} 
                          className="text-slate-300 hover:text-red-500 p-2.5 bg-slate-50 hover:bg-red-50 rounded-full transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'report' && <ReportView logs={logs} babyInfo={babyInfo} />}
        {activeTab === 'growth' && <GrowthView babyInfo={babyInfo} weightLogs={weightLogs} user={user} db={db} />}
        {activeTab === 'settings' && <SettingsPanel babyInfo={babyInfo} userEmail={user?.email} onLogout={handleLogout} onSave={async (d: any) => { if(user && db) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'profile', 'main'), d, {merge:true}); setActiveTab('status'); }} />}
      </main>

      <nav className="bg-white border-t p-4 flex justify-around pb-8 shrink-0 z-40 relative">
        <NavBtn active={activeTab === 'status'} onClick={() => setActiveTab('status')} icon={<Clock />} label="今日" />
        <NavBtn active={activeTab === 'report'} onClick={() => setActiveTab('report')} icon={<BarChart3 />} label="統計" />
        <NavBtn active={activeTab === 'growth'} onClick={() => setActiveTab('growth')} icon={<Scale />} label="生長" />
        <NavBtn active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings />} label="設定" />
      </nav>

      {showModal && (
        <MilkModal 
          babyInfo={babyInfo} 
          defaultDate={viewDate}
          editingLog={editingLog}
          onClose={() => setShowModal(false)} 
          onSubmit={async (actual: any, time: any, dateStr: any, remarks: string, logId?: string) => {
            if (!user || !db) return;
            const [h, m] = time.split(':').map(Number);
            const dObj = new Date(dateStr); dObj.setHours(h, m, 0, 0);
            
            if (logId) {
              await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'careLogs', logId), {
                actualVolume: Number(actual), 
                timestamp: Timestamp.fromDate(dObj),
                remarks: remarks || ""
              });
            } else {
              await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'careLogs'), { 
                type: 'milk', 
                actualVolume: Number(actual), 
                timestamp: Timestamp.fromDate(dObj),
                remarks: remarks || "" 
              });
            }
            setShowModal(false);
          }} 
        />
      )}

      {showBulkModal && (
        <BulkMilkModal
          babyInfo={babyInfo}
          defaultDate={viewDate}
          onClose={() => setShowBulkModal(false)}
          onSubmit={async (dateStr: string, entries: any[]) => {
             if (!user || !db) return;
             const promises = entries.map(entry => {
               const [h, m] = entry.time.split(':').map(Number);
               const dObj = new Date(dateStr); dObj.setHours(h, m, 0, 0);
               return addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'careLogs'), {
                 type: 'milk',
                 actualVolume: Number(entry.volume),
                 timestamp: Timestamp.fromDate(dObj),
                 remarks: entry.remarks || ""
               });
             });
             await Promise.all(promises);
             setShowBulkModal(false);
          }}
        />
      )}
    </div>
  );
};

const NavBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1.5 flex-1 ${active ? 'text-orange-500 scale-105' : 'text-slate-300'}`}>
    {React.cloneElement(icon, { size: 22, strokeWidth: active ? 3 : 2 })}
    <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

const ReportView = ({ logs, babyInfo }: any) => {
  const [rangeMode, setRangeMode] = useState<'7days' | 'month' | 'custom'>('7days');
  const [customStart, setCustomStart] = useState(getLocalDateString(new Date(new Date().setDate(new Date().getDate() - 14))));
  const [customEnd, setCustomEnd] = useState(getLocalDateString(new Date()));

  const chartData = useMemo(() => {
    let startDate = new Date();
    let endDate = new Date();
    
    if (rangeMode === '7days') {
      startDate.setDate(endDate.getDate() - 6);
    } else if (rangeMode === 'month') {
      startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    } else if (rangeMode === 'custom') {
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
      if (startDate > endDate) { const temp = startDate; startDate = endDate; endDate = temp; }
    }
    
    startDate.setHours(0,0,0,0);
    endDate.setHours(23,59,59,999);

    const days: Record<string, number> = {};
    const daysArray = [];
    
    let curr = new Date(startDate);
    while (curr <= endDate) {
      const key = getLocalDateString(curr);
      const label = rangeMode === 'month' ? `${curr.getDate()}日` : `${curr.getMonth()+1}/${curr.getDate()}`;
      daysArray.push({ key, label, total: 0 });
      curr.setDate(curr.getDate() + 1);
      if (daysArray.length > 90) break;
    }

    logs.forEach((l: any) => {
      if (!l.timestamp || l.type !== 'milk') return;
      const logDate = l.timestamp.toDate();
      if (logDate >= startDate && logDate <= endDate) {
        const k = getLocalDateString(logDate);
        if(days[k] === undefined) days[k] = 0;
        days[k] += Number(l.actualVolume) || 0;
      }
    });

    return daysArray.map(d => ({ ...d, total: days[d.key] || 0 }));
  }, [logs, rangeMode, customStart, customEnd]);

  const maxVal = Math.max(...chartData.map(d => d.total), babyInfo.dailyTarget, 500);
  const totalPeriodVol = chartData.reduce((sum, d) => sum + d.total, 0);
  const activeDays = chartData.filter(d => d.total > 0).length;
  const avgVol = activeDays > 0 ? Math.round(totalPeriodVol / activeDays) : 0;

  return (
    <section className="space-y-6 animate-in fade-in pb-20">
      <div className="px-1">
        <h2 className="text-2xl font-black text-slate-800">數據統計</h2>
        <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest mt-1">分析寶寶的食量趨勢</p>
      </div>

      <div className="bg-slate-200/50 p-1 rounded-2xl flex items-center">
        <button onClick={() => setRangeMode('7days')} className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${rangeMode === '7days' ? 'bg-white text-orange-500 shadow-sm' : 'text-slate-400'}`}>近 7 日</button>
        <button onClick={() => setRangeMode('month')} className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${rangeMode === 'month' ? 'bg-white text-orange-500 shadow-sm' : 'text-slate-400'}`}>本月份</button>
        <button onClick={() => setRangeMode('custom')} className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${rangeMode === 'custom' ? 'bg-white text-orange-500 shadow-sm' : 'text-slate-400'}`}>自訂</button>
      </div>

      {rangeMode === 'custom' && (
        <div className="flex gap-3 bg-white p-4 rounded-3xl shadow-sm border border-slate-50 animate-in slide-in-from-top-2">
          <div className="flex-1">
            <label className="text-[9px] font-black text-slate-300 uppercase block mb-1">開始日期</label>
            <input type="date" className="w-full bg-slate-50 border-none font-bold text-slate-600 text-xs rounded-xl p-2 outline-none" value={customStart} onChange={e => setCustomStart(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="text-[9px] font-black text-slate-300 uppercase block mb-1">結束日期</label>
            <input type="date" className="w-full bg-slate-50 border-none font-bold text-slate-600 text-xs rounded-xl p-2 outline-none" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-orange-50 p-4 rounded-[28px] border border-orange-100 flex flex-col items-center justify-center">
          <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">區間日平均</span>
          <p className="text-3xl font-black text-orange-600 mt-1">{avgVol}<span className="text-sm ml-1">ml</span></p>
        </div>
        <div className="bg-white shadow-sm p-4 rounded-[28px] border border-slate-50 flex flex-col items-center justify-center">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">區間總奶量</span>
          <p className="text-3xl font-black text-slate-700 mt-1">{totalPeriodVol}<span className="text-sm ml-1">ml</span></p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[40px] shadow-sm border border-white flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2 text-orange-500"><TrendingUp size={16} /> <span className="text-xs font-black">日奶量趨勢</span></div>
          <div className="text-[9px] font-black text-slate-400 bg-slate-50 px-3 py-1 rounded-full">目標：{babyInfo.dailyTarget}ml</div>
        </div>
        
        <div className="w-full overflow-x-auto scrollbar-hide pb-2">
          <div className="flex items-end justify-start gap-1.5 px-2 relative border-b border-slate-50 h-56" style={{ minWidth: `${Math.max(100, chartData.length * 12)}%` }}>
             <div className="absolute left-0 w-full border-t border-dashed border-orange-200" style={{ bottom: `${(babyInfo.dailyTarget / maxVal) * 100}%` }}></div>
             {chartData.map((d, i) => {
                const heightPct = d.total > 0 ? (d.total / maxVal) * 100 : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative min-w-[20px]">
                    <div className={`w-full max-w-[20px] rounded-t-md transition-all duration-500 ${d.total >= babyInfo.dailyTarget ? 'bg-orange-500' : 'bg-orange-200'}`} style={{ height: `${Math.max(heightPct, d.total > 0 ? 5 : 0)}%` }}></div>
                    <span className="absolute top-full mt-2 text-[8px] font-black text-slate-400 whitespace-nowrap">{d.label}</span>
                  </div>
                );
             })}
          </div>
        </div>
      </div>
    </section>
  );
};

const GrowthView = ({ babyInfo, weightLogs, user, db }: any) => {
  const [weight, setWeight] = useState("");
  const [recordDate, setRecordDate] = useState(getLocalDateString(new Date()));

  const handleSave = async () => {
    if (!user || !db || !weight || !babyInfo.birthDate) {
      if (!babyInfo.birthDate) alert("請先於設定輸入寶寶出生日期以計算年齡");
      return;
    }
    const dObj = new Date(recordDate);
    const ageMonths = getAgeInMonthsDecimal(babyInfo.birthDate, recordDate);
    
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'weightLogs'), {
      weight: Number(weight),
      timestamp: Timestamp.fromDate(dObj),
      ageMonths: ageMonths
    });
    setWeight("");
  };

  return (
    <section className="space-y-6 animate-in fade-in pb-20">
      <div className="px-1">
        <h2 className="text-2xl font-black text-slate-800">生長追蹤</h2>
        <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest mt-1">體重紀錄 (HK2020 女孩生長曲線)</p>
      </div>

      <GrowthChart weightLogs={weightLogs} />

      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-50 space-y-4">
        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase">測量日期</label>
            <input type="date" className="w-full bg-slate-50 p-3 rounded-2xl border-none font-bold text-sm text-slate-700 outline-none" value={recordDate} onChange={e => setRecordDate(e.target.value)} />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase">體重 (kg)</label>
            <input type="number" step="0.1" placeholder="例如: 7.5" className="w-full bg-slate-50 p-3 rounded-2xl border-none font-bold text-sm text-slate-700 outline-none" value={weight} onChange={e => setWeight(e.target.value)} />
          </div>
        </div>
        <button onClick={handleSave} className="w-full bg-emerald-500 text-white py-3.5 rounded-2xl font-black shadow-md shadow-emerald-100 active:scale-95 transition-all">新增體重紀錄</button>
        {!babyInfo?.birthDate && <p className="text-[10px] text-red-500 font-bold text-center">⚠️ 必須在「設定」中填寫出生日期才能計算百分位數</p>}
      </div>

      <div className="space-y-3">
        {weightLogs.length === 0 ? (
          <div className="text-center py-10 text-slate-300 font-black text-sm">尚未有體重紀錄</div>
        ) : (
          weightLogs.map((log: any) => {
            const dateStr = log.timestamp?.toDate ? getLocalDateString(log.timestamp.toDate()) : '';
            const percentile = calculatePercentile(log.ageMonths, log.weight);
            const ageDisplay = getAgeString(babyInfo?.birthDate, dateStr);
            
            return (
              <div key={log.id} className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex flex-col items-center justify-center">
                    <span className="text-lg font-black leading-none">{log.weight}</span>
                    <span className="text-[8px] font-black uppercase mt-0.5">kg</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-slate-700">{dateStr}</p>
                      <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold">{ageDisplay}</span>
                    </div>
                    <p className="text-[11px] font-black text-emerald-500 mt-1 tracking-widest">{percentile} Percentile</p>
                  </div>
                </div>
                <button onClick={async () => { if(window.confirm('確定刪除此體重紀錄？') && db) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'weightLogs', log.id)); }} className="text-slate-300 hover:text-red-500 p-2 transition-colors"><Trash2 size={16} /></button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};

const SettingsPanel = ({ babyInfo, onSave, userEmail, onLogout }: any) => {
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

  const updateQuickVolume = (index: number, val: any) => {
    const newVols = [...f.quickVolumes];
    newVols[index] = Number(val);
    setF({ ...f, quickVolumes: newVols });
  };

  return (
    <section className="space-y-6 pb-24 animate-in fade-in">
      <div className="px-1 flex justify-between items-center">
        <h2 className="text-2xl font-black text-slate-800">設定</h2>
        <button onClick={onLogout} className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 bg-slate-200 px-3 py-1.5 rounded-full active:scale-95 transition-transform"><LogOut size={12}/> 登出</button>
      </div>

      <div className="bg-white p-7 rounded-[40px] shadow-sm space-y-6 border border-white">
        
        <div className="bg-slate-50 p-4 rounded-3xl flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-500"><Mail size={18}/></div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">目前登入帳號</p>
            <p className="text-sm font-bold text-slate-700">{userEmail || '使用者'}</p>
          </div>
        </div>

        <div className="bg-orange-50 p-5 rounded-[32px] border border-orange-100 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3"><div className={`p-2 rounded-xl ${f.enableNotifications ? 'bg-orange-500 text-white' : 'bg-orange-200 text-orange-400'}`}><BellRing size={18} /></div><div><p className="text-sm font-black text-slate-700">自動倒數提醒</p><p className="text-[9px] font-bold text-orange-400">推播通知 / 畫面彈窗</p></div></div>
            <button onClick={toggleNotification} className={`w-14 h-7 rounded-full flex items-center transition-all px-1 ${f.enableNotifications ? 'bg-orange-500 justify-end' : 'bg-slate-200 justify-start'}`}><div className="w-5 h-5 bg-white rounded-full shadow-md"></div></button>
          </div>
          {statusMsg && <div className="text-[10px] font-black px-3 py-2 rounded-xl bg-white text-orange-600 border border-orange-100">{statusMsg}</div>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase ml-1">寶寶名稱</label><input className="w-full bg-slate-50 p-4 rounded-2xl border-none font-black text-slate-700 outline-none focus:ring-2 focus:ring-orange-500" value={f.name} onChange={e => setF({...f, name: e.target.value})} /></div>
          <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase ml-1">出生日期</label><input type="date" className="w-full bg-slate-50 p-4 rounded-2xl border-none font-black text-slate-700 outline-none focus:ring-2 focus:ring-orange-500" value={f.birthDate || ''} onChange={e => setF({...f, birthDate: e.target.value})} /></div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase ml-1">建議間隔 (HR)</label><input type="number" step="0.5" className="w-full bg-slate-50 p-4 rounded-2xl border-none font-black text-slate-700 outline-none focus:ring-2 focus:ring-orange-500" value={f.intervalHours} onChange={e => setF({...f, intervalHours: e.target.value})} /></div>
          <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase ml-1">預設奶量 (ML)</label><input type="number" className="w-full bg-orange-50 p-4 rounded-2xl border-none font-black text-orange-600 outline-none focus:ring-2 focus:ring-orange-500" value={f.standardVolume} onChange={e => setF({...f, standardVolume: e.target.value})} /></div>
        </div>

        <div className="space-y-2 pt-2 border-t border-slate-50">
           <label className="text-[9px] font-black text-slate-300 uppercase ml-1">自訂快捷奶量按鈕 (ML)</label>
           <div className="grid grid-cols-4 gap-2">
             {f.quickVolumes.map((vol: any, idx: number) => (
               <input key={idx} type="number" className="w-full bg-slate-50 p-3 rounded-xl border-none font-black text-slate-700 text-center text-sm outline-none focus:ring-2 focus:ring-orange-500" value={vol} onChange={e => updateQuickVolume(idx, e.target.value)} />
             ))}
           </div>
        </div>

        <div className="space-y-4 pt-2 border-t border-slate-50">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Clock size={12}/> 長睡眠時段 (不計入行程預測)</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase ml-1">睡眠開始</label><input type="time" className="w-full bg-slate-50 p-4 rounded-2xl border-none font-black text-slate-700 outline-none focus:ring-2 focus:ring-orange-500" value={f.sleepStart} onChange={e => setF({...f, sleepStart: e.target.value})} /></div>
            <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase ml-1">睡眠結束 (起床)</label><input type="time" className="w-full bg-slate-50 p-4 rounded-2xl border-none font-black text-slate-700 outline-none focus:ring-2 focus:ring-orange-500" value={f.sleepEnd} onChange={e => setF({...f, sleepEnd: e.target.value})} /></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-50">
          <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase ml-1">每日目標 (ML)</label><input type="number" className="w-full bg-slate-50 p-4 rounded-2xl border-none font-black text-slate-700 outline-none focus:ring-2 focus:ring-orange-500" value={f.dailyTarget} onChange={e => setF({...f, dailyTarget: e.target.value})} /></div>
          <div className="space-y-2"><label className="text-[9px] font-black text-slate-300 uppercase ml-1">1匙奶粉配多少水 (ML)</label><input type="number" className="w-full bg-slate-50 p-4 rounded-2xl border-none font-black text-slate-700 outline-none focus:ring-2 focus:ring-orange-500" value={f.mlPerScoop} onChange={e => setF({...f, mlPerScoop: e.target.value})} /></div>
        </div>
        <button onClick={() => onSave(f)} className="w-full bg-orange-500 text-white py-5 rounded-[28px] font-black shadow-lg mt-4 active:scale-95 transition-all">儲存設定</button>
      </div>
    </section>
  );
};

const MilkModal = ({ babyInfo, defaultDate, editingLog, onClose, onSubmit }: any) => {
  const initialVol = editingLog ? String(editingLog.actualVolume) : String(babyInfo?.standardVolume || 120);
  const initialDateStr = editingLog ? getLocalDateString(editingLog.timestamp.toDate()) : getLocalDateString(defaultDate);
  
  let initialTimeStr = "";
  if (editingLog) {
    const d = editingLog.timestamp.toDate();
    initialTimeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } else {
    initialTimeStr = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
  }

  const initialRemarks = editingLog ? (editingLog.remarks || "") : "";

  const [vol, setVol] = useState(initialVol);
  const [dStr, setDStr] = useState(initialDateStr);
  const [tStr, setTStr] = useState(initialTimeStr);
  const [remarks, setRemarks] = useState(initialRemarks);

  const isEditing = !!editingLog;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-end sm:items-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-sm mx-auto rounded-[48px] p-8 space-y-5 animate-in slide-in-from-bottom-10" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h3 className="text-2xl font-black text-slate-800">{isEditing ? '編輯紀錄' : '新增單筆紀錄'}</h3>
          <button onClick={onClose} className="text-slate-300 font-bold p-2 hover:bg-slate-100 rounded-full">✕</button>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 p-3 rounded-2xl"><span className="text-[8px] font-black text-slate-300 uppercase block mb-1">日期</span><input type="date" className="w-full bg-transparent border-none font-black text-slate-700 p-0 text-xs outline-none" value={dStr} onChange={e => setDStr(e.target.value)} /></div>
          <div className="bg-slate-50 p-3 rounded-2xl"><span className="text-[8px] font-black text-slate-300 uppercase block mb-1">時間</span><input type="time" className="w-full bg-transparent border-none font-black text-slate-700 p-0 text-sm outline-none" value={tStr} onChange={e => setTStr(e.target.value)} /></div>
        </div>

        <div className="space-y-4 text-center">
           <div className="flex items-center justify-between gap-4">
              <button type="button" onClick={() => setVol(s => String(Math.max(0, Number(s)-5)))} className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 active:bg-slate-200"><Minus size={24} strokeWidth={3} /></button>
              <div className="flex-1">
                <input type="text" className="w-full text-5xl font-black text-orange-500 bg-transparent text-center border-none p-0 outline-none" value={vol} onChange={e => setVol(e.target.value.replace(/\D/g,''))} />
                <span className="text-[10px] font-black text-slate-400 uppercase ml-1">ml</span>
              </div>
              <button type="button" onClick={() => setVol(s => String(Number(s)+5))} className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 active:bg-slate-200"><Plus size={24} strokeWidth={3} /></button>
           </div>
           
           <div className="grid grid-cols-4 gap-2">
              {(babyInfo?.quickVolumes || [60, 120, 180, 240]).map((v: any) => (
                <button type="button" key={v} onClick={() => setVol(String(v))} className={`py-3 rounded-2xl text-xs font-black transition-colors ${Number(vol) === Number(v) ? 'bg-orange-500 text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>{v}</button>
              ))}
           </div>
        </div>

        <div className="bg-slate-50 p-3 rounded-2xl flex items-center gap-2">
          <MessageSquareText size={16} className="text-slate-400 shrink-0" />
          <input 
            type="text" 
            placeholder="備註 (如：嘔奶 / 換片)" 
            className="w-full bg-transparent border-none font-bold text-slate-600 text-sm outline-none" 
            value={remarks} 
            onChange={e => setRemarks(e.target.value)} 
          />
        </div>

        <button onClick={() => onSubmit(vol, tStr, dStr, remarks, editingLog?.id)} className="w-full bg-orange-600 text-white py-5 rounded-[32px] font-black text-lg shadow-xl shadow-orange-200 active:scale-95 transition-all mt-2">
          {isEditing ? '儲存修改' : '儲存紀錄'}
        </button>
      </div>
    </div>
  );
};

// --- 批次新增元件 ---
const BulkMilkModal = ({ babyInfo, defaultDate, onClose, onSubmit }: any) => {
  const [dStr, setDStr] = useState(getLocalDateString(defaultDate));
  
  const [entries, setEntries] = useState([
    { id: Date.now(), time: '08:00', volume: String(babyInfo?.standardVolume || 120), remarks: '' }
  ]);

  const handleAddRow = () => {
    let newTime = '08:00';
    if (entries.length > 0) {
      const lastTime = entries[entries.length - 1].time;
      const [h, m] = lastTime.split(':').map(Number);
      const newH = (h + (Number(babyInfo?.intervalHours) || 4)) % 24;
      newTime = `${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    
    setEntries([...entries, { 
      id: Date.now(), 
      time: newTime, 
      volume: String(babyInfo?.standardVolume || 120), 
      remarks: '' 
    }]);
  };

  const handleRemoveRow = (idToRemove: number) => {
    if (entries.length > 1) {
      setEntries(entries.filter(e => e.id !== idToRemove));
    }
  };

  const updateEntry = (id: number, field: string, value: string) => {
    setEntries(entries.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-end sm:items-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-md mx-auto rounded-[48px] p-6 sm:p-8 flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div>
            <h3 className="text-2xl font-black text-slate-800">批次新增</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">快速補回多筆紀錄</p>
          </div>
          <button onClick={onClose} className="text-slate-300 font-bold p-2 hover:bg-slate-100 rounded-full">✕</button>
        </div>
        
        <div className="bg-slate-50 p-3 rounded-2xl shrink-0 mb-4 flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase ml-2">選擇補登日期</span>
          <input type="date" className="bg-transparent border-none font-black text-slate-700 text-sm outline-none" value={dStr} onChange={e => setDStr(e.target.value)} />
        </div>

        {/* 捲動區域：紀錄列表 */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
          {entries.map((entry) => (
            <div key={entry.id} className="bg-white border border-slate-100 shadow-sm p-4 rounded-[24px] relative group">
              {entries.length > 1 && (
                <button onClick={() => handleRemoveRow(entry.id)} className="absolute -top-2 -right-2 bg-slate-100 text-slate-400 p-1.5 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors shadow-sm">
                  ✕
                </button>
              )}
              <div className="flex items-center gap-3">
                <div className="bg-slate-50 px-3 py-2 rounded-xl">
                  <span className="text-[8px] font-black text-slate-300 uppercase block mb-0.5">時間</span>
                  <input type="time" className="bg-transparent border-none font-bold text-slate-700 p-0 text-sm outline-none w-[70px]" value={entry.time} onChange={e => updateEntry(entry.id, 'time', e.target.value)} />
                </div>
                <div className="bg-orange-50 px-3 py-2 rounded-xl flex-1 flex items-center">
                  <div className="flex-1">
                    <span className="text-[8px] font-black text-orange-300 uppercase block mb-0.5">奶量 (ML)</span>
                    <input type="number" className="w-full bg-transparent border-none font-black text-orange-600 p-0 text-lg outline-none" value={entry.volume} onChange={e => updateEntry(entry.id, 'volume', e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="mt-3 bg-slate-50 px-3 py-2 rounded-xl flex items-center gap-2">
                <MessageSquareText size={14} className="text-slate-300 shrink-0" />
                <input type="text" placeholder="備註 (選填)" className="w-full bg-transparent border-none font-bold text-slate-500 text-xs outline-none" value={entry.remarks} onChange={e => updateEntry(entry.id, 'remarks', e.target.value)} />
              </div>
            </div>
          ))}
          
          <button onClick={handleAddRow} className="w-full py-4 border-2 border-dashed border-slate-200 text-slate-400 font-bold rounded-[24px] flex items-center justify-center gap-2 hover:bg-slate-50 hover:border-slate-300 transition-colors">
            <PlusCircle size={18} /> 新增一筆
          </button>
        </div>

        <div className="shrink-0 mt-4 pt-4 border-t border-slate-50">
          <button onClick={() => onSubmit(dStr, entries)} className="w-full bg-orange-600 text-white py-5 rounded-[32px] font-black text-lg shadow-xl shadow-orange-200 active:scale-95 transition-all">
            儲存所有紀錄 ({entries.length}筆)
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;