/*****************************************************************************************
 * 🎙️ PWA_Trascrizione – app.js
 *
 * 🔧 Versione finale:
 * - Usa style.css per il timer lampeggiante
 * - Log stabile (si cancella solo su “Start”)
 * - Funziona su localhost, 127.0.0.1 e Azure
 *****************************************************************************************/

console.log("✅ app.js caricato correttamente (" + window.location.origin + ")");

// 📜 Funzione di log off su schermo e console
document.addEventListener("DOMContentLoaded", () => {

    const userMenu = document.getElementById("userMenu");
    const dropdown = document.getElementById("userDropdown");

    userMenu.addEventListener("click", () => {
        dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
    });

    async function loadUserInfo() {
        try {
            const res = await fetch("/.auth/me");
            const data = await res.json();
            const claims = data[0].user_claims;

            const name = claims.find(c => c.typ === "name")?.val ?? "Utente";
            const email = claims.find(c => c.typ === "preferred_username")?.val ?? "N/A";

            document.getElementById("userName").innerText = name;
            document.getElementById("userEmail").innerText = email;

            document.getElementById("userAvatar").src = "/icons/avatar.jpg";

        } catch (e) {
            console.error("Errore caricamento user info:", e);
        }
    }

async function loadMicrosoftAvatar() {
    try {
        const resp = await fetch("/.auth/me");
        const data = await resp.json();

        const token = data[0]?.access_token;

        if (!token) {
            // Nessun token (tenant Azure senza M365) → avatar default
            document.getElementById("userAvatar").src = "/icons/avatar.jpg";
            return;
        }

        // Prova a recuperare la foto da Graph
        const photoResp = await fetch("https://graph.microsoft.com/v1.0/me/photo/$value", {
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        if (photoResp.ok) {
            const blob = await photoResp.blob();
            const url = URL.createObjectURL(blob);
            document.getElementById("userAvatar").src = url;
        } else {
            // Foto non disponibile → avatar locale
            document.getElementById("userAvatar").src = "/icons/avatar.jpg";
        }

    } catch (err) {
        // Qualsiasi errore → fallback silenzioso
        document.getElementById("userAvatar").src = "/icons/avatar.jpg";
    }
}
    
    loadUserInfo();
    loadMicrosoftAvatar(); 

    document.addEventListener("click", (event) => {
        if (!userMenu.contains(event.target)) {
            dropdown.style.display = "none";
        }
    });

});

////////////////////////////////////////////////////////////////////////////////

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
let timerInterval = null;
let startTime = null;

const recordBtn = document.getElementById("recordBtn");
const stopBtn   = document.getElementById("stopBtn");
const result    = document.getElementById("result");


// ⏱️ Timer sotto al log
const timerBox = document.createElement("div");
timerBox.id = "timerBox";
timerBox.textContent = "";
document.getElementById("debug-log").after(timerBox);

recordBtn.onclick = async () => {
  // 🔄 Pulisce il log a ogni nuova registrazione
  const box = document.getElementById("debug-log");
  if (box) {
    box.innerHTML = "<b style='color:lime'>Log in tempo reale:</b>";
    logToScreen("🧹 Log precedente cancellato");
  }

  logToScreen("🎙️ Bottone Registra premuto");

  try {
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

      // 🕒 Avvio timer lampeggiante
      startTime = Date.now();
      timerBox.className = "rec";
      timerBox.textContent = "⏱️ 00:00 / registrazione in corso...";
      timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const min = String(Math.floor(elapsed / 60)).padStart(2, "0");
        const sec = String(elapsed % 60).padStart(2, "0");
        timerBox.textContent = `⏱️ ${min}:${sec} / registrazione in corso...`;
      }, 1000);
    };

    mediaRecorder.onstop = async () => {
      logToScreen("⏹️ Registrazione fermata");

      // ⏹️ Ferma timer e cambia colore
      clearInterval(timerInterval);
      timerInterval = null;
      timerBox.className = "done";
      timerBox.textContent = "✅ Registrazione completata";

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
