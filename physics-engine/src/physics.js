class Physics {
    static applyGravity(object, gravity, dt) {
        if (!object.velocity) return;

        object.velocity.x += gravity.x * dt;
        object.velocity.y += gravity.y * dt;
        if (gravity.z !== undefined) {
            object.velocity.z += gravity.z * dt;
        }
    }

    static applyFriction(object, friction, dt) {
        if (!object.velocity) return;

        object.velocity.x -= object.velocity.x * friction * dt;
        object.velocity.y -= object.velocity.y * friction * dt;
        if (object.velocity.z !== undefined) {
            object.velocity.z -= object.velocity.z * friction * dt;
        }
    }

    static applyRotationalDynamics(object, dt) {
        if (!object.angularVelocity || !object.rotation) return;

        object.rotation.x += object.angularVelocity.x * dt;
        object.rotation.y += object.angularVelocity.y * dt;
        if (object.rotation.z !== undefined) {
            object.rotation.z += object.angularVelocity.z * dt;
        }
    }
}

export default Physics;