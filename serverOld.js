import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import fs from "fs";
import FormData from "form-data";
import dotenv from "dotenv";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";

dotenv.config();
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const upload = multer({ dest: "uploads/" });
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.post("/trascrivi", upload.single("file"), async (req, res) => {
  console.log("🎧 File ricevuto dal client:", req.file?.originalname, req.file?.mimetype, req.file?.size, "byte");

  const inputPath = req.file.path;
  const outputPath = `${inputPath}.mp3`;

  try {
    // 🔹 Conversione forzata in MP3 standard accettato
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioCodec("libmp3lame")
        .audioBitrate(128)
        .audioChannels(1)
        .audioFrequency(44100)
        .format("mp3")
        .on("end", resolve)
        .on("error", reject)
        .save(outputPath);
    });
    console.log("🎶 Conversione completata:", outputPath);
  } catch (err) {
    console.error("❌ Errore nella conversione:", err);
    return res.status(500).json({ testo: "Errore nella conversione audio" });
  }

  try {
    const formData = new FormData();
    formData.append("file", fs.createReadStream(outputPath));
    formData.append("model", "gpt-4o-mini-transcribe");
    formData.append("language", "it");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` },
      body: formData
    });

    const data = await response.json();
    console.log("📩 Risposta API:", data);

    if (data.text) {
      res.json({ testo: data.text });
    } else if (data.error) {
      res.status(400).json({ testo: "❌ Errore OpenAI: " + data.error.message });
    } else {
      res.status(400).json({ testo: "❌ Nessuna trascrizione ricevuta" });
    }

    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);
  } catch (error) {
    console.error("❌ Errore server:", error);
    res.status(500).json({ testo: "❌ Errore nel server: " + error.message });
  }
});

app.listen(3000, () => console.log("✅ Server avviato su http://localhost:3000"));
