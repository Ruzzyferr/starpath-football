/** What a relationship interaction costs (shown on the buttons; 2.7#81). One use per person per day. */
export type InteractionCostKind = 'call' | 'dinner' | 'gift' | 'train' | 'party' | 'holiday' | 'apologize'
export const INTERACT_COST: Record<InteractionCostKind, { money: number; energy: number }> = {
  call: { money: 0, energy: 2 },
  dinner: { money: 250, energy: 8 },
  gift: { money: 1500, energy: 4 },
  train: { money: 0, energy: 15 },
  party: { money: 600, energy: 15 },
  holiday: { money: 9000, energy: 10 },
  apologize: { money: 0, energy: 3 },
}
