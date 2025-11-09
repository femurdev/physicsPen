import * as THREE from 'three';

class Renderer3D {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        this.objects = [];
        this.camera.position.z = 5;
    }

    addObject(object) {
        const geometry = new THREE.SphereGeometry(object.radius || 0.5, 32, 32);
        const material = new THREE.MeshBasicMaterial({ color: object.color || 0x00ff00 });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.set(object.position.x, object.position.y, object.position.z || 0);
        this.scene.add(sphere);
        this.objects.push(sphere);
    }

    update(objects) {
        objects.forEach((obj, index) => {
            const sphere = this.objects[index];
            sphere.position.set(obj.position.x, obj.position.y, obj.position.z || 0);
        });
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}

export default Renderer3D;