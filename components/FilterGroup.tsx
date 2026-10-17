'use client';

type FilterGroupProps = {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
};

export function FilterGroup({ label, options, value, onChange }: FilterGroupProps) {
  return (
    <div role="group" aria-label={label} className="chips">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className="chip"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
