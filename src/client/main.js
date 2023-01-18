/*eslint global-require:off*/
// eslint-disable-next-line import/order
const local_storage = require('glov/client/local_storage.js');
local_storage.setStoragePrefix('fishy'); // Before requiring anything else that might load from this

import * as camera2d from 'glov/client/camera2d.js';
import * as engine from 'glov/client/engine.js';
import { ALIGN, fontStyle } from 'glov/client/font';
import {
  KEYS,
  PAD,
  keyDown,
  mouseDownAnywhere,
  padButtonDown,
} from 'glov/client/input.js';
import * as net from 'glov/client/net.js';
import { spotFocusSteal } from 'glov/client/spot.js';
import { spriteSetGet } from 'glov/client/sprite_sets.js';
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
  vec2,
  vec4,
  zero_vec,
} from 'glov/common/vmath';


// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { PI, cos, floor, min, max, sin } = Math;

window.Z = window.Z || {};
Z.BACKGROUND = 1;
Z.SPRITES = 10;

// Virtual viewport for our game logic
const game_width = 1280;
const game_height = 720;

const METER_H = game_height * 0.5;
const METER_Y = floor(game_height * 0.1333);
const METER_W = 64;
const METER0_X = game_width * 0.4 - METER_W/2;
const METER1_X = game_width * 0.6 - METER_W/2;
const PROGRESS_W = game_width * 0.5;
const PROGRESS_H = 64;
const PROGRESS_X = (game_width - PROGRESS_W) / 2;
const PROGRESS_Y = (METER_Y - PROGRESS_H) / 2;
const FISHING_POLE_X = game_width * 0.85;
const FISHING_POLE_Y = game_height * 0.6;
const FISHING_POLE_SIZE = 256;
const FISHING_POLE_LENGTH = FISHING_POLE_SIZE * 90/128;
const BOBBER_X = game_width * 0.1;
const BOBBER_Y = game_height * 0.72;
const BOBBER_SIZE = 64;
const FISH_SIZE = 128;

const cursor_color = vec4(0.8, 0.8, 0.8, 1);
const cursor_color_active = vec4(1, 1, 1, 1);
const cursor_color_on_target = vec4(0.3, 0.8, 0.3, 1);
const cursor_color_on_target_active = vec4(0.5, 1.0, 0.5, 1);
const color_fishing_line = vec4(0, 0, 0, 1);

const style_caught_fish = fontStyle(null, {
  color: 0x008000ff,
  border_color: 0x000000ff,
  border_width: 2.5,
});

const style_lost_fish = fontStyle(style_caught_fish, {
  color: 0x800000ff,
});

const FISH_DEFS = [{
  tex: 'bluegreen_fish',
}, {
  tex: 'crab',
}, {
  tex: 'jellyfish',
}, {
  tex: 'octopus',
}, {
  tex: 'redpink_fish',
}, {
  tex: 'sick_fish',
}];


let font;
let sprites;

const EPSILON = 0.001;

class MeterState {
  constructor(game_state) {
    this.game_state = game_state;
    this.cursor_size = 0.3;
    this.cursor_accel = 0.000001;
    this.cursor_gravity = -this.cursor_accel;
    this.cursor_bounce_top = -0.5;
    this.cursor_bounce_bottom = -0.25;
    this.target_bounce_top = -1;
    this.target_bounce_bottom = -1;
    this.reset();
  }
  reset() {
    let { rand } = this.game_state;
    this.cursor_pos = 0;
    this.cursor_vel = 0;
    this.target_pos = rand.random();
    this.target_vel = 0;
    this.target_accel = 0.0000001;
    this.target_max_vel = 0.0001;
    this.choice_period = 2000 + rand.range(4000);
    this.chooseDest();
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
    this.cursor_vel += down * this.cursor_gravity;
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
  }
}

const STATE_PREP = 1;
const STATE_CAST = 2;
const CAST_TIME = 1000;
const STATE_FISH = 3;

