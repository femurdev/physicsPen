import PhysicsEngine from '../src/index.js';

const engine = new PhysicsEngine();

engine.addObject({
    id: 'ball',
    position: { x: 0, y: 10 },
    velocity: { x: 1, y: -2 }
});

console.log('Initial State:', engine.simulation);

engine.update(1);

console.log('After 1s:', engine.simulation);

const yamlData = engine.exportToYAML();
console.log('Exported YAML:\n', yamlData);

engine.importFromYAML(yamlData);
console.log('Imported State:', engine.simulation);