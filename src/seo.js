// Metadati SEO per pagina.
// Sound Pad è una SPA: title, description, canonical e Open Graph vengono
// aggiornati a ogni cambio di vista. Google esegue il JavaScript e indicizza i
// valori aggiornati; le rotte pubbliche sono elencate in public/sitemap.txt.

const SITE = 'https://soundpad.antoniogiordano.dev';

export const DEFAULT_TITLE = 'Sound Pad - AAC Communication Tool for Children';
export const DEFAULT_DESCRIPTION =
  "Sound Pad: applicazione open-source di CAA (Comunicazione Aumentativa Alternativa) per bambini con disabilità, autismo e ritardi del linguaggio. Tastiera open-hardware, card con voce, storie e giochi.";

const ROUTES = {
  modeSelect: {
    path: '/',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  home: {
    path: '/home',
    title: 'Scegli una categoria - Sound Pad',
    description:
      'Tutte le categorie di carte CAA di Sound Pad: animali, persone, mezzi, cibo, strumenti e le carte personali con voce e immagini.',
  },
  random: {
    path: '/random',
    title: 'Tutte le carte - Sound Pad',
    description:
      'Un unico mazzo con tutte le carte CAA pubbliche e personali: tocca una card per ascoltare la parola.',
  },
  stories: {
    path: '/stories',
    title: 'Cantastorie - Sound Pad',
    description:
      'Storie interattive in italiano per bambini, con immagini, narrazione e capitoli da ascoltare a ogni tocco.',
  },
  playingStory: {
    path: '/stories',
    title: 'Cantastorie - Sound Pad',
    description:
      'Storie interattive in italiano per bambini, con immagini, narrazione e capitoli da ascoltare a ogni tocco.',
  },
  gameshub: {
    path: '/gameshub',
    title: 'Giochi - Sound Pad',
    description:
      'Giochi semplici e accessibili per bambini: Tocca la Scatola e Muovi la Scatola, pensati per tablet e switch.',
  },
  band: {
    path: '/band',
    title: 'La Banda: fai musica - Sound Pad',
    description:
      'La Banda è la modalità musicale accessibile di Sound Pad: quattro strumenti, sei passi e una scala pentatonica. Tocca le caselle, premi play e crea il tuo loop senza saper suonare a tempo.',
  },
  info: {
    path: '/info',
    title: 'Informazioni - Sound Pad',
    description:
      'Informazioni su Sound Pad, applicazione open source di Comunicazione Aumentativa Alternativa per bambini.',
  },
};

function setMeta(attribute, key, content) {
  if (!content) return;
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

/**
 * Traduce lo stato di navigazione in metadati. Restituisce null mentre la
 * vista è in transizione, così i metadati precedenti non vengono sovrascritti
 * con valori generici.
 */
export function seoForRoute(view, publicCategory, userCategory) {
  if (!view) return null;

  if (view === 'publicCategory' && publicCategory) {
    return {
      path: publicCategory.slug
        ? `/${publicCategory.slug}`
        : `/category/${publicCategory.id}`,
      title: `${publicCategory.name} - Sound Pad`,
      description: `Carte CAA "${publicCategory.name}" con immagini, parole e voce: tocca una card per ascoltare.`,
    };
  }

  if (view === 'userCategory' && userCategory) {
    return {
      path: `/category/${userCategory.id}`,
      title: 'Le mie carte - Sound Pad',
      description:
        'Le carte personali di Sound Pad: immagini, parole e voce create dall’utente e sincronizzate con il proprio account.',
    };
  }

  return ROUTES[view] || null;
}

export function applySeo(seo) {
  if (!seo || typeof document === 'undefined') return;

  const url = `${SITE}${seo.path}`;
  document.title = seo.title;

  setMeta('name', 'description', seo.description);
  setMeta('property', 'og:title', seo.title);
  setMeta('property', 'og:description', seo.description);
  setMeta('property', 'og:url', url);
  setMeta('name', 'twitter:title', seo.title);
  setMeta('name', 'twitter:description', seo.description);
  setMeta('name', 'twitter:url', url);

  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', url);
}
