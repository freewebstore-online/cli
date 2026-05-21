/**
 * Template-starter scaffold. `fws init` writes these files directly
 * rather than cloning a starter repo — keeps the CLI self-contained
 * (no network round-trip on init, no broken state if the starter repo
 * is renamed). The eventual `freewebstore-online/template-starter`
 * repo will be generated from the same template module so the two
 * stay in sync.
 *
 * Designer fills:
 *   - index.html (vibecodes the layout — Tailwind utility classes only)
 *   - template.config.json (name, author handle, slot schema version)
 *   - preview.png (1280×720 hero shot — required at publish time)
 *   - README.md (optional designer story)
 *
 * Each file is a function that takes the init args + returns the file
 * body, so tests can render the scaffold without touching the disk.
 */

export interface ScaffoldArgs {
  slug: string;
  category: string;
  authorHandle: string;
}

export interface ScaffoldFile {
  path: string;
  content: string;
  mode?: number;
}

export function scaffoldFiles(args: ScaffoldArgs): ScaffoldFile[] {
  return [
    { path: "template.config.json", content: renderConfig(args) },
    { path: "index.html", content: renderHtml(args) },
    { path: "tailwind.config.js", content: renderTailwindConfig() },
    { path: "slots.md", content: renderSlotsDoc(args) },
    { path: "README.md", content: renderReadme(args) },
    { path: ".gitignore", content: "node_modules/\n.DS_Store\n*.log\n" },
    // Placeholder so designers know preview.png is required at publish.
    { path: "PREVIEW.md", content: renderPreviewPlaceholder() },
  ];
}

function renderConfig(args: ScaffoldArgs): string {
  return `${JSON.stringify(
    {
      v: 1,
      slug: args.slug,
      category: args.category,
      slot_schema_version: 1,
      author: { handle: args.authorHandle },
      license: "MIT",
    },
    null,
    2,
  )}\n`;
}

function renderHtml(args: ScaffoldArgs): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title data-fws-slot="business.name">Business Name</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-stone-50 text-stone-900 antialiased">
    <header class="mx-auto max-w-4xl px-6 py-16">
      <h1 class="text-5xl font-semibold tracking-tight" data-fws-slot="business.name">
        Business Name
      </h1>
      <p class="mt-4 text-lg text-stone-600" data-fws-slot="business.tagline">
        Your tagline goes here. The FWS platform AI rewrites this per business.
      </p>
    </header>

    <main class="mx-auto max-w-4xl px-6 pb-16 space-y-12">
      <section data-fws-slot-group="about">
        <h2 class="text-2xl font-semibold">About</h2>
        <p class="mt-3 text-stone-700" data-fws-slot="about.body">
          Two or three sentences about the business. The platform AI fills this in.
        </p>
      </section>

      <section data-fws-slot-group="contact">
        <h2 class="text-2xl font-semibold">Visit us</h2>
        <p class="mt-3 text-stone-700">
          <span data-fws-slot="contact.address">123 Main Street</span><br>
          <span data-fws-slot="contact.phone">(555) 555-5555</span>
        </p>
      </section>
    </main>

    <footer class="border-t border-stone-200 py-6 text-center text-sm text-stone-500">
      <!-- The FWS platform replaces this with the real designer-credit
           snippet at deploy time. Do not remove. -->
      <span data-fws-slot="fws.byline">Template by ${args.authorHandle} · made with FreeWebStore</span>
    </footer>
  </body>
</html>
`;
}

function renderTailwindConfig(): string {
  // Locked config — every template uses the same Tailwind setup so the
  // platform AI can rely on a known set of utility classes. Designers
  // who want a different look use Tailwind's utility composition, not
  // a custom config.
  return `// Locked at publish time. Do not extend without coordinating with
// the FreeWebStore design system — the platform AI assumes vanilla
// Tailwind utilities.
export default {
  content: ["./index.html"],
  theme: { extend: {} },
  plugins: [],
};
`;
}

function renderSlotsDoc(args: ScaffoldArgs): string {
  return `# Slot reference for category: ${args.category}

The FreeWebStore platform AI rewrites your template per small business by
filling \`data-fws-slot\` attributes. The slots below are the *conventional*
set for **${args.category}** — using them gives the platform AI deterministic
anchors, so customization is predictable.

Templates *without* slot markers still work — the AI infers structure from
the HTML — but marked templates are more reliable and easier to QA.

## Universal slots (all categories)

| Slot | Element type | What goes there |
|------|--------------|-----------------|
| \`business.name\` | text | Legal or display name of the business |
| \`business.tagline\` | text | One-line pitch, shown in the hero |
| \`about.body\` | rich text | 2-4 sentence about-the-business paragraph |
| \`contact.address\` | text | Street address |
| \`contact.phone\` | text | Phone number, formatted |
| \`contact.email\` | text | Public email |
| \`contact.hours\` | text or list | Opening hours |
| \`fws.byline\` | reserved | DO NOT EDIT — the platform writes the designer credit here |

## Category-specific slots

See the per-category SLOT-SCHEMAS reference in the platform docs for the
full list (menu.items, services, gallery.photos, etc.).
`;
}

function renderReadme(args: ScaffoldArgs): string {
  return `# ${args.slug}

A FreeWebStore template for **${args.category}** by **@${args.authorHandle}**.

## Vibecoding this template

Open \`index.html\` in your editor of choice (Claude Code, Cursor, Windsurf,
plain VS Code with an AI sidebar) and iterate. Constraints:

- **HTML + Tailwind utility classes only.** No templating engines, no
  framework, no build step.
- **Slot markers (\`data-fws-slot="..."\`) mark customization points.**
  See \`slots.md\` for the conventional set for your category.
- **Single-page output.** FWS produces one HTML file per business. Multi-page
  is a PWS feature, not FWS.

When the design looks good in your browser, capture a 1280×720 PNG hero shot
as \`preview.png\` (replace the placeholder).

## Publishing

\`\`\`sh
npx @freewebstore/cli doctor     # local validation
npx @freewebstore/cli login      # one-time GitHub App install
npx @freewebstore/cli publish    # upload + create repo + queue for review
\`\`\`

## License

MIT (auto-set by \`fws init\`). FreeWebStore requires MIT for community
templates — see CONTRIBUTING.md in the platform docs for the why.
`;
}

function renderPreviewPlaceholder(): string {
  return `# preview.png

\`fws publish\` requires a \`preview.png\` file in the template root.

- 1280×720
- Hero shot of the rendered template
- ≤500KB

This placeholder file exists to remind you. Replace \`PREVIEW.md\` with
\`preview.png\` before publishing.
`;
}
