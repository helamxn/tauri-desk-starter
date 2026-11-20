import {
  INITIAL_STATE,
  isBusy,
  downloadPercent,
  updaterReducer,
  type UpdateInfo,
  type UpdaterState,
} from "./updater-state";

const update: UpdateInfo = { version: "0.2.0", currentVersion: "0.1.0", date: null, notes: null };
const checking = (manual = false): UpdaterState => ({ status: "checking", manual });
const downloading = (manual = false): UpdaterState => ({
  status: "downloading",
  update,
  downloaded: 0,
  total: null,
  manual,
});
const ready: UpdaterState = { status: "ready", update };
const installing: UpdaterState = { status: "installing", update };
const upToDate: UpdaterState = { status: "up-to-date", checkedAt: 1, manual: false };
const withError: UpdaterState = { status: "error", message: "x", manual: false, stage: "check" };

describe("updaterReducer", () => {
  it("checks from idle, up-to-date and error states", () => {
    for (const from of [INITIAL_STATE, upToDate, withError]) {
      expect(updaterReducer(from, { type: "check-started", manual: true })).toEqual(checking(true));
    }
  });

  it("ignores checks while an update is active", () => {
    for (const busy of [checking(), downloading(), ready, installing]) {
      expect(isBusy(busy)).toBe(true);
      expect(updaterReducer(busy, { type: "check-started", manual: true })).toBe(busy);
    }
    for (const idle of [INITIAL_STATE, upToDate, withError]) expect(isBusy(idle)).toBe(false);
  });

  it("records a completed check and its timestamp", () => {
    expect(updaterReducer(checking(true), { type: "check-finished", update: null, at: 42 })).toEqual({
      status: "up-to-date",
      checkedAt: 42,
      manual: true,
    });
  });

  it("starts downloading an available version", () => {
    expect(updaterReducer(checking(), { type: "check-finished", update, at: 1 })).toEqual(downloading());
  });

  it("ignores check results outside a check", () => {
    expect(updaterReducer(INITIAL_STATE, { type: "check-finished", update, at: 1 })).toBe(INITIAL_STATE);
  });

  it("tracks download size, progress and completion", () => {
    let state = updaterReducer(downloading(), { type: "download-started", total: 200 });
    expect(state).toMatchObject({ total: 200, downloaded: 0 });
    state = updaterReducer(state, { type: "download-progress", chunk: 50 });
    state = updaterReducer(state, { type: "download-progress", chunk: -10 });
    expect(state).toMatchObject({ downloaded: 50 });
    expect(downloadPercent(state)).toBe(25);
    expect(updaterReducer(state, { type: "download-finished" })).toEqual(ready);
  });

  it("omits percentage when size is unknown", () => {
    expect(downloadPercent(updaterReducer(downloading(), { type: "download-started", total: 0 }))).toBeNull();
    expect(downloadPercent(downloading())).toBeNull();
    expect(downloadPercent(ready)).toBeNull();
  });

  it("caps progress at 100 percent", () => {
    const state: UpdaterState = { ...downloading(), downloaded: 300, total: 200 } as UpdaterState;
    expect(downloadPercent(state)).toBe(100);
  });

  it("ignores out-of-order download events", () => {
    for (const action of [
      { type: "download-started", total: 1 },
      { type: "download-progress", chunk: 1 },
      { type: "download-finished" },
    ] as const) {
      expect(updaterReducer(ready, action)).toBe(ready);
    }
  });

  it("installs only from the ready state", () => {
    expect(updaterReducer(ready, { type: "install-started" })).toEqual(installing);
    expect(updaterReducer(downloading(), { type: "install-started" })).toEqual(downloading());
  });

  it("preserves manual notifications after check or download failures", () => {
    expect(updaterReducer(checking(false), { type: "failed", message: "m" })).toEqual({
      status: "error",
      message: "m",
      manual: false,
      stage: "check",
    });
    expect(updaterReducer(downloading(true), { type: "failed", message: "m" })).toMatchObject({ manual: true });
  });

  it("always reports failures during user-confirmed installation", () => {
    expect(updaterReducer(installing, { type: "failed", message: "m" })).toMatchObject({
      status: "error",
      manual: true,
    });
  });

  it("records whether checking or installing failed", () => {
    for (const from of [checking(), downloading()]) {
      expect(updaterReducer(from, { type: "failed", message: "m" })).toMatchObject({ stage: "check" });
    }
    expect(updaterReducer(installing, { type: "failed", message: "m" })).toMatchObject({ stage: "install" });
  });

  it("ignores failures outside active operations", () => {
    for (const state of [INITIAL_STATE, upToDate, withError]) {
      expect(updaterReducer(state, { type: "failed", message: "m" })).toBe(state);
    }
  });
});
