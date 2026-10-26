// Actions are what reactions do: { "do": "<type>", ...config }.
// All actions share one interface, so reactions never care which one they run.
import { lookup } from './registry.js';

export class Action {
  static type = 'Action';

  constructor(config) {
    this.config = config;
  }

  async run(ctx) {}
}

export function matchesWhen(when, entity) {
  if (when == null) return true;
  return [].concat(when).includes(entity.state);
}

export async function runActions(list, ctx) {
  for (const config of list) {
    if (!matchesWhen(config.when, ctx.entity)) continue;
    try {
      const ActionClass = lookup('action', config.do);
      await new ActionClass(config).run(ctx);
    } catch (err) {
      console.warn(`Action "${config.do}" failed on ${ctx.entity.def.id}:`, err);
    }
  }
}

const pick = (v) => (Array.isArray(v) ? v[Math.floor(Math.random() * v.length)] : v);
const range = (v, fallback) => (Array.isArray(v) ? v[0] + Math.random() * (v[1] - v[0]) : (v ?? fallback));

export class SetState extends Action {
  static type = 'SetState';

  async run({ entity }) {
    const { to, toggle } = this.config;
    if (toggle) {
      const i = toggle.indexOf(entity.state);
      entity.setState(toggle[(i + 1) % toggle.length]);
    } else if (to) {
      entity.setState(to);
    }
  }
}

export class PlayAnim extends Action {
  static type = 'PlayAnim';

  async run({ entity, scene }) {
    const done = scene.services.animator?.play(entity, this.config.clip, this.config);
    if (this.config.wait) await done;
  }
}

export class StopAnim extends Action {
  static type = 'StopAnim';

  async run({ entity, scene }) {
    scene.services.animator?.stop(entity, this.config.clip);
  }
}

export class PlaySound extends Action {
  static type = 'PlaySound';

  // The entity's own sounds come first, then the built-in presets. Sounds come
  // from where the entity is on screen (stereo).
  async run({ entity, scene }) {
    scene.services.audio?.play(pick(this.config.sound), {
      volume: this.config.volume ?? 1,
      pitch: range(this.config.pitch, 1),
      pan: scene.services.view?.panOf(entity.x) ?? 0,
      sounds: entity.def.sounds,
    });
  }
}

// { "do": "PlayMusic", "song": "core.song.radio" } — the entity plays a song
// (a radio); the background music turns down meanwhile.
export class PlayMusic extends Action {
  static type = 'PlayMusic';

  async run({ entity, scene }) {
    const { music } = scene.services;
    if (!music || !scene.defs.has(this.config.song)) return;
    music.playSource(entity.id, scene.defs.get(this.config.song));
  }
}

export class StopMusic extends Action {
  static type = 'StopMusic';

  async run({ entity, scene }) {
    scene.services.music?.stopSource(entity.id);
  }
}

export class Wait extends Action {
  static type = 'Wait';

  run() {
    return new Promise((resolve) => setTimeout(resolve, this.config.ms ?? 500));
  }
}

// { "do": "Random", "of": [[...actions], [...actions]] } runs one list at random.
export class Random extends Action {
  static type = 'Random';

  async run(ctx) {
    const options = this.config.of ?? [];
    if (options.length) await runActions(pick(options), ctx);
  }
}
