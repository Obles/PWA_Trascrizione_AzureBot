import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import fs from "fs";
import FormData from "form-data";
import dotenv from "dotenv";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import nodemailer from "nodemailer";

dotenv.config();
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(express.static("."));
const upload = multer({ dest: "uploads/" });
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 💌 Configurazione SMTP da .env
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// ✅ Test SMTP all’avvio
transporter.verify(function (error, success) {
  if (error) {
    console.error("❌ Connessione SMTP fallita:", error.message);
  } else {
    console.log("✅ Connessione SMTP Gmail riuscita, pronto a inviare email.");
  }
});

app.get("/", (req, res) => {
  res.send("✅ Server attivo e pronto per /trascrivi");
});

app.post("/trascrivi", upload.single("file"), async (req, res) => {
  console.log("🎧 File ricevuto:", req.file?.originalname, req.file?.mimetype, req.file?.size, "byte");

  const inputPath = req.file.path;
  const outputPath = `${inputPath}.mp3`;

  try {
    // 🎶 Conversione in MP3 standard compatibile
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

  // 🕐 Pausa di sicurezza per assicurarsi che l’MP3 sia completo
  await new Promise(resolve => setTimeout(resolve, 300));

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

    const testo = data.text || "❌ Nessuna trascrizione ricevuta";
    res.json({ testo });

    // 💌 Invia l’email con testo + allegati
    const dataOra = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });
    const mailOptions = {
      from: `"Trascrizione Vocale" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_TO,
      subject: `Trascrizione vocale – ${dataOra}`,
      text: testo,
      attachments: [
        {
          filename: `registrazione_${Date.now()}.mp3`,
          path: outputPath
        },
        {
          filename: `trascrizione_${Date.now()}.txt`,
          content: testo
        }
      ]
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`📧 Email inviata con successo a ${process.env.SMTP_TO}`);
    } catch (mailError) {
      console.error("❌ Errore invio email:", mailError);
    }

    // 🧹 Pulizia dei file temporanei
    try {
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
      console.log("🧽 File temporanei rimossi.");
    } catch (cleanupErr) {
      console.warn("⚠️ Impossibile rimuovere file temporanei:", cleanupErr);
    }

  } catch (error) {
    console.error("❌ Errore server:", error);
    res.status(500).json({ testo: "❌ Errore nel server: " + error.message });
  }
});

// app.listen(3000, () =>
//   console.log("✅ Server con email avviato su http://localhost:3000")
// );
const port = process.env.PORT || 3000;

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server avviato su http://localhost:${port} (PORT=${port})`);
});