import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import { expect, it } from 'vitest';

const stylesheet = readFileSync('src/index.css', 'utf8');

it('loads theme-aware colors from the stylesheet even with default Tailwind options', async () => {
  const result = await postcss([tailwindcss()]).process(stylesheet, {
    from: 'src/index.css',
  });

  expect(result.css).toMatch(/\.bg-slate-950\s*\{[^}]*var\(--neutral-950\)/);
  expect(result.css).toMatch(/\.text-slate-100\s*\{[^}]*var\(--neutral-100\)/);
  expect(result.css).toMatch(/\.bg-white\s*\{[^}]*var\(--accent\)/);
  expect(result.css).toContain(":root[data-theme='light']");
});
