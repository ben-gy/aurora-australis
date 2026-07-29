// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Ben Richardson
//
// Click-to-show glossary popover. Wires every .glossary-link[data-term] to a
// fixed-position popover positioned near the clicked element. Click-away / Escape
// dismisses. Delegated, so it works for links rendered at any time.
import { GLOSSARY } from './glossary';

let pop: HTMLDivElement | null = null;

function ensurePop(): HTMLDivElement {
  if (!pop) {
    pop = document.createElement('div');
    pop.className = 'gloss-pop';
    pop.setAttribute('role', 'dialog');
    document.body.appendChild(pop);
  }
  return pop;
}

function hide(): void {
  if (pop) pop.classList.remove('visible');
}

function show(link: Element): void {
  const key = link.getAttribute('data-term') ?? '';
  const entry = GLOSSARY[key];
  if (!entry) return;
  const el = ensurePop();
  el.innerHTML = `<strong>${entry.term}</strong><p>${entry.definition}</p>`;
  el.classList.add('visible');
  const r = link.getBoundingClientRect();
  const w = Math.min(320, window.innerWidth - 24);
  el.style.width = `${w}px`;
  let left = r.left;
  if (left + w + 12 > window.innerWidth) left = window.innerWidth - w - 12;
  el.style.left = `${Math.max(12, left)}px`;
  const below = r.bottom + 8;
  const popH = el.offsetHeight || 120;
  if (below + popH > window.innerHeight) {
    el.style.top = `${Math.max(12, r.top - popH - 8)}px`;
  } else {
    el.style.top = `${below}px`;
  }
}

export function initGlossary(): void {
  document.addEventListener('click', (e) => {
    const link = (e.target as Element).closest('.glossary-link');
    if (link) {
      e.preventDefault();
      e.stopPropagation();
      show(link);
      return;
    }
    if (pop && !(e.target as Element).closest('.gloss-pop')) hide();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide();
    if ((e.key === 'Enter' || e.key === ' ') && (e.target as Element).classList?.contains('glossary-link')) {
      e.preventDefault();
      show(e.target as Element);
    }
  });
  window.addEventListener('scroll', hide, true);
}
