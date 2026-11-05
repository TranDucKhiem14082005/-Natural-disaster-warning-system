import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Crosshair, LocateFixed, MapPin, MousePointerClick, X } from 'lucide-react';
import { useDebounced } from '../../hooks/use-debounced';
import { fmtLatLng, parseLatLng, searchPlaces, type Place } from '../../utils/geocode';
import { inputClass } from '../ui';

/**
 * One end of a route: type an address or "lat, lng", use GPS, or pick on the map.
 * The chosen point is always what the map shows, so a typed coordinate lands exactly where it was typed.
 */
export function PlaceInput({
  label,
  badge,
  value,
  onChange,
  near,
  picking,
  onPick,
  onLocate,
  locating,
  placeholder = 'Nhập địa chỉ hoặc toạ độ, VD 12.2388, 109.1967',
}: {
  label: string;
  badge: { text: string; color: string };
  value: Place | null;
  onChange: (p: Place | null) => void;
  near?: { lat: number; lng: number } | null;
  picking: boolean;
  onPick: () => void;
  onLocate?: () => void;
  locating?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  const [text, setText] = useState(value?.label ?? '');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const typed = useRef(false);
  const query = useDebounced(text.trim(), 400);

  // Follow points set from outside (GPS, map click, swap) without fighting the user while typing.
  useEffect(() => {
    typed.current = false;
    setText(value?.label ?? '');
    setOpen(false);
  }, [value]);

  const coord = parseLatLng(text);

  useEffect(() => {
    if (!typed.current || query.length < 3 || parseLatLng(query)) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    setFailed(false);
    searchPlaces(query, near, ctrl.signal)
      .then((r) => {
        setResults(r);
        setActive(0);
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== 'AbortError') setFailed(true);
      })
      .finally(() => setSearching(false));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const options: Place[] = coord ? [{ ...coord, label: fmtLatLng(coord) }] : results;

  const choose = (p: Place) => {
    onChange(p);
    setOpen(false);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = options[active] ?? options[0];
      if (pick) choose(pick);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const listId = `${id}-list`;
  const showList = open && typed.current && text.trim().length > 0;

  return (
    <div className="text-sm">
      <label htmlFor={id} className="mb-1.5 flex items-center gap-2 font-medium text-slate-700">
        <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: badge.color }} aria-hidden>
          {badge.text}
        </span>
        {label}
      </label>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          className={`${inputClass} h-11 pl-9 pr-9`}
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            typed.current = true;
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKey}
        />
        {text && (
          <button
            type="button"
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label={`Xoá ${label.toLowerCase()}`}
            onClick={() => {
              setText('');
              onChange(null);
            }}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
        {showList && (
          <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-[1000] mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-raised">
            {options.map((p, i) => (
              <li key={`${p.lat},${p.lng},${i}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(p)}
                  className={`flex w-full items-start gap-2 px-3 py-2 text-left ${i === active ? 'bg-brand-50' : 'hover:bg-slate-50'}`}
                >
                  {coord ? <Crosshair className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden /> : <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />}
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-900">{coord ? `Toạ độ ${p.label}` : p.label}</span>
                    {!coord && <span className="block text-xs tabular-nums text-slate-500">{fmtLatLng(p)}</span>}
                  </span>
                </button>
              </li>
            ))}
            {!coord && searching && <li className="px-3 py-2 text-slate-500">Đang tìm...</li>}
            {!coord && !searching && failed && <li className="px-3 py-2 text-red-600">Không tìm được địa chỉ. Hãy nhập toạ độ hoặc chọn trên bản đồ.</li>}
            {!coord && !searching && !failed && query.length >= 3 && !results.length && <li className="px-3 py-2 text-slate-500">Không thấy địa điểm phù hợp. Thử nhập toạ độ "vĩ độ, kinh độ".</li>}
            {!coord && query.length < 3 && <li className="px-3 py-2 text-slate-500">Nhập ít nhất 3 ký tự, hoặc toạ độ "vĩ độ, kinh độ".</li>}
          </ul>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {onLocate && (
          <button type="button" onClick={onLocate} disabled={locating} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-60">
            <LocateFixed className="h-3.5 w-3.5" aria-hidden />
            {locating ? 'Đang định vị...' : 'Vị trí của tôi'}
          </button>
        )}
        <button
          type="button"
          onClick={onPick}
          aria-pressed={picking}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold ${picking ? 'bg-brand-600 text-white' : 'text-brand-700 hover:bg-brand-50'}`}
        >
          <MousePointerClick className="h-3.5 w-3.5" aria-hidden />
          {picking ? 'Bấm lên bản đồ...' : 'Chọn trên bản đồ'}
        </button>
        {value && <span className="ml-auto text-xs tabular-nums text-slate-500">{fmtLatLng(value)}</span>}
      </div>
    </div>
  );
}
