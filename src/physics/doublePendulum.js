/*
doublePen/src/physics/doublePendulum.js

Physics module for a planar double pendulum (no external physics engine).
Exports:
 - function derivatives(state, params) -> [dθ1, dω1, dθ2, dω2]
 - function rk4Step(state, params, dt) -> newState
 - class DoublePendulum: convenience wrapper around state + params with step(), getPositions(), etc.

State vector convention:
 - state = [theta1, omega1, theta2, omega2]
 - Angles (theta1, theta2) are measured from the vertical (downwards), so:
     x = cx + l * sin(theta)
     y = cy + l * cos(theta)
   This matches the rendering code in src/main.js.

Params:
 - m1, m2 : masses
 - l1, l2 : lengths (in rendering code lengths are in pixels)
 - g      : gravity (m/s^2)
 - drag   : linear damping coefficient applied as torque proportional to angular velocity

Notes:
 - The equations below are the standard Lagrangian-derived accelerations for the double pendulum.
 - A small epsilon is added to denominators for numerical stability.
 - RK4 integrator is provided; for long-term energy behavior symplectic integrators are preferable,
   but RK4 gives good accuracy per-step for many demos.
*/

const DEFAULT_PARAMS = {
  m1: 1.0,
  m2: 1.0,
  l1: 150.0,
  l2: 150.0,
  g: 9.81,
  drag: 0.0
};

/**
 * Compute time derivatives for the double pendulum.
 * @param {Array<number>} state - [theta1, omega1, theta2, omega2]
 * @param {Object} params - {m1,m2,l1,l2,g,drag}
 * @returns {Array<number>} derivatives [dtheta1, domega1, dtheta2, domega2]
 */
export function derivatives(state, params = {}) {
  const p = Object.assign({}, DEFAULT_PARAMS, params);
  const m1 = +p.m1;
  const m2 = +p.m2;
  const l1 = +p.l1;
  const l2 = +p.l2;
  const g = +p.g;
  const drag = +p.drag;

  let theta1 = state[0];
  let omega1 = state[1];
  let theta2 = state[2];
  let omega2 = state[3];

  // Useful shorthands
  const d = theta1 - theta2;
  const sin_d = Math.sin(d);
  const cos_d = Math.cos(d);

  // Denominator common term (avoid exact zero)
  const denom = 2 * m1 + m2 - m2 * Math.cos(2 * d);
  const EPS = 1e-12;
  const safeDenom = denom === 0 ? EPS : denom;

  // Following equations assume angles measured from vertical (downwards)
  // as used in many standard references.
  const num1 = -g * (2 * m1 + m2) * Math.sin(theta1)
             - m2 * g * Math.sin(theta1 - 2 * theta2)
             - 2 * sin_d * m2 * (omega2 * omega2 * l2 + omega1 * omega1 * l1 * cos_d);

  const alpha1 = num1 / (l1 * safeDenom);

  const num2 = 2 * sin_d * (omega1 * omega1 * l1 * (m1 + m2)
              + g * (m1 + m2) * Math.cos(theta1)
              + omega2 * omega2 * l2 * m2 * cos_d);

  const alpha2 = num2 / (l2 * safeDenom);

  // Apply simple linear damping on angular velocities (drag)
  const alpha1_damped = alpha1 - drag * omega1;
  const alpha2_damped = alpha2 - drag * omega2;

  return [omega1, alpha1_damped, omega2, alpha2_damped];
}

/**
 * Classic RK4 integrator for one step.
 * @param {Array<number>} state - current state [theta1, omega1, theta2, omega2]
 * @param {Object} params - physics parameters
 * @param {number} dt - timestep (seconds)
 * @returns {Array<number>} new state after dt
 */
export function rk4Step(state, params = {}, dt = 0.0041667) {
  // k1 = f(y)
  const k1 = derivatives(state, params);

  // k2 = f(y + dt/2 * k1)
  const s2 = [
    state[0] + 0.5 * dt * k1[0],
    state[1] + 0.5 * dt * k1[1],
    state[2] + 0.5 * dt * k1[2],
    state[3] + 0.5 * dt * k1[3]
  ];
  const k2 = derivatives(s2, params);

  // k3 = f(y + dt/2 * k2)
  const s3 = [
    state[0] + 0.5 * dt * k2[0],
    state[1] + 0.5 * dt * k2[1],
    state[2] + 0.5 * dt * k2[2],
    state[3] + 0.5 * dt * k2[3]
  ];
  const k3 = derivatives(s3, params);

  // k4 = f(y + dt * k3)
  const s4 = [
    state[0] + dt * k3[0],
    state[1] + dt * k3[1],
    state[2] + dt * k3[2],
    state[3] + dt * k3[3]
  ];
  const k4 = derivatives(s4, params);

  // Combine
  const newState = [
    state[0] + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
    state[1] + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
    state[2] + (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
    state[3] + (dt / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3])
  ];

  return newState;
}

/**
 * Convenience wrapper class for simulation state + parameters.
 * Provides:
 *  - step(dt) -> advances state using RK4
 *  - getPositions() -> { x1,y1,x2,y2 } relative to origin (0,0)
 *  - reset(params) -> replace params and reset state to defaults
 *  - updateParams(params) -> merge new params
 *  - setState(objectOrArray) -> set state explicitly
 */
