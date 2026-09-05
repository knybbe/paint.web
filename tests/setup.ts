(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.PointerEvent === "undefined") {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    constructor(type: string, props: MouseEventInit & { pointerId?: number } = {}) {
      super(type, { bubbles: true, cancelable: true, ...props });
      this.pointerId = props.pointerId ?? 1;
    }
  }
  globalThis.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

const protoEl = globalThis.HTMLElement?.prototype as HTMLElement & {
  hasPointerCapture?: (id: number) => boolean;
  setPointerCapture?: (id: number) => void;
  releasePointerCapture?: (id: number) => void;
};
if (protoEl) {
  if (!protoEl.hasPointerCapture) protoEl.hasPointerCapture = () => false;
  if (!protoEl.setPointerCapture) protoEl.setPointerCapture = () => {};
  if (!protoEl.releasePointerCapture) protoEl.releasePointerCapture = () => {};
  if (!protoEl.scrollIntoView) protoEl.scrollIntoView = () => {};
}

const proto = globalThis.HTMLCanvasElement?.prototype;
if (proto) {
  proto.getContext = function getContext() {
    return null;
  } as typeof proto.getContext;
}
