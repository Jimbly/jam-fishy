/*eslint global-require:off*/
// eslint-disable-next-line import/order
const local_storage = require('glov/client/local_storage.js');
local_storage.setStoragePrefix('fishy'); // Before requiring anything else that might load from this

import * as assert from 'assert';
import * as camera2d from 'glov/client/camera2d.js';
import * as engine from 'glov/client/engine.js';
import { ALIGN, fontStyle } from 'glov/client/font';
import {
  KEYS,
  PAD,
  eatAllInput,
  inputTouchMode,
  keyDown,
  mouseDownAnywhere,
  mouseDownOverBounds,
  padButtonDown,
} from 'glov/client/input.js';
import * as net from 'glov/client/net.js';
import { spotFocusSteal } from 'glov/client/spot.js';
import { createSprite } from 'glov/client/sprites.js';
import * as ui from 'glov/client/ui.js';
import { drawLine, drawVBox, progressBar } from 'glov/client/ui.js';
import { mashString, randCreate } from 'glov/common/rand_alea';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { clamp, easInOut, easeIn, easeOut, lerp } from 'glov/common/util';
import {
  v2add,
  v2dist,
  v2lerp,
  v2normalize,
  v2scale,
  v2sub,
  v4copy,
  v4lerp,
  vec2,
  vec4,
  zero_vec,
} from 'glov/common/vmath';


// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { PI, ceil, cos, floor, min, max, random, sin } = Math;

// Virtual viewport for our game logic
const game_width = 1280;
const game_height = 720;

const GAME_TIME = 10 * 60 * 1000;

const METER_KEY_SETS = [
  [[KEYS.A, KEYS.LEFT], [PAD.LEFT_BUMPER, PAD.LEFT_TRIGGER, PAD.LEFT, PAD.X], 0],
  // [[KEYS.S, KEYS.UP], [PAD.UP, PAD.A, PAD.Y], 1],
  [[KEYS.D, KEYS.RIGHT], [PAD.RIGHT_BUMPER, PAD.RIGHT_TRIGGER, PAD.RIGHT, PAD.B], 2],
];
const NUM_METERS = METER_KEY_SETS.length;

const METER_H = game_height * 0.5;
const METER_Y = floor(game_height * 0.1333);
const METER_W = 64;
const METER_PAD = min(192, (game_width/2 - METER_W*NUM_METERS) / (NUM_METERS - 1));
const METER_PROGRESS_W = 8;
const METERS_X0 = (game_width - METER_W * NUM_METERS - METER_PAD * (NUM_METERS - 1)) / 2 - METER_PROGRESS_W/2;
const PROGRESS_W = game_width * 0.5;
const PROGRESS_H = 32;
const PROGRESS_X = (game_width - PROGRESS_W) / 2;
const PROGRESS_Y = (METER_Y - PROGRESS_H) / 2;
const FISHING_POLE_X = game_width * 0.82;
const FISHING_POLE_Y_OFFS = game_height * 0.85 - 476;
const FISHING_POLE_SIZE = 256;
const FISHING_POLE_LENGTH = FISHING_POLE_SIZE * 90/128;
const BOBBER_X = game_width * 0.1;
const BOBBER_Y = game_height * 0.87;
const BOBBER_SIZE = 64;
const FISH_SIZE = 128;

const style_skills_header = fontStyle(null, {
  glow_color: 0x00000080,
  glow_xoffs: 2,
  glow_yoffs: 2,
  glow_inner: -2.5,
  glow_outer: 5,
});
const style_skills_label = fontStyle(null, {
  color: 0x000000ff,
});
const SKILLS_W = 300;
const STATS_W = 230;
const SKILLS_LABEL_W = 220;

const color_progress_done = vec4(0.549,0.800,0.490, 1);
const color_progress_bad = vec4(0.788,0.247,0.247, 1);
const color_progress_ok = vec4(0.886,0.886,0.541, 1);
const color_progress_blink = vec4(0,0,0,1);

//const cursor_color = vec4(0.525, 0.753, 0.808, 1);
const cursor_color = vec4(0.596,0.855,0.918, 1);
const cursor_color_active = vec4(0.651, 0.933, 1.0, 1);
const cursor_color_on_target = vec4(0.596,0.922,0.569, 1);
const cursor_color_on_target_active = vec4(0.651,1.0,0.659, 1);
const color_fishing_line = vec4(0, 0, 0, 1);

const color_panel = cursor_color;
// const color_panel = vec4(0.525, 0.753, 0.808, 1);

const style_caught_fish = fontStyle(null, {
  color: 0x008000ff,
  border_color: 0x000000ff,
  border_width: 2.5,
});

const style_lost_fish = fontStyle(style_caught_fish, {
  color: 0x800000ff,
});

