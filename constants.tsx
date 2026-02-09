
import React from 'react';

export const APP_NAME = "SIARNI JEMBER";
export const APP_DESCRIPTION = "Sistem Informasi Arsip Nikah Digital Jember";
export const KEMENAG_LOGO = "https://www.freepnglogos.com/uploads/logo-kemenag-png/logo-kementerian-agama-gambar-logo-depag-png-0.png";

export const Watermark = () => (
  <div className="watermark-overlay fixed inset-0 pointer-events-none select-none z-[999999] hidden print:flex flex-col items-center justify-center overflow-hidden">
    <div className="grid grid-cols-3 gap-x-20 gap-y-40 transform rotate-[-30deg] scale-125 opacity-[0.2]">
      {[...Array(15)].map((_, i) => (
        <div key={i} className="text-[4vw] font-black text-slate-900 whitespace-nowrap uppercase tracking-[0.3em] italic border-y-2 border-slate-900 py-4 px-8 text-center leading-tight">
          SIARNI JEMBER<br/>
          <span className="text-[1.5vw] tracking-[0.5em] font-bold opacity-80">ARSIP DIGITAL KEMENAG</span>
        </div>
      ))}
    </div>
  </div>
);
