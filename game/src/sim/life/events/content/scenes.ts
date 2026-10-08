/**
 * Relationship scenes (Analiz-ve-Plan 2.4#11): short, context-specific scenes
 * replace the old card-matching mini game. Two kinds, both started from a
 * person's card (sim/life/scenes `startScene`) and both finished in well under
 * 20 seconds (one tap):
 *  - `friends.scene_talk`: a conversation with three ways to answer;
 *  - `friends.scene_together`: a shared activity (train together, dinner, game night).
 * Outcomes depend on how warm the relationship already is.
 */
import { energy, fx, happy, relId, stress, t } from '../dsl'
import type { EventDef } from '../types'

/** Placeholder defaults; `startScene` fills the real person in. */
const SCENE_VARS = { person: '', personId: '', personValue: 0 }
const val = (v: string | number | undefined): number => (typeof v === 'number' ? v : Number(v) || 0)
const warm = (v: string | number | undefined): boolean => val(v) >= 30

export const sceneEvents: EventDef[] = [
  {
    id: 'friends.scene_talk',
    category: 'friends',
    weight: 0,
    cooldownWeeks: 0,
    // Never rolled spontaneously: only `startScene` creates these cards.
    conditions: () => false,
    vars: () => SCENE_VARS,
    title: t('Samimi Bir Sohbet: {person}', 'A Real Conversation: {person}'),
    text: t(
      '{person} ile baş başa kaldınız. Önce biraz sessizlik, sonra konuşmaya başladı: son zamanlarda işlerin nasıl gittiğini, neyin zor geldiğini merak ediyor.',
      'You are alone with {person}. A short silence, then the conversation starts: how things have really been lately, what feels hard.',
    ),
    icon: '💬',
    choices: [
      {
        label: t('Dikkatle dinle', 'Listen carefully'),
        hint: t('Güvenli ve sıcak.', 'Safe and warm.'),
        effects: (ctx) =>
          fx(
            t('Lafı kesmeden dinledin. {person} içini döktü; ikinizin de omzundan bir yük kalktı.', 'You let {person} talk without interrupting. A weight came off both your shoulders.'),
            relId(String(ctx.vars.personId), warm(ctx.vars.personValue) ? 4 : 5), stress(-3), happy(1), energy(-2),
          ),
      },
      {
        label: t('Espriyle yumuşat', 'Lighten it with a joke'),
        risk: 'medium',
        effects: (ctx, rng) =>
          rng.chance(warm(ctx.vars.personValue) ? 0.8 : 0.5)
            ? fx(t('Tam yerinde bir espri! Gülüştünüz, ortam rahatladı.', 'A perfectly timed joke! You both laughed and the room relaxed.'), relId(String(ctx.vars.personId), 5), happy(3), energy(-2))
            : fx(t('Espri biraz yanlış zamana denk geldi. {person} güldü ama gözleri gülmedi.', 'The joke landed at the wrong moment. {person} smiled but the eyes did not.'), relId(String(ctx.vars.personId), -1), energy(-2)),
      },
      {
        label: t('Samimi bir tavsiye ver', 'Offer honest advice'),
        hint: t('Yakınsanız işe yarar.', 'Works best when you are close.'),
        effects: (ctx) =>
          warm(ctx.vars.personValue)
            ? fx(t('{person} söylediklerini ciddiye aldı. "Bunu duymam gerekiyordu" dedi.', '{person} took it seriously. "I needed to hear that," came the answer.'), relId(String(ctx.vars.personId), 6), stress(-2), energy(-3))
            : fx(t('Henüz o kadar yakın değilsiniz; tavsiye biraz ukalaca duyuldu.', 'You are not that close yet; the advice sounded a bit preachy.'), relId(String(ctx.vars.personId), 1), energy(-3)),
      },
    ],
  },
  {
    id: 'friends.scene_together',
    category: 'friends',
    weight: 0,
    cooldownWeeks: 0,
    // Never rolled spontaneously: only `startScene` creates these cards.
    conditions: () => false,
    vars: () => SCENE_VARS,
    title: t('Birlikte Vakit: {person}', 'Time Together: {person}'),
    text: t(
      '{person} ile bir şeyler yapmak için küçük bir boşluk buldunuz. Ne yapalım?',
      'You found a small gap to do something with {person}. What shall it be?',
    ),
    icon: '🤝',
    choices: [
      {
        label: t('Birlikte antrenman yap', 'Train together'),
        effects: (ctx) =>
          fx(t('Sırayla şınav sayıp birbirinizi kızıştırdınız. Yorgun ama keyifliydi.', 'You counted push-ups in turns and pushed each other. Tiring but fun.'), relId(String(ctx.vars.personId), 4), energy(-8), stress(-2)),
      },
      {
        label: t('Güzel bir yemek ye', 'Share a good meal'),
        effects: (ctx) =>
          fx(t('Uzun bir sofra, eski hikâyeler. Hesabı sen ödedin, kimse itiraz etmedi.', 'A long table, old stories. You covered the bill and nobody argued.'), relId(String(ctx.vars.personId), 5), energy(-3), happy(2)),
      },
      {
        label: t('Oyun gecesi yap', 'Have a game night'),
        effects: (ctx, rng) =>
          rng.chance(0.5)
            ? fx(t('Son turda kazandın; {person} "rövanş!" diye bağırdı. Gece gülerek bitti.', 'You won the last round; {person} shouted "rematch!". The night ended in laughter.'), relId(String(ctx.vars.personId), 5), happy(3), energy(-3))
            : fx(t('Kaybettin ama kahkahalar yetti. Rövanş sözü verildi.', 'You lost but the laughter was worth it. A rematch was promised.'), relId(String(ctx.vars.personId), 4), happy(2), energy(-3)),
      },
    ],
  },
]
