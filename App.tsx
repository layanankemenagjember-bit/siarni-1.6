import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  FileUp, 
  LogOut, 
  Search, 
  Printer, 
  Trash2, 
  X,
  FileText,
  Eye,
  Cloud,
  RefreshCw,
  Plus,
  Keyboard,
  Users,
  Database,
  Edit,
  MapPin,
  Archive,
  ClipboardList,
  Chrome,
  ShieldCheck,
  Lock,
  AlertTriangle,
  ExternalLink,
  Settings,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { UserRole, UserProfile, MarriageArchive, KECAMATAN_LIST, KecamatanUser } from './types';
import { APP_NAME, Watermark, KEMENAG_LOGO } from './constants';
import { extractMarriageData } from './geminiService';
import * as drive from './driveService';

// PENTING: Ganti dengan Client ID dari Google Cloud Console Anda
// Pastikan Authorized JavaScript Origins di Google Console sudah diset ke URL website ini.
const CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"; 
const SCOPES = "https://www.googleapis.com/auth/drive.file";

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [archives, setArchives] = useState<MarriageArchive[]>([]);
  const [kecamatanUsers, setKecamatanUsers] = useState<KecamatanUser[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewArchive, setPreviewArchive] = useState<MarriageArchive | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

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

  const isConfigValid = CLIENT_ID && !CLIENT_ID.includes("YOUR_GOOGLE_CLIENT_ID");

  const syncWithDrive = async (token: string) => {
    setIsSyncing(true);
    try {
      drive.initDrive(token);
      const data = await drive.loadDatabase();
      setArchives(data.archives || []);
      setKecamatanUsers(data.users || []);
      return data;
    } catch (e) {
      console.error("Drive Sync Error:", e);
      throw e;
    } finally {
      setIsSyncing(false);
    }
  };

  const updateDrive = async (newArchives: MarriageArchive[], newUsers: KecamatanUser[]) => {
    setIsSyncing(true);
    try {
      await drive.saveDatabase({ archives: newArchives, users: newUsers });
    } catch (e) {
      alert("Gagal sinkronisasi ke Google Drive.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLoginProcess = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConfigValid) {
      setLoginError("Config Error: CLIENT_ID belum diatur.");
      return;
    }

    setLoginError('');
    setIsAuthenticating(true);

    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (response: any) => {
          if (response.error) {
            setLoginError(`Gagal otentikasi: ${response.error_description || response.error}`);
            setIsAuthenticating(false);
            return;
          }

          if (response.access_token) {
            try {
              setAccessToken(response.access_token);
              const data = await syncWithDrive(response.access_token);
              
              if (loginForm.nip === 'admin' && loginForm.password === 'admin123') {
                setUser({ uid: 'admin', nip: 'admin', displayName: 'Super Admin', role: UserRole.KABUPATEN });
              } else {
                const users = data.users || [];
                const found = users.find((u: any) => u.nip === loginForm.nip && u.password === loginForm.password);
                if (found) {
                  setUser({ uid: found.id, nip: found.nip, displayName: found.displayName, role: UserRole.KECAMATAN, kecamatan: found.kecamatan });
                } else {
                  setLoginError('NIP atau Password tidak ditemukan di database cloud.');
                  setAccessToken(null);
                }
              }
            } catch (err) {
              setLoginError('Gagal memuat database dari Drive. Pastikan koneksi internet stabil.');
            } finally {
              setIsAuthenticating(false);
            }
          }
        },
        error_callback: (err: any) => {
          setLoginError(`Google Auth Error: ${err.message}`);
          setIsAuthenticating(false);
        }
      });
      client.requestAccessToken();
    } catch (err) {
      setLoginError("Library Google Identity belum dimuat sempurna. Coba muat ulang halaman.");
      setIsAuthenticating(false);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    let updatedUsers;
    if (editingUser) {
      updatedUsers = kecamatanUsers.map(u => u.id === editingUser.id ? { ...userData, id: u.id } : u);
    } else {
      const newUser = { ...userData, id: `user_${Date.now()}` };
      updatedUsers = [...kecamatanUsers, newUser];
    }
    setKecamatanUsers(updatedUsers);
    await updateDrive(archives, updatedUsers);
    setIsUserModalOpen(false);
    setEditingUser(null);
    setUserData({ nip: '', password: '', displayName: '', kecamatan: '' });
  };

  const handleDeleteUser = async (id: string) => {
    if (confirm("Hapus operator ini? Akses mereka akan dicabut.")) {
      const updated = kecamatanUsers.filter(u => u.id !== id);
      setKecamatanUsers(updated);
      await updateDrive(archives, updated);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !accessToken) return;

    setIsUploading(true);
    try {
      const driveFileId = await drive.uploadFile(file);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const extracted = await extractMarriageData(base64, file.type);
        
        const newArchive: MarriageArchive = {
          id: driveFileId,
          fileUrl: driveFileId,
          fileName: file.name,
          fileHash: `hash_${Date.now()}`,
          kecamatan: user.role === UserRole.KABUPATEN ? (extracted.lokasiNikah || "Jember") : (user.kecamatan || ''),
          uploadDate: new Date().toISOString(),
          extractedData: extracted,
          uploaderEmail: user.nip
        };

        const updated = [newArchive, ...archives];
        setArchives(updated);
        await updateDrive(updated, kecamatanUsers);
        setIsUploading(false);
        setActiveTab('archives');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert("Error Upload. Pastikan Gemini API Key valid.");
      setIsUploading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newArchive: MarriageArchive = {
      id: `manual_${Date.now()}`,
      fileUrl: '',
      fileName: 'Input Manual',
      fileHash: 'manual',
      kecamatan: user?.role === UserRole.KABUPATEN ? manualData.lokasiNikah : (user?.kecamatan || ''),
      uploadDate: new Date().toISOString(),
      extractedData: { ...manualData },
      uploaderEmail: user?.nip || 'admin'
    };
    const updated = [newArchive, ...archives];
    setArchives(updated);
    await updateDrive(updated, kecamatanUsers);
    setIsManualEntryOpen(false);
    setActiveTab('archives');
  };

  const handleDeleteArchive = async (id: string) => {
    if (confirm("Hapus arsip ini dari cloud?")) {
      const updated = archives.filter(a => a.id !== id);
      setArchives(updated);
      await updateDrive(updated, kecamatanUsers);
    }
  };

  const filteredArchives = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return archives.filter(a => {
      const match = a.extractedData.suami?.toLowerCase().includes(q) || a.kecamatan?.toLowerCase().includes(q);
      return user?.role === UserRole.KABUPATEN ? match : (match && a.kecamatan === user?.kecamatan);
    });
  }, [archives, searchQuery, user]);

  if (!user) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4">
        {/* Background Animation & Ripple */}
        <div className="bg-container">
          <div className="liquid-shape shape-1"></div>
          <div className="liquid-shape shape-2"></div>
          <div className="liquid-shape shape-3"></div>
          
          {/* Animated SVG Ripple at top */}
          <svg className="waves-top" xmlns="http://www.w3.org/2000/svg" viewBox="0 24 150 28" preserveAspectRatio="none" shapeRendering="auto">
            <defs>
              <path id="gentle-wave" d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z" />
            </defs>
            <g className="parallax">
              <use href="#gentle-wave" x="48" y="0" fill="rgba(16, 185, 129, 0.15)" />
              <use href="#gentle-wave" x="48" y="3" fill="rgba(5, 150, 105, 0.25)" />
              <use href="#gentle-wave" x="48" y="5" fill="rgba(4, 120, 87, 0.35)" />
              <use href="#gentle-wave" x="48" y="7" fill="rgba(6, 78, 59, 0.5)" />
            </g>
          </svg>
        </div>

        {!isConfigValid ? (
          <div className="glass-card w-full max-w-2xl rounded-[3rem] p-12 lg:p-16 animate-in zoom-in-95 duration-700 shadow-2xl relative z-10 overflow-hidden text-white">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-4 bg-emerald-600 rounded-3xl"><Settings size={32} /></div>
              <div>
                <h2 className="text-3xl font-black italic uppercase tracking-tighter">Setup Diperlukan</h2>
                <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Konfigurasi Google Cloud Console</p>
              </div>
            </div>
            
            <div className="space-y-6 text-left mb-10">
              <p className="text-slate-300 text-sm font-medium leading-relaxed">
                Untuk menghilangkan <span className="text-rose-400 font-bold">Error 400</span> dan mengaktifkan database Drive, silakan ikuti panduan ini:
              </p>
              
              <div className="space-y-4">
                {[
                  { step: "1", text: "Buka Google Cloud Console dan buat Proyek baru." },
                  { step: "2", text: "Cari 'Google Drive API' dan klik 'Enable'." },
                  { step: "3", text: "Di tab 'OAuth Consent Screen', pilih 'External', isi Nama App, dan tambah Scope '.../auth/drive.file'." },
                  { step: "4", text: "Di tab 'Credentials', buat 'OAuth Client ID' tipe 'Web Application'." },
                  { step: "5", text: "Tambahkan URL website ini ke bagian 'Authorized JavaScript origins'." },
                  { step: "6", text: "Salin Client ID ke variabel CLIENT_ID di App.tsx." }
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-4 items-start p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div className="w-8 h-8 shrink-0 bg-emerald-600 rounded-full flex items-center justify-center font-black text-xs italic">{item.step}</div>
                    <p className="text-xs font-bold text-slate-100 uppercase italic tracking-tight leading-tight">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <a href="https://console.cloud.google.com/" target="_blank" className="w-full bg-white text-emerald-950 py-6 rounded-[2rem] font-black uppercase tracking-widest flex items-center justify-center gap-4 hover:bg-emerald-50 transition-all shadow-xl active:scale-95 italic">
              Buka Google Console <ExternalLink size={20} />
            </a>
          </div>
        ) : (
          <div className="glass-card w-full max-w-lg rounded-[3rem] p-12 lg:p-16 text-center animate-in zoom-in-95 duration-700 shadow-[0_50px_100px_rgba(0,0,0,0.6)] relative z-10 overflow-hidden">
            <img src={KEMENAG_LOGO} className="w-24 h-24 mx-auto mb-8 transform hover:scale-110 transition-transform drop-shadow-2xl" />
            <h1 className="text-white text-4xl font-black tracking-tighter italic uppercase mb-2 leading-none drop-shadow-lg">{APP_NAME}</h1>
            <p className="text-emerald-400 text-xs font-bold uppercase tracking-[0.4em] mb-12 opacity-80">Digital Archive Ecosystem</p>
            
            <form className="space-y-6" onSubmit={handleLoginProcess}>
              <div className="relative group">
                <input required type="text" placeholder="NIP OPERATOR" className="glass-input w-full px-8 py-6 rounded-2xl outline-none font-bold text-center uppercase tracking-widest placeholder:text-slate-500 focus:ring-4 focus:ring-emerald-500/50 transition-all text-lg shadow-inner" value={loginForm.nip} onChange={e => setLoginForm({...loginForm, nip: e.target.value})}/>
              </div>
              <div className="relative group">
                <input required type="password" placeholder="KATA SANDI" className="glass-input w-full px-8 py-6 rounded-2xl outline-none font-bold text-center tracking-widest placeholder:text-slate-500 focus:ring-4 focus:ring-emerald-500/50 transition-all text-lg shadow-inner" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})}/>
              </div>
              
              {loginError && (
                <div className="bg-rose-500/20 border border-rose-500/40 p-5 rounded-2xl flex items-start gap-4 text-left animate-in fade-in slide-in-from-top-2">
                  <AlertTriangle className="text-rose-400 shrink-0 mt-1" size={20} />
                  <div>
                    <p className="text-rose-100 text-[11px] font-black uppercase leading-tight mb-1">Terjadi Kesalahan</p>
                    <p className="text-rose-300 text-[10px] font-medium leading-relaxed">{loginError}</p>
                  </div>
                </div>
              )}

              <button type="submit" disabled={isAuthenticating} className="w-full bg-emerald-600 text-white py-7 rounded-[2.5rem] font-black uppercase tracking-[0.25em] flex items-center justify-center gap-4 hover:bg-emerald-500 transition-all shadow-2xl active:scale-[0.98] disabled:opacity-50 italic text-lg group">
                {isAuthenticating ? <RefreshCw className="animate-spin" size={24} /> : <Chrome size={24} className="group-hover:rotate-12 transition-transform" />} 
                {isAuthenticating ? 'Menghubungkan...' : 'Masuk Sistem'}
              </button>
            </form>

            <p className="text-white/40 text-[10px] mt-12 font-bold uppercase leading-relaxed italic border-t border-white/10 pt-8">
              Penyimpanan data aman di Google Drive Cloud.<br/>
              Pastikan NIP anda telah didaftarkan oleh Admin Kabupaten.
            </p>
          </div>
        )}
      </div>
    );
  }

  // Tampilan Utama Aplikasi (Sesudah Login)
  return (
    <div className="flex min-h-screen bg-slate-50 relative">
      <Watermark />
      
      <aside className="w-80 bg-emerald-950 text-white min-h-screen flex flex-col no-print fixed lg:static z-40 shadow-2xl">
        <div className="p-10 border-b border-emerald-900/50">
          <div className="flex items-center gap-4 mb-8">
            <img src={KEMENAG_LOGO} className="w-10 h-10 object-contain" />
            <h1 className="text-2xl font-black tracking-tighter italic leading-none">{APP_NAME}</h1>
          </div>
          <div className="p-5 bg-emerald-900/40 rounded-3xl border border-emerald-800/50 shadow-inner">
            <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest flex items-center gap-2 mb-2">
              {isSyncing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Cloud size={12} />} Google Drive Active
            </p>
            <p className="text-sm font-black truncate text-white">{user.displayName}</p>
            <p className="text-[10px] text-emerald-600 font-black uppercase italic mt-1">{user.role === UserRole.KABUPATEN ? 'ADMIN KABUPATEN' : `OPERATOR KUA ${user.kecamatan}`}</p>
          </div>
        </div>

        <nav className="flex-1 p-8 space-y-3">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Statistik' },
            { id: 'upload', icon: FileUp, label: 'Input Arsip' },
            { id: 'archives', icon: ClipboardList, label: 'Buku Besar' },
            { id: 'users', icon: Users, label: 'Manajemen User', hide: user.role !== UserRole.KABUPATEN },
          ].filter(item => !item.hide).map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center gap-5 px-6 py-5 rounded-[2rem] transition-all font-black text-[11px] uppercase tracking-widest ${activeTab === item.id ? 'bg-emerald-600 text-white shadow-xl italic scale-[1.03] translate-x-2' : 'text-emerald-400/50 hover:text-white hover:bg-emerald-900/30'}`}>
              <item.icon size={20} /> {item.label}
            </button>
          ))}
        </nav>

        <div className="p-8 border-t border-emerald-900/50">
          <button onClick={() => { setUser(null); setAccessToken(null); }} className="w-full flex items-center justify-center gap-3 px-6 py-5 bg-rose-500/10 text-rose-400 rounded-[2rem] font-black text-[10px] uppercase hover:bg-rose-500 hover:text-white transition-all shadow-lg active:scale-95"><LogOut size={16} /> Keluar Sistem</button>
        </div>
      </aside>

      <main className="flex-1 p-8 lg:p-16 overflow-y-auto relative no-print">
        <header className="mb-12 flex justify-between items-end">
          <div className="animate-in slide-in-from-left duration-700">
            <p className="text-emerald-600 font-black text-xs uppercase tracking-[0.3em] mb-3 italic">Halaman Utama</p>
            <h2 className="text-6xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">
              {activeTab === 'dashboard' ? 'Drive Insight' : activeTab === 'upload' ? 'Data Ingest' : activeTab === 'users' ? 'User Access' : 'Digital Ledger'}
            </h2>
          </div>
          {activeTab === 'users' && (
            <button onClick={() => { setEditingUser(null); setUserData({ nip: '', password: '', displayName: '', kecamatan: '' }); setIsUserModalOpen(true); }} className="px-10 py-5 bg-emerald-950 text-white rounded-[2rem] font-black uppercase text-xs flex items-center gap-3 hover:bg-emerald-600 hover:shadow-2xl transition-all italic shadow-xl animate-in zoom-in duration-500"><Plus size={20}/> Daftarkan Operator</button>
          )}
        </header>

        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in duration-700">
            <div className="bg-white p-12 rounded-[3.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-emerald-50 relative overflow-hidden group">
              <div className="relative z-10">
                <div className="p-5 bg-emerald-50 text-emerald-600 rounded-3xl w-fit mb-8 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-500"><Database size={40}/></div>
                <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest mb-2">Total Dokumen Cloud</p>
                <p className="text-7xl font-black text-slate-900 italic tracking-tighter">{archives.length}</p>
              </div>
              <div className="absolute -right-8 -bottom-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500 rotate-12 scale-150">
                <Archive size={200} />
              </div>
            </div>
            
            <div className="bg-emerald-950 p-12 rounded-[3.5rem] shadow-[0_30px_70px_-15px_rgba(6,78,59,0.3)] text-white md:col-span-2 flex flex-col justify-between overflow-hidden relative border-4 border-emerald-500/10">
              <div className="relative z-10">
                <p className="text-4xl font-black italic uppercase leading-tight mb-4 tracking-tighter">Penyimpanan Terpusat<br/><span className="text-emerald-400">Google Drive API v3</span></p>
                <p className="text-emerald-400/60 font-bold uppercase tracking-[0.2em] text-[10px] max-w-md leading-relaxed">Arsitektur teringan untuk efisiensi akses 31 KUA di seluruh Kabupaten Jember tanpa biaya server tambahan.</p>
              </div>
              <div className="flex gap-4 mt-12 relative z-10">
                 <div className="px-6 py-3 bg-white/5 rounded-full border border-white/10 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest">End-to-End Encryption</span>
                 </div>
                 <div className="px-6 py-3 bg-white/5 rounded-full border border-white/10 flex items-center gap-2">
                    <Cloud size={16} className="text-emerald-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Auto-Sync</span>
                 </div>
              </div>
              <Cloud size={250} className="absolute -right-16 -bottom-16 opacity-[0.05] rotate-12" />
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-8 animate-in slide-in-from-bottom duration-700">
             <div className="bg-white rounded-[3.5rem] shadow-2xl border border-emerald-50 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-emerald-950 text-white text-[10px] font-black uppercase tracking-[0.2em] italic">
                    <tr>
                      <th className="px-10 py-8">Nama Operator</th>
                      <th className="px-10 py-8">NIP</th>
                      <th className="px-10 py-8">Wilayah KUA</th>
                      <th className="px-10 py-8 text-right">Manajemen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {kecamatanUsers.map(u => (
                      <tr key={u.id} className="hover:bg-emerald-50/40 transition-all text-xs font-bold text-slate-700 group">
                        <td className="px-10 py-8">
                           <p className="text-slate-900 font-black uppercase italic tracking-tight">{u.displayName}</p>
                        </td>
                        <td className="px-10 py-8 font-mono tracking-widest text-emerald-600">{u.nip}</td>
                        <td className="px-10 py-8"><span className="px-4 py-2 bg-emerald-100 text-emerald-800 rounded-2xl text-[10px] uppercase font-black tracking-widest">{u.kecamatan}</span></td>
                        <td className="px-10 py-8 flex gap-3 justify-end opacity-40 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => { setEditingUser(u); setUserData(u); setIsUserModalOpen(true); }} className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all"><Edit size={18}/></button>
                           <button onClick={() => handleDeleteUser(u.id)} className="p-4 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all"><Trash2 size={18}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {kecamatanUsers.length === 0 && (
                   <div className="p-20 text-center opacity-20">
                      <Users size={100} className="mx-auto mb-6" />
                      <p className="text-2xl font-black uppercase italic tracking-tighter">Belum ada operator terdaftar</p>
                   </div>
                )}
             </div>
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-in zoom-in duration-500">
            <div className="bg-white p-20 rounded-[4.5rem] shadow-2xl border border-emerald-50 text-center flex flex-col items-center group relative overflow-hidden">
              <div className={`p-12 rounded-full mb-10 transition-all duration-500 ${isUploading ? 'bg-emerald-100 animate-pulse' : 'bg-emerald-50 group-hover:scale-110'}`}><FileUp size={60} className="text-emerald-600" /></div>
              <h3 className="text-4xl font-black mb-4 italic uppercase tracking-tighter">Pindai AI Gemini</h3>
              <p className="text-xs text-slate-400 font-bold mb-12 uppercase tracking-widest">Otomatis Ekstrak Metadata Drive</p>
              <label className="w-full bg-emerald-950 text-white py-8 rounded-[2.5rem] font-black uppercase tracking-widest cursor-pointer hover:bg-black transition-all italic text-sm shadow-xl flex items-center justify-center gap-4 group/btn">
                {isUploading ? <RefreshCw className="animate-spin" /> : <Archive size={20} />}
                {isUploading ? 'Memproses Arsip...' : 'Pilih File Arsip'}
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
              </label>
            </div>
            <div className="bg-emerald-50 p-20 rounded-[4.5rem] text-center border-4 border-dashed border-emerald-200 flex flex-col items-center group">
              <div className="p-12 bg-white rounded-full mb-10 shadow-xl group-hover:scale-110 transition-all duration-500"><Keyboard size={60} className="text-emerald-600" /></div>
              <h3 className="text-4xl font-black mb-4 italic uppercase tracking-tighter">Input Manual</h3>
              <p className="text-xs text-slate-400 font-bold mb-12 uppercase tracking-widest">Form Manual Buku Besar</p>
              <button onClick={() => setIsManualEntryOpen(true)} className="w-full bg-white text-emerald-950 py-8 rounded-[2.5rem] font-black uppercase tracking-widest border-2 border-emerald-200 hover:bg-emerald-950 hover:text-white transition-all italic text-sm shadow-lg">Buka Form Entri</button>
            </div>
          </div>
        )}

        {activeTab === 'archives' && (
          <div className="space-y-8 animate-in slide-in-from-bottom duration-700">
             <div className="flex gap-6">
                <div className="flex-1 relative">
                   <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-300" size={24} />
                   <input type="text" placeholder="Cari Suami, Istri, atau Wilayah..." className="w-full pl-20 pr-10 py-7 rounded-[2.5rem] bg-white border border-emerald-50 shadow-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/10 font-black italic uppercase text-sm tracking-widest placeholder:text-slate-200" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
                <button onClick={() => window.print()} className="px-12 py-7 bg-emerald-950 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-widest flex items-center gap-4 shadow-2xl hover:bg-black transition-all italic"><Printer size={20} /> Cetak Buku</button>
             </div>
             <div className="bg-white rounded-[4rem] shadow-2xl border border-emerald-50 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-emerald-950 text-white text-[10px] font-black uppercase tracking-[0.25em] italic">
                    <tr>
                      <th className="px-10 py-8">Arsip Pernikahan</th>
                      <th className="px-10 py-8">Nomor Akta</th>
                      <th className="px-10 py-8">KUA Kecamatan</th>
                      <th className="px-10 py-8 text-right">Opsi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredArchives.map(arc => (
                      <tr key={arc.id} className="hover:bg-emerald-50/40 transition-all text-xs font-bold text-slate-700 group">
                        <td className="px-10 py-8">
                           <p className="text-slate-900 font-black uppercase italic tracking-tighter leading-tight">{arc.extractedData.uraian}</p>
                           <p className="text-[10px] text-emerald-600 uppercase italic font-black mt-1">Selesai: {arc.extractedData.tanggalNikah}</p>
                        </td>
                        <td className="px-10 py-8 font-mono tracking-widest">{arc.extractedData.nomorAkta}</td>
                        <td className="px-10 py-8"><span className="px-4 py-2 bg-slate-100 text-slate-600 rounded-full text-[10px] uppercase font-black tracking-widest italic">{arc.kecamatan}</span></td>
                        <td className="px-10 py-8 flex gap-3 justify-end opacity-40 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => setPreviewArchive(arc)} className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all"><Eye size={18}/></button>
                           <button onClick={() => handleDeleteArchive(arc.id)} className="p-4 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all"><Trash2 size={18}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredArchives.length === 0 && (
                  <div className="p-32 text-center opacity-10">
                     <Archive size={150} className="mx-auto" />
                  </div>
                )}
             </div>
          </div>
        )}
      </main>

      {/* User Management Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-8 bg-emerald-950/95 backdrop-blur-2xl">
           <div className="bg-white w-full max-w-lg rounded-[4.5rem] p-16 shadow-[0_50px_100px_rgba(0,0,0,0.5)] relative animate-in zoom-in duration-300">
              <button onClick={() => setIsUserModalOpen(false)} className="absolute top-12 right-12 p-5 text-slate-300 hover:text-rose-500 transition-colors bg-slate-50 rounded-full"><X size={32}/></button>
              <div className="text-center mb-12">
                <Users className="mx-auto mb-6 text-emerald-600" size={60} />
                <h3 className="text-4xl font-black italic uppercase tracking-tighter">{editingUser ? 'Edit' : 'Daftar'} Operator</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Akses Cloud KUA Jember</p>
              </div>
              <form onSubmit={handleSaveUser} className="space-y-6">
                 <input required placeholder="NAMA LENGKAP" className="w-full px-10 py-6 rounded-2xl bg-slate-50 border border-slate-100 font-black uppercase italic tracking-widest focus:ring-4 focus:ring-emerald-500/10 outline-none" value={userData.displayName} onChange={e => setUserData({...userData, displayName: e.target.value})}/>
                 <input required placeholder="NIP / USER ID" className="w-full px-10 py-6 rounded-2xl bg-slate-50 border border-slate-100 font-black tracking-widest focus:ring-4 focus:ring-emerald-500/10 outline-none" value={userData.nip} onChange={e => setUserData({...userData, nip: e.target.value})}/>
                 <input required type="password" placeholder="PASSWORD BARU" className="w-full px-10 py-6 rounded-2xl bg-slate-50 border border-slate-100 font-black tracking-widest focus:ring-4 focus:ring-emerald-500/10 outline-none" value={userData.password} onChange={e => setUserData({...userData, password: e.target.value})}/>
                 <select required className="w-full px-10 py-6 rounded-2xl bg-slate-50 border border-slate-100 font-black uppercase italic tracking-widest focus:ring-4 focus:ring-emerald-500/10 outline-none" value={userData.kecamatan} onChange={e => setUserData({...userData, kecamatan: e.target.value})}>
                    <option value="">PILIH WILAYAH KUA</option>
                    {KECAMATAN_LIST.map(k => <option key={k} value={k}>{k}</option>)}
                 </select>
                 <button type="submit" className="w-full py-8 bg-emerald-600 text-white rounded-[3rem] font-black uppercase tracking-[0.3em] hover:bg-emerald-500 transition-all italic shadow-2xl mt-4 active:scale-95">Simpan Operator</button>
              </form>
           </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {isManualEntryOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-emerald-950/95 backdrop-blur-2xl no-print">
           <div className="bg-white w-full max-w-5xl rounded-[5rem] p-16 lg:p-24 overflow-y-auto max-h-[95vh] shadow-[0_60px_120px_rgba(0,0,0,0.6)] relative animate-in zoom-in duration-300">
              <button onClick={() => setIsManualEntryOpen(false)} className="absolute top-12 right-12 p-6 bg-slate-50 rounded-full text-slate-300 hover:text-rose-500 transition-all hover:rotate-90"><X size={40}/></button>
              <div className="mb-16">
                <h3 className="text-6xl font-black italic uppercase mb-4 tracking-tighter leading-none">Buku Besar Manual</h3>
                <p className="text-emerald-600 font-black uppercase tracking-[0.4em] text-xs italic">Registrasi Arsip Akta Nikah</p>
              </div>
              <form onSubmit={handleManualSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-12">
                 <div className="space-y-8 p-10 bg-slate-50 rounded-[3.5rem] border border-slate-100">
                    <p className="text-[11px] font-black uppercase text-emerald-600 tracking-[0.3em] italic mb-2">I. Biodata Pasangan</p>
                    <input required placeholder="NAMA LENGKAP SUAMI" className="w-full px-10 py-6 rounded-2xl bg-white border border-slate-100 font-black uppercase italic tracking-widest focus:ring-4 focus:ring-emerald-500/10" value={manualData.suami} onChange={e => setManualData({...manualData, suami: e.target.value})}/>
                    <input required placeholder="NAMA LENGKAP ISTRI" className="w-full px-10 py-6 rounded-2xl bg-white border border-slate-100 font-black uppercase italic tracking-widest focus:ring-4 focus:ring-emerald-500/10" value={manualData.istri} onChange={e => setManualData({...manualData, istri: e.target.value})}/>
                 </div>
                 <div className="space-y-8 p-10 bg-emerald-50/50 rounded-[3.5rem] border border-emerald-100">
                    <p className="text-[11px] font-black uppercase text-emerald-600 tracking-[0.3em] italic mb-2">II. Administrasi Nikah</p>
                    <input required placeholder="NOMOR AKTA (REGISTRASI)" className="w-full px-10 py-6 rounded-2xl bg-white border border-emerald-100 font-black tracking-widest focus:ring-4 focus:ring-emerald-500/10" value={manualData.nomorAkta} onChange={e => setManualData({...manualData, nomorAkta: e.target.value})}/>
                    <div className="relative group">
                      <p className="absolute -top-3 left-6 px-3 bg-white text-[9px] font-black text-emerald-600 rounded-full border border-emerald-100 uppercase tracking-widest">Tanggal Peristiwa</p>
                      <input required type="date" className="w-full px-10 py-6 rounded-2xl bg-white border border-emerald-100 font-black tracking-widest" value={manualData.tanggalNikah} onChange={e => setManualData({...manualData, tanggalNikah: e.target.value})}/>
                    </div>
                 </div>
                 <div className="md:col-span-2">
                    <select required className="w-full px-10 py-8 rounded-[2.5rem] bg-emerald-950 text-white font-black uppercase italic tracking-[0.2em] focus:ring-4 focus:ring-emerald-500/50 outline-none text-center appearance-none" value={manualData.lokasiNikah} onChange={e => setManualData({...manualData, lokasiNikah: e.target.value})}>
                      <option value="">-- PILIH KUA KECAMATAN JEMBER --</option>
                      {KECAMATAN_LIST.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                 </div>
                 <button type="submit" className="md:col-span-2 py-10 bg-emerald-600 text-white rounded-[3rem] font-black uppercase tracking-[0.4em] text-xl hover:bg-emerald-500 transition-all italic active:scale-95 shadow-[0_30px_60px_-10px_rgba(5,150,105,0.4)] mt-6">Simpan Permanen ke Drive</button>
              </form>
           </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewArchive && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-8 bg-black/95 backdrop-blur-3xl no-print">
           <div className="bg-white w-full max-w-[95vw] h-[90vh] rounded-[5rem] shadow-2xl overflow-hidden flex flex-col lg:flex-row relative animate-in zoom-in duration-500">
              <button onClick={() => setPreviewArchive(null)} className="absolute top-12 left-12 p-6 bg-white rounded-full text-emerald-950 shadow-2xl z-20 hover:scale-110 transition-transform hover:rotate-90"><X size={36}/></button>
              
              <div className="flex-1 bg-emerald-950 flex items-center justify-center p-16 overflow-hidden relative">
                 {previewArchive.fileUrl ? (
                   <img src={drive.getFileUrl(previewArchive.fileUrl)} className="max-w-full max-h-full object-contain rounded-3xl shadow-[0_50px_100px_rgba(0,0,0,0.8)]" />
                 ) : (
                   <div className="text-center text-white p-24 opacity-20"><Archive size={300} className="mx-auto mb-10" /><p className="text-5xl font-black uppercase italic tracking-tighter">Buku Besar (Manual)</p></div>
                 )}
              </div>

              <div className="w-full lg:w-[500px] bg-white p-16 lg:p-24 overflow-y-auto border-l border-slate-100 flex flex-col">
                 <div className="mb-16">
                    <p className="text-emerald-600 font-black text-xs uppercase tracking-[0.4em] mb-3 italic">Arsip Cloud</p>
                    <h4 className="text-5xl font-black uppercase italic tracking-tighter leading-none mb-2">Detail Metadata</h4>
                 </div>
                 <div className="space-y-10 flex-1">
                    <div className="p-10 bg-slate-50 rounded-[3rem] border border-slate-100 shadow-inner">
                       <p className="text-[10px] font-black text-slate-400 uppercase italic tracking-widest mb-4">Informasi Pasangan</p>
                       <p className="text-2xl font-black text-slate-900 leading-tight uppercase italic tracking-tighter">{previewArchive.extractedData.suami}<br/><span className="text-emerald-600">&</span> {previewArchive.extractedData.istri}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                       <div className="p-8 bg-emerald-50/50 rounded-[2.5rem] border border-emerald-100">
                          <p className="text-[10px] font-black uppercase text-emerald-600 italic tracking-widest mb-2">No. Registrasi</p>
                          <p className="font-black text-slate-900 text-sm tracking-widest break-all uppercase italic">{previewArchive.extractedData.nomorAkta}</p>
                       </div>
                       <div className="p-8 bg-emerald-50/50 rounded-[2.5rem] border border-emerald-100">
                          <p className="text-[10px] font-black uppercase text-emerald-600 italic tracking-widest mb-2">Tanggal Akad</p>
                          <p className="font-black text-slate-900 text-sm italic">{previewArchive.extractedData.tanggalNikah}</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-6 p-10 bg-emerald-950 text-white rounded-[3rem] shadow-xl mt-4">
                       <MapPin size={40} className="text-emerald-400 shrink-0" />
                       <div>
                          <p className="text-[10px] font-black uppercase text-emerald-500 italic tracking-widest mb-1">Kantor Urusan Agama</p>
                          <p className="text-xl font-black italic uppercase tracking-tighter">Kec. {previewArchive.kecamatan}</p>
                       </div>
                    </div>
                    <button onClick={() => window.print()} className="w-full py-10 bg-emerald-600 text-white rounded-[3rem] font-black uppercase text-sm tracking-[0.3em] italic flex items-center justify-center gap-5 shadow-2xl hover:bg-emerald-500 transition-all mt-6 active:scale-95 group">
                       <Printer size={28} className="group-hover:rotate-12 transition-transform" /> Cetak Salinan
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      <style>{`
        .animate-in { animation: slide-up 0.8s cubic-bezier(0.23, 1, 0.32, 1) forwards; } 
        @keyframes slide-up { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
};

export default App;