class GameState {
  constructor() {
    this.rand = randCreate(mashString('test1'));
    this.meters = [new MeterState(this), new MeterState(this)];
    this.t = 0;
    this.progress_gain_speed = 0.00005;
    this.progress_lose_speed = -this.progress_gain_speed * 0.75;
    this.just_fished = false;
    this.startPrep();
  }

  startPrep() {
    this.state = STATE_PREP;
    this.progress = 0.5;
    this.target_fish = this.rand.range(FISH_DEFS.length);
    spotFocusSteal({ key: 'cast' });
  }

  startCast() {
    this.state = STATE_CAST;
    this.t = 0;
    for (let ii = 0; ii < this.meters.length; ++ii) {
      this.meters[ii].reset();
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
      let eff_dt = dt;
      if (this.state === STATE_CAST) {
        eff_dt *= this.t / CAST_TIME;
      }
      for (let ii = 0; ii < this.meters.length; ++ii) {
        let meter = this.meters[ii];
        if (meter.on_target) {
          this.progress += eff_dt * this.progress_gain_speed;
        } else {
          this.progress += eff_dt * this.progress_lose_speed;
        }
      }
      this.progress = clamp(this.progress, 0, 1);
      if (this.progress === 0 || this.progress === 1) {
        this.just_fished = true;
        this.last_fish = this.progress ? this.target_fish : -1;
        this.startPrep();
      }
    }
  }
}

let game_state;

