# Spec-Driven Development Workflow

## Principle

Every feature starts as a small spec before implementation. The spec should explain player value, technical design, acceptance criteria, and ownership. Code is considered complete only when it satisfies the linked spec.

## Folder Convention

```text
docs/
  project-brief.md
  spec-driven-development.md
  specs/
    escape-nthu/
      requirements.md
      design.md
      tasks.md
    feature-name/
      requirements.md
      design.md
      tasks.md
```

## Spec Lifecycle

1. Requirements
   - Define player-facing behavior.
   - Write acceptance criteria using clear pass/fail statements.
   - Mark priority as Must, Should, or Could.

2. Design
   - Define scene/module ownership.
   - Document frontend/backend contracts.
   - Identify risks and fallback plans.

3. Tasks
   - Break implementation into small deliverables.
   - Assign one owner per task.
   - Add verification steps before marking done.

4. Implementation
   - Implement only the scoped task.
   - Keep game constants and tuning values configurable.
   - Update the spec if the implementation changes the intended behavior.

5. Verification
   - Run unit or script checks for backend logic.
   - Run Cocos preview/manual checklist for gameplay loops.
   - Record demo blockers in `tasks.md`.

## Definition Of Done

A feature is done when:

- The relevant requirement has a matching implementation.
- The owner can demonstrate the behavior locally.
- Failure states are visible to the player or developer.
- Integration with other modules is documented.
- At least one teammate other than the owner has reviewed the behavior.

## Risk-First Rule

High-risk systems must be prototyped before high-value polish:

1. Cocos player movement and collision.
2. Ghost patrol/chase loop.
3. WebSocket room sync for two players.
4. AI NPC prompt boundaries.
5. Puzzle answer verification.
6. Scene/UI/art polish.

