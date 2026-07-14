/**
 * Club types - represents the team/club identity.
 */

export interface Club {
  id: string;
  name: string;
  teamName: string | null;
  badgeUrl: string | null;
  homeGround: string | null;
  homeGroundAddress: string | null;
  directions: string | null;
  kitColourHome: string | null;
  kitColourAway: string | null;
  ageGroup: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClubInput {
  name: string;
  teamName?: string;
  badgeUrl?: string;
  homeGround?: string;
  homeGroundAddress?: string;
  directions?: string;
  kitColourHome?: string;
  kitColourAway?: string;
  ageGroup?: string;
}

export interface UpdateClubInput extends Partial<CreateClubInput> {}
