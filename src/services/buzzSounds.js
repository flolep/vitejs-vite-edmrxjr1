/**
 * Sons de buzz joues sur le MASTER.
 *
 * Localisation volontaire : le Master est le device audio de la soiree (il
 * porte le SDK Spotify et sort sur les enceintes). Un beep par telephone
 * produirait un decalage de latence et une cacophonie, et la moitie des
 * mobiles sont en silencieux.
 *
 * Deux sons, et c'est le CONTRASTE entre les deux qui porte l'information :
 *
 *   playBuzzBeep()      sinus court, identique a chaque buzz
 *   playFinalBuzzSound() sawtooth descendant, uniquement au dernier buzz
 *
 * Pas de progression tonale entre les buzz : decision explicite de la
 * conception (§B.7.1). Le beep uniforme ne dit PAS « il en manque un » —
 * cette information passe uniquement par le flash sur le buzzer du joueur.
 */

/** Contexte partage : un seul AudioContext pour toute la page. */
let audioContext = null;

function getAudioContext() {
  if (audioContext && audioContext.state !== 'closed') return audioContext;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  audioContext = new Ctor();
  return audioContext;
}

/**
 * Debloque l'AudioContext. A appeler sur une interaction utilisateur, sinon
 * la politique autoplay du navigateur bloque le son au moment utile.
 */
export async function unlockBuzzSounds() {
  const ctx = getAudioContext();
  if (!ctx) return false;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch (e) {
      console.warn('⚠️ Reprise AudioContext impossible:', e.message);
      return false;
    }
  }
  return ctx.state === 'running';
}

async function ensureRunning(ctx) {
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch (e) {
      console.warn('⚠️ Reprise AudioContext impossible:', e.message);
    }
  }
}

/**
 * Beep uniforme joue a CHAQUE buzz.
 *
 * Sinus 880 Hz, 80 ms. L'attaque et la chute sont adoucies sur 12 ms : une
 * enveloppe carree sur un sinus produit un clic audible (discontinuite du
 * signal), ce qui est desagreable repete a chaque reponse.
 */
export async function playBuzzBeep() {
  const ctx = getAudioContext();
  if (!ctx) return;
  await ensureRunning(ctx);

  const now = ctx.currentTime;
  const duration = 0.08; // 80 ms
  const attack = 0.012; // attaque douce, evite le clic
  const peak = 0.35;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, now);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + attack);
  gain.gain.setValueAtTime(peak, now + duration - attack);
  gain.gain.linearRampToValueAtTime(0, now + duration);

  osc.start(now);
  osc.stop(now + duration + 0.01);
}

/**
 * Son du DERNIER buzz — conserve tel quel depuis useBuzzer.js.
 *
 * Sawtooth 800 -> 400 Hz sur 300 ms. C'est aussi le son du buzz en mode
 * equipe. Son timbre riche tranche nettement avec le sinus du beep uniforme :
 * c'est ce contraste qui signale « c'est boucle ».
 */
export async function playFinalBuzzSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  await ensureRunning(ctx);

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.frequency.setValueAtTime(800, now);
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
  osc.type = 'sawtooth';

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.5, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

  osc.start(now);
  osc.stop(now + 0.3);
}
