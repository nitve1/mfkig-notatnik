// Historia cen na telefonie: zapis po każdym nowym zestawieniu, scalanie z historią z serwera (GitHub),
// wczytanie w karcie modelu. Logika formatu w core/history.js.
import { useEffect, useState } from 'react';
import { emptyHistory, isHistory, mergeHistory, recordPrices } from '../../core/history.js';
import { readHistory, writeHistory } from './store';

let cache = null; // wczytana historia (wspólna dla zapisu i karty modelu)
let loading = null;
let version = 0;
const listeners = new Set();
let queue = Promise.resolve();

async function load() {
  if (cache) return cache;
  loading ??= readHistory().then((h) => {
    cache = isHistory(h) ? h : emptyHistory();
    loading = null;
    return cache;
  });
  return loading;
}

function publish(h) {
  cache = { ...h }; // nowy obiekt: komponenty przeliczają wykres
  version++;
  for (const fn of listeners) fn(version);
}

// Zapisy po kolei, żeby zadanie w tle i apka nie nadpisały sobie zmian.
function enqueue(fn) {
  queue = queue.then(fn).catch(() => {});
  return queue;
}

// Ceny z nowego zestawienia (pełnego, częściowego albo z GitHub).
// Plik czytamy za każdym razem od nowa: zadanie w tle mogło dopisać swoje ceny.
async function fresh() {
  const disk = await readHistory();
  return isHistory(disk) ? disk : await load();
}

export function recordSnapshot(snapshot) {
  return enqueue(async () => {
    const h = recordPrices(await fresh(), snapshot);
    publish(h);
    await writeHistory(h);
  });
}

// Historia z serwera: dłuższa niż na telefonie (np. zaraz po instalacji).
export function mergeRemoteHistory(remote) {
  if (!isHistory(remote)) return Promise.resolve();
  return enqueue(async () => {
    const h = mergeHistory(remote, await fresh());
    publish(h);
    await writeHistory(h);
  });
}

// Historia w komponencie: null do czasu wczytania, potem odświeżana po każdym zapisie.
export function useHistory() {
  const [, setV] = useState(version);
  useEffect(() => {
    let alive = true;
    const fn = (v) => alive && setV(v);
    listeners.add(fn);
    load().then(() => alive && setV(version + 0.5));
    return () => {
      alive = false;
      listeners.delete(fn);
    };
  }, []);
  return cache;
}
