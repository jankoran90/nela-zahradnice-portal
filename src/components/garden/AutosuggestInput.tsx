
import { useState, useEffect, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

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
    if (value.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(() => {
      fetch(`${API_URL}/api/history/${type}?q=${value}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setSuggestions(data);
            setShowSuggestions(data.length > 0);
          }
        })
        .catch(() => { /* tichá chyba */ });
    }, 300); // Debounce

    return () => clearTimeout(timer);
  }, [value, type]);

  function handleSelect(suggestion: string) {
    onChange(suggestion);
    setShowSuggestions(false);
  }

  function handleBlur() {
    // Timeout, aby stihl proběhnout click na návrh
    setTimeout(() => setShowSuggestions(false), 200);
  }

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => value.length > 1 && suggestions.length > 0 && setShowSuggestions(true)}
        onBlur={handleBlur}
        className={className}
        placeholder={placeholder}
        autoComplete="off"
      />
      {showSuggestions && (
        <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">
          {suggestions.map(s => (
            <li
              key={s}
              onMouseDown={() => handleSelect(s)}
              className="px-4 py-2 cursor-pointer hover:bg-gray-100"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
