export enum UserRole {
  KABUPATEN = 'KABUPATEN',
  KECAMATAN = 'KECAMATAN'
}

export interface UserProfile {
  uid: string;
  nip: string;
  displayName: string;
  role: UserRole;
  kecamatan?: string;
}

export interface KecamatanUser {
  id: string;
  nip: string;
  password: string;
  displayName: string;
  kecamatan: string;
}

export interface MarriageArchive {
  id: string;
  fileUrl: string;
  fileName: string;
  fileHash: string;
  kecamatan: string;
  uploadDate: string;
  extractedData: {
    // Data Utama Pasangan
    suami: string;
    istri: string;
    nomorAkta: string;
    tanggalNikah: string;
    lokasiNikah: string;
    // Data Administrasi Arsip (Buku Besar)
    noBerkas: string;
    noItem: string;
    noNB: string;
    kodeKlasifikasi: string;
    uraian: string;
    kurunWaktu: string;
    mediaSimpan: string;
    jumlah: string;
    jangkaSimpan: string;
    tingkatPerkembangan: string;
    nomorBoks: string;
    lokasiSimpan: string;
    metodePerlindungan: string;
    keterangan: string;
  };
  uploaderEmail: string;
}

export const KECAMATAN_LIST = [
  "Ajung", "Ambulu", "Arjasa", "Balung", "Bangsalsari", "Gumukmas", 
  "Jelbuk", "Jenggawah", "Jombang", "Kalisat", "Kaliwates", "Kencong", 
  "Ledokombo", "Mayang", "Mumbulsari", "Pakusari", "Panti", "Patrang", 
  "Puger", "Rambipuji", "Semboro", "Silo", "Sukorambi", "Sukowono", 
  "Sumberbaru", "Sumberjambe", "Sumbersari", "Tanggul", "Tempurejo", 
  "Umbulsari", "Wuluhan"
];