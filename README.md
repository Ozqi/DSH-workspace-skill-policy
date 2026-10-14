# DSH Workspace Skill Policy

A DeepSeek Harness Web plugin for enabling or disabling workspace skills per Session.

## Install

```sh
dsh plugin --profile web add github:Ozqi/DSH-workspace-skill-policy
```

Restart the active profile if the plugin manager reports that a restart is required.

## Use it

Open the right Sidebar and choose **Skill policy**. The panel lists skills visible to the selected Session plus skills detected under common workspace skill roots:

- `.agents/skills/<name>/SKILL.md`
- `.dsh/skills/<name>/SKILL.md`
- `.agent/skills/<name>/SKILL.md`
- `.agent/<name>/SKILL.md`
- `.agent/*/skills/<name>/SKILL.md`

Use each row's switch to enable or disable that skill for the current Session. Disabled skills are hidden from both model and user invocation for that Session.

The `/skills` command remains as a text fallback:

```text
/skills list
/skills block <name>
/skills unblock <name>
/skills clear
```

Policies are stored in `workspace-skill-policy.json` under `DSH_HOME` (normally `~/.dsh`). The file is written with owner-only permissions.

## License

MIT
