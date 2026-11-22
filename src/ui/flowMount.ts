import type { FlowHandle, FlowOptions, FlowSpec } from '../flow/FlowIsland';
import { t } from '../core/i18n';
import { loadFlow } from './lazy';
import { flowLabels } from './widgets';

/**
 * 在容器裡掛上一張互動流程圖。xyflow 與 React 是延遲載入的，
 * 所以這裡先回傳一個代理：載入完成前的 update() 會被記下來，載入後補上。
 */
export function attachFlow(container: HTMLElement, spec: FlowSpec, options: Omit<FlowOptions, 'labels'> = {}): FlowHandle {
  let handle: FlowHandle | null = null;
  let dead = false;
  let latest: { spec: FlowSpec; selected?: string | null } = { spec };
  const loading = document.createElement('div');
  loading.className = 'flow-loading';
  loading.textContent = t('flow.loading');
  container.replaceChildren(loading);

  void loadFlow().then(({ mountFlow }) => {
    if (dead) return;
    container.replaceChildren();
    handle = mountFlow(container, latest.spec, { ...options, labels: flowLabels() });
    if (latest.selected !== undefined) handle.update(latest.spec, latest.selected);
  });

  return {
    update(next, selected) {
      latest = { spec: next, selected };
      handle?.update(next, selected);
    },
    destroy() {
      dead = true;
      handle?.destroy();
      handle = null;
    },
  };
}
