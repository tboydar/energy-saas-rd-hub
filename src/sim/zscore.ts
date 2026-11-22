// 用滾動視窗的 z-score 做最簡單的異常偵測：
// z = (目前值 − 視窗平均) ÷ 視窗標準差。

export function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / (values.length || 1);
}

export function std(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1));
}

export const Z_THRESHOLD = 3;
export const Z_WINDOW = 40;
/** 要連續幾筆超過門檻才算異常。 */
export const Z_CONFIRM = 2;

export class RollingZ {
  private window: number[] = [];
  private streak = 0;
  constructor(private size = Z_WINDOW, private minSamples = 20, readonly threshold = Z_THRESHOLD) {}

  /** 放入新的一筆，回傳它的 z-score 與是否異常。 */
  push(value: number): { z: number; anomaly: boolean } {
    let z = 0;
    if (this.window.length >= this.minSamples) {
      const sd = std(this.window);
      z = sd > 1e-9 ? (value - mean(this.window)) / sd : 0;
    }
    const beyond = Math.abs(z) >= this.threshold;
    // 去抖動：單獨一筆超過 3 個標準差很常見（12 條數列每秒各檢查一次，純雜訊也會偶爾超標），
    // 所以要「連續 2 筆」都超標才告警，否則畫面會一直亮紅燈。
    this.streak = beyond ? this.streak + 1 : 0;
    // 超標的值不放進基準視窗，否則一次尖峰就會把標準差撐大、蓋掉後續的異常。
    if (!beyond) {
      this.window.push(value);
      if (this.window.length > this.size) this.window.shift();
    }
    return { z, anomaly: this.streak >= Z_CONFIRM };
  }
}