const FISH_DEFS = [{
  tex: 'pond/bluegreen_fish',
  name: 'Fishy',
  difficulty: 0,
  rarity: 0,
}, {
  tex: 'pond/purplegreen_fish',
  name: 'Shady',
  difficulty: 0,
  rarity: 1,
}, {
  tex: 'pond/sick_fish',
  name: 'Sicky',
  difficulty: 0,
  rarity: 2,
}, {
  tex: 'river/yellow_fish',
  name: 'Yelly',
  difficulty: 1,
  rarity: 0,
}, {
  tex: 'river/crab',
  name: 'Crabby',
  difficulty: 1,
  rarity: 1,
}, {
  tex: 'river/can',
  name: 'Trashy',
  difficulty: 1,
  rarity: 2,
}, {
  tex: 'ocean/seahorse',
  name: 'Horsey',
  difficulty: 2,
  rarity: 0,
}, {
  tex: 'ocean/jellyfish',
  name: 'Jelly',
  difficulty: 2,
  rarity: 1,
}, {
  tex: 'ocean/redpink_fish',
  name: 'Pinky',
  difficulty: 2,
  rarity: 2,
}];

const ODDS_BY_RARITY = [4,2,1];

const DIFFICULTIES = [{
  label: 'Pond (easy)',
  target_accel: 0.0000001,
  target_max_vel: 0.0001,
  choice_period: [2000, 4000],
  xp: 10,
  score: 100,
}, {
  label: 'River (medium)',
  target_accel: 0.0000004,
  target_max_vel: 0.0004,
  choice_period: [2000, 2000],
  xp: 15,
  score: 200,
}, {
  label: 'Ocean (hard)',
  target_accel: 0.0000024,
  target_max_vel: 0.0008,
  choice_period: [2000, 0],
  xp: 20,
  score: 400,
}];
const DISCOVERY_PTS = 1000;

//////////////////////////////////////////////////////////////////////////
// Begin game code

window.Z = window.Z || {};
Z.BACKGROUND = 1;
Z.SPRITES = 10;

const STATE_PREP = 1;
const STATE_CAST = 2;
const CAST_TIME = 1000;
const STATE_FISH = 3;

let font;
let sprites;

const EPSILON = 0.001;

class MeterState {
  constructor(game_state) {
    this.game_state = game_state;
    this.cursor_size_base = 0.3;
    this.cursor_accel = 0.000001;
    this.cursor_gravity = -this.cursor_accel;
    this.cursor_bounce_top = -0.5;
    this.cursor_bounce_bottom = -0.25;
    this.target_bounce_top = -1;
    this.target_bounce_bottom = -1;
    this.progress_gain_speed_base = 0.00005;
    this.progress_lose_speed_base = -this.progress_gain_speed_base * 0.75;
    this.reset(0);
  }
  applySkills() {
    this.cursor_size = this.cursor_size_base * this.game_state.skill_values.cursor_size;
    this.progress_gain_speed = this.progress_gain_speed_base * this.game_state.skill_values.gain_speed;
    this.progress_lose_speed = this.progress_lose_speed_base * this.game_state.skill_values.lose_speed;
  }
  reset(difficulty) {
    let { rand } = this.game_state;
    let diff = DIFFICULTIES[difficulty];
    this.cursor_pos = 0;
    this.cursor_vel = 0;
    this.target_pos = rand.random();
    this.target_vel = 0;
    this.target_accel = diff.target_accel;
    this.target_max_vel = diff.target_max_vel;
    this.choice_period = diff.choice_period[0] + rand.range(diff.choice_period[1]);
    this.chooseDest();
    this.progress = 0.5;
    this.locked = false;
    this.on_target = false;
  }
  chooseDest() {
    this.target_dest = 0.1 + this.game_state.rand.random() * 0.8;
    this.choice_t = 0;
  }
  getCursorMidpoint() {
    return this.cursor_pos + this.cursor_size / 2;
  }
  getCursor01() {
    return this.cursor_pos / (1 - this.cursor_size);
  }
  update(dt, up) {
    let { game_state } = this;
    // Update target
    this.choice_t += dt;
    if (this.choice_t >= this.choice_period) {
      this.chooseDest();
    }
    if (this.target_dest > this.target_pos) {
      this.target_vel += this.target_accel * dt;
      this.target_vel = min(this.target_vel, this.target_max_vel);
    } else {
      this.target_vel -= this.target_accel * dt;
      this.target_vel = max(this.target_vel, -this.target_max_vel);
    }
    this.target_pos += this.target_vel * dt;
    let over = this.target_pos - 1;
    if (over >= 0) {
      this.target_pos = 1 + over * this.target_bounce_top;
      this.target_vel *= this.target_bounce_top;
    }
    let under = 0 - this.target_pos;
    if (under >= 0) {
      this.target_pos = under * this.target_bounce_bottom;
      this.target_vel *= this.target_bounce_bottom;
    }


    // Update player
    up = min(up, dt);
    let down = dt - up;
    this.cursor_vel += up * this.cursor_accel;
    if (this.cursor_vel < 0) {
      this.cursor_vel += down * this.cursor_gravity * game_state.skill_values.stability;
    } else {
      this.cursor_vel += down * this.cursor_gravity;
    }
    this.cursor_pos += this.cursor_vel * dt;
    // bounce
    over = this.cursor_pos + this.cursor_size - 1;
    if (over >= 0) {
      this.cursor_pos = 1 - this.cursor_size + over * this.cursor_bounce_top;
      this.cursor_vel *= this.cursor_bounce_top;
    }
    under = 0 - this.cursor_pos;
    if (under >= 0) {
      this.cursor_pos = under * this.cursor_bounce_bottom;
      this.cursor_vel *= this.cursor_bounce_bottom;
    }

    if (this.cursor_pos <= this.target_pos + EPSILON &&
      this.cursor_pos + this.cursor_size >= this.target_pos - EPSILON
    ) {
      this.on_target = true;
    } else {
      this.on_target = false;
    }

    if (!this.locked) {
      let eff_dt = dt * game_state.time_scale;
      if (this.on_target) {
        this.progress += eff_dt * this.progress_gain_speed;
      } else {
        this.progress += eff_dt * this.progress_lose_speed;
      }
    }
    this.progress = clamp(this.progress, 0, 1);
    if (this.progress === 1) {
      this.locked = true;
    }
  }
}

