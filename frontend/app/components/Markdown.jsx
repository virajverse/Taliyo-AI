import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Markdown({ children }) {
  return (
    <div className="markdown-body text-zinc-100 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => (
            <h1 className="mt-2 mb-3 text-2xl md:text-3xl font-semibold" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="mt-2 mb-2.5 text-xl md:text-2xl font-semibold" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="mt-2 mb-2 text-lg md:text-xl font-semibold" {...props} />
          ),
          h4: ({ node, ...props }) => (
            <h4 className="mt-2 mb-1.5 text-base md:text-lg font-semibold" {...props} />
          ),
          h5: ({ node, ...props }) => (
            <h5 className="mt-1.5 mb-1 text-sm md:text-base font-semibold" {...props} />
          ),
          h6: ({ node, ...props }) => (
            <h6 className="mt-1.5 mb-1 text-xs md:text-sm font-semibold tracking-wide uppercase text-zinc-300" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="my-2 leading-6 text-[15px] md:text-base text-zinc-200" {...props} />
          ),
          ul: ({ node, ordered, ...props }) => (
            <ul className="list-disc pl-5 space-y-1 my-2" {...props} />
          ),
          ol: ({ node, ordered, ...props }) => (
            <ol className="list-decimal pl-5 space-y-1 my-2" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="leading-6" {...props} />
          ),
          strong: ({ node, ...props }) => (
            <strong className="font-semibold text-zinc-100" {...props} />
          ),
          em: ({ node, ...props }) => <em className="italic" {...props} />,
          a: ({ node, ...props }) => (
            <a className="text-yellow-400 hover:underline" target="_blank" rel="noreferrer" {...props} />
          ),
          code: ({ node, inline, className, children, ...props }) => (
            inline ? (
              <code className="px-1.5 py-0.5 rounded bg-zinc-800/70 text-yellow-200 text-[12px]" {...props}>
                {children}
              </code>
            ) : (
              <pre className="my-3 p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 overflow-x-auto text-[12px] md:text-sm">
                <code className={className} {...props}>{children}</code>
              </pre>
            )
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-zinc-700 pl-3 my-2 text-zinc-300 italic" {...props} />
          ),
          hr: ({ node, ...props }) => (
            <hr className="my-3 border-zinc-800" {...props} />
          ),
          table: ({ node, ...props }) => (
            <div className="my-2 overflow-x-auto">
              <table className="min-w-full text-sm">
                {props.children}
              </table>
            </div>
          ),
          th: ({ node, ...props }) => (
            <th className="px-3 py-2 bg-zinc-900/60 border border-zinc-800 text-left" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-3 py-2 border border-zinc-800" {...props} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
