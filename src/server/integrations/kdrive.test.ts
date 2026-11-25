import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ensureFolder, listFolder, uploadFile } from "./kdrive";

const ok = (data: unknown, extra = {}) =>
  new Response(JSON.stringify({ result: "success", data, ...extra }), {
    status: 200,
  });

describe("kdrive", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv("KDRIVE_TOKEN", "t");
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("blättert Ordnerinhalte per cursor", async () => {
    fetchMock
      .mockResolvedValueOnce(
        ok([{ id: 1, name: "a", type: "file" }], {
          has_more: true,
          cursor: "c1",
        }),
      )
      .mockResolvedValueOnce(ok([{ id: 2, name: "b", type: "dir" }]));
    const files = await listFolder("9", 5);
    expect(files.map((f) => f.id)).toEqual([1, 2]);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.infomaniak.com/3/drive/9/files/5/files?limit=1000",
    );
    expect(fetchMock.mock.calls[1][0]).toContain("cursor=c1");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer t");
  });

  it("legt fehlende Ordner an, vorhandene werden wiederverwendet", async () => {
    fetchMock
      .mockResolvedValueOnce(ok([{ id: 7, name: "2027", type: "dir" }]))
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok({ id: 8, name: "Belege", type: "dir" }));
    expect((await ensureFolder("9", 5, "2027")).id).toBe(7);
    expect((await ensureFolder("9", 7, "Belege")).id).toBe(8);
    const [url, init] = fetchMock.mock.calls[2];
    expect(url).toBe("https://api.infomaniak.com/3/drive/9/files/7/directory");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ name: "Belege" });
  });

  it("lädt Dateien als Rohdaten mit Größe und Zielordner hoch", async () => {
    fetchMock.mockResolvedValueOnce(
      ok({ id: 11, name: "x.pdf", type: "file" }),
    );
    const blob = new Blob(["%PDF-1.4"], { type: "application/pdf" });
    const file = await uploadFile("9", 8, blob, "x.pdf");
    expect(file.id).toBe(11);
    const [url, init] = fetchMock.mock.calls[0];
    const u = new URL(url);
    expect(u.pathname).toBe("/3/drive/9/upload");
    expect(Object.fromEntries(u.searchParams)).toEqual({
      directory_id: "8",
      file_name: "x.pdf",
      total_size: "8",
      conflict: "rename",
    });
    expect(init.headers["Content-Type"]).toBe("application/pdf");
  });

  it("meldet Fehler mit Status", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ result: "error", error: { code: "x" } }), {
        status: 404,
      }),
    );
    await expect(listFolder("9", 1)).rejects.toMatchObject({ status: 404 });
  });
});
