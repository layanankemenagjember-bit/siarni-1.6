import React from 'react';

export const APP_NAME = "AMANAH";
export const APP_DESCRIPTION = "Aplikasi Manajemen Arsip Handal";
export const KEMENAG_LOGO = "https://upload.wikimedia.org/wikipedia/commons/9/9a/Kementerian_Agama_new_logo.png";

export const Watermark = ({ isVisible = false }: { isVisible?: boolean }) => (
  <div className={`watermark-overlay fixed inset-0 pointer-events-none select-none z-[999999] ${isVisible ? 'flex' : 'hidden'} print:flex flex-col items-center justify-center overflow-hidden`}>
    <div className="grid grid-cols-2 gap-x-20 gap-y-40 transform rotate-[-25deg] scale-150 opacity-[0.07]">
      {[...Array(12)].map((_, i) => (
        <div key={i} className="text-[5vw] font-black text-emerald-900 whitespace-nowrap uppercase tracking-[0.2em] italic border-y-4 border-emerald-900 py-6 px-12 text-center leading-tight">
          ARSIP KEMENAG JEMBER<br/>
          <span className="text-[2vw] tracking-[0.8em] font-bold opacity-80">VERIFIKASI DIGITAL - AMANAH</span>
        </div>
      ))}
    </div>
    {/* Visual Barcode on Print Bottom */}
    <div className="absolute bottom-10 right-10 flex flex-col items-center opacity-40">
       <div className="flex gap-1 h-8">
         {[...Array(30)].map((_, i) => <div key={i} className="w-[1.5px] bg-black" style={{ height: `${Math.random() * 20 + 10}px` }} />)}
       </div>
       <p className="text-[8px] font-mono font-bold mt-1">AMANAH-JEMBER-SEC-V1</p>
    </div>
  </div>
);