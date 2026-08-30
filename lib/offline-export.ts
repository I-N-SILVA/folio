import type { Book } from './book-schema'

/**
 * Compiles a self-contained, zero-dependency offline HTML flipbook bundle
 * for kiosk displays, trade-show iPad presentations, and self-hosted deployments.
 */
export function generateOfflineBundle(book: Book): string {
  const pages = book.pages || []
  const title = book.title || 'QLICO Edition'
  const bookJson = JSON.stringify(book).replace(/</g, '\\u003c')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>${title} · Standalone Edition</title>
  <style>
    :root {
      --bg: #050508;
      --paper: ${book.theme?.background || '#ffffff'};
      --accent: ${book.theme?.primary || '#000000'};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      user-select: none;
    }
    .header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 54px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      background: rgba(10,10,14,0.7);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(255,255,255,0.08);
      z-index: 100;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
      font-size: 14px;
      letter-spacing: -0.02em;
    }
    .viewport {
      position: relative;
      width: 90vw;
      max-width: 960px;
      height: 75vh;
      max-height: 640px;
      perspective: 1400px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 40px;
    }
    .spread-container {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      border-radius: 8px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.6);
      background: var(--paper);
      overflow: hidden;
      color: #111;
    }
    .page-pane {
      flex: 1;
      height: 100%;
      padding: 40px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      position: relative;
      overflow-y: auto;
    }
    .page-pane:first-child {
      border-right: 1px solid rgba(0,0,0,0.06);
    }
    .page-title {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 12px;
      line-height: 1.2;
    }
    .page-body {
      font-size: 14px;
      line-height: 1.6;
      color: #444;
      margin-bottom: 16px;
    }
    .page-stat {
      font-size: 36px;
      font-weight: 800;
      color: var(--accent);
      margin: 8px 0;
    }
    .hotspot-pin {
      position: absolute;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(0,0,0,0.85);
      border: 2px solid #fff;
      color: #fff;
      display: grid;
      place-items: center;
      font-size: 12px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transform: translate(-50%, -50%);
      transition: transform 0.2s;
    }
    .hotspot-pin:hover { transform: translate(-50%, -50%) scale(1.15); }
    .footer-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      background: rgba(10,10,14,0.8);
      backdrop-filter: blur(12px);
      border-top: 1px solid rgba(255,255,255,0.08);
      z-index: 100;
    }
    .btn {
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      color: #fff;
      padding: 8px 18px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn:hover { background: #fff; color: #000; }
    .page-indicator {
      font-family: monospace;
      font-size: 12px;
      color: #888;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <svg viewBox="0 0 512 512" width="20" height="20">
        <g fill="none" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round">
          <path d="M 140 170 C 200 120 312 120 372 170" stroke-width="40" />
          <path d="M 110 256 H 402" stroke-width="40" />
          <path d="M 170 342 H 420" stroke-width="40" />
          <circle cx="256" cy="256" r="14" fill="#000000" stroke="#ffffff" stroke-width="12" />
        </g>
      </svg>
      <span>${title}</span>
    </div>
    <span style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.1em;">Standalone Kiosk Bundle</span>
  </div>

  <div class="viewport">
    <div class="spread-container" id="spread">
      <!-- Injected via JavaScript -->
    </div>
  </div>

  <div class="footer-bar">
    <button class="btn" id="prevBtn" onclick="prevPage()">← Previous</button>
    <span class="page-indicator" id="indicator">Spread 1</span>
    <button class="btn" id="nextBtn" onclick="nextPage()">Next →</button>
  </div>

  <script>
    const bookData = ${bookJson};
    const pages = bookData.pages || [];
    let currentSpread = 0;
    const totalSpreads = Math.ceil(pages.length / 2);

    function renderSpread() {
      const spreadEl = document.getElementById('spread');
      const indicatorEl = document.getElementById('indicator');
      const leftIdx = currentSpread * 2;
      const rightIdx = leftIdx + 1;

      const leftPage = pages[leftIdx];
      const rightPage = pages[rightIdx];

      let html = '';

      function renderPageHtml(page) {
        if (!page) return '<div class="page-pane" style="background: rgba(0,0,0,0.02);"></div>';
        let inner = '';
        if (page.blocks) {
          for (const b of page.blocks) {
            if (b.type === 'text') {
              if (b.variant === 'stat') {
                inner += '<div class="page-stat">' + (b.content || '') + '</div>';
              } else if (b.variant === 'heading' || b.variant === 'title') {
                inner += '<h2 class="page-title">' + (b.content || '').replace(/#+/g, '') + '</h2>';
              } else {
                inner += '<p class="page-body">' + (b.content || '') + '</p>';
              }
            } else if (b.type === 'image' && b.src) {
              inner += '<img src="' + b.src + '" style="width:100%; height:200px; object-fit:cover; border-radius:6px; margin:8px 0;" />';
            }
          }
        }

        let hotspotsHtml = '';
        if (page.hotspots) {
          for (const h of page.hotspots) {
            hotspotsHtml += '<div class="hotspot-pin" style="left:' + h.x + '%; top:' + h.y + '%;" title="' + (h.label || '') + '" onclick="alert(\\\'' + (h.modal?.title || h.label || 'Hotspot') + '\\\\n' + (h.modal?.body || '') + '\\\')">●</div>';
          }
        }

        const bg = page.background?.color || 'var(--paper)';
        return '<div class="page-pane" style="background:' + bg + ';">' + inner + hotspotsHtml + '</div>';
      }

      spreadEl.innerHTML = renderPageHtml(leftPage) + renderPageHtml(rightPage);
      indicatorEl.innerText = (currentSpread + 1) + ' / ' + totalSpreads;
    }

    function prevPage() {
      if (currentSpread > 0) {
        currentSpread--;
        renderSpread();
      }
    }

    function nextPage() {
      if (currentSpread < totalSpreads - 1) {
        currentSpread++;
        renderSpread();
      }
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') nextPage();
      if (e.key === 'ArrowLeft') prevPage();
    });

    renderSpread();
  </script>
</body>
</html>`
}
