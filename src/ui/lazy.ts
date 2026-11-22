// 大型函式庫（Chart.js、Three.js）都走動態 import：
// 首屏只下載介面本身，圖表與 3D 場景在畫面出現後才載入，這是 Lighthouse 分數的關鍵。

let chartsModule: Promise<typeof import('./charts')> | null = null;
export function loadCharts(): Promise<typeof import('./charts')> {
  chartsModule ??= import('./charts');
  return chartsModule;
}

let factoryModule: Promise<typeof import('../three/factory')> | null = null;
export function loadFactory(): Promise<typeof import('../three/factory')> {
  factoryModule ??= import('../three/factory');
  return factoryModule;
}

let flowModule: Promise<typeof import('../flow/FlowIsland')> | null = null;
/** 互動流程圖（xyflow + React）。只有用到流程圖的頁面才會下載這一包。 */
export function loadFlow(): Promise<typeof import('../flow/FlowIsland')> {
  flowModule ??= import('../flow/FlowIsland');
  return flowModule;
}

/** 收納一頁裡建立的圖表，重畫或離開頁面時一次銷毀，避免記憶體洩漏。 */
export class ChartBag {
  private items: { destroy(): void }[] = [];
  add<T extends { destroy(): void }>(chart: T): T {
    this.items.push(chart);
    return chart;
  }
  clear(): void {
    this.items.forEach((c) => c.destroy());
    this.items = [];
  }
}
