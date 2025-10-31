# ☁️ Deploy su Azure App Service (Piano F1 Free)

Guida completa per distribuire il backend **PWA_Trascrizione** su **Azure App Service – Piano F1 gratuito (0€/mese)**.

---

## 🧭 Obiettivo

Ospitare `serverMail.js` su Azure come backend Node.js gratuito e collegarlo alla PWA (Render o SharePoint).

---

## ⚙️ 1️⃣ Creazione risorsa App Service

1. Accedi a [https://portal.azure.com](https://portal.azure.com)
2. Cerca **App Services** → **Crea**
3. Configura i campi:

| Campo | Valore |
|-------|---------|
| **Nome app** | `pwa-trascrizione` |
| **Piano tariffario** | `F1 Free (0€/mese)` |
| **Runtime stack** | `Node 22 LTS` |
| **Sistema operativo** | `Linux` |
| **Regione** | `West Europe` (o `North Europe`) |

4. Clicca **Rivedi e crea** → **Crea**

---

## 🧩 2️⃣ Configurazione variabili ambiente (.env)

Dopo la creazione → vai su:
**App Service → Configurazione → Impostazioni applicazione → Nuova impostazione**

Inserisci le variabili:

```
OPENAI_API_KEY = sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
SMTP_HOST = smtp.gmail.com
SMTP_PORT = 465
SMTP_SECURE = true
SMTP_USER = m.signoretto@gmail.com
SMTP_PASS = xxxx aikk uzyu xxxx
SMTP_TO = m.signoretto@gmail.com
```

💡 Azure le memorizza in modo sicuro, quindi non serve caricare `.env` nel progetto.

---

## 📦 3️⃣ Caricamento file (deploy manuale)

### Metodo 1: da Visual Studio Code
1. Installa l’estensione **Azure App Service**
2. Accedi al tuo account Azure
3. Clic destro sulla cartella del progetto → **Deploy to Web App…**
4. Seleziona `pwa-trascrizione`
5. Conferma l’upload

### Metodo 2: tramite CLI Azure
Da terminale:

```bash
az webapp up --name pwa-trascrizione --runtime "NODE:22-lts"
```

---

## 🌐 4️⃣ URL pubblico dell’app

Dopo il deploy l’app sarà raggiungibile su:
```
https://pwa-trascrizione.azurewebsites.net
```

Aggiorna nella tua PWA (`app.js`):

```javascript
const response = await fetch("https://pwa-trascrizione.azurewebsites.net/trascrivi", {
  method: "POST",
  body: formData
});
```

---

## 🕐 5️⃣ Comportamento del piano F1

| Parametro | Descrizione |
|------------|-------------|
| 💰 Prezzo | 0 € / mese |
| ⏱️ Runtime | 60 minuti di CPU/giorno (poi “va in sleep”) |
| ⚙️ Risveglio | 5–10 secondi al primo accesso |
| 🔐 Sicurezza | HTTPS incluso, credenziali protette |
| 🌍 Dominio | `https://<nome>.azurewebsites.net` |

Perfetto per uso personale, test e demo in SharePoint o M365.

---

## ⚡ 6️⃣ Deploy automatico (GitHub Actions)

Puoi collegare il repository GitHub per aggiornamenti automatici.
Crea nella root `.github/workflows/azure-webapp.yml`:

```yaml
name: Azure WebApp CI/CD

on:
  push:
    branches:
      - main

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22.x'
      - run: npm install
      - run: npm run build --if-present
      - name: 'Deploy to Azure WebApp'
        uses: azure/webapps-deploy@v2
        with:
          app-name: 'pwa-trascrizione'
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
          package: .
```

### Per configurarlo:
1. Vai su GitHub → Repository → Settings → Secrets → Actions  
2. Aggiungi un nuovo secret chiamato **AZURE_WEBAPP_PUBLISH_PROFILE**  
3. Copia il *Publish Profile* da Azure → App Service → **Scarica profilo di pubblicazione**

---

## 📘 7️⃣ Suggerimento per test locale

Puoi continuare a testare in locale con:

```bash
node serverMail.js
```

E accedere a:

```
http://localhost:3000
```

Quando tutto funziona, fai il push su GitHub: l’azione aggiornerà automaticamente l’app su Azure.

---

## ✅ 8️⃣ Conclusione

✔️ Piano gratuito (F1) → nessun costo mensile  
✔️ Perfetta integrazione con SharePoint e Microsoft 365  
✔️ Trascrizione e invio email gestiti dal cloud  
✔️ Facile passaggio al piano B1 se in futuro servirà uptime continuo
