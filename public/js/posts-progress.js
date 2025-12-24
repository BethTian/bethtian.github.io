

(function () {
  'use strict';

  // ========== 配置 ==========
  var SENSITIVITY = 0.15; // 越大越不易切换，0.12-0.25 范围常用
  var ROOT_MARGIN = '0px 0px -60% 0px';
  var THRESHOLDS = [0.05, 0.12, 0.25, 0.5];
  // ===========================

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    /* ------------------------
       Part A — 保持原有 inline-dot 行为
       ------------------------ */
    var postsList = document.getElementById('posts-list') || document.getElementById('site-listing');
    var items = postsList ? Array.prototype.slice.call(postsList.querySelectorAll('.post-item, .list-item, article')) : [];
    if (!items.length) {
      // 即使没有文章，继续尝试处理侧边轨道（下方）
      items = [];
    }

    var itemDots = items.map(function (it) {
      return it.querySelector('.post-inline-dot');
    });

    function clearActiveInline() {
      items.forEach(function (it) { it.classList.remove('is-active'); it.removeAttribute('aria-current'); });
      itemDots.forEach(function (d) { if (d) d.classList.remove('is-active'); });
    }

    function setActiveInline(i) {
      i = Math.max(0, Math.min(items.length - 1, i));
      clearActiveInline();
      var it = items[i];
      var d = itemDots[i];
      if (it) {
        it.classList.add('is-active');
        it.setAttribute('aria-current', 'true');
      }
      if (d) d.classList.add('is-active');
      // 当 inline active 改变时，我们也希望尝试同步侧边 handle（如果存在）
      syncSideHandleToIndex(i);
    }

    var activeIndex = 0;
    if (items.length) setActiveInline(activeIndex);

    itemDots.forEach(function (d, idx) {
      if (!d) return;
      d.addEventListener('click', function (e) {
        e.preventDefault();
        var it = items[idx];
        if (it) {
          it.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setActiveInline(idx);
        }
      });
    });

    /* IntersectionObserver for inline dots */
    if ('IntersectionObserver' in window && items.length) {
      var ioInline = new IntersectionObserver(function (entries) {
        var candidate = null;
        entries.forEach(function (ent) {
          if (!ent.isIntersecting) return;
          if (ent.intersectionRatio < SENSITIVITY) return;
          if (!candidate || ent.intersectionRatio > candidate.intersectionRatio) candidate = ent;
        });
        if (candidate && candidate.target) {
          var idx = items.indexOf(candidate.target);
          if (idx !== -1 && idx !== activeIndex) {
            activeIndex = idx;
            setActiveInline(activeIndex);
          }
        }
      }, { root: null, rootMargin: ROOT_MARGIN, threshold: THRESHOLDS });

      items.forEach(function (it) { ioInline.observe(it); });
    } else if (items.length) {
      // fallback scroll-based
      var ticking = false;
      window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(function () {
          var winTop = window.scrollY + window.innerHeight * 0.15;
          var bestIdx = 0, bestDist = Infinity;
          items.forEach(function (it, i) {
            var r = it.getBoundingClientRect();
            var elTop = r.top + window.scrollY;
            var dist = Math.abs(elTop - winTop);
            if (dist < bestDist) { bestDist = dist; bestIdx = i; }
          });
          if (bestIdx !== activeIndex) {
            activeIndex = bestIdx;
            setActiveInline(activeIndex);
          }
          ticking = false;
        });
      }, { passive: true });
    }

    /* ------------------------
       Part B — 侧边轨道 handle 同步与移动（如果存在）
       ------------------------ */

    var track = document.querySelector('.posts-progress-track') || document.getElementById('posts-progress-track');
    var markersContainer = document.getElementById('track-markers') || (track && track.querySelector('.track-markers'));
    var markerEls = markersContainer ? Array.prototype.slice.call(markersContainer.querySelectorAll('.track-marker')) : [];
    var handle = document.getElementById('track-handle') || (track && track.querySelector('.track-handle'));

    // 如果 track 存在但 handle 不存在，则创建一个 handle（防止 CSS 仅画了 rail/markers）
    if (track && !handle) {
      handle = document.createElement('div');
      handle.id = 'track-handle';
      handle.className = 'track-handle';
      track.appendChild(handle);
    }

    // 计算 marker 的像素位置（相对于 track）
    function computeMarkerPositions() {
      markerEls = markersContainer ? Array.prototype.slice.call(markersContainer.querySelectorAll('.track-marker')) : [];
      var positions = [];
      if (!track) return positions;
      var trackRect = track.getBoundingClientRect();
      var trackTop = trackRect.top + window.scrollY;
      markerEls.forEach(function (m) {
        // 优先用 offsetTop（常见情况）；回退到 getBoundingClientRect 计算
        var top;
        try { top = m.offsetTop; } catch (e) { top = null; }
        if (!top && top !== 0) {
          top = m.getBoundingClientRect().top + window.scrollY - trackTop;
        } else {
          // 如果 offsetTop 是相对于 markersContainer，需要再减去 markersContainer offsetTop
          if (m.offsetParent && m.offsetParent !== track && markersContainer) {
            top = (m.getBoundingClientRect().top + window.scrollY) - trackTop;
          }
        }
        positions.push(Math.round(top || 0));
      });
      return positions;
    }

    var markerPositions = computeMarkerPositions();

    // 当我们要把侧边 handle 移到某个 index 时调用
    function moveSideHandleToIndex(i) {
      if (!handle || !markerPositions.length) return;
      i = Math.max(0, Math.min(markerPositions.length - 1, i));
      var y = markerPositions[i] || 0;
      handle.style.transform = 'translate(-50%, ' + y + 'px)';
      // 同步 marker 的 is-active class
      markerEls.forEach(function (m, idx) {
        if (idx === i) m.classList.add('is-active'); else m.classList.remove('is-active');
      });
    }

    // 用于从 inline active index 同步到侧边 handle
    function syncSideHandleToIndex(i) {
      // 如果侧边没有 markers/handle，什么也不做
      if (!track || !markerEls.length || !handle) return;
      // clamp index to marker count if they match; otherwise try to map proportionally
      var n = markerEls.length;
      if (n === items.length && items.length) {
        moveSideHandleToIndex(i);
      } else if (n > 0 && items.length > 0) {
        // map i (0..items.length-1) -> fracIndex on markers (0..n-1)
        var frac = (i / Math.max(1, items.length - 1)) * (n - 1);
        var lower = Math.floor(frac), upper = Math.min(n - 1, lower + 1), t = frac - lower;
        var yLower = markerPositions[lower] || 0;
        var yUpper = markerPositions[upper] || yLower;
        var y = Math.round(yLower + (yUpper - yLower) * t);
        handle.style.transform = 'translate(-50%, ' + y + 'px)';
        // set nearest active marker
        var nearest = Math.round(frac);
        markerEls.forEach(function (m, idx) {
          if (idx === nearest) m.classList.add('is-active'); else m.classList.remove('is-active');
        });
      }
    }

    // IntersectionObserver 也会用来驱动侧边 handle（如果 post items 和 markers 数量相等且顺序一致）
    if ('IntersectionObserver' in window && items.length && markerEls.length && items.length === markerEls.length) {
      // reuse ioInline if available? we'll create a separate observer for clarity
      var ioSide = new IntersectionObserver(function (entries) {
        var candidate = null;
        entries.forEach(function (ent) {
          if (!ent.isIntersecting) return;
          if (ent.intersectionRatio < SENSITIVITY) return;
          if (!candidate || ent.intersectionRatio > candidate.intersectionRatio) candidate = ent;
        });
        if (candidate && candidate.target) {
          var idx = items.indexOf(candidate.target);
          if (idx !== -1) {
            syncSideHandleToIndex(idx);
          }
        }
      }, { root: null, rootMargin: ROOT_MARGIN, threshold: THRESHOLDS });

      items.forEach(function (it) { ioSide.observe(it); });
    } else {
      // fallback: on scroll we map viewport position -> nearest item -> move handle
      var ticking2 = false;
      window.addEventListener('scroll', function () {
        if (!markerEls.length || !items.length) return;
        if (ticking2) return;
        ticking2 = true;
        requestAnimationFrame(function () {
          var ref = window.scrollY + window.innerHeight * 0.12;
          var best = 0, bestDist = Infinity;
          items.forEach(function (it, i) {
            var r = it.getBoundingClientRect();
            var elTop = r.top + window.scrollY;
            var dist = Math.abs(elTop - ref);
            if (dist < bestDist) { bestDist = dist; best = i; }
          });
          syncSideHandleToIndex(best);
          ticking2 = false;
        });
      }, { passive: true });
    }

    // recompute marker positions on resize / mutation
    function recomputeAll() {
      markerEls = markersContainer ? Array.prototype.slice.call(markersContainer.querySelectorAll('.track-marker')) : [];
      markerPositions = computeMarkerPositions();
      // clamp activeIndex
      if (activeIndex >= markerEls.length) activeIndex = Math.max(0, markerEls.length - 1);
      // move handle to current
      syncSideHandleToIndex(activeIndex);
    }

    window.addEventListener('resize', function () {
      clearTimeout(window.__pp_recompute_timer);
      window.__pp_recompute_timer = setTimeout(recomputeAll, 120);
    });

    // ensure positions computed after fonts/images load
    setTimeout(recomputeAll, 250);
    setTimeout(recomputeAll, 800);

    // watch for marker DOM changes
    if (markersContainer) {
      var mo = new MutationObserver(function () { recomputeAll(); });
      mo.observe(markersContainer, { childList: true, subtree: true });
    }

  }); // ready
})();
