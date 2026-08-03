# Row-head action patterns

Use this file when a table needs a compact row-level action in the body row head, such as an open-detail icon beside the sequence number.

For every consumer-side CanvasTable integration, this is the default row detail entry pattern unless the user explicitly says the table does not need a detail entry: show sequence numbers in the row head, reveal an open-detail icon from the row-head suffix on row hover or keyboard focus, and open the row detail Drawer or the host project's established detail surface when the icon is clicked. Row selection is not enabled by default.

## 1. Use `bodyRowHeadSuffixOptions`

Prefer `bodyRowHeadSuffixOptions` when the action belongs to the row head rather than a business data column.

Good cases:

- open detail from the sequence-number area
- row expand / collapse affordance
- compact row-level quick action beside selection or drag handles

For default tables, use this pattern for open detail instead of making the entire row the default detail trigger.

Avoid creating a fake fixed-left data column only to hold this icon. `bodyRowHeadSuffixOptions` is accounted for by the table's first-header width and fixed-left width calculation.

Default visual behavior:

- normal state: show the sequence number as the primary row-head content
- row hover or keyboard focus: reveal the open-detail icon beside the sequence number
- click: open the row detail Drawer or the host project's established detail surface
- reserve a stable suffix width so the first data column does not shift when the icon appears

## 2. Basic open-detail icon

Canvas cannot render a React icon component directly. Use an image source such as a small SVG data URL, a local icon asset, or an `HTMLImageElement`. If the host project uses Ant Design, it can still use the Ant Design visual asset, but pass the canvas layer an image source.

```ts
import { ImgShape, RectShape, type IBodyRowHeadSuffixOptions } from '@qfei-design/canvas-table'

const openDetailIcon =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(`
    <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      <path fill="#8c8c8c" d="M213.3 213.3h213.4v85.4H298.7v128h-85.4V213.3zM597.3 213.3h213.4v213.4h-85.4v-128h-128v-85.4zM213.3 597.3h85.4v128h128v85.4H213.3V597.3zM725.3 597.3h85.4v213.4H597.3v-85.4h128v-128z"/>
    </svg>
  `)

export function createOpenDetailRowHeadSuffix(
  openDetail: (row: Record<string, unknown>) => void,
): IBodyRowHeadSuffixOptions {
  return {
    enabled: true,
    width: 18,
    render: ({ group, x, height, rowData }) => {
      const hitArea = new RectShape({
        name: 'open-detail',
        x,
        y: height / 2 - 9,
        cursor: 'pointer',
        attrs: {
          width: 18,
          height: 18,
          stroke: 'transparent',
          fill: 'transparent',
          borderRadius: 4,
        },
      })

      hitArea.addChild(
        new ImgShape({
          name: 'open-detail-icon',
          x: 3,
          y: 3,
          attrs: {
            width: 12,
            height: 12,
            img: openDetailIcon,
          },
        }),
      )

      hitArea.on('mousedown', (event) => {
        event.stopPropagation?.()
      })

      hitArea.on('click', (event) => {
        event.stopPropagation?.()
        openDetail(rowData)
      })

      hitArea.on('mouseenter', () => {
        hitArea.setOptions({
          attrs: {
            stroke: '#d9d9d9',
            fill: '#fff',
          },
        })
      })

      hitArea.on('mouseleave', () => {
        hitArea.setOptions({
          attrs: {
            stroke: 'transparent',
            fill: 'transparent',
          },
        })
      })

      group.addChild(hitArea)
    },
  }
}
```

Then pass it to the table:

```tsx
<CanvasTable
  {...tableProps}
  showSN={{ enabled: true }}
  bodyRowHeadSuffixOptions={createOpenDetailRowHeadSuffix((row) => {
    openDetailDrawer(row.id)
  })}
/>
```

The code above shows the shape wiring. In product UI, keep the icon hidden or visually quiet until row hover/focus when the package or host row-hover state supports it. If only icon-level hover is available in the current package version, keep the same `bodyRowHeadSuffixOptions` structure and use the closest non-jitter fallback instead of adding a business data column.

## 3. Layout notes

- `x` is relative to the row-head tool group, not the whole table canvas.
- `height` is the row-head tool height, commonly `14`, not the full row height.
- `width` reserves layout space; keep it close to the hit-area width.
- The table adds spacing after the suffix width. Do not manually add a hidden column or offset data columns.
- Keep the hit area at least `18x18` even if the visible icon is smaller.
- Reserve the suffix width even when the icon is hidden until row hover/focus.

## 4. Event guidance

- Stop propagation on `mousedown` and `click` so the icon does not accidentally trigger row selection, drag, or cell editing.
- Use a stable backend id from `rowData` when opening persisted record detail.
- Open the detail Drawer or the host project's established detail surface from the icon click.
- Keep hover styling subtle and cheap; every row may create this shape.

## 5. Pitfalls

Avoid:

- rendering a React component directly inside the canvas render callback
- adding a normal table column for a row-head-only action
- hard-coding extra fixed-left offsets in the host app
- using internal table geometry to compensate for the icon width
- adding complex menus or heavy React overlays from every row-head icon
