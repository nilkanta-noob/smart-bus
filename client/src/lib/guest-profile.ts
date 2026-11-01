export type LocalGuestProfile = { displayName: string; createdAt: string };
const PROFILE_KEY = "smartbus-guest-profile-v1";
const DB_NAME = "smartbus-profile-assets";
const STORE = "images";

export function loadGuestProfile(): LocalGuestProfile {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null") as Partial<LocalGuestProfile> | null;
    if (saved?.displayName) return { displayName: saved.displayName, createdAt: saved.createdAt || new Date().toISOString() };
    const profile = { displayName: `Guest-${crypto.getRandomValues(new Uint16Array(1))[0] % 9000 + 1000}`, createdAt: new Date().toISOString() };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return profile;
  } catch { return { displayName: "Guest rider", createdAt: new Date().toISOString() }; }
}

export function saveGuestProfile(displayName: string) {
  const profile = { ...loadGuestProfile(), displayName: displayName.trim().slice(0, 120) || "Guest rider" };
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch { /* profile remains available for this session */ }
  return profile;
}

function openAssetsDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveGuestAvatar(file: File) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) throw new Error("Choose a PNG, JPEG, or WebP image under 5 MB.");
  const bitmap = await createImageBitmap(file);
  if (bitmap.width < 32 || bitmap.height < 32 || bitmap.width > 4096 || bitmap.height > 4096) { bitmap.close(); throw new Error("Image dimensions must be between 32 and 4096 pixels."); }
  const ratio = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * ratio); canvas.height = Math.round(bitmap.height * ratio);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((image) => image ? resolve(image) : reject(new Error("Could not compress the profile image.")), "image/webp", 0.82));
  const db = await openAssetsDb();
  await new Promise<void>((resolve, reject) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(blob, "avatar"); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
  db.close();
}

export async function loadGuestAvatarUrl() {
  const db = await openAssetsDb().catch(() => null);
  if (!db) return null;
  const blob = await new Promise<Blob | undefined>((resolve) => { const request = db.transaction(STORE).objectStore(STORE).get("avatar"); request.onsuccess = () => resolve(request.result); request.onerror = () => resolve(undefined); });
  db.close();
  return blob ? URL.createObjectURL(blob) : null;
}

export async function clearGuestAvatar() {
  const db = await openAssetsDb().catch(() => null);
  if (!db) return;
  await new Promise<void>((resolve) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete("avatar"); tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); });
  db.close();
}
