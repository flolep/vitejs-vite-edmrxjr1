import { useEffect, useRef } from 'react';
import { spotifyService } from '../spotifyService';
import { playBuzzBeep, playFinalBuzzSound } from '../services/buzzSounds';

/** Volume Spotify pendant le beep, et duree du creux. */
const DUCK_LEVEL = 0.4;
const DUCK_DURATION_MS = 150;

/**
 * Joue un retour sonore sur le MASTER a chaque reponse de joueur en mode quiz.
 *
 * - beep uniforme (sinus) a chaque nouvelle reponse
 * - son special (sawtooth, conserve de useBuzzer) quand la derniere reponse
 *   attendue arrive : le contraste entre les deux sons dit « c'est boucle »
 * - la musique Spotify est baissee a 40% pendant 150 ms, sinon le beep passe
 *   sous la musique (Web Audio et le SDK Spotify sont deux chaines
 *   independantes, le beep ne profite pas du mixage)
 *
 * @param {Array}  playerAnswers  reponses de la piste courante (deja triees)
 * @param {number} totalPlayers   joueurs connectes attendus sur la question
 * @param {number} currentTrack   piste en cours — remet le compteur a zero
 * @param {boolean} enabled       false en dehors du mode quiz
 */
export function useBuzzBeep(playerAnswers, totalPlayers, currentTrack, enabled) {
  const previousCountRef = useRef(0);
  const finalPlayedRef = useRef(false);

  // Changement de piste : on repart de zero sans jouer de son.
  useEffect(() => {
    previousCountRef.current = 0;
    finalPlayedRef.current = false;
  }, [currentTrack]);

  useEffect(() => {
    if (!enabled) return;

    const count = playerAnswers?.length || 0;
    const previous = previousCountRef.current;

    // Rien de neuf, ou retour en arriere (reset de la question).
    if (count <= previous) {
      previousCountRef.current = count;
      if (count === 0) finalPlayedRef.current = false;
      return;
    }

    previousCountRef.current = count;

    // Derniere reponse attendue ? On ne le joue qu'une fois par piste.
    const isFinal = totalPlayers > 0 && count >= totalPlayers && !finalPlayedRef.current;
    if (isFinal) finalPlayedRef.current = true;

    // Le ducking est lance en parallele du son : on n'attend pas la reponse
    // du SDK Spotify, sinon le beep arriverait apres le creux de volume.
    spotifyService.duckVolume(DUCK_LEVEL, DUCK_DURATION_MS).catch(() => {
      /* player absent ou non pret : le beep sort quand meme, juste moins net */
    });

    const play = isFinal ? playFinalBuzzSound : playBuzzBeep;
    play().catch(err => console.warn('⚠️ Beep de buzz non joue:', err.message));
  }, [playerAnswers, totalPlayers, enabled]);
}