const XP_COST = [
  10, 20, 40,
];

const SKILLS = [{
  id: 'cursor_size',
  name: 'Bar Size',
  values: [1, 1 + 0.5/3, 1 + 0.5*2/3, 1.5],
}, {
  id: 'gain_speed',
  name: 'Faster Catching',
  values: [1, 1 + 0.5/3, 1 + 0.5*2/3, 1.5],
}, {
  id: 'lose_speed',
  name: 'Slower Losing',
  values: [1, 0.75, 0.625, 0.5],
// }, {
//   id: 'rarity',
//   name: 'Rarity',
//   values: [1, 2, 3, 4],
}, {
  id: 'stability',
  name: 'Stability',
  values: [1, 0.75, 0.625, 0.5],
}];

class GameState {
  constructor() {
    this.rand = randCreate(mashString('test1'));
    this.meters = [];
    for (let ii = 0; ii < NUM_METERS; ++ii) {
      this.meters.push(new MeterState(this));
    }
    this.t = 0;
    this.just_fished = false;
    this.skills = {};
    for (let ii = 0; ii < SKILLS.length; ++ii) {
      let skill = SKILLS[ii];
      this.skills[skill.id] = 0;
    }
    this.xp = 0; // engine.DEBUG ? 10000 : 0;
    this.time_left = GAME_TIME;
    this.score = 0;
    this.discovered = {};
    this.applySkills();
    this.startPrep();
  }

  applySkills() {
    this.skill_values = {};
    for (let ii = 0; ii < SKILLS.length; ++ii) {
      let skill = SKILLS[ii];
      let level = this.skills[skill.id];
      skill.last_level = level;
      this.skill_values[skill.id] = skill.values[level];
    }
    for (let ii = 0; ii < this.meters.length; ++ii) {
      this.meters[ii].applySkills();
    }
  }

  chooseTargetFish() {
    let options = [];
    for (let ii = 0; ii < FISH_DEFS.length; ++ii) {
      let def = FISH_DEFS[ii];
      if (def.difficulty === this.difficulty) {
        let odds = ODDS_BY_RARITY[def.rarity];
        for (let jj = 0; jj < odds; ++jj) {
          options.push(ii);
        }
      }
    }
    assert(options.length);
    this.target_fish = options[this.rand.range(options.length)];
  }

  startPrep() {
    this.t = 0;
    this.state = STATE_PREP;
    this.time_left = floor((this.time_left + 999) / 1000) * 1000;
    spotFocusSteal({ key: 'cast' });
  }

  startCast(difficulty) {
    this.state = STATE_CAST;
    //this.progress = 0;
    this.time_scale = 1;
    this.difficulty = difficulty;
    this.chooseTargetFish();
    this.t = 0;
    this.applySkills();
    for (let ii = 0; ii < this.meters.length; ++ii) {
      this.meters[ii].reset(difficulty);
    }
  }

  finishFish(did_catch) {
    this.just_fished = true;
    this.last_fish = did_catch ? this.target_fish : -1;
    if (did_catch) {
      let res = {
        xp: DIFFICULTIES[this.difficulty].xp,
        score: DIFFICULTIES[this.difficulty].score,
      };
      if (!this.discovered[this.last_fish]) {
        this.discovered[this.last_fish] = true;
        res.discovered = DISCOVERY_PTS;
        this.score += res.discovered;
      }
      this.last_res = res;
      this.xp += res.xp;
      this.score += res.score;
    } else {
      this.last_res = null;
    }
  }

