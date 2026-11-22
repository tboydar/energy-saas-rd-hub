import { t } from '../core/i18n';
import { href } from '../core/router';
import { html, setHtml } from '../ui/dom';

// 尚未完成的頁面先顯示這個佔位畫面。
export function mount(root: HTMLElement): void {
  setHtml(root, html`<div class="page"><div class="notice"><h1>${t('soon.title')}</h1><p>${t('soon.body')}</p><a class="btn" href="${href('/dashboard')}">${t('denied.back')}</a></div></div>`);
}
