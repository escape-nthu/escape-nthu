# Implementation Plan: Escape NTHU

Timeline assumes work begins on 2026-05-12 and targets the tentative final demo around 2026-06-13 or 2026-06-14.

## Milestone 0: Project Setup

Target: 2026-05-12 to 2026-05-14

Goal: Make the repo ready for parallel work.

- [ ] Create Cocos Creator project structure.
  - Owner: 李久恩
  - Verify: project opens in Cocos Creator and can run preview.
- [ ] Create backend TypeScript workspace with `pnpm`.
  - Owner: 陳可冀
  - Verify: `pnpm dev` starts health endpoint.
- [ ] Add shared environment examples and README setup.
  - Owner: 鄭名緯
  - Verify: teammate can run frontend/backend from fresh clone.
- [ ] Define initial art direction board and asset naming convention.
  - Owner: 潘睦婷
  - Verify: first map tiles, character/ghost references, and UI palette are documented.

## Milestone 1: Gameplay Skeleton

Target: 2026-05-15 to 2026-05-20

Goal: A single player can move in a rough map and interact with objects.

- [ ] Implement top-down movement, sprint, collision, and camera follow.
  - Owner: 李久恩
  - Verify: player can traverse a blockout Delta/CS hallway without clipping through walls.
- [ ] Implement interactable object base component.
  - Owner: 李久恩
  - Verify: pressing E near an object opens a placeholder panel.
- [ ] Implement clue collection and local notebook UI.
  - Owner: 鄭名緯
  - Verify: collected clue appears in Tab notebook.
- [ ] Produce placeholder map/background assets for the MVP route.
  - Owner: 潘睦婷
  - Verify: blockout map has recognizable midnight campus tone.

## Milestone 2: Backend Core And Co-Op Sync

Target: 2026-05-21 to 2026-05-26

Goal: Two players can join the same session and share essential state.

- [ ] Implement room create/join APIs.
  - Owner: 陳可冀
  - Verify: API returns room id, player id, and role.
- [ ] Implement WebSocket room gateway.
  - Owner: 陳可冀
  - Verify: server broadcasts movement snapshots and clue events.
- [ ] Integrate Cocos lobby with room create/join.
  - Owner: 鄭名緯
  - Verify: two browser windows can join as Player A and Player B.
- [ ] Integrate remote player rendering.
  - Owner: 李久恩
  - Verify: each client sees the other player move.

## Milestone 3: High-Risk Core Loop

Target: 2026-05-27 to 2026-06-02

Goal: Prove the systems that can break the whole game.

- [ ] Implement ghost patrol/chase/catch finite-state machine.
  - Owner: 李久恩
  - Verify: ghost patrols, detects, chases, and resets consistently.
- [ ] Implement first cooperative knowledge lock.
  - Owner: 鄭名緯
  - Verify: A sees lock prompt, B sees supporting clue, both are needed.
- [ ] Implement puzzle verifier with shortest-path fixture.
  - Owner: 陳可冀
  - Verify: verifier returns AC for correct answer and WA for incorrect answer.
- [ ] Add first pass chase, lock, and key visual feedback.
  - Owner: 潘睦婷
  - Verify: player can tell when chase starts, lock fails, and key unlocks.

## Milestone 4: AI NPC And VN UI

Target: 2026-06-03 to 2026-06-07

Goal: Make AI dialogue useful, bounded, and demo-safe.

- [ ] Implement backend AI NPC service with hint tiers and fallback hints.
  - Owner: 陳可冀
  - Verify: direct answer request is refused; clue-based question reveals useful hint.
- [ ] Implement Cocos VN dialogue overlay and text input.
  - Owner: 鄭名緯
  - Verify: dialogue pauses exploration and resumes cleanly.
- [ ] Add NPC portrait, dialogue frame, and typing/response effect.
  - Owner: 潘睦婷
  - Verify: dialogue mode visually differs from exploration mode.
- [ ] Connect AI hint output to notebook and puzzle flow.
  - Owner: 鄭名緯
  - Verify: AI hint can be referenced while solving the lock.

## Milestone 5: Vertical Slice Polish

Target: 2026-06-08 to 2026-06-11

Goal: One complete 5-8 minute playable demo.

- [ ] Connect intro, exploration, ghost chase, AI dialogue, AC unlock, and ending.
  - Owner: 李久恩, 鄭名緯
  - Verify: team can complete one full run without dev console intervention.
- [ ] Replace placeholders with final MVP art and effects.
  - Owner: 潘睦婷
  - Verify: map, ghost, NPC, key, and lock are visually coherent.
- [ ] Add audio cues for chase, interaction, AC/WA, and ending.
  - Owner: 潘睦婷
  - Verify: audio supports state changes without overpowering dialogue.
- [ ] Add failure/retry handling for disconnect, AI failure, and repeated WA.
  - Owner: 陳可冀, 鄭名緯
  - Verify: demo can continue from common failure cases.

## Milestone 6: Demo Readiness

Target: 2026-06-12 to 2026-06-14

Goal: Reduce surprise risk before final demo.

- [ ] Create demo script and presenter notes.
  - Owner: 鄭名緯
  - Verify: 5-8 minute path lists who says/does what.
- [ ] Run final manual test checklist.
  - Owner: 全員
  - Verify: two-player flow, AI dialogue, puzzle AC, ghost chase, and ending all pass.
- [ ] Freeze feature scope.
  - Owner: 全員
  - Verify: only bug fixes after freeze.
- [ ] Package final web build and backend run instructions.
  - Owner: 陳可冀, 鄭名緯
  - Verify: build can be launched on demo machine.

## Task Priority Order

Implement in this order if time becomes tight:

1. Cocos movement and interactables.
2. Room create/join and essential WebSocket sync.
3. One puzzle verifier and lock UI.
4. Ghost patrol/chase.
5. AI NPC with fallback hints.
6. Notebook and VN presentation.
7. Art/audio polish.
8. Optional endings, achievements, and hidden lore.

## Manual Demo Checklist

- [ ] Player A creates room.
- [ ] Player B joins room.
- [ ] Both players spawn in different building areas.
- [ ] Player movement and remote player sync are visible.
- [ ] At least one clue can be collected by each player.
- [ ] Notebook shows collected clues.
- [ ] Ghost patrols and chase can be triggered.
- [ ] AI NPC answers clue-based question without directly revealing final answer.
- [ ] Knowledge lock returns WA for wrong answer.
- [ ] Knowledge lock returns AC for correct answer.
- [ ] Key unlocks and final route opens.
- [ ] Ending/result screen appears.

