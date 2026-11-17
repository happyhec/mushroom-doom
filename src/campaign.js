export const CAMPAIGN = Object.freeze([
  { name: 'THE ASHEN COURTYARD', subtitle: 'Chapter I · A very bad service call', briefing: 'Bowser has seized the kingdom’s warp network. Breach the ruined outer castle, recover its Power Star, and take the green warp gate into the machinery below.', objective: 'Recover the Power Star. Use the warp gate.' },
  { name: 'THE INFERNAL PIPEWORKS', subtitle: 'Chapter II · Plumbing the depths', briefing: 'The kingdom’s pipes are pumping molten trouble. Fight through the valve chambers and furnace bridges. Find the next Power Star to open the route into Bowser’s midnight fortress.', objective: 'Navigate the foundry. Recover the star. Reach the next gate.' },
  { name: 'THE MIDNIGHT CITADEL', subtitle: 'Chapter III · The final inspection', briefing: 'The warp network ends at Bowser’s throne. Reclaim the final Power Star, bring down the king of ash, and open the last gate. Finish the job. Bring the kingdom home.', objective: 'Recover the star. Defeat Bowser. Escape through the final gate.' },
]);

export function campaignTotals(results) {
  return results.reduce((total, run) => ({ kills: total.kills + run.kills, enemies: total.enemies + run.total, elapsed: total.elapsed + run.elapsed, secrets: total.secrets + Number(run.secretFound) }), { kills: 0, enemies: 0, elapsed: 0, secrets: 0 });
}

// Every new chapter gives a viable starting supply. A retry restores that entry
// inventory, so dying cannot erase resources accumulated in earlier chapters.
export function nextLevelInventory(player, difficulty) {
  return {
    health: difficulty === 'easy' ? 150 : 100,
    armor: Math.max(25, player.armor),
    shells: Math.max(24, player.shells),
    flowers: Math.max(40, player.flowers),
  };
}
