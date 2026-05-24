# 🚀 Future Feature Road Map - Sound Pad

Questo documento traccia le idee e le funzionalità future proposte per migliorare l'esperienza utente, l'accessibilità e la flessibilità di Sound Pad come strumento di Comunicazione Aumentativa e Alternativa (CAA).

## 1. 🎛️ Nuove Modalità di Interazione e Accessibilità
- **Scansione a Singolo Switch (Scanning Mode):** Una modalità automatica in cui le card vengono evidenziate una dopo l'altra. L'utente preme il pulsante/switch una sola volta per selezionare la card attiva. Essenziale per bambini con gravissime disabilità motorie.
- **Griglia Multi-Card (Grid Mode):** Oltre alle modalità "Scheda Singola" e "Scheda Doppia", introdurre griglie (es. 2x2, 3x3) per utenti con abilità comunicative più avanzate (stile PECS/GoTalk).
- **Feedback Aptico Avanzato:** Vibrazioni ritmiche in base al tipo di card (es. vibrazione prolungata per i mezzi di trasporto, micro-vibrazioni per la musica).

## 2. 📝 Editor Avanzato e Personalizzazione
- **Cantastorie Personalizzati (Story Creator):** Permettere agli utenti autenticati di creare le proprie storie capitolo per capitolo, caricando immagini personalizzate e registrando l'audio per ciascun capitolo, sincronizzandole su Supabase.
- **Sintesi Vocale On-The-Fly (TTS Custom):** Una barra di digitazione rapida per scrivere parole o frasi estemporanee e riprodurle all'istante con la sintesi vocale del browser, personalizzando velocità e tono della voce.

## 3. 📈 Analisi e Monitoraggio per Terapisti e Genitori
- **Pannello Statistiche (Dashboard):** Log privato e anonimo delle interazioni (card più usate, tempo medio di pressione, sessioni attive) per monitorare i progressi comunicativi del bambino nel tempo.

## 4. 🌍 Internazionalizzazione (i18n)
- **Localizzatore Multi-lingua:** Sostituire l'attuale dizionario statico di `src/i18n.js` con un sistema reattivo che consenta di cambiare lingua (es. Italiano, Inglese, Spagnolo) direttamente dall'interfaccia.
