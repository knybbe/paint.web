import { describe, expect, it } from "vitest";
import { putRequest } from "../src/core/idb";

describe("IndexedDB put helper", () => {
  it("omits the out-of-line key when the store uses a keyPath", () => {
    const calls: unknown[][] = [];
    const store = {
      keyPath: "id",
      put(...args: unknown[]) {
        calls.push(args);
        return {} as IDBRequest;
      },
    } as unknown as IDBObjectStore;
    putRequest(store, { id: "a", name: "x.jpg" }, "a");
    expect(calls).toEqual([[{ id: "a", name: "x.jpg" }]]);
  });

  it("passes the key for out-of-line stores", () => {
    const calls: unknown[][] = [];
    const store = {
      keyPath: "",
      put(...args: unknown[]) {
        calls.push(args);
        return {} as IDBRequest;
      },
    } as unknown as IDBObjectStore;
    putRequest(store, [{ name: "x.jpg" }], "list");
    expect(calls).toEqual([[[{ name: "x.jpg" }], "list"]]);
  });
});
