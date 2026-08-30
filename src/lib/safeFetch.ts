import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_REDIRECTS = 5;

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  if (parts[0] === 0 || parts[0] === 10 || parts[0] === 127) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] >= 224) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("::ffff:")) {
    const mapped = v.slice(7);
    return isIP(mapped) === 4 ? isPrivateIPv4(mapped) : true;
  }
  if (v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb")) return true;
  if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("ff")) return true;
  return false;
}

function isPrivateIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true;
}

export async function assertSafeRemoteUrl(rawUrl: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error("URL inválida");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Solo se permiten URLs http(s)");
  }
  if (u.username || u.password) {
    throw new Error("URL con credenciales no permitida");
  }
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Acceso a hosts internos no permitido");
  }
  const family = isIP(host);
  let ips: string[];
  if (family === 4 || family === 6) {
    ips = [host];
  } else {
    try {
      const results = await lookup(host, { all: true, verbatim: true });
      ips = results.map((r) => r.address);
    } catch {
      throw new Error(`No se pudo resolver el host: ${host}`);
    }
  }
  if (ips.length === 0 || ips.some((ip) => isPrivateIp(ip))) {
    throw new Error("Acceso a direcciones internas no permitido");
  }
  return u;
}

export async function safeFetch(rawUrl: string): Promise<Response> {
  let next: string = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const current = await assertSafeRemoteUrl(next);
    const res = await fetch(current, { redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return res;
      await res.body?.cancel();
      next = new URL(location, current).toString();
      continue;
    }
    return res;
  }
  throw new Error("Demasiados redireccionamientos");
}