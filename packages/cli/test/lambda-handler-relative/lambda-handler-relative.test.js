const { clearBuildOutput, runStartCommand } = require("../helpers");

beforeEach(async () => {
  await clearBuildOutput(__dirname);
});

afterAll(async () => {
  await clearBuildOutput(__dirname);
});

/**
 * Test that it doesn't break on relative handler paths
 */
test("lambda-handler-find-relative", async () => {
  const result = await runStartCommand(__dirname);
  expect(result).not.toMatch(/Failed to build the Lambda handlers/);
});
