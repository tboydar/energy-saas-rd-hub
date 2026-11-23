import { describe, expect, test } from 'bun:test';
import { mean, RollingZ, std } from '../../src/sim/zscore';

describe('z-score 異常偵測', () => {
  test('mean 與 std', () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(std([2, 4, 6])).toBe(2);
    expect(std([5])).toBe(0);
  });

  const warm = (z: RollingZ) => { for (let i = 0; i < 30; i++) z.push(100 + (i % 5)); };

  test('樣本不足時不告警', () => {
    const z = new RollingZ();
    for (let i = 0; i < 10; i++) expect(z.push(i * 1000).anomaly).toBe(false);
  });

  test('單獨一筆尖峰不告警（去抖動），連續兩筆才告警', () => {
    const z = new RollingZ();
    warm(z);
    expect(z.push(400).anomaly).toBe(false);
    expect(z.push(400).anomaly).toBe(true);
  });

  test('尖峰後回到正常值就解除', () => {
    const z = new RollingZ();
    warm(z);
    z.push(400);
    z.push(400);
    expect(z.push(102).anomaly).toBe(false);
  });

  test('超標的值不會污染基準：長時間異常後仍然偵測得到', () => {
    const z = new RollingZ();
    warm(z);
    for (let i = 0; i < 50; i++) z.push(400);
    expect(z.push(400).anomaly).toBe(true);
  });
});
