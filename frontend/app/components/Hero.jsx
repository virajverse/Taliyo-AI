export default function Hero({ onStart }) {
  return (
    <div className="relative overflow-hidden rounded-3xl p-8 md:p-12 bg-gradient-to-tr from-zinc-900 via-zinc-800 to-yellow-900/30 border border-zinc-800 shadow-lg">
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-yellow-500/20 blur-3xl" />
      <div className="relative z-10">
        <div className="text-3xl md:text-4xl font-semibold text-yellow-400 mb-2">Welcome back!</div>
        <div className="text-zinc-300 mb-6">Which task would you like to start today?</div>
        <div className="flex flex-wrap gap-3">
          <button onClick={onStart} className="px-4 py-2 rounded-xl bg-yellow-500 text-zinc-900 font-semibold hover:bg-yellow-400">
            Start a new chat
          </button>
          <button className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 hover:bg-zinc-800">
            Search for suppliers
          </button>
          <button className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 hover:bg-zinc-800">
            Select materials
          </button>
          <button className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 hover:bg-zinc-800">
            Cost calculation
          </button>
        </div>
      </div>
    </div>
  );
}
