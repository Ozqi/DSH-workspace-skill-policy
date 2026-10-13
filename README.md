# DSH Workspace Skill Policy

A DeepSeek Harness plugin for blocking selected skills in individual workspaces.

## Install

```sh
dsh plugin --profile web add github:Ozqi/DSH-workspace-skill-policy
```

Restart the active profile if the plugin manager reports that a restart is required.

## Commands

```text
/skills list
/skills block <name>
/skills unblock <name>
/skills clear
```

Policies are stored in `workspace-skill-policy.json` under `DSH_HOME` (normally `~/.dsh`). The file is written with owner-only permissions. A blocked skill is hidden from both model and user invocation for sessions in that registered workspace.

The command returns an error when the current directory does not belong to a registered workspace. Skill names must use lowercase kebab-case.

## License

MIT