  update(dt) {
    this.t += dt;
    if (this.state === STATE_CAST) {
      if (this.t >= CAST_TIME) {
        this.state = STATE_FISH;
        this.t = 0;
      }
    }
    if (this.state === STATE_FISH || this.state === STATE_CAST) {
      //this.progress = 0;
      this.time_scale = 1;
      if (this.state === STATE_CAST) {
        this.time_scale = this.t / CAST_TIME;
      }
      let all_complete = true;
      let any_complete = false;
      let failed = false;
      for (let ii = 0; ii < this.meters.length; ++ii) {
        let meter = this.meters[ii];
        //this.progress += meter.progress / this.meters.length;
        if (meter.locked) {
          any_complete = true;
        } else {
          all_complete = false;
        }
        if (!meter.progress) {
          failed = true;
        }
      }
      if (any_complete) {
        this.time_scale = 1.5;
      }
      if (all_complete || failed) {
        this.finishFish(all_complete);
        this.startPrep();
      }
    }
    if (this.state === STATE_FISH) {
      this.time_left -= dt;
      if (this.time_left < 0) {
        this.time_left = 0;
        this.just_fished = true;
        this.last_fish = 0;
        this.startPrep();
      }
    }
  }
}

function heroHOffset() {
  return sin(engine.frame_timestamp * 0.001)*8;
}

let game_state;

function heroY() {
  return game_state.difficulty === 2 ? 370 : 476;
}

function bobberYOffs() {
  return sin(engine.frame_timestamp * 0.003 + 0.1)*4 +
    sin(engine.frame_timestamp * 0.00013 + 0.3)*2;
}

function init() {
  game_state = new GameState();
  sprites = {
    coin: createSprite({
      name: 'coin',
      size: [ui.button_height, ui.button_height],
    }),
    meter_cursor: createSprite({
      name: 'meter_cursor',
      ws: [128],
      hs: [60, 8, 60],
    }),
    meter_bg: createSprite({
      name: 'meter_bg',
      ws: [256],
      hs: [88, 512-88-178, 178],
    }),
    progress_vert_bar: createSprite({
      name: 'progress_vert_bar',
      ws: [128],
      hs: [60, 8, 60],
    }),
    progress_vert_bg: createSprite({
      name: 'progress_vert_bg',
      ws: [128],
      hs: [64, 128, 64],
    }),
    meter_target: createSprite({
      name: 'meter_target',
      origin: [0.5, 0.5],
    }),
    fishing_pole: createSprite({
      name: 'fishing_pole',
      origin: [64/128, 104/128],
    }),
    bobber: createSprite({
      name: 'bobber',
      origin: [0.5, 0.5],
    }),
    hero: createSprite({
      name: 'fish/beige_catfish',
    }),
    bg_ocean: createSprite({
      name: 'bg_ocean',
      filter_min: gl.LINEAR,
      wrap_s: gl.CLAMP_TO_EDGE,
      wrap_t: gl.CLAMP_TO_EDGE,
    }),
    bg_ocean_top: createSprite({
      name: 'bg_ocean_top',
      filter_min: gl.LINEAR,
      wrap_s: gl.CLAMP_TO_EDGE,
      wrap_t: gl.CLAMP_TO_EDGE,
    }),
    bg_ocean_clouds: createSprite({
      name: 'bg_ocean_clouds',
    }),
    bg_ocean_gradient: createSprite({
      name: 'bg_ocean_gradient',
      filter_min: gl.LINEAR,
      wrap_s: gl.CLAMP_TO_EDGE,
      wrap_t: gl.CLAMP_TO_EDGE,
    }),
    bg_lake: createSprite({
      name: 'bg_lake',
      filter_min: gl.LINEAR,
      wrap_s: gl.CLAMP_TO_EDGE,
      wrap_t: gl.CLAMP_TO_EDGE,
    }),
    bg_lake_clouds: createSprite({
      name: 'bg_lake_clouds',
    }),
    bg_lake_gradient: createSprite({
      name: 'bg_lake_gradient',
      filter_min: gl.LINEAR,
      wrap_s: gl.CLAMP_TO_EDGE,
      wrap_t: gl.CLAMP_TO_EDGE,
    }),
    bg_river: createSprite({
      name: 'bg_river',
      filter_min: gl.LINEAR,
      wrap_s: gl.CLAMP_TO_EDGE,
      wrap_t: gl.CLAMP_TO_EDGE,
    }),
    bg_river_gradient: createSprite({
      name: 'bg_river_gradient',
      filter_min: gl.LINEAR,
      wrap_s: gl.CLAMP_TO_EDGE,
      wrap_t: gl.CLAMP_TO_EDGE,
    }),
    fish: [],
  };
  FISH_DEFS.forEach((def) => {
    sprites.fish.push(createSprite({
      name: `fish/${def.tex}`,
      wrap_s: gl.CLAMP_TO_EDGE,
      wrap_t: gl.CLAMP_TO_EDGE,
      origin: [0.5, 0.5],
    }));
  });
}

