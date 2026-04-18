export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="text-5xl">📦</div>
      <h1 className="text-2xl font-semibold">Нет подключения</h1>
      <p className="text-zinc-500 max-w-xs">
        Проверьте интернет и попробуйте снова
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-2 px-6 py-2 rounded-xl bg-zinc-900 text-white text-sm"
      >
        Обновить
      </button>
    </div>
  );
}
