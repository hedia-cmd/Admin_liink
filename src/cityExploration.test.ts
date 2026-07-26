import {
  validateCenterLatitude,
  validateCenterLongitude,
  validateExplorationAvailability,
} from "./cityExploration";

describe("city exploration validation", () => {
  test("requires an active city before enabling exploration", () => {
    expect(
      validateExplorationAvailability(true, {
        is_active: false,
        is_exploration_active: true,
      }),
    ).toMatch(/doit être active/);
    expect(
      validateExplorationAvailability(true, {
        is_active: true,
        is_exploration_active: true,
      }),
    ).toBeUndefined();
  });

  test("requires both coordinates for an exploration-ready city", () => {
    expect(
      validateCenterLatitude(null, {
        is_active: true,
        is_exploration_active: true,
        center_lng: 3.0031,
      }),
    ).toMatch(/obligatoire/);
    expect(
      validateCenterLongitude(null, {
        is_active: true,
        is_exploration_active: true,
        center_lat: 43.1843,
      }),
    ).toMatch(/obligatoire/);
  });

  test("validates latitude and longitude ranges", () => {
    const values = { is_active: true, is_exploration_active: true };
    expect(validateCenterLatitude(90, values)).toBeUndefined();
    expect(validateCenterLatitude(-90.1, values)).toMatch(/-90 et 90/);
    expect(validateCenterLongitude(180, values)).toBeUndefined();
    expect(validateCenterLongitude(180.1, values)).toMatch(/-180 et 180/);
  });
});
