export enum UserRole {
  KABUPATEN = 'KABUPATEN',
  KECAMATAN = 'KECAMATAN',
  MADRASAH = 'MADRASAH'
}

export enum ArchiveCategory {
  PERNIKAHAN = 'PERNIKAHAN',
  PENDIDIKAN = 'PENDIDIKAN'
}

export interface UserProfile {
  uid: string;
  nip: string;
  displayName: string;
  role: UserRole;
  kecamatan?: string;
  madrasah?: string;
}

export interface KecamatanUser {
  id: string;
  nip: string;
  password: string;
  displayName: string;
  kecamatan?: string;
  madrasah?: string;
  role: UserRole;
}

export interface DigitalArchive {
  id: string;
  category: ArchiveCategory;
  fileBase64: string;
  fileName: string;
  fileHash: string;
  kecamatan?: string;
  madrasah?: string;
  uploadDate: string;
  extractedData: {
    suami?: string;
    istri?: string;
    nomorAkta?: string;
    tanggalNikah?: string;
    // Educational fields
    namaSiswa?: string;
    nomorIjazah?: string;
    tanggalLulus?: string;
    namaSekolah?: string;
    // Generic fields
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

export const MADRASAH_LIST = [
  "MIN 1", "MIN 2", "MIN 3", "MIN 4", "MIN 5",
  "MTS 1", "MTS 2", "MTS 3", "MTS 4", "MTS 5", "MTS 6", "MTS 7", "MTS 8", "MTS 9", "MTS 10", "MTS 11",
  "MAN 1", "MAN 2", "MAN 3"
];
