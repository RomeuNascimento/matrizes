/**
 * Detecção de unidades removíveis (pendrives). No Windows usa o PowerShell
 * (Get-Volume); em outros sistemas lista os pontos de montagem usuais como
 * melhor esforço. Sem dependências nativas.
 */
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readdir } from "node:fs/promises";

const execAsync = promisify(exec);

export interface Drive {
  caminho: string;
  rotulo: string;
  livreBytes: number | null;
  removivel: boolean;
}

async function drivesWindows(): Promise<Drive[]> {
  const cmd =
    'powershell -NoProfile -Command "Get-Volume | Where-Object { $_.DriveType -eq \'Removable\' -and $_.DriveLetter } | ' +
    'Select-Object DriveLetter,FileSystemLabel,SizeRemaining | ConvertTo-Json -Compress"';
  const { stdout } = await execAsync(cmd, { timeout: 8000 });
  const parsed = JSON.parse(stdout.trim() || "[]");
  const lista = Array.isArray(parsed) ? parsed : [parsed];
  return lista
    .filter((v: any) => v && v.DriveLetter)
    .map((v: any) => ({
      caminho: `${v.DriveLetter}:\\`,
      rotulo: v.FileSystemLabel || `Removível (${v.DriveLetter}:)`,
      livreBytes: typeof v.SizeRemaining === "number" ? v.SizeRemaining : null,
      removivel: true,
    }));
}

async function drivesUnix(): Promise<Drive[]> {
  const bases = process.platform === "darwin" ? ["/Volumes"] : ["/media", "/mnt", "/run/media"];
  const drives: Drive[] = [];
  for (const base of bases) {
    try {
      for (const nome of await readdir(base)) {
        drives.push({ caminho: `${base}/${nome}`, rotulo: nome, livreBytes: null, removivel: true });
      }
    } catch {
      /* base inexistente */
    }
  }
  return drives;
}

export async function listarDrivesRemoviveis(): Promise<Drive[]> {
  try {
    return process.platform === "win32" ? await drivesWindows() : await drivesUnix();
  } catch {
    return [];
  }
}
