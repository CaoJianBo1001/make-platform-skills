# Package UI

## Ownership and current controls

The default surface has a floating launcher and right-side panel. The package
owns its internal header, task list, message area, composer, upload menu and
responsive behavior. Verify the installed version's public props and rendered
controls; do not encode pixel-level styling from one screenshot as host CSS.
Current controls include:

- a task list with recent chats and new conversation;
- a composer plus menu with one `上传文件或图片` entry when negotiated upload is enabled;
- send, close, loading, error and retry states owned by the package.

Do not add a current-object line, read-only state decoration, or adjacent help
control. Do not duplicate package buttons or file inputs in the host.

The package owns internal UI and styles. `makeui` may place the launcher/panel in
the App shell and resolve collisions with global navigation, but it must not
restyle internal task rows, headers, menus, messages, or composer controls.

## Responsive and accessible behavior

- Preserve the package's public drawer width/maxDrawerWidth, full-screen control,
  mobile full-width behavior, and container queries. Do not add a host drag-resize
  interaction that the package does not expose.
- Keep controls keyboard reachable with visible focus and meaningful accessible
  names.
- Do not disable reduced-motion behavior or replace status text with color alone.
- Long titles, task names, file names, and errors must truncate or wrap without
  covering actions; retain an accessible full value.
- Closing and reopening the panel must not destroy an active conversation.

Use only public theme/launcher props and documented `--make-ai-*` variables for
requested customization. Prefer package defaults over host CSS patches.

## States

- Loading: keep the entry usable and show bounded progress in the panel.
- Agent unavailable/discovery failed: show a safe retry action.
- Empty task list: retain the new conversation action.
- Stream reconnect: preserve accumulated output and durable cursor.
- Upload in progress/failure: keep the pending item actionable and explain retry.
- Terminal response failure: show the stable public error without raw upstream
  diagnostics.
