// Market-cap segment of a held stock from the stored NSE constituent lists (see src/ingest/segments.ts). Null when the lists are not loaded or the stock is outside the Nifty 500.
                                                
                                                                                                
export function segmentOf(sym        , s                             )                 {
  if (!s) return null;
  if (s.large.includes(sym)) return 'Large'; if (s.mid.includes(sym)) return 'Mid'; if (s.small.includes(sym)) return 'Small';
  return null;
}
