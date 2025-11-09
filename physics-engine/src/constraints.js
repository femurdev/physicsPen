class Constraints {
    static applyDistanceConstraint(object1, object2, distance) {
        const dx = object2.position.x - object1.position.x;
        const dy = object2.position.y - object1.position.y;
        const dz = (object2.position.z || 0) - (object1.position.z || 0);
        const currentDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const correction = (currentDistance - distance) / currentDistance;

        const correctionX = correction * dx * 0.5;
        const correctionY = correction * dy * 0.5;
        const correctionZ = correction * dz * 0.5;

        object1.position.x += correctionX;
        object1.position.y += correctionY;
        if (object1.position.z !== undefined) object1.position.z += correctionZ;

        object2.position.x -= correctionX;
        object2.position.y -= correctionY;
        if (object2.position.z !== undefined) object2.position.z -= correctionZ;
    }
}

export default Constraints;