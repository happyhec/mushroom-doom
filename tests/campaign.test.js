import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGN, campaignTotals, nextLevelInventory } from '../src/campaign.js';

test('a new campaign starts with zero accumulated results', () => {
  assert.deepEqual(campaignTotals([]), { kills: 0, enemies: 0, elapsed: 0, secrets: 0 });
});

test('completed chapters accumulate enemies, kills, time and found secrets independently', () => {
  const results = [
    { kills: 8, total: 13, elapsed: 62.5, secretFound: true },
    { kills: 11, total: 14, elapsed: 87.25, secretFound: false },
    { kills: 13, total: 13, elapsed: 120.75, secretFound: true },
  ];
  assert.deepEqual(campaignTotals(results), { kills: 32, enemies: 40, elapsed: 270.5, secrets: 2 });
});

test('zero-kill or no-secret runs still contribute their level time and enemy count', () => {
  assert.deepEqual(campaignTotals([
    { kills: 0, total: 10, elapsed: 40, secretFound: false },
    { kills: 0, total: 11, elapsed: 55, secretFound: false },
  ]), { kills: 0, enemies: 21, elapsed: 95, secrets: 0 });
});

test('totals do not mutate stored chapter reports', () => {
  const result = Object.freeze({ kills: 5, total: 12, elapsed: 17.5, secretFound: true });
  const results = Object.freeze([result]);
  const total = campaignTotals(results);
  total.kills = 999;
  assert.equal(results[0], result);
  assert.deepEqual(result, { kills: 5, total: 12, elapsed: 17.5, secretFound: true });
  assert.equal(campaignTotals(results).kills, 5);
});

test('a depleted player gets enough supplies to begin the next chapter', () => {
  assert.deepEqual(nextLevelInventory({ health: 1, armor: 0, shells: 0, flowers: 0 }, 'normal'), {
    health: 100, armor: 25, shells: 24, flowers: 40,
  });
});

test('earned supplies above the minimum carry forward without loss', () => {
  assert.deepEqual(nextLevelInventory({ health: 18, armor: 82, shells: 77, flowers: 123 }, 'normal'), {
    health: 100, armor: 82, shells: 77, flowers: 123,
  });
});

test('each supply type is replenished independently', () => {
  assert.deepEqual(nextLevelInventory({ health: 12, armor: 9, shells: 65, flowers: 13 }, 'hard'), {
    health: 100, armor: 25, shells: 65, flowers: 40,
  });
  assert.deepEqual(nextLevelInventory({ health: 12, armor: 44, shells: 3, flowers: 90 }, 'hard'), {
    health: 100, armor: 44, shells: 24, flowers: 90,
  });
});

test('chapter entry restores the selected difficulty health limit', () => {
  const player = { health: 3, armor: 25, shells: 24, flowers: 40 };
  assert.equal(nextLevelInventory(player, 'easy').health, 150);
  assert.equal(nextLevelInventory(player, 'normal').health, 100);
  assert.equal(nextLevelInventory(player, 'hard').health, 100);
});

test('entry inventory is a separate value and does not carry old keys or kill counters', () => {
  const player = Object.freeze({ health: 75, armor: 50, shells: 45, flowers: 70, kills: 9, key: true });
  const inventory = nextLevelInventory(player, 'easy');
  assert.deepEqual(inventory, { health: 150, armor: 50, shells: 45, flowers: 70 });
  inventory.shells = 0;
  assert.equal(player.shells, 45);
  assert.equal(player.health, 75);
  assert.equal(player.key, true);
  assert.equal(player.kills, 9);
});

test('the campaign has three distinct chapters with instructions and a final objective', () => {
  assert.equal(CAMPAIGN.length, 3);
  assert.equal(new Set(CAMPAIGN.map(level => level.name)).size, 3);
  for (const level of CAMPAIGN) {
    assert.ok(level.briefing.length > 40);
    assert.ok(level.objective.length > 10);
  }
  assert.match(CAMPAIGN[2].objective, /Defeat Bowser/i);
});
