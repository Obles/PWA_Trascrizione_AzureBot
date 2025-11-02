# 🎙️ PWA_Trascrizione

> App **PWA** per la **registrazione vocale**, la **trascrizione automatica** con **OpenAI**, e l’**invio del testo via email**.

---

## 🧩 Descrizione

**PWA_Trascrizione** è un’app web installabile su **iPhone**, **Android** e **desktop**, che consente di:
1. Registrare la voce tramite microfono.
2. Convertire l’audio in testo usando le API di **OpenAI Whisper / GPT-4o-mini-transcribe**.
3. Inviare automaticamente la trascrizione via **email SMTP (Gmail)**.

---

## ⚙️ Stack tecnologico

| Componente | Descrizione |
|-------------|-------------|
| **Frontend** | HTML5, CSS3, JavaScript (MediaRecorder API) |
| **Backend** | Node.js + Express |
| **Audio Processing** | FFmpeg (via `fluent-ffmpeg` e `ffmpeg-static`) |
| **AI API** | OpenAI `audio.transcriptions.create` |
| **Email Service** | Nodemailer (SMTP Gmail, password per app) |
| **PWA Support** | Manifest + icone installabili su iOS e Android |

---
## struttura cartelle
    PWA_Trascrizione/
    │
    └── /DOC/            ← Documentazione Applicazione
        ├── TrascrizioneVocale-CloudRender.md    ← Documentazione in .md

    ├── index.html         ← interfaccia utente principale (pagina PWA)
    ├── app.js             ← logica frontend: registra, ferma, invia audio
    ├── style.css          ← stile grafico della PWA
    ├── manifest.json      ← configurazione installazione su iPhone/Android
    │
    ├── serverMail.js      ← server Node.js con trascrizione + invio email
    ├── serverOld.js       ← versione precedente (solo trascrizione)
    │
    ├── .env               ← credenziali OpenAI + Gmail (non va pubblicato!)
    ├── package.json       ← definizione dipendenze npm
    │
    └── /icons/            ← icone PWA per home screen / splash screen
        ├── icon-192.png
        └── icon-512.png
    |
    └── README.md         ← readme di progetto

---
## 🚀 Avvio locale

### 1️⃣ Installa le dipendenze
```bash
npm install
# 1. Installa Node.js LTS (se manca)
winget install OpenJS.NodeJS.LTS

# 2. Installa Git
winget install Git.Git

# 3. Verifica installazioni
node -v
npm -v
git --version
