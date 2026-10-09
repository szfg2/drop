/* ====================================================================== *
 *  sw.js — lets the installed Drop app receive Android shares.
 *
 *  Android sends a share as a form upload (a POST) to /drop/?share-target.
 *  GitHub Pages can't accept uploads, so this worker catches it on the
 *  device, parks the text and pictures in the "drop-share" cache, and
 *  opens the app. Caches belong to the whole szfg2.github.io site, so the
 *  real Drop page (notionwidget/drop.html, shown inside this app) can read
 *  them, save them to GitHub, and clear them.
 * ====================================================================== */

const SHARE_CACHE = "drop-share";
const SHARE_PREFIX = new URL("./share/", self.location).href;
const APP = new URL("./", self.location).href;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

async function stash(request) {
  try {
    const form = await request.formData();
    const files = form.getAll("files").filter((f) => f && typeof f !== "string" && f.size);
    const id = Date.now() + "-" + Math.random().toString(36).slice(2, 6);
    const cache = await caches.open(SHARE_CACHE);
    for (let i = 0; i < files.length; i++) {
      await cache.put(SHARE_PREFIX + id + "/" + i, new Response(files[i], {
        headers: { "content-type": files[i].type || "application/octet-stream", "x-name": encodeURIComponent(files[i].name || "") }
      }));
    }
    // The .json is written last: Drop only acts on shares whose .json exists, so it never sees a half-written one.
    const meta = {
      title: form.get("title") || "", text: form.get("text") || "", url: form.get("url") || "", files: files.length
    };
    await cache.put(SHARE_PREFIX + id + ".json", new Response(JSON.stringify(meta), {
      headers: { "content-type": "application/json" }
    }));
    return Response.redirect(APP + "?shared", 303);
  } catch (e) {
    return Response.redirect(APP + "?share-failed", 303);
  }
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === "POST" && url.href.split("?")[0] === APP && url.searchParams.has("share-target")) {
    event.respondWith(stash(event.request));
  }
});
