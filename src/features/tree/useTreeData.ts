/**
 * Which tree database is shown: the JSON database (src/data/tree/), or an old .xlsx workbook opened for viewing.
 * The JSON is re-read by Vite whenever a file is saved, so editing a file redraws the tree.
 */
import { useCallback, useMemo, useState } from "react";
import { DATABASE } from "./load/loadTree";
import { loadFromFile } from "./load/loadWorkbook";
import { buildModel } from "./model/buildModel";
import type { TreeData } from "./types";

export const DATABASE_NAME = "JSON database";

export function useTreeData(onChange: () => void) {
  const [imported, setImported] = useState<{ data: TreeData; name: string } | null>(null);
  const [error, setError] = useState("");
  const data = imported?.data ?? DATABASE;
  const model = useMemo(() => buildModel(data), [data]);

  const openFile = useCallback(async (f: File) => {
    try {
      setImported({ data: await loadFromFile(f, DATABASE), name: f.name });
      setError(""); onChange();
    } catch (e) {
      setError(`Couldn't read "${f.name}": ${(e as Error).message}`);
    }
  }, [onChange]);

  return {
    model,
    source: imported?.name ?? DATABASE_NAME,
    error,
    openFile,
    /** Set while a workbook is shown: goes back to the JSON database. */
    backToDatabase: imported ? () => { setImported(null); onChange(); } : null,
  };
}
