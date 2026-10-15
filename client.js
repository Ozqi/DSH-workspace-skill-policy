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
      'guide.description': '查看 GitHub 来源与内容，按当前 Session 开启或关闭 skill',
      loading: '正在读取 skill…',
      empty: '没有发现 workspace skill',
      reload: '刷新',
      enabledCount: '已开启 {enabled} / 总计 {total}',
      workspace: '工作区',
      roots: '探测目录',
      noWorkspace: '无工作区',
      loadError: '读取失败：{message}',
      updateError: '更新失败：{message}',
      noGithub: '未发现 GitHub 链接',
      enabled: '已开启',
      disabled: '已关闭',
      enableSkill: '开启 {name}',
      disableSkill: '关闭 {name}',
      modelOnly: '仅模型',
      userOnly: '仅用户',
      sourcePath: '来源路径',
      content: 'SKILL.md 内容',
      contentLoading: '正在读取内容…',
      contentUnavailable: '内容不可用：{message}',
      showContent: '展开 {name} 内容',
      hideContent: '收起 {name} 内容',
      github: 'GitHub',
    };
    const en = {
      'type.label': 'Skill policy',
      'guide.title': 'Skill policy',
      'guide.description': 'Inspect GitHub sources and content, then enable or disable skills for this Session',
      loading: 'Reading skills…',
      empty: 'No workspace skills found',
      reload: 'Reload',
      enabledCount: '{enabled} enabled / {total} total',
      workspace: 'Workspace',
      roots: 'Detected roots',
      noWorkspace: 'No workspace',
      loadError: 'Load failed: {message}',
      updateError: 'Update failed: {message}',
      noGithub: 'No GitHub link found',
      enabled: 'Enabled',
      disabled: 'Disabled',
      enableSkill: 'Enable {name}',
      disableSkill: 'Disable {name}',
      modelOnly: 'model only',
      userOnly: 'user only',
      sourcePath: 'Source path',
      content: 'SKILL.md content',
      contentLoading: 'Reading content…',
      contentUnavailable: 'Content unavailable: {message}',
      showContent: 'Show {name} content',
      hideContent: 'Hide {name} content',
      github: 'GitHub',
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
        h('rect', { x: 2.5, y: 2.5, width: 11, height: 11, rx: 2.2, stroke: 'currentColor', strokeWidth: 1.3 }),
        h('path', { d: 'M5 6h5M5 9h3', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }),
        h('path', { d: 'M10.2 10.2l2 2M12.2 10.2l-2 2', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }));
    }

    function PolicyTitle({ useTabInfo }) {
      const { tab } = useTabInfo();
      return h(React.Fragment, null, h(Icon), tab.title);
    }

    function PolicyPanel({ sessionId, useTabInfo, t }) {
      const { tab } = useTabInfo();
      const [data, setData] = React.useState(null);
      const [loading, setLoading] = React.useState(true);
      const [notice, setNotice] = React.useState(null);
      const [busy, setBusy] = React.useState(new Set());
      const [expanded, setExpanded] = React.useState(null);
      const [contents, setContents] = React.useState({});

      const load = React.useCallback(() => {
        setLoading(true);
        setNotice(null);
        fetch(`${ROUTE}?${new URLSearchParams({ sessionId })}`, { signal: tab.signal })
          .then(async response => {
            if (!response.ok) throw new Error(await response.text());
            return response.json();
          })
          .then(next => { if (!tab.signal.aborted) { setData(next); setLoading(false); } })
          .catch(error => { if (!tab.signal.aborted) { setLoading(false); setNotice(t('loadError', { message: messageOf(error) })); } });
      }, [sessionId, tab.signal, t]);
      React.useEffect(() => { load(); }, [load]);

      const toggle = React.useCallback((skill) => {
        const disabled = !skill.disabled;
        setBusy(current => new Set(current).add(skill.name));
        setNotice(null);
        setData(current => current === null ? current : ({
          ...current,
          skills: current.skills.map(row => row.name === skill.name ? { ...row, disabled } : row),
        }));
        fetch(ROUTE, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId, name: skill.name, disabled }),
          signal: tab.signal,
        }).then(async response => {
          if (!response.ok) throw new Error(await response.text());
          return response.json();
        }).then(next => { if (!tab.signal.aborted) setData(next); })
          .catch(error => {
            if (!tab.signal.aborted) {
              setData(current => current === null ? current : ({
                ...current,
                skills: current.skills.map(row => row.name === skill.name ? { ...row, disabled: skill.disabled } : row),
              }));
              setNotice(t('updateError', { message: messageOf(error) }));
            }
          }).finally(() => {
            if (!tab.signal.aborted) setBusy(current => { const next = new Set(current); next.delete(skill.name); return next; });
          });
      }, [sessionId, tab.signal, t]);

      const toggleContent = React.useCallback((name) => {
        if (expanded === name) { setExpanded(null); return; }
        setExpanded(name);
        if (contents[name] !== undefined) return;
        setContents(current => ({ ...current, [name]: { kind: 'loading' } }));
        fetch(`${ROUTE}?${new URLSearchParams({ sessionId, skill: name })}`, { signal: tab.signal })
          .then(async response => {
            if (!response.ok) throw new Error(await response.text());
            return response.json();
          })
          .then(value => { if (!tab.signal.aborted) setContents(current => ({ ...current, [name]: { kind: 'ready', value } })); })
          .catch(error => { if (!tab.signal.aborted) setContents(current => ({ ...current, [name]: { kind: 'failed', message: messageOf(error) } })); });
      }, [contents, expanded, sessionId, tab.signal]);

      const skills = Array.isArray(data?.skills) ? data.skills : [];
      const enabled = skills.filter(skill => !skill.disabled).length;
      return h('section', { className: 'wsp-root', 'data-skill-policy': '' },
        h('header', { className: 'wsp-header' },
          h('div', { className: 'wsp-title' }, h(Icon, { size: 15 }), h('span', null, t('guide.title'))),
          data ? h('span', { className: 'wsp-count' }, t('enabledCount', { enabled: String(enabled), total: String(skills.length) })) : null,
          h('button', { type: 'button', className: 'wsp-refresh', onClick: load, disabled: loading }, t('reload'))),
        notice ? h('div', { className: 'wsp-notice', role: 'alert' }, notice) : null,
        loading && data === null ? h('div', { className: 'wsp-status' }, t('loading')) : null,
        data ? h(ReadyPanel, { data, skills, busy, contents, expanded, t, toggle, toggleContent }) : null);
    }

    function ReadyPanel({ data, skills, busy, contents, expanded, t, toggle, toggleContent }) {
      const roots = Array.isArray(data.roots) ? data.roots : [];
      return h(React.Fragment, null,
        h('div', { className: 'wsp-summary' },
          h('div', { className: 'wsp-summary-row' }, h('span', null, t('workspace')), h('strong', null, data.workspace?.title || t('noWorkspace'))),
          data.workspace?.path ? h('code', { className: 'wsp-workspace-path' }, data.workspace.path) : null,
          roots.length > 0 ? h('div', { className: 'wsp-roots' }, h('span', null, t('roots')), roots.map(root => h('code', { key: root.path }, `${root.path} · ${root.count}`))) : null),
        skills.length === 0 ? h('div', { className: 'wsp-status' }, t('empty')) : h('div', { className: 'wsp-list' },
          skills.map(skill => h(SkillRow, {
            key: skill.name,
            skill,
            content: contents[skill.name],
            expanded: expanded === skill.name,
            busy: busy.has(skill.name),
            t,
            toggle,
            toggleContent,
          }))));
    }

    function SkillRow({ skill, content, expanded, busy, t, toggle, toggleContent }) {
      const sources = Array.isArray(skill.sources) ? skill.sources : [];
      const flags = [
        skill.modelInvocable === false ? t('userOnly') : null,
        skill.userInvocable === false ? t('modelOnly') : null,
      ].filter(Boolean);
      const contentBody = expanded ? h('div', { className: 'wsp-content' },
        h('div', { className: 'wsp-content-title' }, t('content')),
        content?.kind === 'ready' ? h('pre', null, content.value.content) : null,
        content?.kind === 'failed' ? h('div', { className: 'wsp-content-state wsp-content-error' }, t('contentUnavailable', { message: content.message })) : null,
        (!content || content.kind === 'loading') ? h('div', { className: 'wsp-content-state' }, t('contentLoading')) : null) : null;
      return h('article', { className: `wsp-card ${skill.disabled ? 'is-disabled' : ''}`, 'data-skill-name': skill.name },
        h('div', { className: 'wsp-card-head' },
          h('button', {
            type: 'button',
            className: 'wsp-expand',
            'aria-expanded': expanded,
            'aria-label': t(expanded ? 'hideContent' : 'showContent', { name: skill.name }),
            onClick: () => toggleContent(skill.name),
          }, h('span', { className: 'wsp-chevron', 'aria-hidden': true }, '›')),
          h('div', { className: 'wsp-card-main' },
            h('div', { className: 'wsp-name-line' }, h('code', { className: 'wsp-name' }, skill.name), flags.map(flag => h('span', { key: flag, className: 'wsp-chip' }, flag))),
            skill.description ? h('div', { className: 'wsp-description' }, skill.description) : null,
            skill.github?.fileUrl
              ? h('a', { className: 'wsp-github', href: skill.github.fileUrl, target: '_blank', rel: 'noreferrer' }, `${t('github')}: ${skill.github.fileUrl}`)
              : h('div', { className: 'wsp-github is-missing' }, t('noGithub'))),
          h('div', { className: 'wsp-state' },
            h('span', { className: 'wsp-state-label' }, skill.disabled ? t('disabled') : t('enabled')),
            h('button', {
              type: 'button',
              className: 'wsp-switch',
              role: 'switch',
              'aria-checked': !skill.disabled,
              'aria-label': t(skill.disabled ? 'enableSkill' : 'disableSkill', { name: skill.name }),
              disabled: busy,
              onClick: () => toggle(skill),
            }, h('span', null)))),
        h('div', { className: 'wsp-paths' },
          h('span', { className: 'wsp-path-label' }, t('sourcePath')),
          sources.length > 0
            ? h('div', { className: 'wsp-path-list' }, sources.map((source, index) => h('code', { key: `${source.kind}:${source.path}:${index}` }, source.path)))
            : h('code', null, '—')),
        contentBody);
    }

    function messageOf(error) {
      return error instanceof Error ? error.message : String(error);
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
          .wsp-header { box-sizing: border-box; display: flex; flex: none; align-items: center; gap: 10px; min-height: 44px; padding: 0 10px 0 16px; border-bottom: 0.5px solid var(--dsw-alias-border-l1); }
          .wsp-title { display: inline-flex; min-width: 0; flex: 1 1 auto; align-items: center; gap: 8px; color: var(--dsw-alias-label-primary); font-weight: 500; }
          .wsp-count { flex: none; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; white-space: nowrap; }
          .wsp-refresh { flex: none; padding: 4px 8px; border: 0.5px solid var(--dsw-alias-border-l1); border-radius: 6px; color: var(--dsw-alias-label-secondary); background: transparent; cursor: pointer; }
          .wsp-refresh:hover:not(:disabled), .wsp-expand:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2); }
          .wsp-refresh:disabled { opacity: 0.5; cursor: default; }
          .wsp-notice { flex: none; margin: 8px 12px 0; padding: 7px 9px; border-radius: 6px; color: var(--dsw-alias-state-error-primary); background: var(--dsw-alias-bg-layer-2); line-height: 1.45; }
          .wsp-status { display: flex; flex: 1 1 auto; align-items: center; justify-content: center; padding: 20px; color: var(--dsw-alias-label-secondary); text-align: center; }
          .wsp-summary { display: grid; flex: none; gap: 5px; padding: 10px 16px 11px; border-bottom: 0.5px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-secondary); line-height: 1.4; }
          .wsp-summary-row { display: flex; align-items: baseline; gap: 8px; }
          .wsp-summary-row > span, .wsp-roots > span { color: var(--dsw-alias-label-secondary); }
          .wsp-summary-row strong { overflow: hidden; color: var(--dsw-alias-label-primary); font-weight: 500; white-space: nowrap; text-overflow: ellipsis; }
          .wsp-workspace-path { overflow: hidden; color: var(--dsw-alias-label-secondary); font-size: 12px; white-space: nowrap; text-overflow: ellipsis; }
          .wsp-roots { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; }
          .wsp-roots code, .wsp-chip { padding: 1px 6px; border-radius: 999px; color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2); font-size: 11px; }
          .wsp-list { min-height: 0; overflow: auto; padding: 8px 10px 12px; }
          .wsp-card { margin-bottom: 8px; overflow: hidden; border: 0.5px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-layer-1); }
          .wsp-card.is-disabled { background: var(--dsw-alias-bg-base); }
          .wsp-card-head { display: flex; min-height: 56px; align-items: center; gap: 8px; padding: 7px 10px 7px 6px; }
          .wsp-expand { display: inline-flex; flex: none; align-items: center; justify-content: center; width: 26px; height: 26px; padding: 0; border: none; border-radius: 6px; color: var(--dsw-alias-label-secondary); background: transparent; cursor: pointer; }
          .wsp-chevron { display: inline-block; font-size: 20px; line-height: 1; transition: transform 120ms ease; }
          .wsp-expand[aria-expanded="true"] .wsp-chevron { transform: rotate(90deg); }
          .wsp-card-main { min-width: 0; flex: 1 1 auto; }
          .wsp-name-line { display: flex; min-width: 0; align-items: center; gap: 6px; }
          .wsp-name { overflow: hidden; color: var(--dsw-alias-label-primary); font-size: 13px; white-space: nowrap; text-overflow: ellipsis; }
          .wsp-description { display: -webkit-box; margin-top: 3px; overflow: hidden; color: var(--dsw-alias-label-secondary); line-height: 1.35; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
          .wsp-github { display: block; margin-top: 4px; overflow: hidden; color: var(--dsw-alias-brand-primary); font-size: 11px; white-space: nowrap; text-overflow: ellipsis; text-decoration: none; }
          .wsp-github.is-missing { color: var(--dsw-alias-label-tertiary); }
          .wsp-state { display: grid; flex: none; justify-items: end; gap: 4px; }
          .wsp-state-label { color: var(--dsw-alias-label-secondary); font-size: 11px; }
          .wsp-switch { position: relative; width: 34px; height: 18px; padding: 0; border: none; border-radius: 999px; background: var(--dsw-alias-state-idle-primary); cursor: pointer; transition: background 120ms ease; }
          .wsp-switch[aria-checked="true"] { background: var(--dsw-alias-brand-primary); }
          .wsp-switch:disabled { opacity: 0.5; cursor: wait; }
          .wsp-switch span { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: var(--dsw-alias-bg-layer-1); transition: transform 120ms ease; }
          .wsp-switch[aria-checked="true"] span { transform: translateX(16px); }
          .wsp-paths { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 6px 9px; padding: 7px 10px 8px 40px; border-top: 0.5px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); }
          .wsp-path-label { color: var(--dsw-alias-label-secondary); font-size: 11px; }
          .wsp-path-list { display: grid; min-width: 0; gap: 3px; }
          .wsp-paths code { overflow: hidden; color: var(--dsw-alias-label-primary); font-size: 11px; white-space: nowrap; text-overflow: ellipsis; }
          .wsp-content { padding: 10px 12px; border-top: 0.5px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-base); }
          .wsp-content-title { margin-bottom: 7px; color: var(--dsw-alias-label-secondary); font-size: 11px; }
          .wsp-content pre { max-height: 360px; margin: 0; overflow: auto; color: var(--dsw-alias-label-primary); font-family: var(--dsh-font-family-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace); font-size: 11px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; }
          .wsp-content-state { padding: 8px 0; color: var(--dsw-alias-label-secondary); }
          .wsp-content-error { color: var(--dsw-alias-state-error-primary); }
        `), 'workspace-skill-policy: styles');
        ctx.effect(() => ctx.sidebarRightTabs.register(definition(t)), 'workspace-skill-policy: tab type');
        ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: ID, locale: NS }, PolicyPanel)), 'workspace-skill-policy: tab body');
        ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({ name: 'sidebar.right.pane.tab.title', key: ID }, PolicyTitle)), 'workspace-skill-policy: tab title');
      },
    };
  },
});
