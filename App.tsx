import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileUp, LogOut, Search, Printer, Trash2, X, FileText, Eye, RefreshCw, Plus, 
  Keyboard, Users, Database, Edit, MapPin, Archive, ClipboardList, ShieldCheck, 
  AlertTriangle, CheckCircle2, Lock, ArrowRight, WifiOff, Wifi, LayoutDashboard, 
  Terminal, MessageSquare, PieChart, BarChart3, School, GraduationCap, Binary,
  ChevronRight, HardDrive, ShieldAlert, UserPlus, Building2, UserCog, Sparkles,
  Github, Chrome, Facebook, LogIn, User, Camera
} from 'lucide-react';
import { 
  collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc, onSnapshot, orderBy
} from '@firebase/firestore';
import { db, isFirebaseConfigured } from './firebaseConfig';
import { UserRole, UserProfile, DigitalArchive, KECAMATAN_LIST, MADRASAH_LIST, KecamatanUser, ArchiveCategory } from './types';
import { APP_NAME, APP_DESCRIPTION, Watermark, KEMENAG_LOGO } from './constants';
import { extractArchiveData } from './geminiService';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [archives, setArchives] = useState<DigitalArchive[]>([]);
  const [kecamatanUsers, setKecamatanUsers] = useState<KecamatanUser[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [previewArchive, setPreviewArchive] = useState<DigitalArchive | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  // Terminal State
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalLogs, setTerminalLogs] = useState<string[]>(['SAKINAH BASH v1.2.0 - Security Console Ready', 'Type "help" for commands...']);
  
  const [loginForm, setLoginForm] = useState({ nip: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<KecamatanUser | null>(null);
  const [userData, setUserData] = useState<Partial<KecamatanUser>>({ 
    nip: '', 
    password: '', 
    displayName: '', 
    role: UserRole.KECAMATAN,
    kecamatan: '',
    madrasah: ''
  });

  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalEndRef.current) terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLogs]);

  useEffect(() => {
    if (!user || !isFirebaseConfigured) return;

    let archivesQuery;
    if (user.role === UserRole.KABUPATEN) {
      archivesQuery = query(collection(db, "archives"), orderBy("uploadDate", "desc"));
    } else if (user.role === UserRole.KECAMATAN) {
      archivesQuery = query(collection(db, "archives"), where("kecamatan", "==", user.kecamatan), orderBy("uploadDate", "desc"));
    } else if (user.role === UserRole.MADRASAH) {
      archivesQuery = query(collection(db, "archives"), where("madrasah", "==", user.madrasah), orderBy("uploadDate", "desc"));
    } else {
      archivesQuery = query(collection(db, "archives"), orderBy("uploadDate", "desc"));
    }

    const unsubArchives = onSnapshot(archivesQuery, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DigitalArchive));
        setArchives(data);
        setIsOnline(true);
      },
      (error) => {
        if (error.code === 'unavailable') setIsOnline(false);
      }
    );

    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KecamatanUser));
      setKecamatanUsers(data);
    });

    return () => { unsubArchives(); unsubUsers(); };
  }, [user]);

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000;
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
    });
  };

  const handleTerminal = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = terminalInput.trim().toLowerCase();
    setTerminalLogs(prev => [...prev, `> ${terminalInput}`]);
    
    if (cmd === 'help') {
      setTerminalLogs(prev => [...prev, 'Available: wipe, sync, stats, whoami, clear']);
    } else if (cmd === 'wipe') {
      localStorage.clear();
      setTerminalLogs(prev => [...prev, 'Local cache wiped successfully.']);
    } else if (cmd === 'sync') {
      setTerminalLogs(prev => [...prev, 'Force sync initiated... Complete.']);
    } else if (cmd === 'clear') {
      setTerminalLogs([]);
    } else if (cmd === 'stats') {
      setTerminalLogs(prev => [...prev, `Total Archives: ${archives.length}`]);
    } else {
      setTerminalLogs(prev => [...prev, `Command not found: ${cmd}`]);
    }
    setTerminalInput('');
  };

  const handleLoginProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(''); setIsAuthenticating(true);
    try {
      if (loginForm.nip === 'admin' && loginForm.password === 'admin123') {
        setUser({ uid: 'admin', nip: 'admin', displayName: 'Admin Kemenag Kab', role: UserRole.KABUPATEN });
        setIsAuthenticating(false); return;
      }
      const q = query(collection(db, "users"), where("nip", "==", loginForm.nip), where("password", "==", loginForm.password));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const found = snap.docs[0].data() as KecamatanUser;
        setUser({ 
          uid: snap.docs[0].id, nip: found.nip, displayName: found.displayName, 
          role: found.role, kecamatan: found.kecamatan, madrasah: found.madrasah 
        });
      } else setLoginError('Kredensial tidak valid.');
    } catch (err) { setLoginError('Gagal koneksi server.'); }
    finally { setIsAuthenticating(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const originalBase64 = reader.result as string;
        const compressed = await compressImage(originalBase64);
        const extracted = await extractArchiveData(originalBase64.split(',')[1], file.type);
        
        await addDoc(collection(db, "archives"), {
          category: extracted.category,
          fileBase64: compressed,
          fileName: file.name,
          fileHash: `sha256_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          kecamatan: user.role === UserRole.KECAMATAN ? user.kecamatan : extracted.lokasiNikah || '',
          madrasah: user.role === UserRole.MADRASAH ? user.madrasah : extracted.namaSekolah || '',
          uploadDate: new Date().toISOString(),
          extractedData: extracted,
          uploaderEmail: user.nip
        });
        setActiveTab('archives');
      } catch (err: any) { alert(err.message); }
      finally { setIsUploading(false); }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await updateDoc(doc(db, "users", editingUser.id), userData);
      } else {
        await addDoc(collection(db, "users"), userData);
      }
      setIsUserModalOpen(false);
      setEditingUser(null);
      setUserData({ nip: '', password: '', displayName: '', role: UserRole.KECAMATAN });
    } catch (e) {
      alert("Gagal menyimpan data.");
    }
  };

  const stats = useMemo(() => {
    const totalMarriage = archives.filter(a => a.category === ArchiveCategory.PERNIKAHAN).length;
    const totalEdu = archives.filter(a => a.category === ArchiveCategory.PENDIDIKAN).length;
    return { marriage: totalMarriage, edu: totalEdu, total: archives.length };
  }, [archives]);

  const filteredArchives = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return archives.filter(a => 
      (a.extractedData.suami?.toLowerCase().includes(q)) || 
      (a.extractedData.namaSiswa?.toLowerCase().includes(q)) ||
      (a.extractedData.nomorAkta?.toLowerCase().includes(q)) ||
      (a.extractedData.nomorIjazah?.toLowerCase().includes(q))
    );
  }, [archives, searchQuery]);

  const filteredUsers = useMemo(() => {
    const q = userSearchQuery.toLowerCase();
    return kecamatanUsers.filter(u => 
      u.displayName.toLowerCase().includes(q) || 
      u.nip.toLowerCase().includes(q) ||
      (u.kecamatan && u.kecamatan.toLowerCase().includes(q)) ||
      (u.madrasah && u.madrasah.toLowerCase().includes(q))
    );
  }, [kecamatanUsers, userSearchQuery]);

  if (!user) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4">
        {/* Background Decorations */}
        <div className="bg-container"></div>
        <div className="shape tube-spiral top-[10%] left-[5%] animate-float opacity-30"></div>
        <div className="shape tube-wave bottom-[20%] right-[10%] animate-float opacity-40" style={{ animationDelay: '2s' }}></div>
        <div className="shape tube-wave top-[30%] right-[5%] animate-float opacity-20 rotate-45" style={{ animationDelay: '4s' }}></div>
        <div className="shape tube-spiral bottom-[-5%] left-[20%] animate-float opacity-10 scale-150" style={{ animationDelay: '1s' }}></div>

        {/* Login Card Vertical Glass Style */}
        <div className="glass-login-v2 w-full max-w-sm rounded-[2.5rem] p-10 lg:p-12 animate-in zoom-in-95 relative z-10 flex flex-col items-center">
          
          <div className="mb-8 text-center w-full flex flex-col items-center">
            <img src={KEMENAG_LOGO} alt="Logo Kemenag" className="w-20 h-20 mb-6 drop-shadow-xl" />
            <h1 className="text-white text-4xl font-black tracking-tight mb-2 uppercase italic">{APP_NAME}</h1>
            <p className="text-emerald-400 font-bold uppercase text-[9px] tracking-[0.3em] leading-tight max-w-[200px] mx-auto opacity-90">{APP_DESCRIPTION}</p>
          </div>
          
          <form className="w-full space-y-6" onSubmit={handleLoginProcess}>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-white/80 text-[11px] font-bold uppercase tracking-wider ml-1">Username / NIP</label>
                <input required type="text" placeholder="username@kemenag.go.id" className="w-full px-6 py-4 rounded-xl bg-white text-emerald-950 font-medium outline-none shadow-xl placeholder:text-slate-300 text-sm" value={loginForm.nip} onChange={e=>setLoginForm({...loginForm, nip: e.target.value})}/>
              </div>
              <div className="space-y-2">
                <label className="text-white/80 text-[11px] font-bold uppercase tracking-wider ml-1">Password</label>
                <div className="relative">
                  <input required type="password" placeholder="Password" className="w-full px-6 py-4 rounded-xl bg-white text-emerald-950 font-medium outline-none shadow-xl placeholder:text-slate-300 text-sm" value={loginForm.password} onChange={e=>setLoginForm({...loginForm, password: e.target.value})}/>
                  <Eye className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 hover:text-emerald-600 cursor-pointer" size={16} />
                </div>
              </div>
            </div>

            {loginError && <p className="text-rose-300 text-[10px] font-bold uppercase text-center">{loginError}</p>}

            <button type="submit" disabled={isAuthenticating} className="w-full bg-[#022c22] text-white py-4 rounded-xl font-black uppercase tracking-[0.1em] flex items-center justify-center gap-3 hover:bg-emerald-900 transition-all shadow-2xl active:scale-95 disabled:opacity-50 text-sm">
              {isAuthenticating ? <RefreshCw className="animate-spin" size={18} /> : null} 
              {isAuthenticating ? 'Authenticating...' : 'Masuk Sistem'}
            </button>
          </form>

          <div className="mt-10 text-white/30 text-[9px] font-black uppercase tracking-[0.4em] flex flex-col items-center gap-2">
               {APP_NAME} JEMBER &copy; 2026
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 relative selection:bg-emerald-100">
      <Watermark />
      
      {/* Sidebar with Deep Emerald Professional Gradient */}
      <aside className="w-72 bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950 text-white flex flex-col no-print fixed lg:static z-50 h-screen shadow-[10px_0_30px_rgba(0,0,0,0.2)]">
        <div className="p-8 border-b border-emerald-800/40">
          <div className="flex items-center gap-3 mb-10">
            <img src={KEMENAG_LOGO} className="w-10 h-10 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]" />
            <h1 className="text-2xl font-black tracking-tighter italic leading-none">{APP_NAME}</h1>
          </div>
          <div className="p-5 bg-emerald-900/60 rounded-[2rem] border border-emerald-800/50 shadow-inner group transition-all hover:bg-emerald-900">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1 flex items-center gap-2">
               {isOnline ? <Wifi size={12} className="text-emerald-500" /> : <WifiOff size={12} className="text-rose-500" />}
               {user.role}
            </p>
            <p className="text-sm font-black truncate text-white uppercase italic tracking-tighter">{user.displayName}</p>
            <p className="text-[9px] font-bold text-emerald-600 mt-1 uppercase truncate opacity-80 italic">{user.kecamatan || user.madrasah || 'Pusat Kabupaten'}</p>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-3 overflow-y-auto">
          <NavBtn icon={LayoutDashboard} label="Dashboard" active={activeTab==='dashboard'} onClick={()=>setActiveTab('dashboard')} />
          <NavBtn icon={FileUp} label="Scanning AI" active={activeTab==='upload'} onClick={()=>setActiveTab('upload')} />
          <NavBtn icon={ClipboardList} label="Data Arsip" active={activeTab==='archives'} onClick={()=>setActiveTab('archives')} />
          {user.role === UserRole.KABUPATEN && <NavBtn icon={Users} label="Akses Operator" active={activeTab==='users'} onClick={()=>setActiveTab('users')} />}
        </nav>

        <div className="p-6 border-t border-emerald-800/50 space-y-3">
          {user.role === UserRole.KABUPATEN && (
            <button onClick={()=>setShowTerminal(!showTerminal)} className="w-full flex items-center gap-3 px-5 py-4 bg-slate-900 text-emerald-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all border border-emerald-900/50 group">
              <Terminal size={14} className="group-hover:rotate-12 transition-transform" /> SECURITY CONSOLE
            </button>
          )}
          <button onClick={()=>setUser(null)} className="w-full flex items-center justify-center gap-2 px-5 py-4 bg-rose-500/10 text-rose-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-lg active:scale-95">
            <LogOut size={14} /> Keluar Sistem
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 lg:p-14 overflow-y-auto relative no-print">
        {activeTab === 'dashboard' && (
          <div className="animate-in slide-in-from-bottom duration-700 space-y-14">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-emerald-700 font-black text-xs uppercase tracking-[0.5em] mb-4 italic">Kemenag Kabupaten Jember</p>
                <h2 className="text-8xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">Smart Hub</h2>
              </div>
              <div className="flex gap-4">
                <div className="p-10 bg-white rounded-[3.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] flex items-center gap-8 border border-emerald-50">
                  <div className="p-5 bg-emerald-100 text-emerald-600 rounded-3xl shadow-inner"><Database size={40}/></div>
                  <div><p className="text-[11px] font-black uppercase text-slate-400 tracking-widest mb-1">Populasi Arsip</p><p className="text-5xl font-black text-slate-900 tracking-tighter">{stats.total}</p></div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
               <StatCard icon={MapPin} title="Wilayah KUA" count={stats.marriage} desc="Total Registrasi Akta Nikah Digital" />
               <StatCard icon={School} title="Lembaga Pendidikan" count={stats.edu} desc="Total Arsip Ijazah Madrasah Negeri" />
               <div className="bg-gradient-to-br from-emerald-900 to-emerald-600 p-12 rounded-[5rem] text-white flex flex-col justify-between shadow-2xl relative overflow-hidden group">
                  <div className="absolute -top-10 -right-10 opacity-10 group-hover:scale-150 transition-all duration-1000"><Binary size={280}/></div>
                  <div><p className="text-[11px] font-black uppercase tracking-[0.5em] text-emerald-300 mb-6 italic opacity-70">Data Persistence</p><h4 className="text-5xl font-black italic uppercase tracking-tighter">Spark NoSQL</h4></div>
                  <p className="text-xs font-bold opacity-60 mt-8 leading-relaxed uppercase tracking-widest">Injeksi metadata via Gemini-3-Flash API.</p>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="animate-in zoom-in duration-700 max-w-5xl mx-auto space-y-16 py-12">
            <div className="text-center space-y-4">
              <h2 className="text-8xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">Scanning AI</h2>
              <p className="text-sm font-black text-emerald-600 uppercase tracking-[0.5em] italic">Otomatisasi Ekstraksi Metadata Berbasis Gemini</p>
            </div>
            
            <div className="bg-white p-24 rounded-[7rem] shadow-[0_60px_120px_-30px_rgba(16,185,129,0.1)] border-4 border-dashed border-emerald-100 text-center relative overflow-hidden group">
               {isUploading && (
                 <div className="absolute inset-0 bg-emerald-950/98 backdrop-blur-2xl z-20 flex flex-col items-center justify-center text-white space-y-12">
                    <RefreshCw className="w-28 h-28 animate-spin text-emerald-400" />
                    <div className="text-center space-y-4">
                       <h4 className="text-6xl font-black italic tracking-tighter uppercase">Analyzing Document</h4>
                       <p className="text-xs font-black tracking-[0.8em] animate-pulse opacity-50 uppercase italic">Sakinah-AI Engine is mapping metadata...</p>
                    </div>
                 </div>
               )}
               <div className="p-20 bg-emerald-50 rounded-full w-60 h-60 flex items-center justify-center mx-auto mb-14 group-hover:scale-110 transition-all duration-1000 shadow-inner group-hover:bg-emerald-100"><FileUp size={90} className="text-emerald-700"/></div>
               <label className="block w-full">
                 <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*" />
                 <div className="bg-gradient-to-br from-emerald-800 to-emerald-500 text-white py-12 px-20 rounded-[4rem] font-black uppercase text-2xl tracking-[0.3em] italic hover:scale-[1.03] hover:shadow-[0_30px_70px_rgba(16,185,129,0.3)] transition-all cursor-pointer shadow-2xl active:scale-95 inline-flex items-center gap-8 border-b-8 border-emerald-900">
                    <Archive size={40} /> Registrasi Berkas Baru
                 </div>
               </label>
               <p className="mt-14 text-[11px] font-black text-slate-400 uppercase tracking-[0.5em] italic opacity-50">Support: JPG, PNG, WEBP (Limit 10MB per unit)</p>
            </div>
          </div>
        )}

        {/* Archives Tab */}
        {activeTab === 'archives' && (
          <div className="animate-in slide-in-from-bottom duration-700 space-y-12">
            <div className="flex flex-col md:flex-row gap-10">
               <div className="flex-1 relative group">
                 <Search className="absolute left-10 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-600 transition-colors" size={28} />
                 <input type="text" placeholder="FILTER NAMA / NO. AKTA / NO. IJAZAH..." className="w-full pl-28 pr-12 py-10 rounded-[4rem] bg-white border border-emerald-50 shadow-2xl font-black uppercase tracking-widest text-sm focus:ring-[30px] focus:ring-emerald-500/5 outline-none transition-all" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} />
               </div>
               <button onClick={()=>window.print()} className="px-16 py-10 bg-emerald-950 text-white rounded-[4rem] font-black uppercase text-xs tracking-[0.3em] flex items-center gap-6 hover:bg-emerald-900 transition-all shadow-2xl italic active:scale-95 border-b-8 border-emerald-800"><Printer size={28}/> Cetak Laporan</button>
            </div>

            <div className="bg-white rounded-[5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.08)] border border-emerald-50 overflow-hidden">
               <table className="w-full text-left">
                 <thead className="bg-emerald-950 text-white text-[11px] font-black uppercase tracking-[0.4em] italic">
                   <tr>
                     <th className="px-14 py-12">Uraian Metadata Digital</th>
                     <th className="px-14 py-12">Nomor Registrasi</th>
                     <th className="px-14 py-12">Unit Kerja Satker</th>
                     <th className="px-14 py-12 text-right">Manajemen Berkas</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {filteredArchives.map(arc => (
                     <tr key={arc.id} className="hover:bg-emerald-50/50 transition-all text-sm group">
                        <td className="px-14 py-10">
                          <div className="flex items-center gap-8">
                            <div className="p-5 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-emerald-700 group-hover:text-white transition-all shadow-sm"><FileText size={28}/></div>
                            <div>
                              <p className="font-black text-slate-900 uppercase italic text-xl tracking-tighter leading-tight">{arc.extractedData.uraian}</p>
                              <p className="text-[10px] font-black text-emerald-600 uppercase mt-2 italic tracking-[0.3em] flex items-center gap-2"><ArrowRight size={14}/> Unique ID: {arc.fileHash.slice(-16)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-14 py-10 font-mono text-emerald-800 font-black tracking-widest text-lg">{arc.extractedData.nomorAkta || arc.extractedData.nomorIjazah}</td>
                        <td className="px-14 py-10"><span className="px-8 py-3 bg-emerald-50 text-emerald-700 rounded-full font-black uppercase text-[10px] tracking-[0.3em] italic border border-emerald-100">{arc.kecamatan || arc.madrasah}</span></td>
                        <td className="px-14 py-10 text-right space-x-4 opacity-30 group-hover:opacity-100 transition-opacity">
                           <button onClick={()=>setPreviewArchive(arc)} className="p-5 bg-white text-emerald-600 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all shadow-md border border-emerald-100"><Eye size={24}/></button>
                           {user.role === UserRole.KABUPATEN && <button onClick={async ()=>{if(confirm('Wipe arsip ini secara permanen?')) await deleteDoc(doc(db, "archives", arc.id))}} className="p-5 bg-white text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all shadow-md border border-rose-50"><Trash2 size={24}/></button>}
                        </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
          </div>
        )}

        {/* Access Tab (Admin/Kabupaten Only) */}
        {activeTab === 'users' && user.role === UserRole.KABUPATEN && (
          <div className="animate-in slide-in-from-bottom duration-700 space-y-14">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-emerald-700 font-black text-xs uppercase tracking-[0.5em] mb-4 italic">IAM Gateway</p>
                <h2 className="text-8xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">Akses Operator</h2>
              </div>
              <button onClick={() => { 
                setEditingUser(null); 
                setUserData({ nip: '', password: '', displayName: '', role: UserRole.KECAMATAN, kecamatan: '', madrasah: '' }); 
                setIsUserModalOpen(true); 
              }} className="px-16 py-10 bg-gradient-to-br from-emerald-950 to-emerald-800 text-white rounded-[4rem] font-black uppercase text-xs tracking-[0.4em] flex items-center gap-8 hover:scale-[1.03] transition-all shadow-2xl italic active:scale-95 border-b-8 border-emerald-900">
                <UserPlus size={32}/> Registrasi Operator
              </button>
            </div>

            <div className="relative group">
              <Search className="absolute left-10 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-700 transition-colors" size={32} />
              <input type="text" placeholder="FILTER PETUGAS BERDASARKAN UNIT / NIP / NAMA..." className="w-full pl-28 pr-12 py-10 rounded-[4rem] bg-white border border-emerald-50 shadow-2xl font-black uppercase tracking-widest text-sm focus:ring-[30px] focus:ring-emerald-500/5 outline-none transition-all" value={userSearchQuery} onChange={e=>setUserSearchQuery(e.target.value)} />
            </div>

            <div className="bg-white rounded-[5rem] shadow-2xl border border-emerald-50 overflow-hidden">
               <table className="w-full text-left">
                 <thead className="bg-emerald-950 text-white text-[11px] font-black uppercase tracking-[0.4em] italic">
                   <tr>
                     <th className="px-14 py-12">Identitas Petugas</th>
                     <th className="px-14 py-12">Access Key (NIP)</th>
                     <th className="px-14 py-12">Kategori Unit</th>
                     <th className="px-14 py-12">Satuan Kerja</th>
                     <th className="px-14 py-12 text-right">Manajemen Akses</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {filteredUsers.map(u => (
                     <tr key={u.id} className="hover:bg-emerald-50/50 transition-all text-sm group">
                        <td className="px-14 py-10">
                          <div className="flex items-center gap-8">
                            <div className="p-5 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-all shadow-inner">
                              {u.role === UserRole.KECAMATAN ? <UserCog size={36}/> : <School size={36} />}
                            </div>
                            <p className="font-black text-slate-900 uppercase italic text-xl tracking-tighter leading-tight">{u.displayName}</p>
                          </div>
                        </td>
                        <td className="px-14 py-10 font-mono text-emerald-800 font-black text-xl tracking-[0.2em]">{u.nip}</td>
                        <td className="px-14 py-10">
                          <span className={`px-8 py-3 rounded-full font-black uppercase text-[10px] tracking-[0.3em] italic border ${u.role === UserRole.KECAMATAN ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-purple-50 text-purple-700 border-purple-100'}`}>
                            {u.role === UserRole.KECAMATAN ? 'Operator KUA' : 'Operator Madrasah'}
                          </span>
                        </td>
                        <td className="px-14 py-10">
                          <div className="flex items-center gap-4">
                             {u.role === UserRole.KECAMATAN ? <MapPin size={20} className="text-emerald-500"/> : <Building2 size={20} className="text-purple-500"/>}
                             <span className="font-black uppercase text-sm text-slate-600 tracking-tighter italic">{u.kecamatan || u.madrasah || '-'}</span>
                          </div>
                        </td>
                        <td className="px-14 py-10 text-right space-x-4 opacity-20 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => { setEditingUser(u); setUserData(u); setIsUserModalOpen(true); }} className="p-5 bg-white text-emerald-600 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all shadow-md border border-emerald-50"><Edit size={24}/></button>
                           <button onClick={async () => { if(confirm(`Revoke akses operator ${u.displayName}?`)) await deleteDoc(doc(db, "users", u.id)); }} className="p-5 bg-white text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all shadow-md border border-rose-50"><Trash2 size={24}/></button>
                        </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
          </div>
        )}
      </main>

      {/* User Management Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-[250] bg-emerald-950/98 backdrop-blur-3xl flex items-center justify-center p-10 no-print animate-in zoom-in duration-300">
           <div className="bg-white w-full max-w-5xl rounded-[6rem] p-20 lg:p-28 shadow-2xl relative overflow-y-auto max-h-[95vh] border-8 border-emerald-900/10">
              <button onClick={() => setIsUserModalOpen(false)} className="absolute top-14 right-14 p-10 bg-slate-50 rounded-full text-slate-300 hover:text-rose-500 transition-all hover:rotate-90 hover:scale-110 shadow-inner"><X size={54}/></button>
              
              <div className="mb-20">
                <h3 className="text-8xl font-black italic uppercase tracking-tighter leading-none mb-4">
                  {editingUser ? 'Edit Akses' : 'Akses Baru'}
                </h3>
                <p className="text-sm font-black text-emerald-700 uppercase tracking-[0.6em] italic opacity-60">Sakinah IAM Access Gateway</p>
              </div>

              <form onSubmit={handleSaveUser} className="grid grid-cols-1 md:grid-cols-2 gap-16">
                 <div className="space-y-10">
                    <label className="block space-y-4">
                      <span className="text-[11px] font-black uppercase text-slate-400 tracking-[0.5em] ml-6 italic">Nama Lengkap Petugas</span>
                      <input required type="text" placeholder="CONTOH: AHMAD FAUZI, M.PD" className="w-full px-12 py-8 rounded-[2.5rem] bg-slate-50 border border-slate-100 font-black uppercase italic outline-none focus:ring-[20px] focus:ring-emerald-500/5 transition-all text-xl" value={userData.displayName} onChange={e=>setUserData({...userData, displayName: e.target.value})} />
                    </label>
                    <label className="block space-y-4">
                      <span className="text-[11px] font-black uppercase text-slate-400 tracking-[0.5em] ml-6 italic">Access Identity (NIP)</span>
                      <input required type="text" placeholder="19XXXXXXXXXXXX" className="w-full px-12 py-8 rounded-[2.5rem] bg-slate-50 border border-slate-100 font-black outline-none focus:ring-[20px] focus:ring-emerald-500/5 transition-all text-xl tracking-widest" value={userData.nip} onChange={e=>setUserData({...userData, nip: e.target.value})} />
                    </label>
                    <label className="block space-y-4">
                      <span className="text-[11px] font-black uppercase text-slate-400 tracking-[0.5em] ml-6 italic">Password Otorisasi</span>
                      <input required type="password" placeholder="••••••••" className="w-full px-12 py-8 rounded-[2.5rem] bg-slate-50 border border-slate-100 font-black outline-none focus:ring-[20px] focus:ring-emerald-500/5 transition-all text-xl tracking-widest" value={userData.password} onChange={e=>setUserData({...userData, password: e.target.value})} />
                    </label>
                 </div>

                 <div className="space-y-10">
                    <label className="block space-y-4">
                      <span className="text-[11px] font-black uppercase text-slate-400 tracking-[0.5em] ml-6 italic">Kategori Operator</span>
                      <div className="grid grid-cols-2 gap-4">
                        <button type="button" onClick={() => setUserData({...userData, role: UserRole.KECAMATAN, kecamatan: '', madrasah: ''})} className={`py-6 rounded-[2rem] font-black uppercase tracking-widest text-[10px] italic border-2 transition-all ${userData.role === UserRole.KECAMATAN ? 'bg-emerald-900 text-white border-emerald-900 shadow-xl' : 'bg-white text-emerald-950 border-emerald-50'}`}>
                          Operator KUA
                        </button>
                        <button type="button" onClick={() => setUserData({...userData, role: UserRole.MADRASAH, kecamatan: '', madrasah: ''})} className={`py-6 rounded-[2rem] font-black uppercase tracking-widest text-[10px] italic border-2 transition-all ${userData.role === UserRole.MADRASAH ? 'bg-purple-900 text-white border-purple-900 shadow-xl' : 'bg-white text-emerald-950 border-emerald-50'}`}>
                          Operator Madrasah
                        </button>
                      </div>
                    </label>

                    {userData.role === UserRole.KECAMATAN ? (
                      <label className="block space-y-4">
                        <span className="text-[11px] font-black uppercase text-slate-400 tracking-[0.5em] ml-6 italic">Unit Kerja KUA (31 Kecamatan)</span>
                        <select required className="w-full px-12 py-8 rounded-[2.5rem] bg-slate-50 border border-slate-100 font-black uppercase italic outline-none focus:ring-[20px] focus:ring-emerald-500/5 transition-all text-center text-xl" value={userData.kecamatan} onChange={e => setUserData({...userData, kecamatan: e.target.value})}>
                          <option value="">-- PILIH KECAMATAN JEMBER --</option>
                          {KECAMATAN_LIST.map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </label>
                    ) : (
                      <label className="block space-y-4">
                        <span className="text-[11px] font-black uppercase text-slate-400 tracking-[0.5em] ml-6 italic">Unit Kerja Madrasah Negeri</span>
                        <select required className="w-full px-12 py-8 rounded-[2.5rem] bg-slate-50 border border-slate-100 font-black uppercase italic outline-none focus:ring-[20px] focus:ring-emerald-500/5 transition-all text-center text-xl" value={userData.madrasah} onChange={e => setUserData({...userData, madrasah: e.target.value})}>
                          <option value="">-- PILIH LEMBAGA MADRASAH --</option>
                          {MADRASAH_LIST.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </label>
                    )}

                    <div className="pt-16">
                       <button type="submit" className="w-full py-12 bg-gradient-to-r from-emerald-700 to-emerald-500 text-white rounded-[4rem] font-black uppercase tracking-[0.5em] italic hover:scale-[1.02] transition-all shadow-2xl active:scale-[0.98] text-2xl border-b-8 border-emerald-900 group">
                         <span className="group-hover:translate-x-2 transition-transform inline-block">
                            {editingUser ? 'PERBARUI DATA AKSES' : 'AKTIFKAN OPERATOR'}
                         </span>
                       </button>
                    </div>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* Terminal Overlay */}
      {showTerminal && (
        <div className="fixed bottom-12 right-12 w-[700px] h-[500px] bg-slate-950 rounded-[4rem] shadow-[0_60px_120px_-30px_rgba(0,0,0,0.9)] z-[100] border border-slate-800 flex flex-col overflow-hidden font-mono animate-in slide-in-from-right">
          <div className="bg-slate-900 p-8 flex justify-between items-center border-b border-slate-800">
            <div className="flex items-center gap-5"><Terminal size={24} className="text-emerald-500"/><span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.5em] italic">SAKINAH KERNEL SHELL (ADMIN)</span></div>
            <button onClick={()=>setShowTerminal(false)} className="text-slate-500 hover:text-white transition-colors"><X size={28}/></button>
          </div>
          <div className="flex-1 p-10 overflow-y-auto text-emerald-400 text-[12px] space-y-3 leading-relaxed">
            {terminalLogs.map((log, i) => <div key={i} className="flex gap-4"><span className="opacity-20">[{String(i+1).padStart(2,'0')}]</span> {log}</div>)}
            <div ref={terminalEndRef} />
          </div>
          <form onSubmit={handleTerminal} className="p-8 bg-black flex gap-5 border-t border-slate-900">
            <span className="text-emerald-500 font-black tracking-widest">sakinah@kernel:~$</span>
            <input autoFocus type="text" className="bg-transparent text-emerald-300 outline-none flex-1 font-bold text-sm" value={terminalInput} onChange={e=>setTerminalInput(e.target.value)} />
          </form>
        </div>
      )}

      {/* Preview Detail Overlay */}
      {previewArchive && (
        <div className="fixed inset-0 z-[200] bg-black/98 backdrop-blur-3xl flex items-center justify-center p-14 no-print animate-in zoom-in duration-500">
           <div className="bg-white w-full max-w-7xl h-full rounded-[7rem] overflow-hidden flex shadow-2xl relative border-8 border-white/5">
              <button onClick={()=>setPreviewArchive(null)} className="absolute top-14 left-14 p-12 bg-white/10 backdrop-blur-3xl text-white rounded-full hover:scale-110 transition-all z-[210] border border-white/20 shadow-2xl"><X size={54}/></button>
              
              <div className="flex-1 bg-emerald-950 flex items-center justify-center p-28 relative overflow-hidden">
                 <div className="absolute top-24 right-24 flex flex-col items-center gap-4 opacity-30">
                    <div className="flex gap-1 h-14">{[...Array(30)].map((_,i)=><div key={i} className="w-[4px] bg-emerald-400" style={{width: `${Math.random()*8+1}px`}}/>)}</div>
                    <p className="text-[11px] text-emerald-400 font-mono tracking-[0.6em] uppercase font-black">SAKINAH-SEC-ID-{previewArchive.fileHash.slice(-12)}</p>
                 </div>
                 <img src={previewArchive.fileBase64} className="max-w-full max-h-full object-contain rounded-[4rem] shadow-2xl border-4 border-white/10" />
              </div>

              <div className="w-[600px] p-24 lg:p-32 overflow-y-auto space-y-20 border-l border-emerald-50 flex flex-col justify-between">
                 <div className="space-y-20">
                    <div>
                      <p className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.6em] mb-8 italic opacity-60">Deep Registry Analytics</p>
                      <h4 className="text-7xl font-black italic uppercase tracking-tighter text-slate-900 leading-[0.8]">Arsip Digital</h4>
                    </div>

                    <div className="space-y-10">
                       <DataRow label="Kategori Data" value={previewArchive.category} />
                       <DataRow label="Periodisasi" value={previewArchive.extractedData.kurunWaktu} />
                       <DataRow label="Koordinat Fisik" value={previewArchive.extractedData.lokasiSimpan} />
                       <DataRow label="Enkripsi Keamanan" value={previewArchive.extractedData.metodePerlindungan} icon={ShieldAlert} />
                    </div>

                    <div className="p-14 bg-emerald-50 rounded-[5rem] border border-emerald-100 shadow-inner relative group transition-all hover:bg-white hover:shadow-2xl">
                       <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-20 transition-opacity duration-700"><Database size={120} /></div>
                       <p className="text-[11px] font-black uppercase text-emerald-700 mb-8 opacity-50 tracking-[0.4em] italic">Metadata Terekstrak AI</p>
                       <p className="text-3xl font-black text-slate-900 leading-tight italic tracking-tighter">"{previewArchive.extractedData.uraian}"</p>
                    </div>
                 </div>

                 <button onClick={()=>window.print()} className="w-full py-14 bg-emerald-950 text-white rounded-[5rem] font-black uppercase tracking-[0.6em] flex items-center justify-center gap-8 hover:bg-emerald-700 transition-all shadow-2xl italic text-lg group active:scale-95 border-b-8 border-emerald-800">
                    <Printer size={40} className="group-hover:rotate-12 transition-transform" /> Cetak Salinan Resmi
                 </button>
              </div>
           </div>
        </div>
      )}

      <style>{`
        .animate-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @media print { .no-print { display: none !important; } .print-only { display: block !important; } }
      `}</style>
    </div>
  );
};

