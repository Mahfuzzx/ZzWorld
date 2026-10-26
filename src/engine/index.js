// Engine entry point: registers the built-in classes and re-exports the API.
// Everything here is DOM-free so it can be unit tested with Node.
import { register } from './registry.js';
import { Entity, Item, Furniture, Decor } from './entity.js';
import { Toggle, Container } from './behaviors.js';
import { SetState, PlayAnim, PlaySound, Wait, Random } from './actions.js';

for (const cls of [Entity, Item, Furniture, Decor]) register('entity', cls);
for (const cls of [Toggle, Container]) register('behavior', cls);
for (const cls of [SetState, PlayAnim, PlaySound, Wait, Random]) register('action', cls);

export { register, lookup, types } from './registry.js';
export { DefStore, mergeDefs, loadPack, fetchJson } from './defs.js';
export { Entity, Item, Furniture, Decor } from './entity.js';
export { Behavior } from './behavior.js';
export { Toggle, Container } from './behaviors.js';
export { Action, runActions } from './actions.js';
export { Scene, MIN_TOUCH } from './scene.js';
export { Animator, CLIPS } from './animator.js';
