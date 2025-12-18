# 🎙️ TrascrizioneVocale-CloudRender

PWA multipiattaforma per **registrazione vocale e trascrizione automatica** tramite **API OpenAI**, con invio email SMTP integrato.  
Backend in **Node.js**, compatibile con **iOS, Android e desktop**, deploy su **Render.com** (cloud gratuito e sicuro).

---

## 🧭 Sommario

1. [Analisi e progetti collegati](#analisi-e-progetti-collegati)
2. [Descrizione progetto](#descrizione-progetto)
3. [Preparazione ambiente di sviluppo](#preparazione-ambiente-di-sviluppo)
4. [Configurazione `.env`](#configurazione-env)
5. [Struttura progetto](#struttura-progetto)
6. [Manifest PWA](#manifest-pwa)
7. [Avvio locale](#avvio-locale)
8. [Deploy su Render](#deploy-su-render)
9. [Extra consigliati](#extra-consigliati)
10. [Test finale](#test-finale)

---

## 🔹 Analisi e progetti collegati

| Nome | Tipo | Descrizione sintetica |
|------|------|-----------------------|
| **PowerApps-Mp3-text** | App Power Apps | Registra voce in MP3 da iPhone → invia a Power Automate → OpenAI API `audio.transcriptions.create` |
| **App nativa iOS in Swift** | Analisi | Versione compilata in Swift con Xcode, accesso nativo all’audio e prestazioni superiori |
| **App universale senza compilatore OS** | Analisi | PWA multipiattaforma basata su tecnologie web (React / PWA / Expo) |
| **TrascrizioneVocale-CloudRender** | Progetto finale | Versione cloud completa con backend Node.js, PWA frontend e invio email automatico |

---

## 🧾 Descrizione progetto

- **Nome progetto:** `TrascrizioneVocale-CloudRender`  
- **Obiettivo:** consentire all’utente di registrare audio da browser / iPhone, inviare l’audio al backend Node.js, trascriverlo con OpenAI e ricevere il testo via email.  
- **Componente server:** `serverMail.js` (Express + ffmpeg + nodemailer)  
- **Hosting cloud:** [Render.com](https://render.com)  
- **URL previsto:** `https://trascrizionevocale-cloud.onrender.com`

---

## ⚙️ Preparazione ambiente di sviluppo

### 1️⃣ Prerequisiti di sistema

| Strumento | Descrizione | Download |
|------------|-------------|----------|
| **Node.js (LTS)** | Motore JavaScript per backend | [https://nodejs.org](https://nodejs.org) |
| **npm** | Gestore pacchetti Node (incluso) | — |
| **Visual Studio Code** | Editor principale | [https://code.visualstudio.com](https://code.visualstudio.com) |
| **Git** | Versionamento e deploy cloud | [https://git-scm.com](https://git-scm.com) |
| **ffmpeg-static** | Conversione audio WebM → MP3 | installato via npm |
| **Browser moderno** | Test locale (Chrome / Edge / Safari) | — |

---

### 2️⃣ Librerie Node.js

Da terminale nella cartella del progetto:

```bash
npm init -y
npm install express multer node-fetch form-data dotenv ffmpeg-static fluent-ffmpeg nodemailer
npm install nodemon --save-dev
```

---

### 3️⃣ Struttura progetto

```
PWA_Trascrizione/
│
├── index.html
├── app.js
├── style.css
├── manifest.json
├── serverMail.js
├── serverOld.js
├── .env
├── package.json
└── /icons/
     ├── icon-192.png
     └── icon-512.png
```

---

## 🔐 Configurazione `.env`

```bash
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxx

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=m.signoretto@gmail.com
SMTP_PASS=smit aikk uzyu sgyu
SMTP_TO=m.signoretto@gmail.com
```

> ⚠️ Usa la password per app di Gmail (non quella normale).  
> Gli spazi nella chiave vanno mantenuti come mostrato.

---

## 📄 Manifest PWA

```json
{
  "name": "Trascrizione Vocale",
  "short_name": "Trascrivi",
  "start_url": "/index.html",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## ▶️ Avvio locale

```bash
node serverMail.js
# oppure con autoreload
npx nodemon serverMail.js
```

Apri da browser / iPhone:

```
http://<tuo_IP_locale>:3000
```

> Per iPhone: stesso Wi-Fi del PC → Safari → Condividi → *Aggiungi alla schermata Home*  

---

## ☁️ Deploy su Render

1️⃣ Registrati su [https://render.com](https://render.com)  
2️⃣ Conferma la mail e accedi alla **Dashboard**  
3️⃣ Clicca **“New +” → Web Service**  
4️⃣ Collega il tuo repo GitHub oppure carica manualmente i file del progetto  
5️⃣ Specifica:  
   - **Runtime:** Node  
   - **Start Command:** `node serverMail.js`  
6️⃣ Nella sezione **Environment Variables**, incolla i valori del tuo `.env`  
7️⃣ Render fornirà un URL pubblico (es. `https://trascrizionevocale-cloud.onrender.com`)  

---

## 🧠 Extra consigliati

| Funzione | Pacchetto | Descrizione |
|-----------|------------|-------------|
| **PM2** | `npm install -g pm2` | Mantiene il server attivo in background |
| **compression** | `npm install compression` | Migliora le prestazioni HTTP |
| **morgan** | `npm install morgan` | Log avanzati nel terminal |
| **mkcert** | — | HTTPS locale (autocertificato) |

---

## ✅ Test finale

1️⃣ Apri l’app PWA sul telefono  
2️⃣ Premi **Registra → Ferma**  
3️⃣ Verifica la mail ricevuta:  
   - Oggetto → “Trascrizione vocale – data ora”  
   - Allegati → `.mp3` + `.txt`  
   - Corpo → testo trascritto in italiano  

---

## 📌 Titolo interno richiamabile
**`TrascrizioneVocale-CloudRender`**  
> PWA multipiattaforma con backend Node.js e invio email integrato – versione cloud Render.

# az login
## az login --use-device-code

az login --tenant 841d1384-c9f8-4de3-ba9d-b813f8dbaf4a