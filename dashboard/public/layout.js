/**
 * Page layout behaviour shared by every dashboard page, ported from the
 * homelab dashboard (Home-Landing-Page sections.js / sortable.js / the
 * System Overview panel chooser) and made page-agnostic:
 *
 *  - Sections: every `section.section[id]` with a `.section-header` inside
 *    `#mainContent` gets a ▾/▸ collapse toggle (which doubles as a drag
 *    handle to reorder sections) and ▲/▼ move buttons. A section named in
 *    `#mainContent[data-pinned]` stays first and cannot be moved.
 *  - Sortable grids: children `[data-sort-id]` of any `[data-sortable]`
 *    grid get a ⋮⋮ drag handle and can be reordered.
 *  - Panel chooser: a `<details class="panel-chooser" data-for="gridId">`
 *    is filled with one show/hide checkbox per panel of that grid.
 *
 * State (collapsed sections, orders, hidden panels) is kept per page in
 * localStorage, so it survives reloads but stays in this browser.
 * Load after vendor/Sortable.min.js; without SortableJS everything except
 * dragging still works.
 */

(function initLayout() {
  const PAGE = (window.location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '');
  const key = (name) => `aszune_${PAGE}_${name}`;

  function load(name, fallback) {
    try {
      const raw = localStorage.getItem(key(name));
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function save(name, value) {
    try {
      localStorage.setItem(key(name), JSON.stringify(value));
    } catch {
      // storage unavailable (private mode / quota): the layout lasts for this visit only
    }
  }

  const hasSortable = () => typeof Sortable !== 'undefined';

  // ---------------------------------------------------------------- Sections

  const Sections = {
    main: null,
    pinnedId: null,

    init() {
      this.main = document.getElementById('mainContent');
      if (!this.main) return;
      this.pinnedId = this.main.dataset.pinned || null;

      const collapsed = new Set(load('collapsed_sections', []));
      this.sections().forEach((section) => this.decorate(section, collapsed));

      this.applyOrder();
      this.initSorting();
      this.updateMoveButtons();
    },

    /** Direct-child sections of #mainContent, in page order */
    sections() {
      return [...this.main.querySelectorAll(':scope > section.section[id]')];
    },

    movable() {
      return this.sections().filter((s) => s.id !== this.pinnedId);
    },

    decorate(section, collapsed) {
      const header = section.querySelector(':scope > .section-header');
      if (!header || header.querySelector('.section-collapse-toggle')) return;

      const title = section.querySelector('.section-title')?.textContent.trim() || 'section';
      const pinned = section.id === this.pinnedId;
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = pinned
        ? 'section-collapse-toggle section-collapse-toggle--pinned'
        : 'section-collapse-toggle';
      toggle.title = pinned ? 'Click to collapse' : 'Drag to reorder · click to collapse';
      this.applyState(section, toggle, collapsed.has(section.id), title);

      toggle.addEventListener('click', () => {
        const nowCollapsed = !section.classList.contains('collapsed');
        this.applyState(section, toggle, nowCollapsed, title);
        const set = new Set(load('collapsed_sections', []));
        if (nowCollapsed) set.add(section.id);
        else set.delete(section.id);
        save('collapsed_sections', [...set]);
      });

      header.insertBefore(toggle, header.firstChild);
      if (!pinned && this.movable().length > 1) {
        header.appendChild(this.moveButtons(section, title));
      }
    },

    applyState(section, toggle, isCollapsed, title) {
      section.classList.toggle('collapsed', isCollapsed);
      toggle.setAttribute('aria-expanded', String(!isCollapsed));
      toggle.setAttribute('aria-label', `${isCollapsed ? 'Expand' : 'Collapse'} ${title} section`);
      toggle.textContent = isCollapsed ? '▸' : '▾';
    },

    moveButtons(section, title) {
      const group = document.createElement('div');
      group.className = 'stack-move-group';
      [
        [-1, '▲', 'up'],
        [1, '▼', 'down'],
      ].forEach(([direction, glyph, word]) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'stack-move section-move';
        btn.dataset.move = String(direction);
        btn.title = `Move section ${word}`;
        btn.setAttribute('aria-label', `Move ${title} section ${word}`);
        btn.textContent = glyph;
        btn.addEventListener('click', () => this.move(section, direction));
        group.appendChild(btn);
      });
      return group;
    },

    move(section, direction) {
      const list = this.movable();
      const target = list[list.indexOf(section) + direction];
      if (!target) return;
      if (direction < 0) target.before(section);
      else target.after(section);
      this.saveOrder();
      this.updateMoveButtons();
      section.querySelector(`.section-move[data-move="${direction}"]`)?.focus();
    },

    updateMoveButtons() {
      const list = this.movable();
      list.forEach((section, i) => {
        section
          .querySelector('.section-move[data-move="-1"]')
          ?.toggleAttribute('disabled', i === 0);
        section
          .querySelector('.section-move[data-move="1"]')
          ?.toggleAttribute('disabled', i === list.length - 1);
      });
    },

    saveOrder() {
      save(
        'section_order',
        this.sections().map((s) => s.id)
      );
    },

    /** Put the sections back in the saved order, keeping them where they sit in the page */
    applyOrder() {
      const current = this.sections();
      if (current.length < 2) return;
      const saved = load('section_order', []);
      const ordered = [
        ...saved.map((id) => current.find((s) => s.id === id)).filter(Boolean),
        ...current.filter((s) => !saved.includes(s.id)),
      ];
      const pinned = ordered.find((s) => s.id === this.pinnedId);
      const final = pinned ? [pinned, ...ordered.filter((s) => s !== pinned)] : ordered;
      // Re-insert at the first section's position so content after the sections stays after them
      const anchor = document.createComment('sections');
      current[0].before(anchor);
      final.forEach((s) => anchor.before(s));
      anchor.remove();
    },

    initSorting() {
      if (!hasSortable() || this.movable().length < 2) return;
      const pinnedSel = this.pinnedId ? `:not(#${CSS.escape(this.pinnedId)})` : '';
      Sortable.create(this.main, {
        draggable: `section.section${pinnedSel}`,
        handle: '.section-collapse-toggle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        // Press-and-hold before a drag starts, so a quick click still collapses
        delay: 200,
        delayOnTouchOnly: false,
        touchStartThreshold: 4,
        onMove: (evt) => !this.pinnedId || evt.related?.id !== this.pinnedId || evt.willInsertAfter,
        onEnd: () => {
          this.saveOrder();
          this.updateMoveButtons();
        },
      });
    },
  };

  // ------------------------------------------------------ Sortable panel grids

  function panelTitle(panel) {
    return (
      panel.dataset.title ||
      panel.querySelector('h3, .card-title, .panel-title')?.textContent.trim() ||
      panel.dataset.sortId
    );
  }

  function initGrid(grid) {
    const items = () => [...grid.querySelectorAll(':scope > [data-sort-id]')];

    items().forEach((item) => {
      if (item.querySelector(':scope > .drag-handle')) return;
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'drag-handle';
      handle.title = 'Drag to reorder';
      handle.setAttribute('aria-label', `Drag to reorder ${panelTitle(item)}`);
      handle.textContent = '⋮⋮';
      item.appendChild(handle);
    });

    // Saved order first; panels added since keep their place at the end
    const byId = new Map(items().map((el) => [el.dataset.sortId, el]));
    const saved = load(`order_${grid.id}`, []);
    saved.forEach((id) => {
      const el = byId.get(id);
      if (el) grid.appendChild(el);
    });
    items()
      .filter((el) => !saved.includes(el.dataset.sortId))
      .forEach((el) => grid.appendChild(el));

    if (!hasSortable()) return;
    Sortable.create(grid, {
      draggable: '[data-sort-id]',
      handle: '.drag-handle',
      animation: 150,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      delay: 100,
      delayOnTouchOnly: true,
      onStart: () => document.body.classList.add('is-sorting'),
      onEnd: () => {
        document.body.classList.remove('is-sorting');
        save(
          `order_${grid.id}`,
          items().map((el) => el.dataset.sortId)
        );
      },
    });
  }

  // ------------------------------------------------------------ Panel chooser

  function initChooser(chooser) {
    const grid = document.getElementById(chooser.dataset.for);
    if (!grid) return;

    let options = chooser.querySelector('.panel-chooser-options');
    if (!options) {
      options = document.createElement('div');
      options.className = 'panel-chooser-options';
      chooser.appendChild(options);
    }
    options.innerHTML = '';

    const storeKey = `hidden_${grid.id}`;
    const hidden = new Set(load(storeKey, []));

    grid.querySelectorAll(':scope > [data-sort-id]').forEach((panel) => {
      const id = panel.dataset.sortId;
      panel.hidden = hidden.has(id);

      const label = document.createElement('label');
      label.className = 'panel-chooser-item';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = !panel.hidden;
      checkbox.addEventListener('change', () => {
        const set = new Set(load(storeKey, []));
        if (checkbox.checked) set.delete(id);
        else set.add(id);
        panel.hidden = !checkbox.checked;
        save(storeKey, [...set]);
      });
      label.append(checkbox, document.createTextNode(` ${panelTitle(panel)}`));
      options.appendChild(label);
    });
  }

  function init() {
    Sections.init();
    document.querySelectorAll('[data-sortable][id]').forEach(initGrid);
    document.querySelectorAll('details.panel-chooser[data-for]').forEach(initChooser);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
