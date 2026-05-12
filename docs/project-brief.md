# Project Brief

## Source Constraints

Based on the teacher's final project proposal slides and the team proposal PDF:

- The final project must be a web game built with Cocos Creator.
- The proposal and development should clearly express motivation, user story, setting, controls, high-risk features, high-value features, similar games, and concept art.
- The course grading emphasis is mainly effort and technique, so the implementation should make technical work visible instead of relying only on story or art.
- The proposal should be a practical blueprint, not a detailed game encyclopedia.

## Game Concept

`逃離清大：Delta Protocol` is a top-down cooperative escape-room horror game set in NTHU's Delta Building and CS Building.

Two players are trapped in different buildings after a midnight blackout. They must explore rooms, avoid ghosts, collect asymmetric clues, ask AI NPCs useful questions, solve algorithm-themed knowledge locks, and cooperate to escape.

## MVP Scope

The MVP should prove one complete game loop:

1. Player A and Player B enter the same room session.
2. Each player spawns in a different map area.
3. Both players can explore, interact with objects, and collect clues.
4. A ghost patrols and can chase a player.
5. One AI NPC dialogue encounter gives controlled hints based on discovered clues.
6. One algorithm knowledge lock requires information from both players.
7. The backend verifies the submitted answer and returns AC or WA.
8. AC unlocks a key, opens the route, and triggers a short ending.

## Non-Goals For MVP

- Full online judge or arbitrary code execution.
- Large campus map.
- Many NPCs or branching storylines.
- Complex combat.
- Account system.
- Production-grade matchmaking.

## Team Ownership

| Member | Primary Ownership | Secondary Ownership |
| --- | --- | --- |
| 李久恩 | Cocos gameplay frontend, player controller, ghost chase, scene integration | Unity-to-Cocos implementation patterns, frontend polish |
| 陳可冀 | Backend API, room/session service, AI NPC service, puzzle verification | API documentation, backend testing |
| 鄭名緯 | Frontend/backend integration, WebSocket sync, Cocos UI panels | Build tooling, end-to-end integration |
| 潘睦婷 | Game art, UI visual style, effects, concept-to-asset pipeline | Atmosphere, VN dialogue presentation, sound/effect coordination |

## Success Definition

The project is demo-ready when the team can show a 5-8 minute complete run where both players must communicate, the AI NPC behaves like a bounded hint source, the ghost creates pressure, and AC unlocks the final route.

