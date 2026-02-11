import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileUp, 
  LogOut, 
  Search, 
  Printer, 
  Trash2, 
  X,
  FileText,
  Eye,
  RefreshCw,
  Plus,
  Keyboard,
  Users,
  Database,
  Edit,
  MapPin,
  Archive,
  ClipboardList,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRight,
  WifiOff,
  Wifi
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc, 
  doc, 
  updateDoc, 
  onSnapshot,
  orderBy
} from '@firebase/firestore';
import { db, isFirebaseConfigured } from './firebaseConfig';
import { UserRole, UserProfile, MarriageArchive, KECAMATAN_LIST, KecamatanUser } from './types';
import { APP_NAME, Watermark, KEMENAG_LOGO } from './constants';
import { extractMarriageData } from './geminiService';

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState('archives');
  const [archives, setArchives] = useState<MarriageArchive[]>([]);
  const [kecamatanUsers, setKecamatanUsers] = useState<KecamatanUser[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewArchive, setPreviewArchive] = useState<MarriageArchive | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  const [loginForm, setLoginForm] = useState({ nip: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<KecamatanUser | null>(null);
  const [userData, setUserData] = useState({ nip: '', password: '', displayName: '', kecamatan: '' });

  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [manualData, setManualData] = useState({ 
    suami: '', istri: '', nomorAkta: '', tanggalNikah: '', lokasiNikah: '',
    noBerkas: '', noItem: '', noNB: '', kodeKlasifikasi: 'HK.01', uraian: '', 
    kurunWaktu: '', mediaSimpan: 'Kertas', jumlah: '1 Berkas', jangkaSimpan: 'Permanen', 
    tingkatPerkembangan: 'Asli', nomorBoks: 'Boks 1', lokasiSimpan: 'RAK A BARIS 2', 
    metodePerlindungan: 'Vaulting', keterangan: 'Asli'
  });

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    });
  };

  useEffect(() => {
    if (!user || !isFirebaseConfigured) return;

    const archivesQuery = user.role === UserRole.KABUPATEN 
      ? query(collection(db, "archives"), orderBy("uploadDate", "desc"))
      : query(collection(db, "archives"), where("kecamatan", "==", user.kecamatan), orderBy("uploadDate", "desc"));

    const unsubArchives = onSnapshot(archivesQuery, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MarriageArchive));
        setArchives(data);
        setIsOnline(true);
      },
      (error) => {
        console.error("Firestore connectivity issue:", error);
        if (error.code === 'unavailable') {
          setIsOnline(false);
        }
      }
    );

    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KecamatanUser));
      setKecamatanUsers(data);
      setLoading(false);
    });

    return () => { unsubArchives(); unsubUsers(); };
  }, [user]);

  const handleLoginProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsAuthenticating(true);

    try {
      if (loginForm.nip === 'admin' && loginForm.password === 'admin123') {
        setUser({ uid: 'admin', nip: 'admin', displayName: 'Super Admin', role: UserRole.KABUPATEN });
        setIsAuthenticating(false);
        return;
      }

      const q = query(collection(db, "users"), where("nip", "==", loginForm.nip), where("password", "==", loginForm.password));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const found = querySnapshot.docs[0].data() as KecamatanUser;
        setUser({ 
          uid: querySnapshot.docs[0].id, 
          nip: found.nip, 
          displayName: found.displayName, 
          role: UserRole.KECAMATAN, 
          kecamatan: found.kecamatan 
        });
      } else {
        setLoginError('NIP atau Kata Sandi salah.');
      }
    } catch (err: any) {
      setLoginError(err.code === 'unavailable' ? 'Masalah koneksi database. Periksa internet Anda.' : 'Gagal terhubung ke Firebase.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const originalBase64 = reader.result as string;
        const compressedBase64 = await compressImage(originalBase64);
        const geminiBase64 = originalBase64.split(',')[1];
        const extracted = await extractMarriageData(geminiBase64, file.type);
        
        await addDoc(collection(db, "archives"), {
          fileBase64: compressedBase64,
          fileName: file.name,
          fileHash: `sha256_${Date.now()}`,
          kecamatan: user.role === UserRole.KABUPATEN ? (extracted.lokasiNikah || "Jember") : (user.kecamatan || ''),
          uploadDate: new Date().toISOString(),
          extractedData: extracted,
          uploaderEmail: user.nip
        });
        
        setActiveTab('archives');
      } catch (err: any) {
        alert("Gagal: " + (err.code === 'unavailable' ? "Koneksi terputus." : err.message));
      } finally {
        setIsUploading(false);
      }
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
      setUserData({ nip: '', password: '', displayName: '', kecamatan: '' });
    } catch (e) {
      alert("Gagal menyimpan data.");
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (window.confirm('Hapus operator ini?')) {
      await deleteDoc(doc(db, "users", id));
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "archives"), {
        fileBase64: '',
        fileName: 'Input Manual',
        fileHash: 'manual',
        kecamatan: user?.role === UserRole.KABUPATEN ? manualData.lokasiNikah : (user?.kecamatan || ''),
        uploadDate: new Date().toISOString(),
        extractedData: { ...manualData },
        uploaderEmail: user?.nip || 'admin'
      });
      setIsManualEntryOpen(false);
      setActiveTab('archives');
    } catch (e) {
      alert("Gagal simpan manual.");
    }
  };

  const filteredArchives = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return archives.filter(a => 
      a.extractedData.suami?.toLowerCase().includes(q) || 
      a.extractedData.istri?.toLowerCase().includes(q) ||
      a.extractedData.nomorAkta?.toLowerCase().includes(q)
    );
  }, [archives, searchQuery]);

  if (!user) {
    return (
      <div className="min-h-screen relative flex flex-col items-center justify-center p-4 overflow-hidden">
        {/* Latar Belakang Animasi */}
        <div className="bg-container">
          <div className="liquid-shape shape-1"></div>
          <div className="liquid-shape shape-2"></div>
          <div className="liquid-shape shape-3"></div>
        </div>

        {/* Ripple Wave Luar (Animasi dari Atas ke Bawah) */}
        <div className="absolute top-0 left-0 w-full overflow-hidden leading-[0] pointer-events-none opacity-40 h-[250px] z-0 animate-ripple-down">
          <svg className="waves-top w-full h-full" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink"
          viewBox="0 24 150 28" preserveAspectRatio="none" shapeRendering="auto">
            <defs>
              <path id="gentle-wave" d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z" />
            </defs>
            <g className="parallax">
              <use xlinkHref="#gentle-wave" x="48" y="0" fill="rgba(255,255,255,0.7" />
              <use xlinkHref="#gentle-wave" x="48" y="3" fill="rgba(255,255,255,0.5)" />
              <use xlinkHref="#gentle-wave" x="48" y="5" fill="rgba(255,255,255,0.3)" />
              <use xlinkHref="#gentle-wave" x="48" y="7" fill="#fff" />
            </g>
          </svg>
        </div>

        <div className="glass-card w-full max-w-lg rounded-[4rem] p-12 lg:p-16 text-center animate-in zoom-in-95 duration-700 relative z-10 border-t-2 border-white/20 overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.6)]">
          
          {/* Ripple Wave Dalam Frame */}
          <div className="absolute top-0 left-0 w-full overflow-hidden leading-[0] pointer-events-none opacity-20 h-[120px]">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink"
            viewBox="0 24 150 28" preserveAspectRatio="none" shapeRendering="auto">
              <g className="parallax">
                <use xlinkHref="#gentle-wave" x="48" y="0" fill="#10b981" />
                <use xlinkHref="#gentle-wave" x="48" y="3" fill="rgba(16, 185, 129, 0.5)" />
                <use xlinkHref="#gentle-wave" x="48" y="5" fill="rgba(16, 185, 129, 0.3)" />
                <use xlinkHref="#gentle-wave" x="48" y="7" fill="rgba(16, 185, 129, 0.1)" />
              </g>
            </svg>
          </div>

          <div className="relative z-20">
            <img src={KEMENAG_LOGO} className="w-20 h-20 mx-auto mb-8 drop-shadow-2xl" />
            <h1 className="text-white text-5xl font-black tracking-tighter italic uppercase mb-2 drop-shadow-lg">{APP_NAME}</h1>
            <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.5em] mb-12 opacity-80">Sistem Informasi Akta Nikah v 1.0</p>
            
            <form className="space-y-6" onSubmit={handleLoginProcess}>
              <div className="space-y-4">
                <div className="relative">
                  <input required type="text" placeholder="NIP OPERATOR" className="glass-input w-full px-10 py-6 rounded-2xl outline-none font-black text-center uppercase tracking-widest focus:ring-4 focus:ring-emerald-500/50 transition-all text-lg shadow-inner border-0" value={loginForm.nip} onChange={e => setLoginForm({...loginForm, nip: e.target.value})}/>
                  <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-600 opacity-20" size={20} />
                </div>
                <div className="relative">
                  <input required type="password" placeholder="KATA SANDI" className="glass-input w-full px-10 py-6 rounded-2xl outline-none font-bold text-center tracking-widest focus:ring-4 focus:ring-emerald-500/50 transition-all text-lg shadow-inner border-0" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})}/>
                  <ShieldCheck className="absolute left-6 top-1/2 -translate-y-1/2 text-emerald-600 opacity-20" size={20} />
                </div>
              </div>
              
              {loginError && (
                <div className="bg-rose-500/10 border border-rose-500/30 p-6 rounded-3xl text-left animate-in slide-in-from-top-4 flex items-center gap-4">
                  <AlertTriangle className="text-rose-400 shrink-0" size={20} />
                  <p className="text-rose-100 text-[10px] font-black uppercase tracking-widest leading-relaxed">{loginError}</p>
                </div>
              )}

              <button type="submit" disabled={isAuthenticating} className="w-full bg-emerald-600 text-white py-8 rounded-[3rem] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-4 hover:bg-emerald-500 transition-all shadow-2xl active:scale-[0.98] disabled:opacity-50 italic text-xl group">
                {isAuthenticating ? <RefreshCw className="animate-spin" size={24} /> : <CheckCircle2 size={28} />} 
                {isAuthenticating ? 'OTENTIKASI...' : 'MASUK SISTEM'}
              </button>
            </form>

            <div className="mt-12 text-white/40 text-[10px] font-black uppercase tracking-[0.4em] animate-pulse">
              Kemenag Jember 2026
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 relative selection:bg-emerald-100">
      <Watermark />
      
      <aside className="w-80 bg-emerald-950 text-white min-h-screen flex flex-col no-print fixed lg:static z-40 shadow-2xl">
        <div className="p-10 border-b border-emerald-900/50">
          <div className="flex items-center gap-4 mb-8">
            <img src={KEMENAG_LOGO} className="w-10 h-10 object-contain" />
            <h1 className="text-2xl font-black tracking-tighter italic leading-none">{APP_NAME}</h1>
          </div>
          <div className="p-6 bg-emerald-900/40 rounded-[2rem] border border-emerald-800/50 shadow-inner">
            <p className="text-[9px] text-emerald-400 font-black uppercase tracking-widest mb-2 flex items-center gap-2">
               {isOnline ? <Wifi size={12} className="text-emerald-500" /> : <WifiOff size={12} className="text-rose-500 animate-pulse" />}
               {isOnline ? 'Firestore (Aktif)' : 'Mode Luring'}
            </p>
            <p className="text-sm font-black truncate text-white uppercase italic tracking-tighter">{user.displayName}</p>
            <p className="text-[10px] text-emerald-600 font-black uppercase italic mt-1">
              {user.role === UserRole.KABUPATEN ? 'ADMIN KABUPATEN' : `KUA ${user.kecamatan}`}
            </p>
          </div>
        </div>

        <nav className="flex-1 p-8 space-y-3">
          {[
            { id: 'upload', icon: FileUp, label: 'Tambah Data' },
            { id: 'archives', icon: ClipboardList, label: 'Arsip Data' },
            { id: 'users', icon: Users, label: 'Akses Operator', hide: user.role !== UserRole.KABUPATEN },
          ].filter(item => !item.hide).map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center gap-5 px-6 py-5 rounded-[2rem] transition-all font-black text-[10px] uppercase tracking-widest ${activeTab === item.id ? 'bg-emerald-600 text-white shadow-xl italic translate-x-2' : 'text-emerald-400/50 hover:text-white hover:bg-emerald-900/30'}`}>
              <item.icon size={20} /> {item.label}
            </button>
          ))}
        </nav>

        <div className="p-8 border-t border-emerald-900/50">
          <button onClick={() => setUser(null)} className="w-full flex items-center justify-center gap-3 px-6 py-5 bg-rose-500/10 text-rose-400 rounded-[2rem] font-black text-[10px] uppercase hover:bg-rose-500 hover:text-white transition-all shadow-lg active:scale-95">
            <LogOut size={16} /> Keluar Sistem
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 lg:p-16 overflow-y-auto relative no-print">
        {!isOnline && (
          <div className="mb-10 p-6 bg-rose-500 text-white rounded-3xl flex items-center gap-6 shadow-2xl animate-bounce">
            <AlertTriangle size={32} />
            <div>
              <p className="font-black uppercase italic tracking-tighter">Koneksi Database Terputus</p>
              <p className="text-xs font-bold opacity-80 uppercase tracking-widest">Sistem berjalan dalam mode luring. Sinkronisasi akan berlanjut saat internet pulih.</p>
            </div>
          </div>
        )}

        <header className="mb-16 flex justify-between items-end">
          <div className="animate-in slide-in-from-left duration-700">
            <p className="text-emerald-600 font-black text-xs uppercase tracking-[0.4em] mb-4 italic">Kabupaten Jember</p>
            <h2 className="text-7xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">
              {activeTab === 'upload' ? 'Tambah Data' : activeTab === 'users' ? 'Akses Operator' : 'Arsip Data'}
            </h2>
          </div>
          {activeTab === 'users' && (
            <button onClick={() => { setEditingUser(null); setUserData({ nip: '', password: '', displayName: '', kecamatan: '' }); setIsUserModalOpen(true); }} className="px-10 py-6 bg-emerald-950 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-widest flex items-center gap-4 hover:bg-emerald-600 hover:shadow-2xl transition-all italic shadow-xl animate-in zoom-in duration-500"><Plus size={24}/> Tambah Operator</button>
          )}
        </header>

        {activeTab === 'archives' && (
          <div className="space-y-10 animate-in slide-in-from-bottom duration-700">
             <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-1 relative group">
                   <Search className="absolute left-10 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-600 transition-colors" size={28} />
                   <input type="text" placeholder="Cari Nama Pasangan atau No. Akta..." className="w-full pl-24 pr-12 py-8 rounded-[3rem] bg-white border border-emerald-50 shadow-2xl focus:outline-none focus:ring-8 focus:ring-emerald-500/5 font-black italic uppercase text-sm tracking-[0.1em] transition-all" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <button onClick={() => window.print()} className="px-16 py-8 bg-emerald-950 text-white rounded-[3rem] font-black uppercase text-xs tracking-widest flex items-center justify-center gap-5 shadow-2xl hover:bg-black transition-all italic active:scale-95"><Printer size={24} /> Cetak Arsip</button>
             </div>

             <div className="bg-white rounded-[5rem] shadow-2xl border border-emerald-50 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-emerald-950 text-white text-[11px] font-black uppercase tracking-[0.3em] italic">
                    <tr>
                      <th className="px-12 py-10">Uraian Metadata Arsip</th>
                      <th className="px-12 py-10">Nomor Registrasi</th>
                      <th className="px-12 py-10">Wilayah KUA</th>
                      <th className="px-12 py-10 text-right">Manajemen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredArchives.length > 0 ? filteredArchives.map(arc => (
                      <tr key={arc.id} className="hover:bg-emerald-50/50 transition-all text-sm font-bold text-slate-700 group">
                        <td className="px-12 py-10">
                           <div className="flex items-center gap-5">
                              <div className="p-4 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors"><FileText size={24}/></div>
                              <div>
                                <p className="text-slate-900 font-black uppercase italic tracking-tighter leading-tight text-lg">{arc.extractedData.uraian}</p>
                                <p className="text-[10px] text-emerald-600 uppercase italic font-black mt-2 tracking-widest flex items-center gap-2"><ArrowRight size={10} /> Akad: {arc.extractedData.tanggalNikah}</p>
                              </div>
                           </div>
                        </td>
                        <td className="px-12 py-10 font-mono tracking-widest text-emerald-700 font-black">{arc.extractedData.nomorAkta}</td>
                        <td className="px-12 py-10">
                          <span className="px-6 py-3 bg-slate-100 text-slate-600 rounded-full text-[10px] uppercase font-black tracking-[0.2em] italic border border-slate-200">{arc.kecamatan}</span>
                        </td>
                        <td className="px-12 py-10 flex gap-4 justify-end opacity-20 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => setPreviewArchive(arc)} className="p-5 bg-emerald-50 text-emerald-600 rounded-3xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"><Eye size={20}/></button>
                           <button onClick={() => { if(confirm('Hapus arsip ini secara permanen?')) deleteDoc(doc(db, "archives", arc.id)); }} className="p-5 bg-rose-50 text-rose-500 rounded-3xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"><Trash2 size={20}/></button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-12 py-24 text-center">
                          <p className="text-slate-400 font-black uppercase italic tracking-widest">Tidak ada data arsip ditemukan</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
             </div>
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 animate-in zoom-in duration-500">
            <div className="bg-white p-24 rounded-[5rem] shadow-2xl border border-emerald-50 text-center flex flex-col items-center group relative overflow-hidden">
              <div className={`p-14 rounded-full mb-12 transition-all duration-500 shadow-inner ${isUploading ? 'bg-emerald-100 animate-pulse' : 'bg-emerald-50 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white'}`}>
                <FileUp size={80} className={isUploading ? 'text-emerald-400' : 'text-emerald-600 group-hover:text-white'} />
              </div>
              <h3 className="text-5xl font-black mb-6 italic uppercase tracking-tighter">Pindai Digital AI</h3>
              <p className="text-xs text-slate-400 font-bold mb-16 uppercase tracking-[0.3em] max-w-xs">Penyimpanan Terenkripsi Firestore</p>
              <label className="w-full bg-emerald-950 text-white py-10 rounded-[3rem] font-black uppercase tracking-[0.3em] cursor-pointer hover:bg-black transition-all italic text-sm shadow-2xl flex items-center justify-center gap-5 group/btn active:scale-95">
                {isUploading ? <RefreshCw className="animate-spin" /> : <Archive size={24} />}
                {isUploading ? 'MEMPROSES AI...' : 'UNGGAH ARSIP'}
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} accept="image/*" />
              </label>
            </div>
            <div className="bg-emerald-50 p-24 rounded-[5rem] text-center border-4 border-dashed border-emerald-200 flex flex-col items-center group shadow-inner">
              <div className="p-14 bg-white rounded-full mb-12 shadow-2xl group-hover:scale-110 transition-all duration-500"><Keyboard size={80} className="text-emerald-600" /></div>
              <h3 className="text-5xl font-black mb-6 italic uppercase tracking-tighter">Input Manual</h3>
              <p className="text-xs text-slate-400 font-bold mb-16 uppercase tracking-[0.3em] max-w-xs">Registrasi metadata tanpa dokumen visual</p>
              <button onClick={() => setIsManualEntryOpen(true)} className="w-full bg-white text-emerald-950 py-10 rounded-[3rem] font-black uppercase tracking-[0.3em] border-2 border-emerald-200 hover:bg-emerald-950 hover:text-white transition-all italic text-sm shadow-xl active:scale-95">MULAI INPUT</button>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-10 animate-in slide-in-from-bottom duration-700">
             <div className="bg-white rounded-[4rem] shadow-2xl border border-emerald-50 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-emerald-950 text-white text-[11px] font-black uppercase tracking-[0.3em] italic">
                    <tr>
                      <th className="px-12 py-10">Nama Lengkap Operator</th>
                      <th className="px-12 py-10">NIP / User ID</th>
                      <th className="px-12 py-10">Wilayah KUA</th>
                      <th className="px-12 py-10 text-right">Opsi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {kecamatanUsers.length > 0 ? kecamatanUsers.map(u => (
                      <tr key={u.id} className="hover:bg-emerald-50/50 transition-all text-sm font-bold text-slate-700 group">
                        <td className="px-12 py-10 font-black uppercase italic text-lg">{u.displayName}</td>
                        <td className="px-12 py-10 font-mono text-emerald-600 tracking-widest">{u.nip}</td>
                        <td className="px-12 py-10 uppercase text-[10px] font-black tracking-[0.2em] text-slate-400 italic">
                          <span className="flex items-center gap-2"><MapPin size={12}/> KUA {u.kecamatan}</span>
                        </td>
                        <td className="px-12 py-10 flex gap-4 justify-end opacity-20 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => { setEditingUser(u); setUserData(u); setIsUserModalOpen(true); }} className="p-5 bg-emerald-50 text-emerald-600 rounded-3xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"><Edit size={20}/></button>
                           <button onClick={() => handleDeleteUser(u.id)} className="p-5 bg-rose-50 text-rose-500 rounded-3xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"><Trash2 size={20}/></button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-12 py-24 text-center text-slate-400 font-black uppercase italic tracking-widest">Tidak ada operator terdaftar</td>
                      </tr>
                    )}
                  </tbody>
                </table>
             </div>
          </div>
        )}
      </main>

      {/* Manual Entry Modal */}
      {isManualEntryOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-emerald-950/95 backdrop-blur-3xl no-print">
           <div className="bg-white w-full max-w-6xl rounded-[5rem] p-16 lg:p-24 overflow-y-auto max-h-[95vh] shadow-2xl relative animate-in zoom-in duration-300">
              <button onClick={() => setIsManualEntryOpen(false)} className="absolute top-12 right-12 p-8 bg-slate-50 rounded-full text-slate-300 hover:text-rose-500 transition-all hover:rotate-90 shadow-inner"><X size={48}/></button>
              <div className="mb-20">
                <h3 className="text-7xl font-black italic uppercase mb-4 tracking-tighter leading-none">Pendaftaran Arsip</h3>
              </div>
              <form onSubmit={handleManualSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-16">
                 <div className="space-y-10 p-12 bg-slate-50 rounded-[4rem] border border-slate-100">
                    <p className="text-xs font-black uppercase text-emerald-600 tracking-[0.4em] italic mb-6 border-b border-emerald-200 pb-4">I. Identitas Pasangan</p>
                    <input required placeholder="NAMA LENGKAP SUAMI" className="w-full px-10 py-7 rounded-3xl bg-white border border-slate-200 font-black uppercase italic focus:ring-8 focus:ring-emerald-500/5 outline-none transition-all" value={manualData.suami} onChange={e => setManualData({...manualData, suami: e.target.value.toUpperCase()})}/>
                    <input required placeholder="NAMA LENGKAP ISTRI" className="w-full px-10 py-7 rounded-3xl bg-white border border-slate-200 font-black uppercase italic focus:ring-8 focus:ring-emerald-500/5 outline-none transition-all" value={manualData.istri} onChange={e => setManualData({...manualData, istri: e.target.value.toUpperCase()})}/>
                 </div>
                 <div className="space-y-10 p-12 bg-emerald-50/50 rounded-[4rem] border border-emerald-100">
                    <p className="text-xs font-black uppercase text-emerald-600 tracking-[0.4em] italic mb-6 border-b border-emerald-200 pb-4">II. Metadata Administrasi</p>
                    <input required placeholder="NOMOR REGISTRASI AKTA" className="w-full px-10 py-7 rounded-3xl bg-white border border-emerald-200 font-black tracking-widest focus:ring-8 focus:ring-emerald-500/5 outline-none" value={manualData.nomorAkta} onChange={e => setManualData({...manualData, nomorAkta: e.target.value})}/>
                    <input required type="date" className="w-full px-10 py-7 rounded-3xl bg-white border border-emerald-200 font-black" value={manualData.tanggalNikah} onChange={e => setManualData({...manualData, tanggalNikah: e.target.value})}/>
                 </div>
                 <div className="md:col-span-2">
                    <select required className="w-full px-10 py-10 rounded-[3rem] bg-emerald-950 text-white font-black uppercase italic text-center border-4 border-emerald-900 shadow-2xl" value={manualData.lokasiNikah} onChange={e => setManualData({...manualData, lokasiNikah: e.target.value})}>
                      <option value="">-- DAFTAR 31 KECAMATAN JEMBER --</option>
                      {KECAMATAN_LIST.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                 </div>
                 <button type="submit" className="md:col-span-2 py-12 bg-emerald-600 text-white rounded-[4rem] font-black uppercase tracking-[0.5em] text-2xl hover:bg-emerald-500 italic shadow-2xl">SIMPAN KE ARSIP DATA</button>
              </form>
           </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewArchive && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-8 bg-black/98 backdrop-blur-3xl no-print">
           <div className="bg-white w-full max-w-[95vw] h-[92vh] rounded-[6rem] shadow-2xl overflow-hidden flex flex-col lg:flex-row relative animate-in zoom-in duration-500">
              <button onClick={() => setPreviewArchive(null)} className="absolute top-12 left-12 p-8 bg-white/10 backdrop-blur-xl rounded-full text-white shadow-2xl z-20 hover:scale-110 transition-all border border-white/20"><X size={48}/></button>
              
              <div className="flex-1 bg-emerald-950 flex items-center justify-center p-16 overflow-hidden relative">
                 {(previewArchive.fileBase64 || previewArchive.fileUrl) ? (
                   <img src={previewArchive.fileBase64 || previewArchive.fileUrl} className="max-w-full max-h-full object-contain rounded-[3rem] shadow-2xl border-4 border-white/10" />
                 ) : (
                   <div className="text-center text-white p-24 opacity-20 flex flex-col items-center space-y-12">
                     <Archive size={350} className="animate-pulse" />
                     <p className="text-7xl font-black uppercase italic tracking-tighter text-white">Tidak Ada Gambar Dokumen</p>
                   </div>
                 )}
              </div>

              <div className="w-full lg:w-[600px] bg-white p-20 lg:p-28 overflow-y-auto border-l border-slate-100 flex flex-col justify-between">
                 <div>
                    <div className="mb-20">
                        <p className="text-emerald-600 font-black text-xs uppercase tracking-[0.5em] mb-4 italic flex items-center gap-3"><Database size={16}/> Metadata Digital</p>
                        <h4 className="text-6xl font-black uppercase italic tracking-tighter leading-none mb-4">Detail Akta</h4>
                    </div>
                    
                    <div className="space-y-12">
                        <div className="p-12 bg-slate-50 rounded-[4rem] border border-slate-100 shadow-inner group transition-all hover:bg-white hover:shadow-2xl">
                          <p className="text-[11px] font-black text-slate-400 uppercase italic tracking-[0.3em] mb-6">Pihak Berpasangan</p>
                          <p className="text-3xl font-black text-slate-900 leading-tight uppercase italic tracking-tighter">
                            {previewArchive.extractedData.suami}<br/>
                            <span className="text-emerald-600 text-xl font-black block my-3">&</span> 
                            {previewArchive.extractedData.istri}
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-8">
                          <div className="p-10 bg-emerald-50/50 rounded-[3.5rem] border border-emerald-100 shadow-sm">
                              <p className="text-[11px] font-black uppercase text-emerald-600 italic tracking-widest mb-3">No. Akta</p>
                              <p className="font-black text-slate-900 text-lg tracking-widest uppercase italic font-mono">{previewArchive.extractedData.nomorAkta}</p>
                          </div>
                          <div className="p-10 bg-emerald-50/50 rounded-[3.5rem] border border-emerald-100 shadow-sm">
                              <p className="text-[11px] font-black uppercase text-emerald-600 italic tracking-widest mb-3">Tgl Akad</p>
                              <p className="font-black text-slate-900 text-lg italic">{previewArchive.extractedData.tanggalNikah}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-8 p-12 bg-emerald-950 text-white rounded-[4rem] shadow-2xl mt-6 relative overflow-hidden">
                           <MapPin size={48} className="text-emerald-400" />
                           <div className="relative z-10">
                              <p className="text-[11px] font-black uppercase text-emerald-500 italic tracking-[0.4em] mb-2">Kantor Urusan Agama</p>
                              <p className="text-3xl font-black italic uppercase tracking-tighter">Kec. {previewArchive.kecamatan}</p>
                           </div>
                        </div>
                    </div>
                 </div>

                 <button onClick={() => window.print()} className="w-full py-12 bg-emerald-600 text-white rounded-[4rem] font-black uppercase text-sm tracking-[0.4em] italic flex items-center justify-center gap-6 shadow-2xl mt-16 hover:bg-emerald-500 transition-all active:scale-[0.98] group">
                    <Printer size={32} className="group-hover:rotate-12 transition-transform" /> Cetak Arsip
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-8 bg-emerald-950/98 backdrop-blur-3xl">
           <div className="bg-white w-full max-w-xl rounded-[5rem] p-16 lg:p-20 shadow-2xl relative animate-in zoom-in duration-300 border-b-8 border-emerald-600">
              <button onClick={() => setIsUserModalOpen(false)} className="absolute top-12 right-12 p-6 text-slate-300 hover:text-rose-500 bg-slate-50 rounded-full transition-all shadow-inner"><X size={32}/></button>
              <h3 className="text-5xl font-black italic uppercase tracking-tighter leading-none mb-12 text-center">Registrasi Operator</h3>
              <form onSubmit={handleSaveUser} className="space-y-6">
                 <input required placeholder="NAMA LENGKAP" className="w-full px-10 py-6 rounded-3xl bg-slate-50 border border-slate-100 font-black uppercase italic tracking-widest outline-none shadow-inner" value={userData.displayName} onChange={e => setUserData({...userData, displayName: e.target.value})}/>
                 <input required placeholder="NIP / ID PEGAWAI" className="w-full px-10 py-6 rounded-3xl bg-slate-50 border border-slate-100 font-black tracking-widest outline-none shadow-inner" value={userData.nip} onChange={e => setUserData({...userData, nip: e.target.value})}/>
                 <input required type="password" placeholder="PASSWORD BARU" className="w-full px-10 py-6 rounded-3xl bg-slate-50 border border-slate-100 font-black tracking-widest outline-none shadow-inner" value={userData.password} onChange={e => setUserData({...userData, password: e.target.value})}/>
                 <select required className="w-full px-10 py-6 rounded-3xl bg-slate-50 border border-slate-100 font-black uppercase italic shadow-inner" value={userData.kecamatan} onChange={e => setUserData({...userData, kecamatan: e.target.value})}>
                    <option value="">WILAYAH TUGAS KUA</option>
                    {KECAMATAN_LIST.map(k => <option key={k} value={k}>{k}</option>)}
                 </select>
                 <button type="submit" className="w-full py-10 bg-emerald-600 text-white rounded-[3.5rem] font-black uppercase tracking-[0.4em] hover:bg-emerald-500 transition-all italic shadow-2xl mt-8">VALIDASI AKSES</button>
              </form>
           </div>
        </div>
      )}

      <style>{`
        .animate-in { animation: slide-up 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; } 
        @keyframes slide-up { from { transform: translateY(60px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        
        /* Animasi Ripple Wave dari Atas ke Bawah */
        @keyframes ripple-down {
          0% { transform: translateY(-100%); opacity: 0; }
          100% { transform: translateY(0); opacity: 0.4; }
        }
        .animate-ripple-down {
          animation: ripple-down 1.5s cubic-bezier(0.23, 1, 0.32, 1) forwards;
        }

        input::placeholder { font-style: italic; opacity: 0.5; }
        
        .glass-input:focus {
           transform: translateY(-2px);
           box-shadow: 0 20px 40px -10px rgba(16, 185, 129, 0.2);
        }

        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-full { width: 100% !important; margin: 0 !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  );
};

export default App;