const NavBtn = ({ icon: Icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-6 px-10 py-6 rounded-[2.5rem] transition-all font-black text-[11px] uppercase tracking-[0.4em] ${active ? 'bg-emerald-700 text-white shadow-2xl italic translate-x-3' : 'text-emerald-400/50 hover:text-white hover:bg-emerald-800/40'}`}>
    <Icon size={24} className={active ? 'scale-125 transition-transform' : ''} /> {label}
  </button>
);

const StatCard = ({ icon: Icon, title, count, desc }: any) => (
  <div className={`p-12 bg-white rounded-[5rem] shadow-2xl border border-emerald-50 relative group overflow-hidden hover:translate-y-[-12px] transition-all duration-700`}>
     <div className={`absolute -right-12 -top-12 text-emerald-50 opacity-0 group-hover:opacity-100 transition-all duration-1000 scale-150 rotate-12`}><Icon size={220}/></div>
     <div className="p-6 bg-emerald-50 text-emerald-700 rounded-[2rem] w-fit mb-10 shadow-inner group-hover:bg-emerald-700 group-hover:text-white transition-all duration-500"><Icon size={40}/></div>
     <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 mb-4 italic">{title}</h4>
     <p className="text-6xl font-black text-slate-900 mb-6 tracking-tighter italic">{count}</p>
     <p className="text-[11px] font-black text-emerald-700 uppercase tracking-widest opacity-60 leading-relaxed italic">{desc}</p>
  </div>
);

const DataRow = ({ label, value, icon: Icon }: any) => (
  <div className="flex justify-between items-center py-8 border-b border-emerald-50 group hover:translate-x-3 transition-transform duration-500">
    <div className="flex items-center gap-5">
      {Icon ? <Icon size={20} className="text-emerald-600" /> : <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>}
      <span className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em] italic">{label}</span>
    </div>
    <span className="text-lg font-black text-slate-900 uppercase italic tracking-tighter">{value || '-'}</span>
  </div>
);

export default App;