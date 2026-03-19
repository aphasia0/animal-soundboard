#include <BleKeyboard.h>

// Nome della tastiera visibile sul cellulare/tablet
BleKeyboard bleKeyboard("Tastiera Accessibile", "Progetto", 100);

const int buttonA_Pin = 4;     
const int buttonSpace_Pin = 5; 

int previousButtonAState = HIGH;
int previousButtonSpaceState = HIGH;

void setup() {
  // Attiva i resistori di pull-up interni
  pinMode(buttonA_Pin, INPUT_PULLUP);
  pinMode(buttonSpace_Pin, INPUT_PULLUP);

  bleKeyboard.begin();
}

void loop() {
  if(bleKeyboard.isConnected()) {
    
    int currentButtonAState = digitalRead(buttonA_Pin);
    int currentButtonSpaceState = digitalRead(buttonSpace_Pin);

    // --- CONTROLLO TASTO 'A' ---
    // Se il pulsante viene PREMUTO (passa da rilasciato a premuto)
    if (currentButtonAState == LOW && previousButtonAState == HIGH) {
      bleKeyboard.press('a');  // Tieni premuta la 'a'
      delay(50); // Anti-rimbalzo meccanico
    }
    // Se il pulsante viene RILASCIATO (passa da premuto a rilasciato)
    else if (currentButtonAState == HIGH && previousButtonAState == LOW) {
      bleKeyboard.release('a'); // Rilascia la 'a'
      delay(50); // Anti-rimbalzo meccanico
    }
    previousButtonAState = currentButtonAState;


    // --- CONTROLLO TASTO 'SPAZIO' ---
    // Se il pulsante viene PREMUTO
    if (currentButtonSpaceState == LOW && previousButtonSpaceState == HIGH) {
      bleKeyboard.press(' ');  // Tieni premuto lo spazio
      delay(50); // Anti-rimbalzo meccanico
    }
    // Se il pulsante viene RILASCIATO
    else if (currentButtonSpaceState == HIGH && previousButtonSpaceState == LOW) {
      bleKeyboard.release(' '); // Rilascia lo spazio
      delay(50); // Anti-rimbalzo meccanico
    }
    previousButtonSpaceState = currentButtonSpaceState;
    
  }
  
  delay(10);
}