let temp_color = vec4();
function doMeter(dt, x, y, meter, keys, pads, mouse_button, touch_is_down) {
  let z = Z.UI;
  let up = 0;
  for (let ii = 0; ii < keys.length; ++ii) {
    up += keyDown(keys[ii]);
  }
  for (let ii = 0; ii < pads.length; ++ii) {
    up += padButtonDown(pads[ii]);
  }
  up += mouseDownAnywhere(mouse_button) ? dt : 0;
  up += touch_is_down ? dt : 0;
  meter.update(dt, up);
  let active = Boolean(up) && !meter.locked; // active = player is activating
  drawVBox({
    x, y, z, w: METER_W, h: METER_H,
  }, sprites.meter_bg);
  let cursor_pos = meter.cursor_pos + meter.cursor_size;
  let cursor_h = meter.cursor_size;
  if (meter.locked) {
    cursor_pos = 1;
    cursor_h = 1;
  }
  drawVBox({
    x,
    y: y + METER_H - cursor_pos * METER_H,
    z: z + 1,
    w: METER_W,
    h: METER_H * cursor_h,
  }, sprites.meter_cursor,
    (meter.on_target || meter.locked) ? active ? cursor_color_on_target_active : cursor_color_on_target :
    active ? cursor_color_active : cursor_color);

  if (!meter.locked) {
    sprites.meter_target.draw({
      x: x + METER_W * 0.5,
      y: y + METER_H - meter.target_pos * METER_H,
      z: z + 2,
      w: METER_W, h: METER_W*0.5,
      rot: meter.on_target ? 0 : sin(engine.frame_timestamp*0.02) * 0.3,
    });

    if (engine.DEBUG && false) {
      sprites.meter_target.draw({
        x,
        y: y + METER_H - meter.target_dest * METER_H,
        z: z + 1.5,
        w: METER_W, h: METER_W,
        color: [0,0,0,0.5],
      });
    }
  }
  let blink = meter.progress < 0.125 && engine.frame_timestamp % 150 < 75;

  // Progress meter
  x += METER_W;
  drawVBox({
    x, y, z, w: METER_PROGRESS_W, h: METER_H,
  }, sprites.progress_vert_bg);
  if (meter.locked) {
    v4copy(temp_color, color_progress_done);
  } else {
    v4lerp(temp_color, meter.progress, color_progress_bad, color_progress_ok);
    if (blink) {
      v4copy(temp_color, color_progress_blink);
    }
  }

  drawVBox({
    x,
    y: min(y + METER_H - meter.progress * METER_H, y + METER_H - METER_PROGRESS_W),
    z: z + 1,
    w: METER_PROGRESS_W,
    h: METER_H * meter.progress,
  }, sprites.progress_vert_bar, temp_color);
}

function drawProgress(x, y, w, h) {
  progressBar({
    x, y, w, h, progress: game_state.progress,
  });
}

function drawBG() {
  let h = camera2d.hReal();
  let vextra = (h - game_height) / game_height / 2;
  let w = camera2d.wReal();
  let uextra = (w - game_width) / game_width / 2;
  let spr = game_state.difficulty === 1 ? 'river' : game_state.difficulty === 2 ? 'ocean' : 'lake';
  sprites[`bg_${spr}_gradient`].draw({
    x: camera2d.x0Real(),
    y: camera2d.y0Real(),
    w, h,
    z: Z.BACKGROUND,
    uvs: [-uextra, -vextra, 1+uextra, 1+vextra],
  });
  sprites[`bg_${spr}`].draw({
    x: camera2d.x0Real(),
    y: camera2d.y0Real(),
    w, h,
    z: Z.BACKGROUND+1,
    uvs: [-uextra, -vextra, 1+uextra, 1+vextra],
  });
  if (game_state.difficulty === 2) {
    sprites.bg_ocean_top.draw({
      x: camera2d.x0Real(),
      y: camera2d.y0Real(),
      w, h,
      z: Z.BACKGROUND+4,
      uvs: [-uextra, -vextra, 1+uextra, 1+vextra],
    });
  }
  let clouds_key = `bg_${spr}_clouds`;
  if (sprites[clouds_key]) {
    let scroll = engine.frame_timestamp * 0.00001;
    sprites[clouds_key].draw({
      x: camera2d.x0Real(),
      y: camera2d.y0Real(),
      w, h,
      z: Z.BACKGROUND+4,
      uvs: [-uextra + scroll, -vextra, 1+uextra + scroll, 1+vextra],
    });
  }

  let heroh = heroHOffset() * 2;
  sprites.hero.draw({
    x: 1022,
    y: heroY() + heroh,
    w: 223,
    h: 223 - heroh,
    z: Z.BACKGROUND+3,
  });

  if (!inputTouchMode()) {
    font.draw({
      x: 0, y: game_height - ui.font_height * 1.5,
      w: game_width,
      align: ALIGN.HCENTER,
      text: NUM_METERS === 3 ?
        'Controls: A/S/D or ←/↑/→ or LB/MB/RB or X/Y/B' :
        'Controls: A/D or ←/→ or LB/RB or X/B',
    });
  }
}

