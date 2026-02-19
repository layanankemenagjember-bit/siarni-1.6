import { GoogleGenAI, Type } from "@google/genai";

export const extractArchiveData = async (base64Data: string, mimeType: string = "image/jpeg") => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            },
          },
          {
            text: `Extract data from this document for the AMANAH JEMBER digital archive system.
            Identify if this is a MARRIAGE CERTIFICATE (Buku Nikah / Akta Nikah) or an EDUCATIONAL DIPLOMA (Ijazah).
            RETURN ONLY JSON.

            FOR MARRIAGE CERTIFICATES (Buku Nikah / Akta Nikah):
            - category: "PERNIKAHAN"
            - suami: Husband's full name (Nama Lengkap Suami)
            - istri: Wife's full name (Nama Lengkap Istri)
            - nomorAkta: Registration number (Nomor Akta / No. Akta)
            - tanggalNikah: YYYY-MM-DD (Tanggal Pernikahan)
            - lokasiNikah: Kecamatan (District, e.g., AJUNG, AMBULU)
            - kurunWaktu: Year of marriage (YYYY)
            - uraian: "Akta Nikah a.n. [SUAMI] dan [ISTRI]"

            FOR DIPLOMAS (IJAZAH):
            - category: "PENDIDIKAN"
            - namaSiswa: Student's name (Nama Lengkap Siswa)
            - nomorIjazah: Serial number (Nomor Ijazah)
            - tanggalLulus: Graduation date (Tanggal Lulus)
            - namaSekolah: School name (Nama Madrasah/Sekolah)
            - kurunWaktu: Year of graduation (YYYY)
            - uraian: "Ijazah a.n. [NAMASISWA] ([NAMASEKOLAH])"

            COMMON FIELDS:
            - mediaSimpan: "Kertas"
            - jangkaSimpan: "Permanen"
            - tingkatPerkembangan: "Asli"`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            suami: { type: Type.STRING },
            istri: { type: Type.STRING },
            nomorAkta: { type: Type.STRING },
            tanggalNikah: { type: Type.STRING },
            namaSiswa: { type: Type.STRING },
            nomorIjazah: { type: Type.STRING },
            tanggalLulus: { type: Type.STRING },
            namaSekolah: { type: Type.STRING },
            uraian: { type: Type.STRING },
            kurunWaktu: { type: Type.STRING },
          },
        },
      },
    });

    const result = response.text || "{}";
    const cleanJson = result.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleanJson || "{}");
    
    return {
      ...parsed,
      kodeKlasifikasi: parsed.category === "PERNIKAHAN" ? "HK.01" : "PP.01",
      mediaSimpan: "Kertas",
      jumlah: "1 Berkas",
      jangkaSimpan: "Permanen",
      tingkatPerkembangan: "Asli",
      nomorBoks: "Boks 1",
      lokasiSimpan: "RAK A BARIS 2",
      metodePerlindungan: "Vaulting",
      keterangan: "Asli"
    };
  } catch (error) {
    console.error("OCR Error:", error);
    throw new Error("Gagal OCR. Silakan input manual.");
  }
};

export const chatAssistant = async (query: string, history: any[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      { role: "user", parts: [{ text: `You are SIARNI Assistant, helping Kemenag Jember staff with archiving. Context: 31 KUA districts and 19 Madrasah institutions. Help them with technical questions about scanning, metadata, or laws. Query: ${query}` }] }
    ],
  });
  return response.text;
};
