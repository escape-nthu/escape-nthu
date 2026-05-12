# Requirements Spec: Escape NTHU

## Requirement Priorities

- Must: required for demo-ready MVP.
- Should: strong grading/value improvement after MVP is stable.
- Could: optional extension only after core loop is complete.

## R1: Two-Player Session

Priority: Must

User story: As two players, we want to enter the same game session so that each of us can play a different role in the escape route.

Acceptance criteria:

- Given Player A creates a room, when Player B joins with the room code, then both players enter the same session.
- Given both players are in a session, when either player moves or triggers a key event, then the other player receives the relevant synchronized state.
- Given one player disconnects, when the remaining player continues, then the UI shows a waiting/reconnect state instead of silently breaking.

## R2: Top-Down Exploration

Priority: Must

User story: As a player, I want to move through the building, inspect objects, and collect clues so that I can progress through the escape room.

Acceptance criteria:

- Given the player is in exploration mode, when they press W/A/S/D, then the character moves in the expected direction.
- Given the player is near an interactable object, when they press E or click it, then the interaction panel opens.
- Given a clue is collected, when the notebook is opened, then the clue appears in the player's clue list.

## R3: Ghost Patrol And Chase

Priority: Must

User story: As a player, I want the ghost to patrol and chase me so that exploration has pressure and urgency.

Acceptance criteria:

- Given the ghost is in patrol mode, when no player is detected, then it follows a predefined patrol path.
- Given a player enters the ghost detection range, when line of sight is valid, then the ghost switches to chase mode.
- Given the player hides, escapes range, or reaches a safe zone, when the chase timeout expires, then the ghost returns to patrol.
- Given the ghost catches the player, then the game applies a clear penalty such as reset to checkpoint, time loss, or clue drop.

## R4: AI NPC Dialogue

Priority: Must

User story: As a player, I want to ask an AI NPC questions based on discovered clues so that I can infer the knowledge lock answer.

Acceptance criteria:

- Given the player opens an AI NPC conversation, when they ask a question, then the backend returns an in-character response.
- Given the player has not discovered required clues, when they ask for the answer directly, then the NPC refuses or gives a vague hint.
- Given the player includes relevant clue context, when they ask a focused question, then the NPC can reveal the next hint tier.
- Given the AI service fails, then the game shows a fallback hint path so the demo can continue.

## R5: Cooperative Knowledge Lock

Priority: Must

User story: As two players, we want each side to hold different information so that communication is required to unlock the route.

Acceptance criteria:

- Given Player A sees the lock prompt, when Player B has supporting clue data, then neither player alone has enough information.
- Given both players exchange information, when the correct answer is submitted, then the lock returns AC and unlocks the key.
- Given an incorrect answer is submitted, then the lock returns WA with limited feedback and does not reveal the full solution.

## R6: Algorithm Puzzle Verification

Priority: Must

User story: As a player, I want the game to validate my answer like an AC/WA result so that the programming theme feels concrete.

Acceptance criteria:

- Given a lock has predefined test data and expected output, when the player submits an answer, then the backend checks the answer deterministically.
- Given the answer is correct, then the backend returns `AC`, the key state becomes unlocked, and both clients update.
- Given the answer is incorrect, then the backend returns `WA`, attempt count increases, and the lock remains closed.

## R7: Visual Novel Dialogue UI

Priority: Should

User story: As a player, I want dialogue scenes to feel different from exploration so that AI NPC interactions feel dramatic and readable.

Acceptance criteria:

- Given the player starts dialogue, when the VN overlay opens, then movement pauses and the dialogue UI receives input focus.
- Given the player exits dialogue, then exploration state resumes without losing player position.
- Given new dialogue lines arrive, then the UI displays speaker name, portrait, text, and clue context.

## R8: Clue Notebook

Priority: Should

User story: As a player, I want a notebook of collected clues so that I can reason without memorizing every detail.

Acceptance criteria:

- Given a clue is collected, when the player presses Tab, then the clue appears in the notebook.
- Given clues belong to different categories, then the notebook separates map clues, algorithm clues, and AI hints.

## R9: Atmosphere, Art, And Effects

Priority: Should

User story: As a player, I want the game to look and sound like a midnight NTHU horror escape so that the setting feels memorable.

Acceptance criteria:

- The MVP map includes recognizable Delta/CS building visual cues.
- Ghost chase includes clear visual or audio feedback.
- Interaction states have readable UI feedback.

## R10: Extended Content

Priority: Could

User story: As a returning player, I want optional endings, achievements, and hidden lore so that the game has replay value.

Acceptance criteria:

- Optional content does not block the main escape route.
- Optional systems can be disabled without breaking the MVP.