let temp_points = [];
let temp_point_idx = 0;
function tempPoint() {
  if (temp_point_idx === temp_points.length) {
    temp_points.push(vec2());
  }
  return temp_points[temp_point_idx++];
}
function pointInLine(t, p0, p1) {
  return v2lerp(tempPoint(), t, p0, p1);
}
function pointInBezier(p0, cp0, cp1, p1, t) {
  let a = pointInLine(t, p0, cp0);
  let b = pointInLine(t, cp0, cp1);
  let c = pointInLine(t, cp1, p1);
  let d = pointInLine(t, a, b);
  let e = pointInLine(t, b, c);
  return pointInLine(t, d, e);
}

const CURVE_STEPS = 30;
let cp0 = vec2();
let cp1 = vec2();
function drawBezier(p0, t0, p1, t1, z, color) {
  v2add(cp0, p0, t0);
  v2sub(cp1, p1, t1);
  // draw control points
  // drawLine(p0[0], p0[1], cp0[0], cp0[1], z, 1, 1, color);
  // drawLine(cp0[0], cp0[1], cp1[0], cp1[1], z, 1, 1, color);
  // drawLine(cp1[0], cp1[1], p1[0], p1[1], z, 1, 1, color);

  let last_pos = p0;
  for (let ii = 0; ii < CURVE_STEPS; ++ii) {
    let next_pos = pointInBezier(p0, cp0, cp1, p1, (ii + 1) / CURVE_STEPS);
    drawLine(last_pos[0], last_pos[1], next_pos[0], next_pos[1], z, 1, 1, color);
    last_pos = next_pos;
  }
}
function drawCurve(points, z, color) {
  temp_point_idx = 0;
  let tangents = [];
  tangents.push(zero_vec);
  for (let ii = 0; ii < points.length - 2; ++ii) {
    let tangent = v2sub(tempPoint(), points[ii+2], points[ii]);
    v2normalize(tangent, tangent);
    let mag = min(v2dist(points[ii], points[ii+1]), v2dist(points[ii+1], points[ii+2]));
    v2scale(tangent, tangent, mag * 0.5);
    tangents.push(tangent);
  }
  tangents.push(zero_vec);

  // Linear
  // for (let ii = 0; ii < points.length - 1; ++ii) {
  //   drawLine(points[ii][0], points[ii][1],
  //     points[ii+1][0], points[ii+1][1],
  //     z, 1, 1, color);
  // }

  // Bezier
  for (let ii = 0; ii < points.length - 1; ++ii) {
    drawBezier(points[ii], tangents[ii], points[ii+1], tangents[ii+1], z, color);
  }
}

function drawFishingPole() {
  let z = Z.BACKGROUND + 5;
  let angle = -PI/4;
  if (game_state.state === STATE_CAST) {
    let t = game_state.t / CAST_TIME;
    const BRK1 = 0.7;
    if (t < BRK1) {
      angle = lerp(easeOut(t/BRK1, 2), angle, PI/2);
    } else {
      angle = lerp(easeOut((t - BRK1)/(1 - BRK1), 2), PI/2, angle);
    }
  } else if (game_state.state === STATE_FISH) {
    angle = lerp(game_state.meters[1].getCursor01(), angle, PI/2);
  }
  sprites.fishing_pole.draw({
    x: FISHING_POLE_X, y: heroY() + FISHING_POLE_Y_OFFS + heroHOffset(),
    z,
    w: FISHING_POLE_SIZE, h: FISHING_POLE_SIZE,
    rot: angle,
  });

  if (game_state.state === STATE_FISH) {
    let pole_tip_x = FISHING_POLE_X + cos(angle - PI/2) * FISHING_POLE_LENGTH;
    let pole_tip_y = heroY() + FISHING_POLE_Y_OFFS + heroHOffset() + sin(angle - PI/2) * FISHING_POLE_LENGTH;
    let points = [[BOBBER_X, BOBBER_Y + bobberYOffs()]];
    for (let ii = 0; ii < game_state.meters.length; ++ii) {
      points.push([
        METERS_X0 + (METER_PAD + METER_W) * ii + METER_W/2,
        METER_Y + METER_H * (1 - game_state.meters[ii].getCursorMidpoint())
      ]);
    }
    points.push([pole_tip_x, pole_tip_y]);
    drawCurve(points, z-1, color_fishing_line);
    sprites.bobber.draw({
      x: BOBBER_X, y: BOBBER_Y + bobberYOffs(), z,
      w: BOBBER_SIZE, h: BOBBER_SIZE,
    });
  }
}

function pad2(num) {
  return `0${num}`.slice(-2);
}

