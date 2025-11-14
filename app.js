/*****************************************************************************************
 * 🎙️ PWA_Trascrizione – app.js
 *
 * 🔧 Versione migliorata:
 * - Il log viene cancellato solo quando si preme “Registra”
 * - Alla pressione di “Ferma” il log rimane visibile
 * - Compatibile con localhost:5500, 127.0.0.1:5500 e Azure
 *****************************************************************************************/

console.log("✅ app.js caricato correttamente (" + window.location.origin + ")");

function logToScreen(message) {
  const box = document.getElementById("debug-log");
  if (box) {
    const line = document.createElement("div");
    line.textContent = message;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
  }
  console.log(message);
}

// 🟢 Inizializzazione log all’avvio
document.addEventListener("DOMContentLoaded", () => {
  const box = document.getElementById("debug-log");
  if (box) {
    box.innerHTML = "<b style='color:lime'>Log in tempo reale:</b>";
    console.log("🔧 Box log inizializzato correttamente");
  } else {
    console.warn("⚠️ Nessun elemento #debug-log trovato nel DOM");
  }
});

let mediaRecorder;
let audioChunks = [];

const recordBtn = document.getElementById("recordBtn");
const stopBtn   = document.getElementById("stopBtn");
const result    = document.getElementById("result");

recordBtn.onclick = async () => {
  // 🔄 Pulisce il log a ogni nuova registrazione
  const box = document.getElementById("debug-log");
  if (box) {
    box.innerHTML = "<b style='color:lime'>Log in tempo reale:</b>";
    logToScreen("🧹 Log precedente cancellato");
  }

  logToScreen("🎙️ Bottone Registra premuto");

  try {
    // Ottiene il microfono
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    logToScreen("✅ Accesso microfono ottenuto");

    mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    audioChunks = [];

    mediaRecorder.ondataavailable = e => {
      audioChunks.push(e.data);
      logToScreen("🎧 Dato audio disponibile (" + e.data.size + " byte)");
    };

    mediaRecorder.onstart = () => {
      logToScreen("▶️ Registrazione avviata");
      result.textContent = "🎙️ Registrazione in corso...";
    };

    mediaRecorder.onstop = async () => {
      logToScreen("⏹️ Registrazione fermata");
      result.textContent = "⏳ Invio audio al server...";

      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      if (audioBlob.size < 1000) {
        logToScreen("⚠️ Audio troppo corto o vuoto");
        result.textContent = "⚠️ Nessun audio registrato";
        return;
      }

      const formData = new FormData();
      formData.append("file", audioBlob, "audio.webm");

      try {
        logToScreen("📤 Invio al server...");

        // 🔧 Rilevamento automatico ambiente (locale vs Azure)
        const apiBase =
          window.location.hostname.includes("127.0.0.1") ||
          window.location.hostname.includes("localhost")
            ? "http://localhost:3000"
            : window.location.origin;

        logToScreen("🌐 Endpoint API rilevato: " + apiBase + "/trascrivi");

        const resp = await fetch(`${apiBase}/trascrivi`, {
          method: "POST",
          body: formData
        });

        const data = await resp.json();
        logToScreen("📩 Risposta server: " + JSON.stringify(data));
        result.textContent = "📝 Testo: " + (data.testo || "Errore o risposta vuota");
      } catch (err) {
        logToScreen("❌ Errore fetch verso server: " + err.message);
        result.textContent = "❌ Errore di comunicazione con il server.";
      }
    };

    mediaRecorder.start();
    recordBtn.disabled = true;
    stopBtn.disabled   = false;
  } catch (err) {
    logToScreen("❌ Errore microfono: " + err.message);
    result.textContent = "⚠️ Accesso al microfono negato o non disponibile.";
  }
};

stopBtn.onclick = () => {
  logToScreen("🛑 Bottone Ferma premuto");
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    setTimeout(() => {
      logToScreen("⏹️ Arresto registrazione forzato");
      mediaRecorder.stop();
    }, 500);
    recordBtn.disabled = false;
    stopBtn.disabled   = true;
  } else {
    logToScreen("⚠️ Nessuna registrazione in corso");
  }
};
