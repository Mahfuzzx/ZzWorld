// Engine entry point: registers the built-in classes and re-exports the API.
// Everything here is DOM-free so it can be unit tested with Node.
import { register } from './registry.js';
import { Entity, Item, Furniture, Decor, Structure, Portal } from './entity.js';
import { Toggle, Container, Instrument, Wearable, Seat, Doorway, Wrap } from './behaviors.js';
import { Character, Face, Wearer } from './character.js';
import { SetState, PlayAnim, StopAnim, PlaySound, PlayMusic, StopMusic, Wait, Random } from './actions.js';
import { Sky, Stars, SunMoon, Clouds, Art } from './backdrop.js';

for (const cls of [Entity, Item, Furniture, Decor, Structure, Portal, Character]) register('entity', cls);
for (const cls of [Toggle, Container, Instrument, Wearable, Seat, Doorway, Wrap, Face, Wearer]) register('behavior', cls);
for (const cls of [SetState, PlayAnim, StopAnim, PlaySound, PlayMusic, StopMusic, Wait, Random]) register('action', cls);
for (const cls of [Sky, Stars, SunMoon, Clouds, Art]) register('layer', cls);

export { register, lookup, types } from './registry.js';
export { DefStore, mergeDefs, loadPack, fetchJson } from './defs.js';
export { Entity, Item, Furniture, Decor, Structure, Portal } from './entity.js';
export { Backdrop, Layer } from './backdrop.js';
export { DayNight } from './daynight.js';
export { Behavior } from './behavior.js';
export { Toggle, Container, Instrument, Wearable, Seat, Doorway, Wrap } from './behaviors.js';
export * as characters from './character.js';
export { Action, runActions } from './actions.js';
export { Scene, MIN_TOUCH } from './scene.js';
export { Animator, CLIPS, sampleTrack, clipDuration } from './animator.js';
export { partGroups, artFor, applyPartFx } from './compose.js';