const SKILL_PAD = 16;
function doTimeDisplay() {
  const x0 = SKILL_PAD;
  const y0 = SKILL_PAD;
  let x = x0;
  let y = y0;
  let z = Z.UI;

  function drawStat(label, value) {
    font.draw({
      style: style_skills_header,
      x, y, z,
      text: `${label}:`,
    });
    font.draw({
      style: style_skills_label,
      x, y, z,
      w: STATS_W,
      align: ALIGN.HRIGHT,
      text: value,
    });
    y += ui.button_height;
  }

  let time_sec = ceil(game_state.time_left / 1000);
  let time_min = floor(time_sec / 60);
  time_sec -= time_min * 60;
  drawStat('Time Left', `${time_min}:${pad2(time_sec)}`);
}

function doSkillsMenu(dt) {
  const x0 = SKILL_PAD;
  const y0 = SKILL_PAD;
  let x = x0;
  let y = y0;
  let z = Z.UI;

  let yoffs = (ui.button_height - ui.font_height) / 2;

  function drawStat(label, value, sprite) {
    font.draw({
      style: style_skills_header,
      x, y, z,
      text: `${label}:`,
    });
    let xoffs = 0;
    if (sprite) {
      xoffs = font.getStringWidth(style_skills_label, ui.font_height, ' XP');
    }
    font.draw({
      style: style_skills_label,
      x: x - xoffs, y, z,
      w: STATS_W,
      align: ALIGN.HRIGHT,
      text: value,
    });
    if (sprite) {
      sprite.draw({
        x: x + STATS_W - ui.button_height,
        y: y - yoffs,
        z,
      });
    }
    y += ui.button_height;
  }

  let time_sec = ceil(game_state.time_left / 1000);
  let time_min = floor(time_sec / 60);
  time_sec -= time_min * 60;
  drawStat('Time Left', `${time_min}:${pad2(time_sec)}`);

  font.draw({
    style: style_skills_header,
    x, y, z,
    text: 'Skills',
  });
  y += ui.font_height;
  for (let ii = 0; ii < SKILLS.length; ++ii) {
    let skill = SKILLS[ii];
    let { id, name, last_level, values } = skill;
    let level = game_state.skills[id];
    let at_max = level === values.length - 1;
    x = x0 + SKILL_PAD;
    font.draw({
      style: style_skills_label,
      x, y: y + yoffs, z,
      text: `${name} (${at_max ? 'MAX' : `L${level+1}`})`,
    });
    x += SKILLS_LABEL_W;
    if (last_level < level) {
      if (ui.buttonText({
        text: '-',
        w: ui.button_height,
        x, y, z,
        tooltip: 'Undo skill increase (available until next fishing)',
      })) {
        game_state.skills[id]--;
        game_state.xp += XP_COST[level - 1];
      }
    }
    x += ui.button_height;
    if (!at_max) {
      if (ui.buttonText({
        text: '+',
        x, y, z,
        w: ui.button_height,
        disabled_focusable: true,
        tooltip: `Increase ${name} for ${XP_COST[level]} XP`,
        disabled: game_state.xp < XP_COST[level],
      })) {
        game_state.skills[id]++;
        game_state.xp -= XP_COST[level];
      }
    }

    y += ui.button_height + 4;
  }

  y += yoffs;
  x = x0;
  drawStat('Experience', `${game_state.xp} XP`);
  drawStat('Score', `${game_state.score}`, sprites.coin);

  ui.panel({
    x: x0 - SKILL_PAD, y: y0 - SKILL_PAD, z: z-1,
    w: SKILLS_W + SKILL_PAD * 2,
    h: y - y0 + SKILL_PAD * 2,
    color: color_panel,
  });
}