export class DoublePendulum {
  /**
   * @param {Object} params - initial parameters (m1,m2,l1,l2,g,drag)
   * @param {Array|Object} initialState - optional initial state
   */
  constructor(params = {}, initialState = null) {
    this.params = Object.assign({}, DEFAULT_PARAMS, params);

    // state = [theta1, omega1, theta2, omega2]
    if (Array.isArray(initialState) && initialState.length === 4) {
      this.state = initialState.slice();
    } else if (initialState && typeof initialState === 'object') {
      const t1 = Number.isFinite(initialState.theta1) ? initialState.theta1 : Math.PI / 2 - 0.2;
      const t2 = Number.isFinite(initialState.theta2) ? initialState.theta2 : Math.PI / 2 + 0.1;
      const w1 = Number.isFinite(initialState.omega1) ? initialState.omega1 : 0;
      const w2 = Number.isFinite(initialState.omega2) ? initialState.omega2 : 0;
      this.state = [t1, w1, t2, w2];
    } else {
      // sensible default: both pendulums near vertical with small offset
      this.state = [Math.PI / 2 - 0.2, 0, Math.PI / 2 + 0.1, 0];
    }

    // Expose some params as quick properties for rendering convenience
    this._syncQuickProps();
  }

  _syncQuickProps() {
    this.m1 = this.params.m1;
    this.m2 = this.params.m2;
    this.l1 = this.params.l1;
    this.l2 = this.params.l2;
    this.g = this.params.g;
    this.drag = this.params.drag;
  }

  /**
   * Advance simulation by dt seconds using RK4.
   * This mutates internal state.
   * @param {number} dt seconds
   */
  step(dt = 0.0041667) {
    this.state = rk4Step(this.state, this.params, dt);
    return this.state;
  }

  /**
   * Return positions for rendering.
   * Coordinates are relative to pivot at (0,0):
   *   x1 = l1 * sin(theta1)
   *   y1 = l1 * cos(theta1)
   *   x2 = x1 + l2 * sin(theta2)
   *   y2 = y1 + l2 * cos(theta2)
   */
  getPositions() {
    const theta1 = this.state[0];
    const theta2 = this.state[2];
    const l1 = this.params.l1;
    const l2 = this.params.l2;

    const x1 = l1 * Math.sin(theta1);
    const y1 = l1 * Math.cos(theta1);
    const x2 = x1 + l2 * Math.sin(theta2);
    const y2 = y1 + l2 * Math.cos(theta2);

    return { x1, y1, x2, y2 };
  }

  /**
   * Replace parameters (merge) and sync quick props.
   * @param {Object} params
   */
  updateParams(params = {}) {
    Object.assign(this.params, params);
    this._syncQuickProps();
  }

  /**
   * Reset simulator to new params and initial state (optional).
   * @param {Object} params
   * @param {Array|Object} initialState
   */
  reset(params = {}, initialState = null) {
    this.params = Object.assign({}, DEFAULT_PARAMS, params);
    if (Array.isArray(initialState) && initialState.length === 4) {
      this.state = initialState.slice();
    } else {
      // if initialState omitted, use small-angle default
      this.state = [Math.PI / 2 - 0.2, 0, Math.PI / 2 + 0.1, 0];
    }
    this._syncQuickProps();
  }

  /**
   * Set state. Accepts either array [t1,w1,t2,w2] or object {theta1,...}
   * @param {Array|Object} s
   */
  setState(s) {
    if (Array.isArray(s) && s.length === 4) {
      this.state = s.slice();
    } else if (s && typeof s === 'object') {
      const t1 = Number.isFinite(s.theta1) ? s.theta1 : this.state[0];
      const w1 = Number.isFinite(s.omega1) ? s.omega1 : this.state[1];
      const t2 = Number.isFinite(s.theta2) ? s.theta2 : this.state[2];
      const w2 = Number.isFinite(s.omega2) ? s.omega2 : this.state[3];
      this.state = [t1, w1, t2, w2];
    } else {
      throw new TypeError('setState requires an array [t1,w1,t2,w2] or an object {theta1,omega1,theta2,omega2}');
    }
  }

  /**
   * Compute total mechanical energy (useful for diagnostics).
   * Returns object { KE, PE, E } in whichever units lengths are provided.
   */
  energy() {
    const m1 = this.params.m1;
    const m2 = this.params.m2;
    const l1 = this.params.l1;
    const l2 = this.params.l2;
    const g = this.params.g;

    const t1 = this.state[0];
    const w1 = this.state[1];
    const t2 = this.state[2];
    const w2 = this.state[3];

    // Positions (relative to pivot at y=0)
    const y1 = l1 * Math.cos(t1);
    const y2 = y1 + l2 * Math.cos(t2);

    // Velocities: derive from angular velocities
    // v1^2 = (l1*w1)^2
    const v1sq = (l1 * w1) * (l1 * w1);
    // v2 vector: velocity of mass2 = v1 + contribution of second link
    // Using planar kinematics:
    const vx1 = l1 * w1 * Math.cos(t1);
    const vy1 = -l1 * w1 * Math.sin(t1);
    const vx2 = vx1 + l2 * w2 * Math.cos(t2);
    const vy2 = vy1 - l2 * w2 * Math.sin(t2);
    const v2sq = vx2 * vx2 + vy2 * vy2;

    const KE = 0.5 * m1 * v1sq + 0.5 * m2 * v2sq;
    // Potential energy: take pivot y=0 as reference (negative downwards),
    // because cos(theta) with theta=0 -> y = +l (down)
    const PE = m1 * g * y1 + m2 * g * y2;

    return { KE, PE, E: KE + PE };
  }
}

export default {
  derivatives,
  rk4Step,
  DoublePendulum
};
