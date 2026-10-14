window.__ModuleLoader__.load({
  id: '@ozqi/dsh-workspace-skill-policy',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'workspaceSkillPolicy';
    const KIND = 'skill-policy';
    const ID = '@ozqi/dsh-workspace-skill-policy';
    const ROUTE = 'api/workspace-skill-policy';

    const zh = {
      'type.label': 'Skill 策略',
      'guide.title': 'Skill 策略',
      'guide.description': '按当前 Session 开启或关闭 workspace skills',
      loading: '正在读取 skill…',
      empty: '没有发现 workspace skill',
      reload: '刷新',
      disabled: '已关闭',
      enabled: '已开启',
      workspace: '工作区',
      roots: '探测目录',
      noWorkspace: '无工作区',
      error: '读取失败：{message}',
      sourceDetected: '探测',
      sourceCatalog: '目录',
      modelOnly: '仅模型',
      userOnly: '仅用户',
    };
    const en = {
      'type.label': 'Skill policy',
      'guide.title': 'Skill policy',
      'guide.description': 'Enable or disable workspace skills for this Session',
      loading: 'Reading skills…',
      empty: 'No workspace skills found',
      reload: 'Reload',
      disabled: 'Disabled',
      enabled: 'Enabled',
      workspace: 'Workspace',
      roots: 'Detected roots',
      noWorkspace: 'No workspace',
      error: 'Load failed: {message}',
      sourceDetected: 'detected',
      sourceCatalog: 'catalog',
      modelOnly: 'model only',
      userOnly: 'user only',
    };

    function insertStyle(cssText) {
      if (typeof document === 'undefined') return () => {};
      const tag = document.createElement('style');
      tag.dataset.plugin = ID;
      tag.dataset.pluginCss = `${ID}/client.css`;
      tag.textContent = cssText;
      document.head.appendChild(tag);
      return () => { tag.remove(); };
    }

    function Icon({ size = 16 }) {
      return h('svg', { viewBox: '0 0 16 16', width: size, height: size, fill: 'none', 'aria-hidden': true },
        h('path', { d: 'M3 3h10v10H3z', stroke: 'currentColor', strokeWidth: 1.4, rx: 2 }),
        h('path', { d: 'M5 6h5M5 9h3', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' }),
        h('path', { d: 'M10.5 10.5l2 2M12.5 10.5l-2 2', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' }));
    }

    function PolicyTitle({ useTabInfo }) {
      const { tab } = useTabInfo();
      return h(React.Fragment, null, h(Icon), tab.title);
    }

    function PolicyPanel({ sessionId, useTabInfo, t }) {
      const { tab } = useTabInfo();
      const [state, setState] = React.useState({ kind: 'loading' });
      const load = React.useCallback(() => {
        const signal = tab.signal;
        setState({ kind: 'loading' });
        fetch(`${ROUTE}?${new URLSearchParams({ sessionId })}`, { signal })
          .then(async response => {
            if (!response.ok) throw new Error(await response.text());
            return response.json();
          })
          .then(data => { if (!signal.aborted) setState({ kind: 'ready', data }); })
          .catch(error => { if (!signal.aborted) setState({ kind: 'failed', message: error instanceof Error ? error.message : String(error) }); });
      }, [sessionId, tab.signal]);
      React.useEffect(() => { load(); }, [load]);
      const toggle = React.useCallback((name, disabled) => {
        const previous = state;
        setState(current => current.kind === 'ready' ? {
          kind: 'ready',
          data: { ...current.data, skills: current.data.skills.map(skill => skill.name === name ? { ...skill, disabled } : skill) },
        } : current);
        fetch(ROUTE, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId, name, disabled }),
          signal: tab.signal,
        })
          .then(async response => {
            if (!response.ok) throw new Error(await response.text());
            return response.json();
          })
          .then(data => { if (!tab.signal.aborted) setState({ kind: 'ready', data }); })
          .catch(error => { if (!tab.signal.aborted) setState({ kind: 'failed', message: error instanceof Error ? error.message : String(error), previous }); });
      }, [sessionId, state, tab.signal]);
      return h('section', { className: 'wsp-root' },
        h('header', { className: 'wsp-header' },
          h('div', { className: 'wsp-title' }, h(Icon, { size: 15 }), h('span', null, t('guide.title'))),
          h('button', { type: 'button', className: 'wsp-refresh', onClick: load }, t('reload'))),
        state.kind === 'loading' ? h('div', { className: 'wsp-status' }, t('loading')) : null,
        state.kind === 'failed' ? h('div', { className: 'wsp-status wsp-error', role: 'alert' }, t('error', { message: state.message })) : null,
        state.kind === 'ready' ? h(ReadyPanel, { data: state.data, t, toggle }) : null);
    }

    function ReadyPanel({ data, t, toggle }) {
      const roots = Array.isArray(data.roots) ? data.roots : [];
      const skills = Array.isArray(data.skills) ? data.skills : [];
      return h(React.Fragment, null,
        h('div', { className: 'wsp-meta' },
          h('div', null, h('span', null, `${t('workspace')}: `), data.workspace?.title || t('noWorkspace')),
          roots.length > 0 ? h('div', null, h('span', null, `${t('roots')}: `), roots.map(root => `${root.path} (${root.count})`).join(', ')) : null),
        skills.length === 0 ? h('div', { className: 'wsp-status' }, t('empty')) : h('div', { className: 'wsp-list' },
          skills.map(skill => h(SkillRow, { key: skill.name, skill, t, toggle }))));
    }

    function SkillRow({ skill, t, toggle }) {
      const sources = Array.isArray(skill.sources) ? skill.sources : [];
      const flags = [
        skill.disabled ? t('disabled') : t('enabled'),
        skill.modelInvocable === false ? t('userOnly') : null,
        skill.userInvocable === false ? t('modelOnly') : null,
      ].filter(Boolean);
      return h('div', { className: `wsp-row ${skill.disabled ? 'is-disabled' : ''}` },
        h('div', { className: 'wsp-row-main' },
          h('div', { className: 'wsp-row-name' }, skill.name),
          h('div', { className: 'wsp-row-desc' }, skill.description || sources.map(source => source.path).join(', '))),
        h('div', { className: 'wsp-row-side' },
          h('div', { className: 'wsp-flags' }, flags.map(flag => h('span', { key: flag, className: 'wsp-chip' }, flag))),
          h('button', {
            type: 'button',
            className: 'wsp-switch',
            role: 'switch',
            'aria-checked': !skill.disabled,
            onClick: () => toggle(skill.name, !skill.disabled),
          }, skill.disabled ? t('disabled') : t('enabled'))));
    }

    function definition(t) {
      return {
        id: ID,
        kind: KIND,
        priority: 'builtin',
        title: () => t('type.label'),
        guide: [{ id: 'skill-policy', order: 40, title: () => t('guide.title'), description: () => t('guide.description'), icon: Icon }],
      };
    }

    return {
      inject: ['slots', 'locale', 'sidebarRightTabs'],
      apply(ctx) {
        const t = ctx.locale.bind(NS);
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'workspace-skill-policy: dictionaries');
        ctx.effect(() => insertStyle(`
          .wsp-root { display: flex; height: 100%; min-height: 0; flex-direction: column; color: var(--dsw-alias-label-primary); font-size: var(--dsh-content-font-size-secondary, 13px); }
          .wsp-header { box-sizing: border-box; display: flex; flex: none; align-items: center; gap: 8px; height: 38px; padding: 0 8px 0 16px; border-bottom: 0.5px solid var(--dsw-alias-border-l3); }
          .wsp-title { display: inline-flex; min-width: 0; flex: 1 1 auto; align-items: center; gap: 8px; color: var(--dsw-alias-label-secondary); }
          .wsp-refresh, .wsp-switch { border: 0.5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-sm); color: var(--dsw-alias-label-secondary); background: transparent; cursor: pointer; }
          .wsp-refresh { padding: 4px 8px; }
          .wsp-refresh:hover, .wsp-switch:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-interactive-bg-hover); }
          .wsp-status { display: flex; flex: 1 1 auto; align-items: center; justify-content: center; padding: 16px; color: var(--dsw-alias-label-secondary); text-align: center; }
          .wsp-error { color: var(--dsw-alias-state-error-primary); }
          .wsp-meta { flex: none; display: grid; gap: 4px; padding: 10px 16px; color: var(--dsw-alias-label-secondary); border-bottom: 0.5px solid var(--dsw-alias-border-l3); line-height: 1.5; }
          .wsp-meta span { color: var(--dsw-alias-label-tertiary); }
          .wsp-list { min-height: 0; overflow: auto; padding: 6px 0; }
          .wsp-row { display: flex; gap: 12px; align-items: center; padding: 9px 12px 9px 16px; border-bottom: 0.5px solid var(--dsw-alias-border-l3); }
          .wsp-row.is-disabled { opacity: 0.72; }
          .wsp-row-main { min-width: 0; flex: 1 1 auto; }
          .wsp-row-name { overflow: hidden; color: var(--dsw-alias-label-primary); font-family: var(--dsh-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace); white-space: nowrap; text-overflow: ellipsis; }
          .wsp-row-desc { overflow: hidden; margin-top: 2px; color: var(--dsw-alias-label-secondary); white-space: nowrap; text-overflow: ellipsis; }
          .wsp-row-side { display: grid; flex: none; justify-items: end; gap: 5px; }
          .wsp-flags { display: flex; gap: 4px; }
          .wsp-chip { padding: 1px 5px; border-radius: 999px; color: var(--dsw-alias-label-tertiary); background: var(--dsw-alias-bg-layer-2); font-size: 11px; }
          .wsp-switch { min-width: 58px; padding: 3px 7px; }
          .wsp-switch[aria-checked="true"] { color: var(--dsw-alias-state-success-primary); }
          .wsp-switch[aria-checked="false"] { color: var(--dsw-alias-state-error-primary); }
        `), 'workspace-skill-policy: styles');
        ctx.effect(() => ctx.sidebarRightTabs.register(definition(t)), 'workspace-skill-policy: tab type');
        ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: ID, locale: NS }, PolicyPanel)), 'workspace-skill-policy: tab body');
        ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({ name: 'sidebar.right.pane.tab.title', key: ID }, PolicyTitle)), 'workspace-skill-policy: tab title');
      },
    };
  },
});
