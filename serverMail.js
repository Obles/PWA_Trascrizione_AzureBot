/*****************************************************************************************
 * 🎙️ PWA_Trascrizione – serverMail.js (versione aggiornata per Office 365 Exchange)
 * 
 * 🔧 Fix definitivo:
 * - Gestione risposta vuota da OpenAI (rawText === "")
 * - Eliminati ritorni doppi e garantito sempre res.json()
 * - Debug completo di rete e conversione
 *****************************************************************************************/

import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import fs from "fs";
import FormData from "form-data";
import dotenv from "dotenv";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import nodemailer from "nodemailer";
import cors from "cors";

dotenv.config();
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();

//app.use(cors());

app.use(cors({
  origin: ["http://127.0.0.1:5500", "http://localhost:5500"],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.static("."));
const upload = multer({ dest: "uploads/" });
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/* ========================================================================================
   🔹 BLOCCO EMAIL (Graph + SMTP Exchange)
   ======================================================================================== */
const M365_TENANT_ID = process.env.M365_TENANT_ID;
const M365_CLIENT_ID = process.env.M365_CLIENT_ID;
const M365_CLIENT_SECRET = process.env.M365_CLIENT_SECRET;
const M365_SENDER = process.env.M365_SENDER;

const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: process.env.SMTP_SECURE === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  tls: { ciphers: "SSLv3" },
};

async function getGraphAccessToken() {
  const url = `https://login.microsoftonline.com/${M365_TENANT_ID}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("client_id", M365_CLIENT_ID);
  params.append("client_secret", M365_CLIENT_SECRET);
  params.append("scope", "https://graph.microsoft.com/.default");

  const response = await fetch(url, { method: "POST", body: params });
  const data = await response.json();
  if (!data.access_token) throw new Error("❌ Impossibile ottenere token da Microsoft Graph");
  return data.access_token;
}

async function sendMailGraph(to, subject, bodyText, attachments = []) {
  const token = await getGraphAccessToken();
  const url = `https://graph.microsoft.com/v1.0/users/${M365_SENDER}/sendMail`;

  const graphAttachments = attachments.map(a => {
    if (a.path && fs.existsSync(a.path)) {
      const content = fs.readFileSync(a.path).toString("base64");
      return { "@odata.type": "#microsoft.graph.fileAttachment", name: a.filename, contentBytes: content };
    } else if (a.content) {
      return { "@odata.type": "#microsoft.graph.fileAttachment", name: a.filename, contentBytes: Buffer.from(a.content).toString("base64") };
    }
    return null;
  }).filter(Boolean);

  const mail = {
    message: {
      subject,
      body: { contentType: "Text", content: bodyText },
      toRecipients: [{ emailAddress: { address: to } }],
      attachments: graphAttachments,
    },
    saveToSentItems: "true",
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(mail),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Graph sendMail error: ${errText}`);
  }

  console.log(`📧 Email inviata correttamente via Microsoft Graph → ${to}`);
}

const smtpTransporter = nodemailer.createTransport(smtpConfig);
smtpTransporter.verify(err =>
  err
    ? console.error("⚠️ Connessione SMTP Exchange fallita:", err.message)
    : console.log("✅ Connessione SMTP Exchange riuscita (fallback pronto).")
);

/* ========================================================================================
   🔹 ENDPOINT PRINCIPALE
   ======================================================================================== */
app.get("/", (req, res) => res.send("✅ Server attivo e pronto per /trascrivi"));

app.post("/trascrivi", upload.single("file"), async (req, res) => {
  console.log("⚡ [DEBUG] /trascrivi chiamato");
  res.on("finish", () => console.log("⚡ [DEBUG] Risposta HTTP completata"));
  res.on("close", () => console.log("⚡ [DEBUG] Connessione chiusa dal client"));

  if (!req.file) return res.status(400).json({ testo: "❌ Nessun file ricevuto" });

  const inputPath = req.file.path;
  const outputPath = `${inputPath}.mp3`;

  try {
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

  await new Promise(r => setTimeout(r, 300));

  try {
    console.log("📤 Invio a OpenAI Whisper...");

    const formData = new FormData();
    formData.append("file", fs.createReadStream(outputPath));
    formData.append("model", "whisper-1");
    formData.append("language", "it");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: formData,
    });

    console.log("📡 Status OpenAI:", response.status, response.statusText);
    const rawText = await response.text();

    if (!rawText) {
      console.error("⚠️ Nessuna risposta dal server OpenAI (vuota).");
      return res.status(502).json({ testo: "❌ Nessuna risposta da OpenAI (vuota)" });
    }

    console.log("📦 Body OpenAI (raw):", rawText);

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.error("⚠️ Errore parsing JSON:", parseErr.message);
      data = {};
    }

    const testo = data.text || "❌ Nessuna trascrizione ricevuta";

    // 📧 Invia email con allegati
    const dataOra = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" });
    const subject = `Trascrizione vocale – ${dataOra}`;
    const attachments = [
      { filename: `registrazione_${Date.now()}.mp3`, path: outputPath },
      { filename: `trascrizione_${Date.now()}.txt`, content: testo },
    ];

    try {
      await sendMailGraph(process.env.SMTP_TO, subject, testo, attachments);
    } catch (graphErr) {
      console.warn("⚠️ Invio via Graph fallito:", graphErr.message);
      try {
        await smtpTransporter.sendMail({
          from: `"Trascrizione Vocale" <${process.env.SMTP_USER}>`,
          to: process.env.SMTP_TO,
          subject,
          text: testo,
          attachments,
        });
        console.log(`📧 Email inviata via SMTP Exchange fallback → ${process.env.SMTP_TO}`);
      } catch (smtpErr) {
        console.error("❌ Errore invio email anche via SMTP:", smtpErr);
      }
    }

    // 🧹 Pulizia file
    try {
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
      console.log("🧽 File temporanei rimossi.");
    } catch (cleanupErr) {
      console.warn("⚠️ Impossibile rimuovere file temporanei:", cleanupErr);
    }

    console.log("✅ [DEBUG] JSON inviato al client:", testo);
    res.json({ testo });

  } catch (error) {
    console.error("❌ Errore chiamata OpenAI:", error);
    res.status(500).json({ testo: "❌ Errore nella richiesta a OpenAI: " + error.message });
  }
});

process.on("unhandledRejection", err => console.error("💥 ERRORE NON GESTITO (Promise):", err));
process.on("uncaughtException", err => console.error("💥 ERRORE NON GESTITO (Exception):", err));

/*****************************************************************************************
 * 🔻 AVVIO SERVER
 *****************************************************************************************/
app.listen(3000, () => console.log("✅ Server con email avviato su http://localhost:3000"));

// 🚀 PRODUZIONE / AZURE APP SERVICE
// const port = process.env.PORT || 3000;
// app.listen(port, "0.0.0.0", () => {
//   console.log(`✅ Server avviato su http://localhost:${port} (PORT=${port})`);
// });