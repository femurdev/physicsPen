import { Simulation } from '../src/index.js';

function runTests() {
  const sim = new Simulation();

  // Test setting dimensions
  try {
    sim.setDimensions(2);
    console.log('Test Passed: Setting dimensions to 2D');
  } catch (e) {
    console.error('Test Failed: Setting dimensions to 2D', e);
  }

  try {
    sim.setDimensions(3);
    console.log('Test Passed: Setting dimensions to 3D');
  } catch (e) {
    console.error('Test Failed: Setting dimensions to 3D', e);
  }

  try {
    sim.setDimensions(4);
    console.error('Test Failed: Setting dimensions to 4 did not throw an error');
  } catch (e) {
    console.log('Test Passed: Setting dimensions to 4 threw an error');
  }

  // Test object addition
  sim.addObject({ name: 'Ball', mass: 1, position: { x: 0, y: 0 }, velocity: { x: 1, y: 1 } });
  if (sim.objects.length === 1) {
    console.log('Test Passed: Object was added successfully');
  } else {
    console.error('Test Failed: Object was not added');
  }

  // Test YAML export and import
  const yamlData = sim.exportToYAML();
  const newSim = new Simulation();
  newSim.importFromYAML(yamlData);

  if (newSim.objects.length === 1 && newSim.dimensions === 2) {
    console.log('Test Passed: YAML export and import works correctly');
  } else {
    console.error('Test Failed: YAML export and import does not work correctly');
  }
}

runTests();