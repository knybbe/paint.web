class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

const proto = globalThis.HTMLCanvasElement?.prototype;
if (proto) {
  proto.getContext = function getContext() {
    return null;
  } as typeof proto.getContext;
}
