import * as YAML from 'js-yaml';
import Physics from './physics.js';
import Collision from './collision.js';
import Constraints from './constraints.js';

class PhysicsEngine {
    constructor() {
        this.simulation = {
            objects: [],
            settings: {
                gravity: { x: 0, y: -9.8, z: 0 },
                friction: 0.1,
                dimensions: 2,
                constraints: []
            }
        };
    }

    addObject(object) {
        this.simulation.objects.push(object);
    }

    addConstraint(constraint) {
        this.simulation.settings.constraints.push(constraint);
    }

    update(dt) {
        const { gravity, friction, dimensions, constraints } = this.simulation.settings;

        this.simulation.objects.forEach(obj => {
            Physics.applyGravity(obj, gravity, dt);
            Physics.applyFriction(obj, friction, dt);
            Physics.applyRotationalDynamics(obj, dt);

            obj.position.x += obj.velocity.x * dt;
            obj.position.y += obj.velocity.y * dt;
            if (dimensions === 3) {
                obj.position.z += obj.velocity.z * dt;
            }
        });

        constraints.forEach(constraint => {
            const { type, object1, object2, distance } = constraint;
            if (type === 'distance') {
                Constraints.applyDistanceConstraint(
                    this.simulation.objects.find(o => o.id === object1),
                    this.simulation.objects.find(o => o.id === object2),
                    distance
                );
            }
        });

        for (let i = 0; i < this.simulation.objects.length - 1; i++) {
            for (let j = i + 1; j < this.simulation.objects.length; j++) {
                const obj1 = this.simulation.objects[i];
                const obj2 = this.simulation.objects[j];

                const collisionDetected = dimensions === 2
                    ? Collision.detectCollision2D(obj1, obj2)
                    : Collision.detectCollision3D(obj1, obj2);

                if (collisionDetected) {
                    console.log(`Collision detected between ${obj1.id} and ${obj2.id}`);
                    // Handle collision response logic
                }
            }
        }
    }

    exportToYAML() {
        return YAML.dump(this.simulation);
    }

    importFromYAML(yamlString) {
        this.simulation = YAML.load(yamlString);
    }
}

export default PhysicsEngine;