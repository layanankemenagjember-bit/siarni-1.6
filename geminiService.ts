import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const extractMarriageData = async (base64Data: string, mimeType: string = "image/jpeg") => {
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
            text: `Extract data from this marriage certificate for a digital archive system. RETURN ONLY JSON.
            
            EXTRACT THESE FIELDS:
            - suami: Full name of the husband (UPPERCASE)
            - istri: Full name of the wife (UPPERCASE)
            - nomorAkta: The full registration number
            - tanggalNikah: Date of marriage (YYYY-MM-DD)
            - lokasiNikah: District name in Jember
            - kurunWaktu: The year of the marriage
            - uraian: Strictly follow this format: "Akta Nikah a.n. [SUAMI] dan [ISTRI]"
            
            ADMINISTRATIVE FIELDS (guess or use defaults):
            - noBerkas: Empty
            - noItem: Empty
            - noNB: Empty
            - kodeKlasifikasi: Default "HK.01"
            - mediaSimpan: Default "Kertas"
            - jumlah: Default "1 Berkas"
            - jangkaSimpan: Default "Permanen"
            - tingkatPerkembangan: Default "Asli"
            - nomorBoks: Default "Boks 1"
            - lokasiSimpan: Default "RAK A BARIS 2"
            - metodePerlindungan: Default "Vaulting"
            - keterangan: Default "Asli"`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suami: { type: Type.STRING },
            istri: { type: Type.STRING },
            nomorAkta: { type: Type.STRING },
            tanggalNikah: { type: Type.STRING },
            lokasiNikah: { type: Type.STRING },
            kurunWaktu: { type: Type.STRING },
            uraian: { type: Type.STRING },
            noBerkas: { type: Type.STRING },
            noItem: { type: Type.STRING },
            noNB: { type: Type.STRING },
            kodeKlasifikasi: { type: Type.STRING },
            mediaSimpan: { type: Type.STRING },
            jumlah: { type: Type.STRING },
            jangkaSimpan: { type: Type.STRING },
            tingkatPerkembangan: { type: Type.STRING },
            nomorBoks: { type: Type.STRING },
            lokasiSimpan: { type: Type.STRING },
            metodePerlindungan: { type: Type.STRING },
            keterangan: { type: Type.STRING },
          },
          required: ["suami", "istri", "nomorAkta", "tanggalNikah", "uraian"],
        },
      },
    });

    const result = response.text || "{}";
    const cleanJson = result.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleanJson || "{}");
    
    return {
      ...parsed,
      noBerkas: parsed.noBerkas || "",
      noItem: parsed.noItem || "",
      noNB: parsed.noNB || "",
      kodeKlasifikasi: parsed.kodeKlasifikasi || "HK.01",
      kurunWaktu: parsed.kurunWaktu || (parsed.tanggalNikah ? parsed.tanggalNikah.split('-')[0] : ""),
      mediaSimpan: parsed.mediaSimpan || "Kertas",
      jumlah: parsed.jumlah || "1 Berkas",
      jangkaSimpan: parsed.jangkaSimpan || "Permanen",
      tingkatPerkembangan: parsed.tingkatPerkembangan || "Asli",
      nomorBoks: parsed.nomorBoks || "Boks 1",
      lokasiSimpan: parsed.lokasiSimpan || "RAK A BARIS 2",
      metodePerlindungan: parsed.metodePerlindungan || "Vaulting",
      keterangan: parsed.keterangan || "Asli"
    };
  } catch (error) {
    console.error("OCR Error:", error);
    throw new Error("Gagal mengekstrak data dengan AI. Silakan gunakan input manual.");
  }
};