function init() {
  game_state = new GameState();
  sprites = {
    meter_cursor: createSprite({
      name: 'meter_cursor',
      ws: [128],
      hs: [60, 8, 60],
    }),
    meter_bg: createSprite({
      name: 'meter_bg',
      ws: [128],
      hs: [60, 8, 60],
    }),
    meter_target: createSprite({
      name: 'meter_target',
      origin: [0, 0.5],
    }),
    fishing_pole: createSprite({
      name: 'fishing_pole',
      origin: [64/128, 104/128],
    }),
    bobber: createSprite({
      name: 'bobber',
      origin: [0.5, 0.5],
    }),
    bg1: createSprite({
      name: 'bg1',
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

function doMeter(dt, x, y, meter, keys, pads, mouse_button) {
  let z = Z.UI;
  let up = 0;
  for (let ii = 0; ii < keys.length; ++ii) {
    up += keyDown(keys[ii]);
  }
  for (let ii = 0; ii < pads.length; ++ii) {
    up += padButtonDown(pads[ii]);
  }
  up += mouseDownAnywhere(mouse_button) ? dt : 0;
  meter.update(dt, up);
  let active = Boolean(up);
  drawVBox({
    x, y, z, w: METER_W, h: METER_H,
  }, sprites.meter_bg);
  drawVBox({
    x,
    y: y + METER_H - (meter.cursor_pos + meter.cursor_size) * METER_H,
    z: z + 1,
    w: METER_W,
    h: METER_H * meter.cursor_size,
  }, sprites.meter_cursor,
    meter.on_target ? active ? cursor_color_on_target_active : cursor_color_on_target :
    active ? cursor_color_active : cursor_color);

  sprites.meter_target.draw({
    x,
    y: y + METER_H - meter.target_pos * METER_H,
    z: z + 2,
    w: METER_W, h: METER_W,
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
  sprites.bg1.draw({
    x: camera2d.x0Real(),
    y: camera2d.y0Real(),
    w, h,
    z: Z.BACKGROUND,
    uvs: [-uextra, -vextra, 1+uextra, 1+vextra],
  });

  font.draw({
    x: 0, y: game_height - ui.font_height * 1.5,
    w: game_width,
    align: ALIGN.HCENTER,
    text: 'Controls: A/D or ←/→ or LB/RB or X/B',
  });
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
    x: FISHING_POLE_X, y: FISHING_POLE_Y,
    z,
    w: FISHING_POLE_SIZE, h: FISHING_POLE_SIZE,
    rot: angle,
  });

  if (game_state.state === STATE_FISH) {
    let pole_tip_x = FISHING_POLE_X + cos(angle - PI/2) * FISHING_POLE_LENGTH;
    let pole_tip_y = FISHING_POLE_Y + sin(angle - PI/2) * FISHING_POLE_LENGTH;
    let points = [
      [pole_tip_x, pole_tip_y],
      [METER1_X + METER_W/2, METER_Y + METER_H * (1 - game_state.meters[1].getCursorMidpoint())],
      [METER0_X + METER_W/2, METER_Y + METER_H * (1 - game_state.meters[0].getCursorMidpoint())],
      [BOBBER_X, BOBBER_Y],
    ];
    drawCurve(points, z-1, color_fishing_line);
    sprites.bobber.draw({
      x: BOBBER_X, y: BOBBER_Y, z,
      w: BOBBER_SIZE, h: BOBBER_SIZE,
    });
  }
}

function statePlay(dt) {
  game_state.update(dt);
  drawBG();
  drawFishingPole();

  if (game_state.state === STATE_CAST ||
    game_state.state === STATE_FISH
  ) {
    doMeter(dt, METER0_X, METER_Y, game_state.meters[0],
      [KEYS.A, KEYS.LEFT], [PAD.LEFT_BUMPER, PAD.LEFT_TRIGGER, PAD.LEFT, PAD.X], 0);
    doMeter(dt, METER1_X, METER_Y, game_state.meters[1],
      [KEYS.D, KEYS.RIGHT], [PAD.RIGHT_BUMPER, PAD.RIGHT_TRIGGER, PAD.RIGHT, PAD.B], 2);
    drawProgress(PROGRESS_X, PROGRESS_Y, PROGRESS_W, PROGRESS_H);
  } else if (game_state.state === STATE_PREP) {
    if (game_state.just_fished) {
      let lost = game_state.last_fish === -1;
      font.draw({
        align: ALIGN.HCENTER,
        x: 0, w: game_width,
        y: METER_Y,
        style: lost ? style_lost_fish : style_caught_fish,
        text: lost ? 'Too bad, the fish got away' : 'You caught a fish!',
      });
      if (!lost) {
        let sp = sprites.fish[game_state.last_fish];
        sp.draw({
          x: game_width/2,
          y: METER_Y + METER_H*0.35,
          w: FISH_SIZE * sp.uvs[2], h: FISH_SIZE * sp.uvs[3],
        });
      }
    }

    if (ui.buttonText({
      key: 'cast',
      x: (game_width - ui.button_width) / 2,
      y: (game_height - ui.button_height) / 2,
      text: game_state.just_fished ? 'Cast again!' : 'Cast!',
    })) {
      game_state.startCast();
    }
  }
}

export function main() {
  if (engine.DEBUG) {
    // Enable auto-reload, etc
    net.init({ engine });
  }

  const font_info_04b03x2 = require('./img/font/04b03_8x2.json');
  const font_info_04b03x1 = require('./img/font/04b03_8x1.json');
  const font_info_palanquin32 = require('./img/font/palanquin32.json');
  let pixely = 'off';
  let ui_sprites;
  if (pixely === 'strict') {
    font = { info: font_info_04b03x1, texture: 'font/04b03_8x1' };
    ui_sprites = spriteSetGet('pixely');
  } else if (pixely && pixely !== 'off') {
    font = { info: font_info_04b03x2, texture: 'font/04b03_8x2' };
    ui_sprites = spriteSetGet('pixely');
  } else {
    font = { info: font_info_palanquin32, texture: 'font/palanquin32' };
  }

  if (!engine.startup({
    game_width,
    game_height,
    pixely,
    font,
    viewport_postprocess: false,
    antialias: false,
    ui_sprites,
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
    // game_state.just_fished = true;
    // game_state.last_fish = 0;
    game_state.startCast();
  }
}
