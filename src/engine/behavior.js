// Base class for behaviors attached to entities. Every behavior answers the same
// questions; the engine never needs to know which concrete behavior it talks to.

export class Behavior {
  static type = 'Behavior';

  constructor(entity, config = {}, saved = undefined) {
    this.entity = entity;
    this.config = config;
  }

  // Called for every event the entity emits, before its reactions run.
  handle(event, data) {}

  tick(dt) {}

  // Can `item` be dropped into this behavior? `force` skips state checks
  // (used when building scenes from templates).
  accepts(item, { force = false } = {}) {
    return false;
  }

  receive(item) {}

  release(item) {}

  // Are entities held by this behavior currently visible?
  showsContents() {
    return false;
  }

  // Extra state to persist with the entity; undefined means nothing to save.
  serialize() {
    return undefined;
  }
}
