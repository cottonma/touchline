/**
 * Seed script - populates default policies, development goal library,
 * and a default club with season.
 * Run with: cd server && npx tsx src/db/seed-all.ts
 */

import { db } from './index.js';
import { clubs, seasons } from './schema.js';
import { policyService } from '../services/policy.service.js';
import { developmentService } from '../services/development.service.js';
import { eq } from 'drizzle-orm';

async function seedClubAndSeason() {
  const now = new Date().toISOString();
  const currentYear = new Date().getFullYear();

  // Check if default club already exists
  const existingClub = db.select().from(clubs).where(eq(clubs.id, 'club_default')).get();
  if (!existingClub) {
    db.insert(clubs).values({
      id: 'club_default',
      name: 'My Club',
      teamName: 'First Team',
      ageGroup: 'U10',
      createdAt: now,
      updatedAt: now,
    }).run();
  }

  // Check if default season already exists
  const existingSeason = db.select().from(seasons).where(eq(seasons.id, 'season_default')).get();
  if (!existingSeason) {
    db.insert(seasons).values({
      id: 'season_default',
      clubId: 'club_default',
      name: `${currentYear}/${currentYear + 1} Season`,
      startDate: `${currentYear}-08-01`,
      endDate: `${currentYear + 1}-06-30`,
      format: '7v7',
      matchDurationMinutes: 48,
      periods: 4,
      maxSquadSize: 12,
      formation: '2-3-1',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }).run();
  }
}

async function seedAll() {
  console.log('🌱 Seeding Touchline...\n');

  await seedClubAndSeason();
  console.log('  ✅ Default club and season seeded');

  await policyService.seedDefaults();
  console.log('  ✅ Default coaching policies seeded (23 settings)');

  await developmentService.seedLibrary();
  console.log('  ✅ Development goal library seeded (52 goals)');

  console.log('\n✅ All seed data applied. Touchline is ready to use.\n');
  process.exit(0);
}

seedAll();
