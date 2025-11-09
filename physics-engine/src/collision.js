class Collision {
    static detectCollision2D(object1, object2) {
        const dx = object1.position.x - object2.position.x;
        const dy = object1.position.y - object2.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        return distance < (object1.radius + object2.radius);
    }

    static detectCollision3D(object1, object2) {
        const dx = object1.position.x - object2.position.x;
        const dy = object1.position.y - object2.position.y;
        const dz = object1.position.z - object2.position.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        return distance < (object1.radius + object2.radius);
    }
}

export default Collision;