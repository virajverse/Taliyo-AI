export default function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="px-4 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-300 shadow-sm inline-flex items-center gap-2">
        <span className="sr-only">Assistant is typing</span>
        <span className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse" />
        <span className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse [animation-delay:150ms]" />
        <span className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse [animation-delay:300ms]" />
      </div>
    </div>
  );
}
