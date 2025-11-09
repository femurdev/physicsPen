import PhysicsEngine from '../src/index.js';

function runTests() {
    const engine = new PhysicsEngine();

    console.log('Running Tests...');

    // Test 1: Add Object
    engine.addObject({
        id: 'testObject',
        position: { x: 0, y: 0 },
        velocity: { x: 1, y: 1 }
    });
    console.assert(engine.simulation.objects.length === 1, 'Test 1 Failed: Object not added.');

    // Test 2: Update Simulation
    engine.update(1);
    const obj = engine.simulation.objects[0];
    console.assert(obj.position.x === 1 && obj.position.y === 1, 'Test 2 Failed: Object position not updated correctly.');

    // Test 3: Export to YAML
    const yamlData = engine.exportToYAML();
    console.assert(typeof yamlData === 'string', 'Test 3 Failed: Exported YAML data is not a string.');

    // Test 4: Import from YAML
    engine.importFromYAML(yamlData);
    console.assert(engine.simulation.objects[0].position.x === 1, 'Test 4 Failed: YAML import failed.');

    console.log('All Tests Passed!');
}

runTests();