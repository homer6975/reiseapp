import "server-only";

// Infomaniak kDrive (SPEC §6.4). Nur serverseitig, Token nie an den Client.
// Endpunkte (geprüft 2026-11-25 gegen developer.infomaniak.com-Seitennamen, die
// rclone-kDrive-Implementierung und den kDrive-Client von Agora; live erst mit Token):
//   GET    /2/drive/{drive}                                  Drive-Infos
//   GET    /3/drive/{drive}/files/{id}                       Datei-/Ordnerinfos
//   GET    /3/drive/{drive}/files/{id}/files?limit&cursor    Ordnerinhalt (has_more/cursor)
//   POST   /3/drive/{drive}/files/{parent}/directory {name}  Ordner anlegen
//   POST   /3/drive/{drive}/upload?directory_id&file_name&total_size&conflict  Upload (Rohdaten)
//   GET    /2/drive/{drive}/files/{id}/download              Download (ggf. 302)

const DEFAULT_BASE_URL = "https://api.infomaniak.com";

function baseUrl() {
  // Überschreibbar nur für Tests mit einem lokalen Fake-kDrive.
  return process.env.KDRIVE_API_URL ?? DEFAULT_BASE_URL;
}

export class KdriveError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "KdriveError";
  }
}

export type KFile = {
  id: number;
  name: string;
  type: "dir" | "file" | string;
  size?: number;
  mime_type?: string;
  parent_id?: number;
  last_modified_at?: number;
};

type ApiResponse<T> = {
  result: "success" | "error";
  data: T;
  has_more?: boolean;
  cursor?: string | null;
  error?: { code?: string };
};

function token() {
  const t = process.env.KDRIVE_TOKEN;
  if (!t) throw new KdriveError("KDRIVE_TOKEN ist nicht gesetzt.");
  return t;
}

async function call<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResponse<T>> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, ...init.headers },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!res.ok || body?.result !== "success") {
    throw new KdriveError(
      body?.error?.code ?? `HTTP ${res.status}`,
      res.status,
    );
  }
  return body;
}

const enc = encodeURIComponent;

export async function getDrive(
  driveId: string,
): Promise<{ id: number; name: string }> {
  return (await call<{ id: number; name: string }>(`/2/drive/${enc(driveId)}`))
    .data;
}

export async function getFile(
  driveId: string,
  fileId: string | number,
): Promise<KFile> {
  return (
    await call<KFile>(`/3/drive/${enc(driveId)}/files/${enc(String(fileId))}`)
  ).data;
}

export async function listFolder(
  driveId: string,
  folderId: string | number,
): Promise<KFile[]> {
  const files: KFile[] = [];
  let cursor: string | null | undefined;
  for (let page = 0; page < 20; page++) {
    const qs = new URLSearchParams({ limit: "1000" });
    if (cursor) qs.set("cursor", cursor);
    const res = await call<KFile[]>(
      `/3/drive/${enc(driveId)}/files/${enc(String(folderId))}/files?${qs}`,
    );
    files.push(...res.data);
    if (!res.has_more || !res.cursor) break;
    cursor = res.cursor;
  }
  return files;
}

export async function createFolder(
  driveId: string,
  parentId: string | number,
  name: string,
): Promise<KFile> {
  return (
    await call<KFile>(
      `/3/drive/${enc(driveId)}/files/${enc(String(parentId))}/directory`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      },
    )
  ).data;
}

/** Unterordner mit diesem Namen finden oder anlegen. */
export async function ensureFolder(
  driveId: string,
  parentId: string | number,
  name: string,
): Promise<KFile> {
  const existing = (await listFolder(driveId, parentId)).find(
    (f) => f.type === "dir" && f.name === name,
  );
  return existing ?? createFolder(driveId, parentId, name);
}

export async function uploadFile(
  driveId: string,
  folderId: string | number,
  file: Blob,
  name: string,
): Promise<KFile> {
  const qs = new URLSearchParams({
    directory_id: String(folderId),
    file_name: name,
    total_size: String(file.size),
    conflict: "rename",
  });
  return (
    await call<KFile>(`/3/drive/${enc(driveId)}/upload?${qs}`, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    })
  ).data;
}

/** Lädt die Datei serverseitig (Token bleibt auf dem Server) und gibt die Antwort zum Durchreichen zurück. */
export async function downloadFile(
  driveId: string,
  fileId: string | number,
): Promise<Response> {
  const res = await fetch(
    `${baseUrl()}/2/drive/${enc(driveId)}/files/${enc(String(fileId))}/download`,
    {
      headers: { Authorization: `Bearer ${token()}` },
      cache: "no-store",
      redirect: "manual",
    },
  );
  // Weiterleitung auf den Speicher (live nicht unter *.infomaniak.com): nur https folgen,
  // den Token nie mitschicken. Die Adresse stammt aus der authentifizierten API-Antwort.
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location");
    const target = location ? new URL(location, baseUrl()) : null;
    if (!target || target.protocol !== "https:") {
      throw new KdriveError(
        `Unerwartete Weiterleitung beim Download (${target ? `${target.protocol}//${target.hostname}` : "ohne Ziel"}).`,
      );
    }
    const redirected = await fetch(target, { cache: "no-store" });
    if (!redirected.ok)
      throw new KdriveError(`HTTP ${redirected.status}`, redirected.status);
    return redirected;
  }
  if (!res.ok) throw new KdriveError(`HTTP ${res.status}`, res.status);
  return res;
}

// Für den Button „Verbindung testen“ in den Einstellungen.
export async function testConnection(
  driveId: string | null,
  rootFolderId: string | null,
): Promise<{ ok: boolean; message: string }> {
  if (!process.env.KDRIVE_TOKEN) {
    return {
      ok: false,
      message:
        "Auf dem Server ist noch kein kDrive-Token (KDRIVE_TOKEN) hinterlegt.",
    };
  }
  if (!driveId)
    return { ok: false, message: "Bitte zuerst die kDrive-ID eintragen." };

  try {
    const drive = await getDrive(driveId);
    if (!rootFolderId) {
      return {
        ok: true,
        message: `Verbunden mit „${drive.name}“. Ordner „Reisen“ fehlt noch.`,
      };
    }
    const files = await listFolder(driveId, rootFolderId);
    return {
      ok: true,
      message: `Verbunden mit „${drive.name}“. Der Ordner enthält ${files.length} Einträge.`,
    };
  } catch (e) {
    return { ok: false, message: kdriveMessage(e) };
  }
}

export function kdriveMessage(e: unknown): string {
  const status = e instanceof KdriveError ? e.status : undefined;
  if (e instanceof KdriveError && !status && /KDRIVE_TOKEN/.test(e.message)) {
    return "Auf dem Server ist noch kein kDrive-Token hinterlegt.";
  }
  if (status === 401 || status === 403)
    return "kDrive lehnt den Token ab. Bitte Token und Rechte prüfen.";
  if (status === 404)
    return "kDrive oder Ordner nicht gefunden. Bitte die IDs prüfen.";
  return "kDrive ist gerade nicht erreichbar.";
}
