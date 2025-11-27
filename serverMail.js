/*****************************************************************************************
 * 🎙️ PWA_Trascrizione – serverMail.js (versione aggiornata per Office 365 Exchange)
 * 
 * 🔧 Fix definitivo:
 * - Gestione risposta vuota da OpenAI (rawText === "")
 * - Eliminati ritorni doppi e garantito sempre res.json()
 * - Debug completo di rete e conversione
 *
 * 🔐 [SECURITY] Aggiornamento:
 * - Gestione doppio ambiente: locale (sviluppo) vs Azure (EasyAuth + Entra ID)
 * - Middleware requirePwaAccessGroup applicato alla route /trascrivi
 * - Route di debug /api/debug/auth per ispezionare i claims in Azure
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

/* 🔐 [SECURITY] Configurazione ambiente applicativo
   APP_ENV=local  → modalità sviluppo/debug locale (nessuna EasyAuth, utente simulato)
   APP_ENV=azure  → modalità WebApp Azure (EasyAuth + Entra ID + gruppi)
*/
const APP_ENV = process.env.APP_ENV || "local";
console.log(`🔐 [SECURITY] Ambiente applicativo: APP_ENV=${APP_ENV}`);

// ✅ Abilita CORS solo per ambiente locale (dev)
app.use(
  cors({
    origin: ["http://127.0.0.1:5500", "http://localhost:5500"],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 🧭 Gestione percorsi e servizio dei file statici
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🟢 Servizio dei file statici (frontend)
app.use(express.static(path.join(__dirname, "public")));

// 🚫 Disabilita cache e forza connessione persistente
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Connection", "keep-alive");
  next();
});

/* ========================================================================================
   🔐 [SECURITY] BLOCCO SECURITY PWA_Trascrizione
   - Gestione EasyAuth in Azure (X-MS-CLIENT-PRINCIPAL)
   - Simulazione utente in locale per sviluppo e debug
   ======================================================================================== */

// 🔐 [SECURITY] GUID del gruppo Entra autorizzato (PWA_Trascrizione_Access)
const REQUIRED_GROUP = "03e6e95e-d8c2-4b4f-9506-7f87c2298935";

// 🔐 [SECURITY] Lettura e decodifica header EasyAuth
function getClientPrincipal(req) {
  const header = req.headers["x-ms-client-principal"];
  if (!header) return null;

  try {
    const decoded = Buffer.from(header, "base64").toString("utf8");
    const principal = JSON.parse(decoded);
    return principal;
  } catch (err) {
    console.error("🔐 [SECURITY] Errore decodifica X-MS-CLIENT-PRINCIPAL:", err);
    return null;
  }
}

// 🔐 [SECURITY] Middleware di autorizzazione dual-mode (locale / Azure)
function requirePwaAccessGroup(req, res, next) {
  // 1️⃣ Modalità locale: nessuna EasyAuth, utente simulato per debug
  if (APP_ENV === "local") {
    req.user = {
      name: process.env.DEV_USER_NAME || "Dev User",
      email: process.env.DEV_USER_EMAIL || "dev@example.com",
      groups: ["LOCAL-DEVELOPER"],
    };
    return next();
  }

  // 2️⃣ Modalità Azure: uso EasyAuth + gruppi Entra
  const principal = getClientPrincipal(req);

  if (!principal) {
    return res
      .status(401)
      .send("Utente non autenticato (manca X-MS-CLIENT-PRINCIPAL in Azure)");
  }

  const claims = principal.claims || [];

  const groups = claims
    .filter((c) => c.typ === "groups")
    .map((c) => c.val);

  if (!groups.includes(REQUIRED_GROUP)) {
    return res
      .status(403)
      .send("Accesso negato: utente non appartiene al gruppo autorizzato");
  }

  const emailClaim =
    claims.find((c) => c.typ === "preferred_username") ||
    claims.find((c) => c.typ === "emails");

  const nameClaim = claims.find((c) => c.typ === "name");

  req.user = {
    name: nameClaim ? nameClaim.val : null,
    email: emailClaim ? emailClaim.val : null,
    groups,
  };

  next();
}

// 🔐 [SECURITY] Route di debug per verificare i claims (Azure / locale)
app.get("/api/debug/auth", (req, res) => {
  if (APP_ENV === "local") {
    return res.json({
      mode: "LOCAL DEVELOPMENT",
      user: {
        name: process.env.DEV_USER_NAME || "Dev User",
        email: process.env.DEV_USER_EMAIL || "dev@example.com",
        groups: ["LOCAL-DEVELOPER"],
      },
    });
  }

  const principal = getClientPrincipal(req);
  return res.json(
    principal || { error: "Nessun principal trovato (controllare EasyAuth)" }
  );
});

/* ========================================================================================
   🔹 UPLOAD & OPENAI
   ======================================================================================== */

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
  if (!data.access_token)
    throw new Error("❌ Impossibile ottenere token da Microsoft Graph");
  return data.access_token;
}

