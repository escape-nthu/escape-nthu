/**
 * Thin wrapper over cc.EventTarget for decoupled game-wide events.
 * Usage: EventBus.emit("clue:collected", clueId);
 *        EventBus.on("clue:collected", handler, this);
 */
const EventBus = new cc.EventTarget();
export default EventBus;
