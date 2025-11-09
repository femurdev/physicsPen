/*
script.js — lightweight 2D physics core with attach/detach behavior.

This file mirrors the runtime used by the inline demo. It provides:
 - Vec: small 2D vector helpers
 - PhysicsObject: base class with attach/detach support
 - Anchor, Ball: simple object types with named attach points
 - RodSpring: simple spring connecting two objects
 - step: single-step simulation helper

Usage:
 import { Vec, PhysicsObject, Anchor, Ball, RodSpring, step } from './script.js';
*/

class Vec {
  static add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  static sub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
  static scale(a, s) { return [a[0] * s, a[1] * s]; }
  static len(a) { return Math.hypot(a[0], a[1]); }
  static zero() { return [0, 0]; }
}

class PhysicsObject {
  constructor({ position = [0, 0], velocity = [0, 0], mass = 1, color = [200, 200, 200], fixed = false } = {}) {
    this.position = position.slice();
    this.velocity = velocity.slice();
    this.mass = mass;
    this.color = color;
    this.fixed = fixed;

    // attachment state
    this._attached_to = null;
    this._attached_part = null;
    this._attached_offset = null;
    this._previous_fixed_state = null;
  }

  applyForce(force, dt) {
    // If fixed or attached, ignore external forces
    if (this.fixed || this._attached_to) return;
    if (this.mass <= 0) return;
    const ax = force[0] / this.mass, ay = force[1] / this.mass;
    this.velocity[0] += ax * dt;
    this.velocity[1] += ay * dt;
  }

  integrate(dt) {
    if (this._attached_to) {
      const target = this._attached_to;
      const part = this._attached_part || 'center';
      const attachPoint = target.getAttachPoint(part);
      if (!attachPoint) return;
      if (this._attached_offset == null) {
        this.position = attachPoint.slice();
      } else {
        this.position = Vec.add(attachPoint, this._attached_offset);
      }
      // inherit velocity for kinematic coupling
      this.velocity = target.velocity.slice();
      return;
    }
    if (this.fixed) return;
    this.position[0] += this.velocity[0] * dt;
    this.position[1] += this.velocity[1] * dt;
  }

  getAttachPoint(part) {
    if (part === 'center') return this.position;
    throw new Error(`${this.constructor.name} has no attach point '${part}'`);
  }

  attachTo(target, targetPart = 'center') {
    if (!target) throw new Error('target required');
    const attachPoint = target.getAttachPoint(targetPart);
    // store prior fixed state
    this._previous_fixed_state = this.fixed;
    const offset = Vec.sub(this.position, attachPoint);
    this._attached_to = target;
    this._attached_part = targetPart;
    this._attached_offset = offset;
    // treat as non-dynamic while attached
    this.fixed = true;
  }

  // snake_case alias
  attach_to(target, targetPart = 'center') { return this.attachTo(target, targetPart); }

  detach() {
    if (!this._attached_to) return;
    const old = this._attached_to;
    // inherit target's velocity for smooth transition
    this.velocity = old.velocity.slice();
    this._attached_to = null;
    this._attached_part = null;
    this._attached_offset = null;
    if (this._previous_fixed_state !== null) {
      this.fixed = this._previous_fixed_state;
      this._previous_fixed_state = null;
    } else {
      this.fixed = false;
    }
  }

  // camelCase alias
  detachFrom() { return this.detach(); }

  isAttached() { return this._attached_to != null; }
}

class Anchor extends PhysicsObject {
  constructor(position = [0, 0]) {
    super({ position, velocity: [0, 0], mass: Infinity, fixed: true, color: [255, 80, 80] });
  }
  getAttachPoint(part) {
    if (part === 'anchor' || part === 'center') return this.position;
    throw new Error('Anchor missing part ' + part);
  }
}

class Ball extends PhysicsObject {
  constructor({ position = [0, 0], radius = 12, mass = 1, color = [160, 200, 255] } = {}) {
    super({ position, velocity: [0, 0], mass, color });
    this.radius = radius;
  }
  getAttachPoint(part) {
    if (part === 'center') return this.position;
    throw new Error('Ball missing part ' + part);
  }
}

class RodSpring {
  constructor(a, b, { rest_length = null, stiffness = 120, damping = 0.0 } = {}) {
    this.a = a; this.b = b;
    this.rest_length = rest_length != null ? rest_length : Vec.len(Vec.sub(b.position, a.position));
    this.stiffness = stiffness;
    this.damping = damping;
  }
  apply(dt) {
    const delta = Vec.sub(this.b.position, this.a.position);
    const dist = Vec.len(delta);
    if (dist === 0) return;
    const dir = [ delta[0] / dist, delta[1] / dist ];
    const stretch = dist - this.rest_length;
    const forceMag = -this.stiffness * stretch;
    const relVel = Vec.sub(this.b.velocity, this.a.velocity);
    const dampingForce = -this.damping * (relVel[0] * dir[0] + relVel[1] * dir[1]);
    const total = forceMag + dampingForce;
    const force = Vec.scale(dir, total);
    this.a.applyForce(Vec.scale(force, -1), dt);
    this.b.applyForce(force, dt);
  }
}

function step(objects, constraints, dt) {
  for (let c of constraints) c.apply(dt);
  for (let o of objects) o.integrate(dt);
}

// Named exports for module usage
export {
  Vec, PhysicsObject, Anchor, Ball, RodSpring, step
};
