import "server-only";

// Infomaniak kDrive (SPEC §6.4). Nur serverseitig, Token nie an den Client.
// Endpunkte laut developer.infomaniak.com (Stand 2026-11-24):
//   GET /2/drive/{drive_id}                      Drive-Infos
//   GET /3/drive/{drive_id}/files/{file_id}/files Inhalt eines Ordners
// Upload, Ordner anlegen usw. folgen in M4 und werden dann erneut gegen die Doku geprüft.

const BASE_URL = "https://api.infomaniak.com";

export class KdriveError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "KdriveError";
  }
}

export type KFile = { id: number; name: string; type: string };

type ApiResponse<T> = {
  result: "success" | "error";
  data: T;
  error?: { code?: string };
};

async function request<T>(path: string): Promise<T> {
  const token = process.env.KDRIVE_TOKEN;
  if (!token) throw new KdriveError("KDRIVE_TOKEN ist nicht gesetzt.");

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!res.ok || body?.result !== "success") {
    throw new KdriveError(
      body?.error?.code ?? `HTTP ${res.status}`,
      res.status,
    );
  }
  return body.data;
}

export async function getDrive(
  driveId: string,
): Promise<{ id: number; name: string }> {
  return request(`/2/drive/${encodeURIComponent(driveId)}`);
}

export async function listFolder(
  driveId: string,
  folderId: string,
): Promise<KFile[]> {
  return request(
    `/3/drive/${encodeURIComponent(driveId)}/files/${encodeURIComponent(folderId)}/files`,
  );
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
    const status = e instanceof KdriveError ? e.status : undefined;
    if (status === 401 || status === 403) {
      return {
        ok: false,
        message: "kDrive lehnt den Token ab. Bitte Token und Rechte prüfen.",
      };
    }
    if (status === 404) {
      return {
        ok: false,
        message: "kDrive oder Ordner nicht gefunden. Bitte die IDs prüfen.",
      };
    }
    return { ok: false, message: "kDrive ist gerade nicht erreichbar." };
  }
}
