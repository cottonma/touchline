/**
 * Server-side constants.
 */

export const MATCH_FORMATS = {
  '5v5': { playersOnPitch: 5, outfieldPlayers: 4, typicalSquad: 8 },
  '7v7': { playersOnPitch: 7, outfieldPlayers: 6, typicalSquad: 12 },
  '9v9': { playersOnPitch: 9, outfieldPlayers: 8, typicalSquad: 14 },
  '11v11': { playersOnPitch: 11, outfieldPlayers: 10, typicalSquad: 16 },
} as const;
