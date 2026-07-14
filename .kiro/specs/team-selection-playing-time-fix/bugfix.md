# Bugfix Requirements Document

## Introduction

The team selection screen displays unbalanced playing time across squad members in a 7v7 match format. Three related defects exist: (1) the match duration is incorrectly configured as 60 minutes for 7v7 when it should be 48 minutes (4 quarters of 12 minutes), (2) the playing time engine fails to distribute outfield minutes evenly across all available players when the squad size exceeds the number of on-pitch slots, and (3) the bench time distribution is unequal — some players sit out 2 quarters while others sit out none. These bugs together mean some players get 60 minutes of playing time while others get only 30 minutes, violating the equal playing time policy.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a 7v7 season is seeded THEN the system stores `matchDurationMinutes: 60` and `periods: 4`, resulting in 15-minute quarters instead of the correct 12-minute quarters for a 48-minute match

1.2 WHEN the playing time engine generates a substitution plan for 11 players in a 7v7 format (6 outfield slots + 1 GK) across 4 periods THEN some players receive 60 minutes total playing time while others receive only 30 minutes, a difference of 30 minutes which far exceeds the configured ±2 minute tolerance

1.3 WHEN the playing time engine distributes bench duty across 4 quarters for 11 players with 6 outfield slots THEN some players are benched for 2 quarters while others are never benched, producing an unequal rotation that shows "2 Qs" bench for some and "-" for others, meaning some players sit out for extended periods and get cold

1.4 WHEN the playing time engine assigns bench periods THEN it does not space bench stints apart, allowing a player to be benched in consecutive quarters (e.g., Q1 and Q2) rather than spreading the bench time to non-adjacent periods (e.g., Q1 and Q3)

1.5 WHEN a GK volunteer is assigned to goal for 2 periods and the `gkRewardFullOutfield` policy is enabled THEN the GK player occupies an outfield slot in all remaining periods, reducing the slots available for other players and skewing the distribution further

### Expected Behavior (Correct)

2.1 WHEN a 7v7 season is configured THEN the system SHALL use `matchDurationMinutes: 48` and `periods: 4`, producing 4 quarters of 12 minutes each

2.2 WHEN the playing time engine generates a substitution plan for N available players in a format with S outfield slots across P periods THEN every non-GK player SHALL receive outfield minutes within ±tolerance of each other (default tolerance: 2 minutes), and total playing time difference between any two players SHALL NOT exceed `periodDuration` minutes

2.3 WHEN the playing time engine distributes bench duty across periods THEN bench periods SHALL be distributed as evenly as possible among all non-GK players, such that no player is benched more than 1 period more than any other player

2.4 WHEN a player must be benched for more than one period in a match THEN the engine SHALL space bench stints in non-adjacent periods where possible (e.g., Q1 and Q3 rather than Q1 and Q2) so that the player does not get cold from sitting out consecutive quarters

2.5 WHEN the squad size and format allow it (e.g., 11 players for 7v7 with 4 quarters) THEN each player SHALL miss at most 1 quarter where mathematically possible, ensuring maximum participation and minimal time off the pitch

2.6 WHEN a GK volunteer plays in goal for some periods and `gkRewardFullOutfield` is enabled THEN the GK player SHALL receive outfield time in non-GK periods, but the engine SHALL account for this when distributing remaining outfield slots so that pure outfield players still receive equitable time

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a squad has exactly the minimum number of players for the format (e.g., 7 for 7v7) THEN the system SHALL CONTINUE TO assign all players to every period with zero bench time

3.2 WHEN a GK volunteer is assigned to all periods in goal THEN the system SHALL CONTINUE TO not assign that player any outfield periods

3.3 WHEN the `maxConsecutiveBenchPeriods` policy is set to 1 THEN the system SHALL CONTINUE TO ensure no player sits out more than 1 consecutive period

3.4 WHEN a player must sit out more than 1 period in a match THEN the system SHALL CONTINUE TO space those bench periods apart (non-adjacent) to prevent players from getting cold

3.5 WHEN the match format is 5v5, 9v9, or 11v11 THEN the system SHALL CONTINUE TO generate substitution plans using the correct format-specific outfield slot count without regression

3.6 WHEN all players are marked available and the plan is generated THEN the system SHALL CONTINUE TO validate the plan and report `isValid: true` when all constraints are satisfied

3.7 WHEN fewer players than required are available THEN the system SHALL CONTINUE TO return an appropriate error with code `NOT_ENOUGH_PLAYERS`