function statePlay(dt) {
  game_state.update(dt);
  drawBG();
  drawFishingPole();

  if (game_state.state === STATE_CAST ||
    game_state.state === STATE_FISH
  ) {
    doTimeDisplay();
    // first check touch events
    let touch_values = [];
    if (inputTouchMode()) {
      let last_x = -camera2d.x0Real();
      for (let ii = 0; ii < NUM_METERS; ++ii) {
        let x = METERS_X0 + (METER_W + METER_PAD) * ii + METER_W + METER_PAD / 2;
        if (ii === NUM_METERS - 1) {
          x = camera2d.x1Real();
        }
        if (mouseDownOverBounds({
          x: last_x, w: x - last_x,
          y: -Infinity, h: Infinity,
        })) {
          touch_values[ii] = 1;
        }
        last_x = x;
      }
      eatAllInput();
    }

    for (let ii = 0; ii < METER_KEY_SETS.length; ++ii) {
      let keys = METER_KEY_SETS[ii];
      doMeter(dt, METERS_X0 + (METER_W + METER_PAD) * ii, METER_Y, game_state.meters[ii],
        keys[0], keys[1], keys[2], touch_values[ii]);
    }
    if (0) {
      drawProgress(PROGRESS_X, PROGRESS_Y, PROGRESS_W, PROGRESS_H);
    }
  } else if (game_state.state === STATE_PREP) {
    if (game_state.just_fished) {
      let lost = game_state.last_fish === -1 || !game_state.time_left;
      let y = METER_Y;
      font.draw({
        align: ALIGN.HCENTER,
        x: 0, w: game_width,
        y,
        style: lost ? style_lost_fish : style_caught_fish,
        text: game_state.time_left ? lost ? 'Too bad, the fish got away' : 'You caught a fish!' :
          'You ran out of time!',
      });
      y += METER_H * 0.35;
      if (!lost) {
        let def = FISH_DEFS[game_state.last_fish];
        let sp = sprites.fish[game_state.last_fish];
        sp.draw({
          x: game_width/2,
          y,
          w: FISH_SIZE * sp.uvs[2], h: FISH_SIZE * sp.uvs[3],
        });
        y += FISH_SIZE/2;
        let diff = DIFFICULTIES[game_state.difficulty];
        font.draw({
          style: style_caught_fish,
          align: ALIGN.HCENTER,
          x: 0, w: game_width, y,
          text: `${def.name}`,
        });
        y += ui.font_height + 16;
        let { last_res } = game_state;
        font.draw({
          style: style_caught_fish,
          align: ALIGN.HCENTER,
          x: 0, w: game_width, y,
          text: `${diff.label}:  +${last_res.xp} XP`,
        });
        y += ui.font_height + 4;
        let text_w = font.draw({
          style: style_caught_fish,
          align: ALIGN.HCENTER,
          x: 0, w: game_width, y,
          text: `${diff.label}:  +${last_res.score}       `,
        });
        let yoffs = (ui.button_height - ui.font_height) / 2;
        sprites.coin.draw({
          x: (game_width + text_w) / 2 - ui.button_height,
          y: y - yoffs,
        });
        y += ui.font_height + 4;
        if (last_res.discovered) {
          text_w = font.draw({
            style: style_caught_fish,
            align: ALIGN.HCENTER,
            x: 0, w: game_width, y,
            text: `New discovery!  +${last_res.discovered}       `,
          });
          sprites.coin.draw({
            x: (game_width + text_w) / 2 - ui.button_height,
            y: y - yoffs,
          });
          y += ui.font_height + 4;
        }
      }

      doSkillsMenu(dt);
    }

    if (game_state.time_left) {
      let cast_y = game_height * 0.6;
      if (!game_state.just_fished) {
        // First fish
        if (ui.buttonText({
          key: 'cast',
          x: (game_width - ui.button_width) / 2,
          y: cast_y,
          text: 'Cast!',
          auto_focus: true,
        })) {
          game_state.startCast(0);
        }
      } else if (game_state.t > 1000) {
        // give choices
        let mx = DIFFICULTIES.length;
        let x = (game_width - (ui.button_width * mx) - 16 * (mx - 1)) / 2;
        for (let ii = 0; ii < mx; ++ii) {
          if (ui.buttonText({
            key: `cast_${ii}`,
            x,
            y: cast_y,
            text: DIFFICULTIES[ii].label,
          })) {
            game_state.startCast(ii);
          }
          x += ui.button_width + 16;
        }
      }
    }

    if (engine.DEBUG) {
      let y = game_height * 0.94;
      let w = ui.button_width * 0.5;
      let x = 16;
      if (ui.buttonText({ x, y, w, text: 'Debug: +XP' })) {
        game_state.xp += 10000;
      }
      x += w + 4;
      if (ui.buttonText({ x, y, w, text: 'Debug: Catch' })) {
        game_state.difficulty = game_state.difficulty || 0;
        game_state.chooseTargetFish();
        game_state.finishFish(true);
      }
      x += w + 4;
      if (ui.buttonText({ x, y, w, text: 'Debug: BG' })) {
        game_state.difficulty = (game_state.difficulty + 1) % 3;
      }
      x += w + 4;
    }
  }
}

export function main() {
  if (engine.DEBUG) {
    // Enable auto-reload, etc
    net.init({ engine });
  }

  const font_info_palanquin32 = require('./img/font/palanquin32.json');
  let pixely = 'off';
  font = { info: font_info_palanquin32, texture: 'font/palanquin32' };

  if (!engine.startup({
    game_width,
    game_height,
    pixely,
    font,
    viewport_postprocess: false,
    antialias: false,
    ui_sprites: {
      color_set_shades: [0.8, 0.7, 0.4],
      button: { name: 'button', ws: [38, 256-38-97, 97], hs: [128] },
      button_rollover: null,
      button_down: null,
      button_disabled: null,
    },
    do_borders: false,
    line_mode: 0,
  })) {
    return;
  }
  font = engine.font;

  // ui.scaleSizes(13 / 32);
  // ui.setFontHeight(8);

  init();

  engine.setState(statePlay);

  if (engine.DEBUG) {
    game_state.difficulty = 0;
    game_state.chooseTargetFish();
    game_state.finishFish(true);
    // game_state.startPrep();
    game_state.startCast(game_state.difficulty);
  }
}
