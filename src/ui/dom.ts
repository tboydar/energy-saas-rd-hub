// 很小的畫面工具：安全的 HTML 樣板、事件委派、對話框與提示。
// 沒有用前端框架：每頁就是「資料 → HTML 字串」，資料變了就重畫該區塊。

/** 已經確認安全、可以直接放進 innerHTML 的 HTML。 */
export class Safe {
  constructor(readonly s: string) {}
  toString(): string {
    return this.s;
  }
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(text: unknown): string {
  return String(text).replace(/[&<>"']/g, (c) => ESC[c]);
}

function render(value: unknown): string {
  if (value == null || value === false || value === true) return '';
  if (value instanceof Safe) return value.s;
  if (Array.isArray(value)) return value.map(render).join('');
  return esc(value);
}

/**
 * 樣板標籤：${} 內的值一律先跳脫，只有 Safe（另一段 html``）才原樣插入。
 * 使用者輸入的文字（1:1 紀錄、需求描述…）因此不會變成 XSS。
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]): Safe {
  let out = '';
  strings.forEach((part, i) => {
    out += part;
    if (i < values.length) out += render(values[i]);
  });
  return new Safe(out);
}

export const raw = (s: string): Safe => new Safe(s);

export function setHtml(el: Element, content: Safe): void {
  el.innerHTML = content.s;
}

export function $<T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T | null {
  return root.querySelector<T>(sel);
}

export function $$<T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll<T>(sel));
}

/** 事件委派：在 root 上聽一次，就能處理之後重畫出來的元素。回傳取消函式。 */
export function on<K extends keyof HTMLElementEventMap>(
  root: HTMLElement,
  type: K,
  selector: string,
  handler: (event: HTMLElementEventMap[K], target: HTMLElement) => void,
): () => void {
  const listener = (event: HTMLElementEventMap[K]) => {
    const target = (event.target as Element | null)?.closest<HTMLElement>(selector);
    if (target && root.contains(target)) handler(event, target);
  };
  root.addEventListener(type, listener as EventListener);
  return () => root.removeEventListener(type, listener as EventListener);
}

let toastTimer = 0;
export function toast(message: string, tone: 'ok' | 'warn' = 'ok'): void {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = `toast is-show is-${tone}`;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el && el.classList.remove('is-show'), 2600);
}

/** 開啟對話框（原生 <dialog>，自帶焦點管理與 Esc 關閉）。回傳關閉函式。 */
export function openModal(content: Safe, onReady?: (dialog: HTMLDialogElement, close: () => void) => void): () => void {
  const dialog = document.createElement('dialog');
  dialog.className = 'modal';
  dialog.innerHTML = content.s;
  document.body.appendChild(dialog);
  const close = () => {
    if (dialog.open) dialog.close();
    dialog.remove();
  };
  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || (e.target as Element).closest('[data-close]')) close();
  });
  dialog.showModal();
  onReady?.(dialog, close);
  return close;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 非安全來源或權限被拒時，退回舊式的選取複製。
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

export function num(value: number, digits = 0): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** 把大數字縮成 3.0 億／300M 這種好讀的寫法。 */
export function compact(value: number, lang: 'zh' | 'en'): string {
  if (lang === 'zh') {
    if (value >= 1e8) return `${(value / 1e8).toFixed(2)} 億`;
    if (value >= 1e4) return `${(value / 1e4).toFixed(1)} 萬`;
    return num(value);
  }
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return num(value);
}
