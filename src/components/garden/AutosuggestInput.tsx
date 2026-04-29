import { useState, useEffect, useRef } from 'react';
import { searchParametry } from '../../services/database';

interface Props {
  type: 'kategorie' | 'nazev';
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function AutosuggestInput({ type, value, onChange, className, placeholder }: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(() => {
      searchParametry(type, value)
        .then(data => {
          if (Array.isArray(data)) {
            setSuggestions(data);
            setShowSuggestions(data.length > 0);
          }
        })
        .catch(() => { /* tichá chyba */ });
    }, 200);

    return () => clearTimeout(timer);
  }, [value, type]);

  function handleSelect(suggestion: string) {
    onChange(suggestion);
    setShowSuggestions(false);
  }

  function handleBlur() {
    setTimeout(() => setShowSuggestions(false), 200);
  }

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => value.length > 0 && suggestions.length > 0 && setShowSuggestions(true)}
        onBlur={handleBlur}
        className={className}
        placeholder={placeholder}
        autoComplete="off"
      />
      {showSuggestions && (
        <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <li
              key={i}
              onMouseDown={() => handleSelect(s)}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-green-50 hover:text-green-800 transition-colors"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
