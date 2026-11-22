// 用滾動視窗的 z-score 做最簡單的異常偵測：
// z = (目前值 − 視窗平均) ÷ 視窗標準差，|z| 超過門檻就視為異常。

export function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / (values.length || 1);
}

export function std(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1));
}

export class RollingZ {
  private window: number[] = [];
  constructor(private size = 40, private minSamples = 15, readonly threshold = 3) {}

  /** 放入新的一筆，回傳它的 z-score 與是否異常。 */
  push(value: number): { z: number; anomaly: boolean } {
    let z = 0;
    if (this.window.length >= this.minSamples) {
      const sd = std(this.window);
      z = sd > 1e-9 ? (value - mean(this.window)) / sd : 0;
    }
    const anomaly = Math.abs(z) >= this.threshold;
    // 異常值不放進基準視窗，否則一次尖峰就會把標準差撐大、蓋掉後續的異常。
    if (!anomaly) {
      this.window.push(value);
      if (this.window.length > this.size) this.window.shift();
    }
    return { z, anomaly };
  }
}
