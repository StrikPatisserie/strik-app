type NewsBlock =
  | {
      type: "heading";
      text: string;
    }
  | {
      type: "subheading";
      text: string;
    }
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "list";
      items: string[];
    };

type NewsRichContentProps = {
  content: string;
  tone?: "normal" | "newsletter";
  className?: string;
};

function normalizeContent(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6])>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function stripWrappingBold(value: string) {
  return value
    .replace(/^\*\*([^*]+)\*\*$/, "$1")
    .replace(/^\*([^*]+)\*$/, "$1")
    .trim();
}

function parseNewsBlocks(content: string) {
  const lines = normalizeContent(content).split("\n");
  const blocks: NewsBlock[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];

  function flushParagraph() {
    if (!paragraph.length) return;

    blocks.push({
      type: "paragraph",
      text: paragraph.join("\n").replace(/[ \t]+/g, " ").trim(),
    });
    paragraph = [];
  }

  function flushList() {
    if (!listItems.length) return;

    blocks.push({
      type: "list",
      items: listItems,
    });
    listItems = [];
  }

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        text: headingMatch[2].trim(),
      });
      return;
    }

    const listMatch = trimmed.match(/^[-•]\s+(.+)$/);
    if (listMatch) {
      flushParagraph();
      listItems.push(listMatch[1].trim());
      return;
    }

    if (/^\*\*?[^*]+\*\*?$/.test(trimmed)) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "subheading",
        text: stripWrappingBold(trimmed),
      });
      return;
    }

    flushList();
    paragraph.push(trimmed);
  });

  flushParagraph();
  flushList();

  return blocks.filter((block) => {
    if (block.type === "list") return block.items.length > 0;

    return block.text.length > 0;
  });
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g);

  return parts.map((part, index) => {
    if (/^\*\*[^*\n]+\*\*$/.test(part)) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }

    if (/^\*[^*\n]+\*$/.test(part)) {
      return <strong key={`${part}-${index}`}>{part.slice(1, -1)}</strong>;
    }

    return part;
  });
}

export function NewsRichContent({
  content,
  tone = "normal",
  className = "",
}: NewsRichContentProps) {
  const blocks = parseNewsBlocks(content);
  const isNewsletter = tone === "newsletter";

  if (!blocks.length) return null;

  return (
    <div
      className={`${isNewsletter ? "space-y-4" : "space-y-3"} ${className}`}
    >
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h3
              key={`${block.type}-${index}`}
              className={
                isNewsletter
                  ? "border-l-4 border-[#ef5737] pl-3 text-lg font-black leading-tight text-[#1a1815]"
                  : "text-base font-black leading-tight text-[#1a1815]"
              }
            >
              {renderInline(block.text)}
            </h3>
          );
        }

        if (block.type === "subheading") {
          return (
            <p
              key={`${block.type}-${index}`}
              className={
                isNewsletter
                  ? "text-base font-black leading-snug text-[#1a1815]"
                  : "text-sm font-black leading-snug text-[#1a1815]"
              }
            >
              {renderInline(block.text)}
            </p>
          );
        }

        if (block.type === "list") {
          return (
            <ul
              key={`${block.type}-${index}`}
              className={
                isNewsletter
                  ? "list-disc space-y-2 pl-5 text-[0.95rem] leading-7 text-[#5f5750] marker:text-[#ef5737]"
                  : "list-disc space-y-1 pl-5 text-sm leading-relaxed text-[#6b645b] marker:text-[#ef5737]"
              }
            >
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }

        return (
          <p
            key={`${block.type}-${index}`}
            className={
              isNewsletter
                ? "whitespace-pre-line text-[0.95rem] leading-7 text-[#5f5750]"
                : "whitespace-pre-line text-sm leading-relaxed text-[#6b645b]"
            }
          >
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
