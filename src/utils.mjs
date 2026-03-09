import { TZ } from './constants.mjs';

export function $(id) { return document.getElementById(id); }

export function nowInCasa() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
}

export function showShareToast(msg) {
  const el = $('share-toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(el._tid);
  el._tid = setTimeout(() => el.classList.remove('show'), 2500);
}
