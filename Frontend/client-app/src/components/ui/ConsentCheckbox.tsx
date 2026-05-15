"use client";

interface ConsentCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string | null;
}

export default function ConsentCheckbox({ checked, onChange, error }: ConsentCheckboxProps) {
  return (
    <div>
      <label className="flex items-start gap-3 cursor-pointer group select-none">
        <div className="relative flex-shrink-0 mt-0.5">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only"
          />
          <div
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
              checked
                ? "bg-indigo-600 border-indigo-600"
                : error
                ? "border-red-400 bg-red-50"
                : "border-gray-300 group-hover:border-indigo-400"
            }`}
          >
            {checked && (
              <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>
        <span className="text-xs text-gray-600 leading-relaxed">
          Я даю согласие на{" "}
          <a
            href="/consent"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-indigo-600 underline hover:text-indigo-800 transition-colors"
          >
            обработку персональных данных
          </a>{" "}
          в соответствии с{" "}
          <a
            href="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-indigo-600 underline hover:text-indigo-800 transition-colors"
          >
            Политикой конфиденциальности
          </a>
        </span>
      </label>
      {error && (
        <p className="mt-1.5 ml-8 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
