"""
physicsEngine.py

Richer physics object behavior with attach/detach functionality.

Key additions:
- PhysicsObject.attach_to(target, target_part)
  - Attaches this object to a named attach point on another object.
  - For supported objects:
    - Ball: "center"
    - Anchor: "anchor"
  - The attachment keeps a fixed offset (in world coordinates) between
    the two objects. While attached, the object is moved to follow the
    target and will not be affected by forces or integration.
- PhysicsObject.detach()
  - Releases the attachment and allows the object to behave normally.
  - The object's velocity is set to the target's velocity at the moment
    of detachment (so it continues moving consistently).
- Aliases `attachTo` and `detachFrom` are provided to match requested naming.

This file is a standalone, reasonably small physics core suitable as a basis
for further expansion (collision, rotations, joints, etc).
"""

import math
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

# Configuration / defaults (units: seconds, meters, kg)
DIMENSIONS = 2
DEFAULT_DT = 1e-6
DEFAULT_ELASTICITY = 0.0  # placeholder, unitless

Vector2 = Tuple[float, float]


# ---- Basic 2D vector helpers ----
def v_add(a: Vector2, b: Vector2) -> Vector2:
    return (a[0] + b[0], a[1] + b[1])


def v_sub(a: Vector2, b: Vector2) -> Vector2:
    return (a[0] - b[0], a[1] - b[1])


def v_scale(a: Vector2, s: float) -> Vector2:
    return (a[0] * s, a[1] * s)


def v_len(a: Vector2) -> float:
    return math.hypot(a[0], a[1])


def v_zero() -> Vector2:
    return (0.0, 0.0)


# ---- Physics primitives ----
@dataclass
class PhysicsObject:
    """
    Base physics object.

    - position: world-space center/representative point
    - velocity: linear velocity of that representative point
    - mass: mass in kg (<=0 treated as immovable)
    - fixed: if True, the object does not integrate/move due to forces
    - color: display hint (R,G,B)
    - attachment fields: used when this object is attached to another
    """

    position: Vector2 = field(default_factory=v_zero)
    velocity: Vector2 = field(default_factory=v_zero)
    mass: float = 1.0
    color: Tuple[int, int, int] = (0, 0, 0)
    fixed: bool = False

    # Attachment state (private-ish)
    _attached_to: Optional["PhysicsObject"] = field(
        default=None, init=False, repr=False
    )
    _attached_part: Optional[str] = field(default=None, init=False, repr=False)
    _attached_offset: Optional[Vector2] = field(default=None, init=False, repr=False)
    _previous_fixed_state: Optional[bool] = field(default=None, init=False, repr=False)

    def apply_force(self, force: Vector2, dt: float) -> None:
        """
        Apply an instantaneous force over timestep dt (i.e., F * dt impulse).
        If the object is fixed or attached, forces are ignored.
        """
        if self.fixed or self._attached_to is not None:
            return
        if self.mass <= 0:
            return
        ax, ay = force[0] / self.mass, force[1] / self.mass
        self.velocity = (self.velocity[0] + ax * dt, self.velocity[1] + ay * dt)

    def integrate(self, dt: float) -> None:
        """
        Advance position using simple explicit Euler integration.
        If attached, the object will follow the attachment target instead.
        """
        if self._attached_to is not None:
            # Follow the attached target's attach point + offset
            target = self._attached_to
            part = self._attached_part or "center"
            attach_point = target.get_attach_point(part)
            # _attached_offset is in world coordinates at time of attachment.
            if self._attached_offset is None:
                # Defensive: fall back to matching attach point exactly.
                self.position = attach_point
            else:
                self.position = v_add(attach_point, self._attached_offset)
            # Velcoity follow the target's velocity (so relative offset is maintained)
            self.velocity = target.velocity
            return

        if self.fixed:
            return

        self.position = (
            self.position[0] + self.velocity[0] * dt,
            self.position[1] + self.velocity[1] * dt,
        )

    # --- Attachment API ---
    def get_attach_point(self, part: str) -> Vector2:
        """
        Return the world-space position corresponding to the named attach point
        on this object. Subclasses should override to provide named attach points.

        Default: only "center" is available and maps to `position`.
        """
        if part == "center":
            return self.position
        raise ValueError(
            f"{self.__class__.__name__} has no attach point named '{part}'"
        )

    def attach_to(self, target: "PhysicsObject", target_part: str = "center") -> None:
        """
        Attach this object to `target` at the named attach point.

        Behavior:
        - The relative offset (in world coordinates) between this object's
          representative position and the target attach point is recorded.
        - While attached, this object will follow the target's attach point +
          recorded offset. Forces and integration are suspended for the
          attached object.
        - Detaching restores prior fixed state (if any).
        """
        if target is None:
            raise ValueError("target must be a PhysicsObject")

        # Validate that the target has the requested attach point
        attach_point = target.get_attach_point(target_part)

        # Save previous fixed state so detach can restore it
        self._previous_fixed_state = self.fixed

        # Compute world-space offset from attach point to this object's position
        offset = v_sub(self.position, attach_point)

        # Set attachment state
        self._attached_to = target
        self._attached_part = target_part
        self._attached_offset = offset

        # While attached, treat object as non-dynamic (ignore applied forces)
        # but don't forcibly mark as `fixed` because some code may rely on fixed.
        # We still preserve previous fixed flag and honor it on detach.
        # Setting fixed to True prevents external integration attempts; keep that.
        self.fixed = True

    # Provide camelCase alias to match request
    attachTo = attach_to

    def detach(self) -> None:
        """
        Detach this object from any target.

        After detachment:
        - The object's velocity is set to the target's velocity (if there was
          a target), so it continues smoothly in world space.
        - The object's previous `fixed` state is restored.
        """
        if self._attached_to is None:
            return

        old_target = self._attached_to
        # Inherit target's velocity for consistent motion after detaching
        self.velocity = old_target.velocity

        # Clear attachment state
        self._attached_to = None
        self._attached_part = None
        self._attached_offset = None

        # Restore previous fixed state if known
        if self._previous_fixed_state is not None:
            self.fixed = self._previous_fixed_state
            self._previous_fixed_state = None
        else:
            # If we didn't store anything, default to not fixed
            self.fixed = False

    # Alias
    detachFrom = detach

    # Utility helpers
    @property
    def is_attached(self) -> bool:
        return self._attached_to is not None


