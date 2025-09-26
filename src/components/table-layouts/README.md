# Table Layout Components

This directory preserves the refined table layout design for task display.

## Components

### TaskTable.tsx
- Main table component with date grouping logic
- Groups tasks by date with separate gray containers
- Handles task rendering and date column visibility

### TaskRow.tsx
- Individual task row component
- Refined styling with hover effects
- Action buttons (edit, delete, phone, assign)
- Horizontal dividers starting from time column

### TableTaskDisplay.tsx
- Complete integration wrapper
- Ready-to-use alternative to card layout
- Preserves all refined styling and functionality

## Features Preserved

- **Date Grouping**: Tasks grouped by date in separate containers
- **Visual Design**: Gray containers with white column backgrounds
- **Horizontal Dividers**: Positioned to start from time column (ml-28)
- **Hover Effects**: Enhanced row interactions
- **Date Range Integration**: Compatible with date range filtering
- **Responsive Design**: Proper mobile and desktop layouts

## Usage

To switch back to table layout in KanbanContent.tsx:

```tsx
// Replace TaskCard import with:
import TableTaskDisplay from "./table-layouts/TableTaskDisplay";

// Replace TaskCard usage with:
<TableTaskDisplay
  tasks={tasksToDisplay}
  onMove={onMove}
  onFrameUrlChange={onFrameUrlChange}
  onTaskAssigned={onTaskAssigned}
  selectedOwnerId={selectedOwnerId}
  onTaskDeleted={onTaskDeleted}
  categoryColor={category?.color}
/>
```

## Toggle Implementation

To create a display mode toggle:

```tsx
const [displayMode, setDisplayMode] = useState<'cards' | 'table'>('cards');

// In render:
{displayMode === 'table' ? (
  <TableTaskDisplay {...props} />
) : (
  <TaskCard {...props} />
)}
```