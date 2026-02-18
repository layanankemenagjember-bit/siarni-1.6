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
            text: `Extract data from this document for the SIARNI JEMBER digital archive system.
            Identify if this is a MARRIAGE CERTIFICATE (Buku Nikah) or an EDUCATIONAL DIPLOMA (Ijazah).
            RETURN ONLY JSON.

            FOR MARRIAGE CERTIFICATES:
            - category: "PERNIKAHAN"
            - suami: Husband's name
            - istri: Wife's name
            - nomorAkta: Registration number
            - tanggalNikah: YYYY-MM-DD
            - uraian: "Akta Nikah a.n. [SUAMI] dan [ISTRI]"

            FOR DIPLOMAS (IJAZAH):
            - category: "PENDIDIKAN"
            - namaSiswa: Student's name
            - nomorIjazah: Serial number
            - tanggalLulus: Graduation date
            - namaSekolah: School name
            - uraian: "Ijazah a.n. [NAMASISWA] ([NAMASEKOLAH])"

            COMMON FIELDS:
            - kurunWaktu: Year (YYYY)
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
