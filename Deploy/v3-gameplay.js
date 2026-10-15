/* V3 GamePlay shell — UI bind only (engine rules untouched).
 * Depends on globals from index.html: S, $, me, selectBid, lockHumanBid,
 * composeCardSvgInlined (or composeCardSvg), playSfx, playHover, shuffle,
 * MAX_POLLUTION, localHumanBid, playMode, isHost, syncChronicleUI,
 * toggleChronicle, toggleMute, unlockAudio
 */
(function (global) {
  'use strict';

  const GAMEPLAY_SVG_V3 = 'Asset/GamePlay/GamePlaySVG.svg';
  const V3_BG_DEFAULT = 'Asset/Seat/BackGround/BackGroup_Default_1.png';
  const V3_CHAR_DEFAULT = 'Asset/Seat/Character/Character_Default.png';
  const NS = 'http://www.w3.org/2000/svg';
  const XLINK = 'http://www.w3.org/1999/xlink';
  const OUTLINE = {
    fill: '#FFFFFF',
    stroke: '#1a0a22',
    strokeWidth: '2.4'
  };

  let gamePlayReady = false;
  let gamePlayLoading = null;
  let v3SeatMap = null;
  let v3CardDrag = { dx: 0, dy: 0, scale: 1, base: null };
  const CARD_SCALE_MIN = 0.55;
  const CARD_SCALE_MAX = 2.6;
  let v3BoardCenterVisible = true;
  let v3PrevCardToken = '';
  let v3ShowCardToken = '';
  let v3BidWired = false;
  let v3BlobUrls = [];

  function gpRoot() {
    return document.getElementById('gamePlayHost')?.querySelector('svg');
  }

  function svgOpacity(el, on) {
    if (!el) return;
    el.style.opacity = on ? '1' : '0';
    el.style.pointerEvents = on ? 'auto' : 'none';
    if (on) el.removeAttribute('display');
  }

  function svgSetFirstTspan(el, text) {
    if (!el) return;
    const tspan = el.querySelector('tspan');
    if (tspan) tspan.textContent = String(text ?? '');
    else {
      const textEl = el.querySelector('text');
      if (textEl) textEl.textContent = String(text ?? '');
    }
  }

  function findTspan(root, exact) {
    if (!root) return null;
    return [...root.querySelectorAll('tspan')].find(ts => (ts.textContent || '') === exact) || null;
  }

  function setTspanText(tspan, text) {
    if (tspan) tspan.textContent = String(text ?? '');
  }

  /** White fill + dark thin stroke outline on text/tspan. */
  function styleOutlinedText(textOrTspan) {
    if (!textOrTspan) return;
    const targets = [];
    if (textOrTspan.tagName && textOrTspan.tagName.toLowerCase() === 'tspan') {
      targets.push(textOrTspan);
      if (textOrTspan.parentElement) targets.push(textOrTspan.parentElement);
    } else {
      targets.push(textOrTspan);
      textOrTspan.querySelectorAll?.('tspan').forEach(ts => targets.push(ts));
    }
    targets.forEach(el => {
      el.setAttribute('fill', OUTLINE.fill);
      el.setAttribute('stroke', OUTLINE.stroke);
      el.setAttribute('stroke-width', OUTLINE.strokeWidth);
      el.setAttribute('paint-order', 'stroke fill');
      el.style.paintOrder = 'stroke fill';
      el.removeAttribute('fill-opacity');
      el.style.fillOpacity = '1';
    });
  }

  function ensureImage(group, id, href, box) {
    if (!group) return null;
    let img = group.querySelector('image.' + id);
    if (!img) {
      img = document.createElementNS(NS, 'image');
      img.setAttribute('class', id);
      img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      img.style.pointerEvents = 'none';
      group.appendChild(img);
    }
    img.setAttribute('x', String(box.x));
    img.setAttribute('y', String(box.y));
    img.setAttribute('width', String(box.w));
    img.setAttribute('height', String(box.h));
    img.setAttributeNS(XLINK, 'href', href);
    img.setAttribute('href', href);
    return img;
  }

  /** Hide pink mock fills (#FF80B3 / #FFC7DD) under a seat slot once real art is injected. */
  function hidePlaceholderFills(group) {
    if (!group) return;
    group.querySelectorAll('use').forEach(u => {
      u.style.opacity = '0';
      u.setAttribute('opacity', '0');
    });
    group.querySelectorAll('path, rect').forEach(p => {
      const fill = (p.getAttribute('fill') || '').toUpperCase();
      if (fill === '#FF80B3' || fill === '#FFC7DD') {
        p.style.opacity = '0';
        p.setAttribute('opacity', '0');
      }
    });
  }

  function reparentV3Seats(svg) {
    for (let max = 3; max <= 7; max++) {
      const pack = svg.querySelector('#MaskSIzePlayer_' + max);
      if (!pack) continue;
      for (let seat = 1; seat <= max; seat++) {
        const node = svg.querySelector('#MaskPlayer_' + seat + '_' + max);
        if (node && node.parentNode !== pack) pack.appendChild(node);
      }
    }
  }

  function prepareResolveTextLayout(svg) {
    const resolveEl = svg.querySelector('#resolve_Text');
    if (!resolveEl) return;
    const textEl = resolveEl.querySelector('text');
    const tspan = resolveEl.querySelector('tspan');
    if (!textEl || !tspan) return;

    // Center in Board_Center column: middle-anchor on clip center (or 0)
    let cx = 0;
    const clipAttr = textEl.getAttribute('clip-path') || '';
    const m = clipAttr.match(/url\(#([^)]+)\)/);
    if (m) {
      const clip = svg.getElementById(m[1]) || resolveEl.querySelector('#' + CSS.escape(m[1]));
      const rect = clip && clip.querySelector('rect');
      if (rect) {
        const x = parseFloat(rect.getAttribute('x') || '0');
        const w = parseFloat(rect.getAttribute('width') || '0');
        if (Number.isFinite(x) && Number.isFinite(w) && w > 0) cx = x + w / 2;
      }
    }
    textEl.setAttribute('text-anchor', 'middle');
    tspan.setAttribute('text-anchor', 'middle');
    tspan.setAttribute('x', String(+cx.toFixed(2)));
    styleOutlinedText(tspan);
    tspan.setAttribute('fill-opacity', '0'); // start hidden; sync restores
  }

  function prepareGamePlaySvgV3(host) {
    const svg = host.querySelector('svg');
    if (!svg) return;
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('viewBox', '0 0 1280 720');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    reparentV3Seats(svg);
    prepareResolveTextLayout(svg);

    svgOpacity(svg.querySelector('#resolve_Text'), false);
    svgOpacity(svg.querySelector('#ToxicNumber'), false);
    svgOpacity(svg.querySelector('#Card_ShowNow'), false);
    svgOpacity(svg.querySelector('#Card_Previous'), false);
    // Shadow_card removed from UX — never show / never intercept clicks
    disableShadowCard(svg);

    for (let n = 3; n <= 7; n++) {
      svgOpacity(svg.querySelector('#MaskSIzePlayer_' + n), false);
    }

    // Keep Card_ShowNow above Board_Center so toggle pile does not hide the auction card
    promoteFocusLayers(svg);
    applyBoardCenterVisibility();
    wireCardDrag(svg.querySelector('#Card_ShowNow'));
  }

  /** Permanently hide Shadow_card (no dim overlay). */
  function disableShadowCard(svg) {
    const shadow = svg && svg.querySelector('#Shadow_card');
    if (!shadow) return;
    shadow.style.opacity = '0';
    shadow.style.pointerEvents = 'none';
    shadow.setAttribute('opacity', '0');
    shadow.setAttribute('display', 'none');
    shadow.setAttribute('visibility', 'hidden');
  }

  /** Card_ShowNow lives inside Board_Center in the art file — lift it to SVG root (above board). */
  function promoteFocusLayers(svg) {
    if (!svg) return;
    const board = svg.querySelector('#Board_Center');
    const show = svg.querySelector('#Card_ShowNow');
    const parent = (board && board.parentNode) || svg;
    if (board && board.parentNode !== parent) parent.appendChild(board);
    if (show) parent.appendChild(show);
    disableShadowCard(svg);
  }

  function applyBoardCenterVisibility() {
    const svg = gpRoot();
    if (!svg) return;
    svgOpacity(svg.querySelector('#Board_Center'), v3BoardCenterVisible);
    const btn = document.getElementById('v2BoardToggleBtn');
    if (btn) {
      btn.classList.toggle('is-on', v3BoardCenterVisible);
      const tip = v3BoardCenterVisible ? 'ปิดกองกลาง' : 'เปิดกองกลาง';
      btn.title = tip;
      btn.setAttribute('data-tip', tip);
      btn.setAttribute('aria-pressed', v3BoardCenterVisible ? 'true' : 'false');
    }
  }

  function setBoardCenterVisible(on) {
    v3BoardCenterVisible = !!on;
    applyBoardCenterVisibility();
  }

  function toggleBoardCenter() {
    setBoardCenterVisible(!v3BoardCenterVisible);
    return v3BoardCenterVisible;
  }

  /** Reset Card_ShowNow drag offset + zoom to authored position. */
  function resetCardTransform() {
    v3CardDrag.dx = 0;
    v3CardDrag.dy = 0;
    v3CardDrag.scale = 1;
    const show = gpRoot()?.querySelector('#Card_ShowNow');
    if (show) applyCardDragTransform(show, { clamp: false });
  }

  function wireCardDrag(cardEl) {
    if (!cardEl || cardEl.dataset.v3Drag === '1') return;
    cardEl.dataset.v3Drag = '1';
    cardEl.style.cursor = 'grab';
    let dragging = false;
    let start = null;

    const onDown = (e) => {
      if (cardEl.style.opacity === '0') return;
      dragging = true;
      cardEl.style.cursor = 'grabbing';
      const pt = pointerInSvg(cardEl.ownerSVGElement, e);
      start = { x: pt.x, y: pt.y, dx: v3CardDrag.dx, dy: v3CardDrag.dy };
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!dragging || !start) return;
      const pt = pointerInSvg(cardEl.ownerSVGElement, e);
      v3CardDrag.dx = start.dx + (pt.x - start.x);
      v3CardDrag.dy = start.dy + (pt.y - start.y);
      // Clamp only while dragging — not while zooming
      applyCardDragTransform(cardEl, { clamp: true });
    };
    const onUp = () => {
      dragging = false;
      cardEl.style.cursor = 'grab';
      start = null;
    };
    const onWheel = (e) => {
      if (cardEl.style.opacity === '0') return;
      e.preventDefault();
      e.stopPropagation();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      v3CardDrag.scale = Math.min(
        CARD_SCALE_MAX,
        Math.max(CARD_SCALE_MIN, (v3CardDrag.scale || 1) * factor)
      );
      // Zoom freely — do not shove card back when it hits the edge
      applyCardDragTransform(cardEl, { clamp: false });
    };
    cardEl.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    cardEl.addEventListener('wheel', onWheel, { passive: false });
  }

  function pointerInSvg(svg, e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  function cardTransformString(dx, dy, scale) {
    const base = (v3CardDrag.base || 'matrix( 1, 0, 0, 1, 0,0) ').replace(/\s*$/, '');
    const s = scale == null ? 1 : scale;
    return base + ' translate(' + dx + ',' + dy + ') scale(' + s + ')';
  }

  function applyCardDragTransform(cardEl, opts) {
    if (!cardEl) return;
    if (!v3CardDrag.base) {
      v3CardDrag.base = cardEl.getAttribute('transform') || 'matrix( 1, 0, 0, 1, 0,0) ';
    }
    if (!(v3CardDrag.scale > 0)) v3CardDrag.scale = 1;
    cardEl.setAttribute(
      'transform',
      cardTransformString(v3CardDrag.dx, v3CardDrag.dy, v3CardDrag.scale)
    );
    // Default: no clamp (sync / zoom). Drag pass opts.clamp = true.
    if (opts && opts.clamp) clampCardDragToView(cardEl);
  }

  /** Keep Card_ShowNow inside viewBox while dragging (not applied during zoom). */
  function clampCardDragToView(cardEl) {
    const svg = cardEl && cardEl.ownerSVGElement;
    if (!svg) return;
    // When zoomed past ~1, edge clamp fights scale — skip shove-back
    if ((v3CardDrag.scale || 1) > 1.05) return;
    const vb = svg.viewBox && svg.viewBox.baseVal;
    const minX = (vb ? vb.x : 0) + 8;
    const minY = (vb ? vb.y : 0) + 8;
    const maxX = (vb ? vb.x + vb.width : 1280) - 8;
    const maxY = (vb ? vb.y + vb.height : 720) - 8;

    const local = { x: -140, y: -200, w: 280, h: 400 };
    const toRoot = (x, y) => {
      const pt = svg.createSVGPoint();
      pt.x = x;
      pt.y = y;
      const m = cardEl.getCTM();
      const root = svg.getScreenCTM();
      if (!m || !root) return { x, y };
      try {
        return pt.matrixTransform(m).matrixTransform(root.inverse());
      } catch (_) {
        return { x, y };
      }
    };
    const corners = [
      toRoot(local.x, local.y),
      toRoot(local.x + local.w, local.y),
      toRoot(local.x, local.y + local.h),
      toRoot(local.x + local.w, local.y + local.h)
    ];
    const bx1 = Math.min(...corners.map(c => c.x));
    const by1 = Math.min(...corners.map(c => c.y));
    const bx2 = Math.max(...corners.map(c => c.x));
    const by2 = Math.max(...corners.map(c => c.y));

    let adjX = 0;
    let adjY = 0;
    if (bx1 < minX) adjX = minX - bx1;
    else if (bx2 > maxX) adjX = maxX - bx2;
    if (by1 < minY) adjY = minY - by1;
    else if (by2 > maxY) adjY = maxY - by2;

    if (!adjX && !adjY) return;
    v3CardDrag.dx += adjX;
    v3CardDrag.dy += adjY;
    cardEl.setAttribute(
      'transform',
      cardTransformString(v3CardDrag.dx, v3CardDrag.dy, v3CardDrag.scale)
    );
  }

  function ensureSeatOrder() {
    if (!S || !S.players) return;
    if (S.seatOrder && S.seatOrder.length === S.players.length) return;
    S.seatOrder = shuffle([...Array(S.players.length).keys()]);
    v3SeatMap = S.seatOrder;
  }

  function showPlayerPack(count) {
    const svg = gpRoot();
    if (!svg) return;
    for (let n = 3; n <= 7; n++) {
      const pack = svg.querySelector('#MaskSIzePlayer_' + n);
      svgOpacity(pack, n === count);
    }
  }

  function seatNode(seat1based, count) {
    return gpRoot()?.querySelector('#MaskPlayer_' + seat1based + '_' + count);
  }

  function hudInSeat(seatEl, baseId) {
    if (!seatEl) return null;
    return (
      seatEl.querySelector('[id="' + baseId + '"]') ||
      seatEl.querySelector('[id^="' + baseId + '"]')
    );
  }

  function nameTextInSeat(seatEl) {
    if (!seatEl) return null;
    return findTspan(seatEl, 'PLAYER NAME') ||
      [...seatEl.querySelectorAll('tspan')].find(ts => /PLAYER NAME/i.test(ts.textContent || ''));
  }

  function injectSeatDefaults(seatEl) {
    const bg = hudInSeat(seatEl, 'BackGroupPlayer');
    const ch = hudInSeat(seatEl, 'CharacterDesign');
    ensureImage(bg, 'v3-bg', V3_BG_DEFAULT, { x: -640, y: -360, w: 1280, h: 720 });
    ensureImage(ch, 'v3-char', V3_CHAR_DEFAULT, { x: -231, y: -231, w: 462, h: 462 });
    hidePlaceholderFills(bg);
    hidePlaceholderFills(ch);
  }

  function syncV3Players() {
    if (!S) return;
    ensureSeatOrder();
    const count = S.players.length;
    showPlayerPack(count);
    const order = S.seatOrder;
    const local = typeof me === 'function' ? me() : null;

    for (let seat = 1; seat <= count; seat++) {
      const seatEl = seatNode(seat, count);
      if (!seatEl) continue;
      svgOpacity(seatEl, true);
      injectSeatDefaults(seatEl);

      const pIdx = order[seat - 1];
      const p = S.players[pIdx];
      if (!p) continue;

      const isYou = local && p.id === local.id && !p.isBot;
      let name = p.name || ('P' + seat);
      if (isYou && !/\(You\)/i.test(name)) name = name + ' (You)';

      const nameTs = nameTextInSeat(seatEl);
      setTspanText(nameTs, name);
      styleOutlinedText(nameTs);

      const coinHud = hudInSeat(seatEl, 'Coin_Player');
      svgSetFirstTspan(coinHud, p.coins);
      styleOutlinedText(coinHud && coinHud.querySelector('tspan'));

      const popHud = hudInSeat(seatEl, 'popularity_Player');
      svgSetFirstTspan(popHud, p.stars);
      styleOutlinedText(popHud && popHud.querySelector('tspan'));

      const bidVal = (p.locked && p.bid != null) ? p.bid : '';
      const action = hudInSeat(seatEl, 'ActionCoin_Player');
      svgSetFirstTspan(action, bidVal === '' ? '' : bidVal);
      styleOutlinedText(action && action.querySelector('tspan'));
    }
  }

  function syncV3Toxic() {
    const svg = gpRoot();
    if (!svg || !S) return;
    const pol = Math.max(0, S.pollution | 0);
    const uniq = [...svg.querySelectorAll('[id^="Token_Toxic"]')].filter(el =>
      /^Token_Toxic(_FL)*$/.test(el.id)
    );

    const over = pol > 10;
    const toxicNum = svg.querySelector('#ToxicNumber');
    if (over) {
      uniq.forEach(el => svgOpacity(el, false));
      svgOpacity(toxicNum, true);
      const ts = toxicNum && toxicNum.querySelector('tspan');
      if (ts) {
        ts.textContent = 'Toxic : ' + pol;
        ts.setAttribute('fill-opacity', '1');
      }
    } else {
      svgOpacity(toxicNum, false);
      uniq.forEach((el, idx) => {
        if (idx >= 10) svgOpacity(el, false);
        else svgOpacity(el, idx < pol);
      });
    }
  }

  function syncV3TimerTurn() {
    const svg = gpRoot();
    if (!svg || !S) return;
    const board = svg.querySelector('#Board_Center') || svg;

    const turnTs = [...board.querySelectorAll('tspan')].find(ts => /Turn/i.test(ts.textContent || ''));
    if (turnTs) {
      turnTs.textContent = (S.round || 0) + ' Turn';
      styleOutlinedText(turnTs);
    }

    const sceTs = [...board.querySelectorAll('tspan')].find(ts =>
      /SCE|วินาที/i.test(ts.textContent || '') || /^\d+\s*SCE$/i.test(ts.textContent || '')
    );
    let sec = 0;
    if (S.timerLeft != null) sec = Math.ceil(Math.max(0, S.timerLeft));
    if (sceTs) sceTs.textContent = sec + ' SCE';

    const bar = svg.querySelector('#TimeBar_MockUp');
    if (bar) {
      const max = S.timerMax || 1;
      const pct = Math.max(0, Math.min(1, (Math.max(0, S.timerLeft || 0) / max)));
      const base = bar.dataset.v3BaseTf || bar.getAttribute('transform') || '';
      if (!bar.dataset.v3BaseTf) bar.dataset.v3BaseTf = base;
      bar.setAttribute('transform', bar.dataset.v3BaseTf);
      bar.style.opacity = String(0.35 + 0.65 * pct);
    }
  }

  function syncV3ResolveAndCoins() {
    const svg = gpRoot();
    if (!svg || !S) return;
    const resolving = S.phase === 'reveal' || S.phase === 'resolved';
    const bidding = S.phase === 'bidding';

    const resolveEl = svg.querySelector('#resolve_Text');
    svgOpacity(resolveEl, resolving);
    if (resolveEl) {
      const ts = resolveEl.querySelector('tspan');
      if (ts) {
        if (resolving) {
          ts.textContent = S.statusMsg || 'resolve Text';
          styleOutlinedText(ts);
          ts.setAttribute('fill-opacity', '1');
        } else {
          ts.setAttribute('fill-opacity', '0');
        }
      }
    }

    for (let i = 1; i <= 7; i++) {
      svgOpacity(svg.querySelector('#Coin_' + i + '_Btn_MockUp'), bidding && !resolving);
    }
    svgOpacity(svg.querySelector('#Coin_Lock'), bidding && !resolving);
    svgOpacity(svg.querySelector('#Coin_MockUp'), bidding && !resolving);

    if (bidding && !resolving) syncV3BidButtons();
  }

  function bidAmountForButton(btnIndex, wallet) {
    if (wallet <= 7) return btnIndex;
    if (btnIndex === 1) return 1;
    if (btnIndex === 2) return 2;
    const pct = { 3: 0.10, 4: 0.25, 5: 0.50, 6: 0.80, 7: 1.0 }[btnIndex] || 0;
    return Math.max(0, Math.min(wallet, Math.round(wallet * pct)));
  }

  function syncV3BidButtons() {
    const svg = gpRoot();
    if (!svg || !S) return;
    const player = typeof me === 'function' ? me() : null;
    const spectate = S.spectate || playMode === 'spectate';
    const wallet = player ? player.coins : 0;
    const locked = !!(player && player.locked);

    for (let i = 1; i <= 7; i++) {
      const btn = svg.querySelector('#Coin_' + i + '_Btn_MockUp');
      if (!btn) continue;
      const amount = bidAmountForButton(i, wallet);
      const affordable = !spectate && player && !player.isBot && amount >= 1 && amount <= wallet && (wallet <= 7 ? i <= wallet : true);
      svgOpacity(btn, !spectate && !!player && !player.isBot && affordable);
      const label = wallet <= 7 ? String(i) : (i <= 2 ? String(amount) : ({ 3: '10%', 4: '25%', 5: '50%', 6: '80%', 7: '100%' }[i]));
      svgSetFirstTspan(btn, label);
      btn.style.cursor = (!locked && affordable) ? 'pointer' : 'default';
      btn.style.opacity = (!affordable || locked) ? (affordable ? '0.55' : '0') : '1';
      if (typeof localHumanBid !== 'undefined' && localHumanBid === amount && affordable) {
        btn.style.filter = 'brightness(1.25)';
      } else {
        btn.style.filter = '';
      }
    }

    const lock = svg.querySelector('#Coin_Lock');
    if (lock) {
      const show = !spectate && player && !player.isBot;
      svgOpacity(lock, show);
      lock.style.cursor = (show && !locked) ? 'pointer' : 'default';
      svgSetFirstTspan(lock, locked ? ('✓' + player.bid) : 'Lock');
    }

    wireV3BidHits();
  }

  function wireV3BidHits() {
    const svg = gpRoot();
    if (!svg || v3BidWired) return;
    v3BidWired = true;
    for (let i = 1; i <= 7; i++) {
      const btn = svg.querySelector('#Coin_' + i + '_Btn_MockUp');
      if (!btn || btn.dataset.v3Wired === '1') continue;
      btn.dataset.v3Wired = '1';
      btn.classList.add('gp-hit');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!S || S.phase !== 'bidding') return;
        const player = me();
        if (!player || player.locked || player.isBot) return;
        const amount = bidAmountForButton(i, player.coins);
        if (amount < 1 || amount > player.coins) return;
        playSfx && playSfx('click', 0.6);
        selectBid(amount);
      });
      btn.addEventListener('pointerenter', () => playHover && playHover());
    }
    const lock = svg.querySelector('#Coin_Lock');
    if (lock && lock.dataset.v3Wired !== '1') {
      lock.dataset.v3Wired = '1';
      lock.classList.add('gp-hit');
      lock.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        lockHumanBid();
      });
      lock.addEventListener('pointerenter', () => playHover && playHover());
    }
  }

  function revokeBlob(url) {
    if (url && String(url).startsWith('blob:')) {
      try { URL.revokeObjectURL(url); } catch (_) {}
    }
  }

  function imageHref(el) {
    if (!el) return '';
    return el.getAttribute('href') || el.getAttributeNS(XLINK, 'href') || '';
  }

  /** Normalize composed SVG then raster via data: URI (no blob SVG as outer &lt;image&gt;). */
  function rasterizeSvgToPngDataUrl(svgMarkup, w, h) {
    return new Promise((resolve, reject) => {
      let svg = String(svgMarkup || '');
      if (!svg.includes('<svg')) {
        reject(new Error('not an svg'));
        return;
      }
      svg = svg.replace(/\sstyle="display:block;width:100%;height:100%;"/gi, '');
      if (!/\sxmlns=/.test(svg.slice(0, 280))) {
        svg = svg.replace(/<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      if (!/\sxmlns:xlink=/.test(svg.slice(0, 320))) {
        svg = svg.replace(/<svg\b/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
      }
      svg = svg.replace(/<svg\b([^>]*)>/i, (m, attrs) => {
        let a = attrs;
        if (!/\bwidth\s*=/.test(a)) a += ' width="' + w + '"';
        if (!/\bheight\s*=/.test(a)) a += ' height="' + h + '"';
        return '<svg' + a + '>';
      });

      const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error('SVG image load failed'));
      img.src = url;
    });
  }

  /**
   * Always return a PNG/data-URL safe for SVG &lt;image&gt;.
   * Never use blob: SVG (nested images / parse failures → broken icon).
   */
  async function composeCardFaceUrl(card) {
    try {
      const compose =
        (typeof composeCardSvgInlined === 'function' && composeCardSvgInlined) ||
        (typeof composeCardSvg === 'function' && composeCardSvg);
      if (!compose) throw new Error('no compose');
      const svgMarkup = await compose(card);
      const png = await rasterizeSvgToPngDataUrl(svgMarkup, 280, 400);
      if (png && png.indexOf('data:image/png') === 0) return png;
    } catch (err) {
      console.warn('V3 card full compose/raster failed', err);
    }
    // Fallback: card art bitmap only (still readable vs broken icon)
    try {
      if (typeof cardArtDataUrl === 'function') return await cardArtDataUrl(card);
      if (typeof fetchAsDataUrl === 'function' && typeof cardArtUrl === 'function') {
        return await fetchAsDataUrl(cardArtUrl(card));
      }
    } catch (err2) {
      console.warn('V3 card art fallback failed', err2);
    }
    throw new Error('card face unavailable');
  }

  async function setCardSlotImage(group, card) {
    if (!group) return;
    group.querySelectorAll(':scope > g').forEach(g => {
      if (!g.querySelector('image.v3-card-face')) {
        g.style.opacity = '0';
        g.setAttribute('opacity', '0');
      }
    });
    if (!card) {
      const img = group.querySelector('image.v3-card-face');
      if (img) {
        revokeBlob(imageHref(img));
        img.removeAttribute('href');
        img.removeAttributeNS(XLINK, 'href');
      }
      return;
    }
    try {
      const url = await composeCardFaceUrl(card);
      const prev = group.querySelector('image.v3-card-face');
      const oldHref = imageHref(prev);
      const img = ensureImage(group, 'v3-card-face', url, { x: -140, y: -200, w: 280, h: 400 });
      img.style.opacity = '1';
      img.setAttribute('opacity', '1');
      img.style.imageRendering = 'auto';
      group.querySelectorAll(':scope > g').forEach(g => {
        if (!g.contains(img)) {
          g.style.opacity = '0';
          g.setAttribute('opacity', '0');
        }
      });
      if (oldHref && oldHref !== url) revokeBlob(oldHref);
    } catch (err) {
      console.warn('V3 card compose failed', err);
    }
  }

  async function syncV3Cards() {
    const svg = gpRoot();
    if (!svg || !S) return;
    const show = svg.querySelector('#Card_ShowNow');
    const prev = svg.querySelector('#Card_Previous');
    const back = svg.querySelector('#Card_backCard');
    disableShadowCard(svg);

    const hasCard = !!(S.card && S.phase !== 'draw');
    const visibleNow = hasCard && (S.phase === 'bidding' || S.phase === 'reveal');
    svgOpacity(show, visibleNow);
    if (show) {
      show.style.pointerEvents = visibleNow ? 'auto' : 'none';
      applyCardDragTransform(show, { clamp: false });
    }

    const token = S.card ? String(S.card.uid || S.card.typeNum) + '|' + S.phase : '';
    if (visibleNow && S.card && token !== v3ShowCardToken) {
      v3ShowCardToken = token;
      await setCardSlotImage(show, S.card);
    }

    if (S.prevCard) {
      svgOpacity(prev, true);
      const ptok = String(S.prevCard.uid || S.prevCard.typeNum);
      if (ptok !== v3PrevCardToken) {
        v3PrevCardToken = ptok;
        await setCardSlotImage(prev, S.prevCard);
      }
    } else {
      svgOpacity(prev, false);
    }

    svgOpacity(back, true);
  }

  function syncV3GameShell() {
    if (!gamePlayReady || !S) return;
    syncV3Players();
    syncV3Toxic();
    syncV3TimerTurn();
    syncV3ResolveAndCoins();
    syncV3Cards();
    applyBoardCenterVisibility();
  }

  async function ensureGamePlayLoadedV3() {
    if (gamePlayReady) return true;
    if (gamePlayLoading) return gamePlayLoading;
    const host = document.getElementById('gamePlayHost');
    if (!host) return false;
    gamePlayLoading = (async () => {
      const res = await fetch(GAMEPLAY_SVG_V3);
      if (!res.ok) throw new Error('V3 GamePlaySVG load failed');
      host.innerHTML = await res.text();
      prepareGamePlaySvgV3(host);
      gamePlayReady = true;
      v3BidWired = false;
      return true;
    })().catch(err => {
      console.warn(err);
      gamePlayLoading = null;
      gamePlayReady = false;
      return false;
    });
    return gamePlayLoading;
  }

  async function applyV3GamePlaySkin() {
    const gs = document.getElementById('gameScreen');
    if (!gs) return;
    const ok = await ensureGamePlayLoadedV3();
    if (!ok) {
      gs.classList.remove('skin-v3-game');
      return;
    }
    gs.classList.add('skin-v3-game');
    gs.classList.remove('skin-v2-game');
    ['v2BidHost', 'v2LockHost', 'v2YouPlayer', 'playersPanel', 'tableArea'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
    syncV3GameShell();
  }

  function notePrevCardBeforeRound() {
    if (S && S.card) S.prevCard = S.card;
  }

  global.V3Shell = {
    ensureLoaded: ensureGamePlayLoadedV3,
    apply: applyV3GamePlaySkin,
    sync: syncV3GameShell,
    notePrevCard: notePrevCardBeforeRound,
    ensureSeatOrder,
    isReady: () => gamePlayReady,
    toggleBoardCenter,
    setBoardCenterVisible,
    isBoardCenterVisible: () => v3BoardCenterVisible,
    resetCardTransform
  };
})(window);