async function sendMailGraph(to, subject, bodyText, attachments = []) {
  const token = await getGraphAccessToken();
  const url = `https://graph.microsoft.com/v1.0/users/${M365_SENDER}/sendMail`;

  const graphAttachments = attachments
    .map((a) => {
      if (a.path && fs.existsSync(a.path)) {
        const content = fs.readFileSync(a.path).toString("base64");
        return {
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: a.filename,
          contentBytes: content,
        };
      } else if (a.content) {
        return {
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: a.filename,
          contentBytes: Buffer.from(a.content).toString("base64"),
        };
      }
      return null;
    })
    .filter(Boolean);

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
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(mail),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Graph sendMail error: ${errText}`);
  }

  console.log(`📧 Email inviata correttamente via Microsoft Graph → ${to}`);
}

const smtpTransporter = nodemailer.createTransport(smtpConfig);
smtpTransporter.verify((err) =>
  err
    ? console.error("⚠️ Connessione SMTP Exchange fallita:", err.message)
    : console.log("✅ Connessione SMTP Exchange riuscita (fallback pronto).")
);

/* ========================================================================================
   🔹 ENDPOINT PRINCIPALE
   ======================================================================================== */

// 🔐 [SECURITY] Qui è stata aggiunta requirePwaAccessGroup come middleware
app.post(
  "/trascrivi",
  requirePwaAccessGroup, // 🔐 [SECURITY] Protezione dual-mode (locale / Azure)
  upload.single("file"),
  async (req, res) => {
    console.log("⚡ [DEBUG] /trascrivi chiamato");
    res.on("finish", () =>
      console.log("⚡ [DEBUG] Risposta HTTP completata")
    );
    res.on("close", () => console.log("⚡ [DEBUG] Connessione chiusa dal client"));

    if (!req.file)
      return res.status(400).json({ testo: "❌ Nessun file ricevuto" });

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
      return res
        .status(500)
        .json({ testo: "Errore nella conversione audio" });
    }

    await new Promise((r) => setTimeout(r, 300));

    try {
      console.log("📤 Invio a OpenAI Whisper...");

      const formData = new FormData();
      formData.append("file", fs.createReadStream(outputPath));
      formData.append("model", "whisper-1");
      formData.append("language", "it");

      const response = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
          body: formData,
        }
      );

      console.log("📡 Status OpenAI:", response.status, response.statusText);
      const rawText = await response.text();

      if (!rawText) {
        console.error("⚠️ Nessuna risposta dal server OpenAI (vuota).");
        return res
          .status(502)
          .json({ testo: "❌ Nessuna risposta da OpenAI (vuota)" });
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
      const dataOra = new Date().toLocaleString("it-IT", {
        timeZone: "Europe/Rome",
      });
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
          console.log(
            `📧 Email inviata via SMTP Exchange fallback → ${process.env.SMTP_TO}`
          );
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
        console.warn(
          "⚠️ Impossibile rimuovere file temporanei:",
          cleanupErr
        );
      }

      console.log("✅ [DEBUG] JSON inviato al client:", testo);
      res.json({ testo });
    } catch (error) {
      console.error("❌ Errore chiamata OpenAI:", error);
      res.status(500).json({
        testo: "❌ Errore nella richiesta a OpenAI: " + error.message,
      });
    }
  }
);

process.on("unhandledRejection", (err) =>
  console.error("💥 ERRORE NON GESTITO (Promise):", err)
);
process.on("uncaughtException", (err) =>
  console.error("💥 ERRORE NON GESTITO (Exception):", err)
);

/*****************************************************************************************
 * 🔻 AVVIO SERVER
 *****************************************************************************************/
const port = process.env.PORT || 3000;

// Necessario per EasyAuth
app.get("/.auth/login/aad/callback", (req, res) => {
  res.redirect("/");
});

// PWA main page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Catch-all (solo dopo)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});


app.listen(port, "0.0.0.0", () => {
  console.log(
    `✅ Server con email avviato su http://localhost:${port} (APP_ENV=${APP_ENV})`
  );
});
