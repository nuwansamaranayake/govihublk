import fs from "fs";
import path from "path";

function loadTos(locale: string): string {
  const dir = path.join(process.cwd(), "content", "tos");
  const candidates = [path.join(dir, `tos.${locale}.md`), path.join(dir, "tos.en.md")];
  for (const file of candidates) {
    try {
      return fs.readFileSync(file, "utf8");
    } catch {
      // try next candidate
    }
  }
  return "";
}

function renderMarkdown(markdown: string) {
  return markdown
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, i) => {
      const text = block.replace(/\s*\n\s*/g, " ");
      if (text.startsWith("## ")) {
        return (
          <h2 key={i} className="text-base font-semibold text-neutral-900 mt-7 mb-2">
            {text.slice(3)}
          </h2>
        );
      }
      if (text.startsWith("# ")) {
        return (
          <h1 key={i} className="text-xl font-bold text-neutral-900 mb-3">
            {text.slice(2)}
          </h1>
        );
      }
      return (
        <p key={i} className="text-sm text-neutral-700 leading-loose mb-3">
          {text}
        </p>
      );
    });
}

export default function TermsPage({ params: { locale } }: { params: { locale: string } }) {
  const markdown = loadTos(locale);

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-2xl px-5 py-10">{renderMarkdown(markdown)}</div>
    </main>
  );
}