@dataclass
class Anchor(PhysicsObject):
    """
    An anchor is an immovable point in space. It offers the attach point
    name "anchor" (and for convenience "center" too).
    """

    def __init__(self, position: Vector2):
        super().__init__(
            position=position,
            velocity=v_zero(),
            mass=float("inf"),
            fixed=True,
            color=(255, 0, 0),
        )

    def get_attach_point(self, part: str) -> Vector2:
        if part in ("anchor", "center"):
            return self.position
        raise ValueError(f"Anchor has no attach point named '{part}'")


@dataclass
class Ball(PhysicsObject):
    """
    Simple spherical object (represented by a center point). Valid attach
    point names: "center".
    """

    radius: float = 0.1

    def get_attach_point(self, part: str) -> Vector2:
        if part == "center":
            return self.position
        raise ValueError(f"Ball has no attach point named '{part}'")


@dataclass
class Box(PhysicsObject):
    """
    Axis-aligned box represented by center position, width and height.
    Provides attach points like "center" and optionally "top_left", "top_right", ...
    """

    width: float = 1.0
    height: float = 1.0

    def get_attach_point(self, part: str) -> Vector2:
        # Provide center and corners
        cx, cy = self.position
        hw, hh = self.width / 2.0, self.height / 2.0
        parts = {
            "center": (cx, cy),
            "top_left": (cx - hw, cy - hh),
            "top_right": (cx + hw, cy - hh),
            "bottom_left": (cx - hw, cy + hh),
            "bottom_right": (cx + hw, cy + hh),
        }
        if part in parts:
            return parts[part]
        raise ValueError(f"Box has no attach point named '{part}'")


@dataclass
class RodSpring:
    """
    Simple spring/rod that connects two PhysicsObjects.

    Applies internal forces to the connected objects so they tend toward the
    rest length. If one or both objects are attached/fixed, they won't move,
    but force application is still safe (it will be ignored by fixed/attached objects).
    """

    a: PhysicsObject
    b: PhysicsObject
    rest_length: Optional[float] = None
    stiffness: float = 100.0  # N/m
    damping: float = 0.0  # relative velocity damping along spring axis

    def __post_init__(self):
        if self.rest_length is None:
            self.rest_length = v_len(v_sub(self.b.position, self.a.position))

    def apply(self, dt: float) -> None:
        # Compute vector from a to b
        delta = v_sub(self.b.position, self.a.position)
        dist = v_len(delta)
        if dist == 0:
            return
        dir_vec = (delta[0] / dist, delta[1] / dist)
        stretch = dist - self.rest_length
        # Hooke's law (force magnitude on b along direction from a->b)
        force_mag = -self.stiffness * stretch
        # Damping based on relative velocity projected onto axis
        rel_vel = v_sub(self.b.velocity, self.a.velocity)
        damping_force = -self.damping * (
            rel_vel[0] * dir_vec[0] + rel_vel[1] * dir_vec[1]
        )
        total_force = force_mag + damping_force
        force = v_scale(dir_vec, total_force)
        # Apply equal and opposite forces (a gets -force, b gets +force)
        self.a.apply_force(v_scale(force, -1.0), dt)
        self.b.apply_force(force, dt)


# Simple simulation step
def step(
    objects: List[PhysicsObject], constraints: List[RodSpring], dt: float = DEFAULT_DT
) -> None:
    """
    Advance simulation by dt:
    1. Apply constraint forces (springs/rods)
    2. Integrate objects (objects that are attached will follow their target)
    """
    # Apply constraint forces
    for c in constraints:
        c.apply(dt)

    # Integrate objects (attached objects will be moved by their attach logic)
    for obj in objects:
        obj.integrate(dt)


# ---- Example usage (not executed on import) ----
if __name__ == "__main__":
    # Create an anchor and a ball, attach the ball to the anchor
    anchor = Anchor(position=(0.0, 0.0))
    ball = Ball(position=(1.0, 0.0), mass=1.0, radius=0.2)
    print("Before attach:", ball.position, "attached?", ball.is_attached)

    # Attach ball to anchor at anchor's attach point named "anchor"
    ball.attachTo(anchor, "anchor")
    print("After attach:", ball.position, "attached?", ball.is_attached)

    # Simulate a step; ball should follow anchor (which is fixed)
    objs = [anchor, ball]
    springs = []
    step(objs, springs, dt=1e-3)
    print("After step:", ball.position, "velocity:", ball.velocity)

    # Detach and give anchor a velocity via ball (for demonstration)
    anchor.velocity = (
        0.5,
        0.0,
    )  # anchors are fixed by default; this is just to show velocity transfer
    ball.detachFrom()
    print("After detach:", ball.position, "velocity:", ball.velocity)
