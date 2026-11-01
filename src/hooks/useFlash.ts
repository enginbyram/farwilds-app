/** A short message that clears itself after `ms` (the header's "Saved Aldric." line). */
import { useEffect, useState } from "react";

export function useFlash(ms = 4000) {
  const [message, setMessage] = useState("");
  useEffect(() => { if (!message) return; const t = setTimeout(() => setMessage(""), ms); return () => clearTimeout(t); }, [message, ms]);
  return [message, setMessage] as const;
}
