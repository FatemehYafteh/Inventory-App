import { EllipsisIcon } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * The "⋯" menu for the secondary actions of a table row. `label` names the trigger for screen
 * readers ("More actions for X"). Each item is `{ key, label, ariaLabel?, onSelect, disabled?,
 * destructive?, title?, describedBy? }`; items that do not apply to the user are left out by the
 * caller, so a role rule never has to be repeated here.
 *
 * A chosen action runs once the menu has closed and put focus back on the trigger, so a dialog
 * it opens hands focus back to the trigger when it closes.
 */
export function RowActionsMenu({ label, items, disabled = false }) {
  const pending = useRef(null);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-8 px-0"
          aria-label={label}
          title={label}
          disabled={disabled}
        >
          <EllipsisIcon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={() => {
          const action = pending.current;
          pending.current = null;
          if (action) setTimeout(action, 0);
        }}
      >
        {items.map((item) => (
          <DropdownMenuItem
            key={item.key}
            aria-label={item.ariaLabel}
            aria-describedby={item.describedBy}
            title={item.title}
            disabled={item.disabled}
            variant={item.destructive ? 'destructive' : 'default'}
            onSelect={() => {
              pending.current = item.onSelect;
            }}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
