// Blocca ogni forma di zoom dell'interfaccia (pinch, doppio tap, tastiera e
// trackpad). L'app è pensata per persone che fanno fatica con le gesture:
// la UI deve restare fissa a scala 1.
//
// Nota: il meta viewport con `user-scalable=no` copre Android e PWA, ma iOS
// Safari lo ignora. Per questo aggiungiamo anche i gestori di eventi sotto.

const GESTURE_EVENTS = ["gesturestart", "gesturechange", "gestureend"];

function preventDefault(e) {
  if (e.cancelable) e.preventDefault();
}

// Pinch-to-zoom: più di un dito sullo schermo.
function preventMultiTouch(e) {
  if (e.touches && e.touches.length > 1) {
    e.preventDefault();
  }
}

// Pinch su trackpad / zoom con Ctrl o Cmd + rotellina.
function preventWheelZoom(e) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
  }
}

// Zoom da tastiera: Ctrl/Cmd + "+", "-", "=", "0".
function preventKeyZoom(e) {
  if (!(e.ctrlKey || e.metaKey)) return;
  if (["+", "-", "=", "0"].includes(e.key)) {
    e.preventDefault();
  }
}

let installed = false;

export function lockZoom() {
  if (installed || typeof document === "undefined") return;
  installed = true;

  GESTURE_EVENTS.forEach((name) =>
    document.addEventListener(name, preventDefault, { passive: false })
  );
  document.addEventListener("touchmove", preventMultiTouch, { passive: false });
  window.addEventListener("wheel", preventWheelZoom, { passive: false });
  window.addEventListener("keydown", preventKeyZoom, { passive: false });
}
