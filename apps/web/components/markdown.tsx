// Small safe renderer for the demo's deliverables. Never injects provider HTML.
export function Markdown({ text }: { text: string }) {
  const blocks = text.split(/(```[\s\S]*?```)/g);
  return <div className="markdown">{blocks.map((block, index) => {
    if (block.startsWith('```')) return <pre key={index}><code>{block.replace(/^```[^\n]*\n?/, '').replace(/```$/, '')}</code></pre>;
    return <div key={index}>{block.replace(/^(#{1,3} .+)$/gm, '$1\n').split(/\n\n+/).filter(Boolean).map((paragraph, i) => {
      if (paragraph.startsWith('### ')) return <h4 key={i}>{paragraph.slice(4)}</h4>;
      if (paragraph.startsWith('## ')) return <h3 key={i}>{paragraph.slice(3)}</h3>;
      if (paragraph.startsWith('# ')) return <h2 key={i}>{paragraph.slice(2)}</h2>;
      if (/^[•*-] /.test(paragraph)) return <ul key={i}>{paragraph.split('\n').map((line, j) => <li key={j}>{line.replace(/^[•*-] /, '')}</li>)}</ul>;
      return <p key={i}>{paragraph}</p>;
    })}</div>;
  })}</div>;
}
