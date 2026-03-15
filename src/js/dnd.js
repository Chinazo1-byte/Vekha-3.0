// ══════════════════════════════════════════════════════════════════════════════
//  DnD — утилита перетаскивания на pointer events (мышь + тач)
// ══════════════════════════════════════════════════════════════════════════════

const DnD = (() => {
  let _dragging  = null;  // { data, ghost, sourceEl, onDragEnd }
  let _lastTarget = null;

  // Создаём призрак — визуальную копию элемента, следующую за пальцем/курсором
  function _createGhost(el, clientX, clientY) {
    const rect = el.getBoundingClientRect();
    const ghost = el.cloneNode(true);
    ghost.style.cssText = [
      'position:fixed',
      `left:${rect.left}px`,
      `top:${rect.top}px`,
      `width:${rect.width}px`,
      `height:${rect.height}px`,
      'pointer-events:none',
      'z-index:9999',
      'opacity:0.88',
      'transform:scale(1.06)',
      'transition:transform .1s',
      'box-shadow:0 10px 36px rgba(0,0,0,.22)',
      'border-radius:inherit',
    ].join(';');
    document.body.appendChild(ghost);
    return {
      el,
      ghost,
      offsetX: clientX - rect.left,
      offsetY: clientY - rect.top,
    };
  }

  function _moveGhost(g, clientX, clientY) {
    g.ghost.style.left = (clientX - g.offsetX) + 'px';
    g.ghost.style.top  = (clientY - g.offsetY) + 'px';
  }

  // Найти drop-target под координатой (пропускаем призрак)
  function _targetAt(clientX, clientY) {
    const els = document.elementsFromPoint(clientX, clientY);
    for (const el of els) {
      if (el._dndTarget) return el;
    }
    return null;
  }

  function _onPointerMove(e) {
    if (!_dragging) return;
    e.preventDefault();
    _moveGhost(_dragging.ghost, e.clientX, e.clientY);

    const target = _targetAt(e.clientX, e.clientY);
    if (target !== _lastTarget) {
      if (_lastTarget) {
        _lastTarget._dndTarget.onDragLeave?.(_lastTarget);
        _lastTarget.classList.remove('dnd-over');
      }
      if (target) {
        target._dndTarget.onDragOver?.(_dragging.data, target);
        target.classList.add('dnd-over');
      }
      _lastTarget = target;
    }
  }

  function _onPointerUp(e) {
    if (!_dragging) return;
    document.removeEventListener('pointermove', _onPointerMove);
    document.removeEventListener('pointerup',   _onPointerUp);

    const target = _targetAt(e.clientX, e.clientY);

    if (_lastTarget) {
      _lastTarget.classList.remove('dnd-over');
      if (_lastTarget !== target) {
        _lastTarget._dndTarget.onDragLeave?.(_lastTarget);
      }
    }
    if (target) {
      target.classList.remove('dnd-over');
      target._dndTarget.onDrop?.(_dragging.data, target);
    }

    _dragging.sourceEl.classList.remove('dnd-dragging');
    _dragging.ghost.ghost.remove();
    _dragging.onDragEnd?.(_dragging.data, !!target);
    _dragging  = null;
    _lastTarget = null;
  }

  return {
    /**
     * Сделать элемент источником перетаскивания.
     * @param {HTMLElement} el
     * @param {{ data: any, onDragStart?: (data)=>void, onDragEnd?: (data, dropped)=>void }} opts
     */
    makeDraggable(el, opts = {}) {
      el.style.touchAction = 'none';
      el.style.userSelect  = 'none';
      if (!el.style.cursor) el.style.cursor = 'grab';
      el._dndDraggable = opts;

      const onDown = (e) => {
        // Только основная кнопка мыши или тач
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();

        const g = _createGhost(el, e.clientX, e.clientY);
        el.classList.add('dnd-dragging');
        opts.onDragStart?.(opts.data);

        _dragging = {
          data:      opts.data,
          ghost:     g,
          sourceEl:  el,
          onDragEnd: opts.onDragEnd,
        };
        _lastTarget = null;

        document.addEventListener('pointermove', _onPointerMove, { passive: false });
        document.addEventListener('pointerup',   _onPointerUp);
      };

      el.addEventListener('pointerdown', onDown);
      el._dndRemove = () => el.removeEventListener('pointerdown', onDown);
    },

    /**
     * Сделать элемент зоной сброса.
     * @param {HTMLElement} el
     * @param {{ onDragOver?: (data,el)=>void, onDrop: (data,el)=>void, onDragLeave?: (el)=>void }} opts
     */
    makeDropTarget(el, opts = {}) {
      el._dndTarget = opts;
    },

    /**
     * Убрать все DnD-обработчики внутри контейнера.
     * @param {HTMLElement} container
     */
    cleanup(container) {
      if (!container) return;
      container.querySelectorAll('*').forEach(el => {
        el._dndRemove?.();
        delete el._dndDraggable;
        delete el._dndTarget;
      });
    },

    /** Текущие данные перетаскивания (или null) */
    get dragging() { return _dragging?.data ?? null; },
  };
})();

window.DnD = DnD;
