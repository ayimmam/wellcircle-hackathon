import { readFileSync, writeFileSync } from 'node:fs';
import { legalContact, legalDocuments, legalUpdated } from '../src/data/legal.js';
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const css = readFileSync(new URL('../src/pages/LegalPage.css', import.meta.url), 'utf8');
for (const policy of Object.values(legalDocuments)) {
  const nav = Object.values(legalDocuments).map(item => `<a href="/${item.file}">${escape(item.title)}</a>`).join('');
  const sections = policy.sections.map(section => `<section><h2>${escape(section.title)}</h2>${(section.paragraphs || []).map(text => `<p>${escape(text)}</p>`).join('')}${section.items ? `<ul>${section.items.map(text => `<li>${escape(text)}</li>`).join('')}</ul>` : ''}</section>`).join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(policy.title)} | Well Circle</title><meta name="description" content="${escape(policy.intro)}"><style>body{margin:0;background:#f5f6fa;font:16px system-ui,-apple-system,sans-serif}.legal-page{box-sizing:border-box;padding:32px 24px 64px}${css}</style></head><body><main class="legal-page"><a class="legal-brand" href="/">Well Circle</a><h1>${escape(policy.title)}</h1><p class="legal-updated">Last updated: ${escape(legalUpdated)}</p><p>${escape(policy.intro)}</p><nav class="legal-navigation" aria-label="Legal information">${nav}</nav>${sections}<footer>Contact: <a href="mailto:${escape(legalContact)}">${escape(legalContact)}</a></footer></main></body></html>`;
  writeFileSync(new URL(`../public/${policy.file}`, import.meta.url), html);
}
console.log('Generated public legal pages from shared policy content.');
