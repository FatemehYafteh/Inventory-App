import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import { describe, expect, it } from 'vitest';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/toaster';
import { FormAlert } from '@/components/form/FormAlert';

// Smoke tests: each shadcn component renders and keeps its accessible roles.
describe('ui components', () => {
  it('renders a badge with its text', () => {
    render(<Badge variant="secondary">Low stock</Badge>);
    expect(screen.getByText('Low stock')).toBeInTheDocument();
  });

  it('renders an open dialog with title, description and a close button', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Edit product</DialogTitle>
          <DialogDescription>Change the product details.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole('dialog', { name: 'Edit product' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('renders an open sheet as a dialog', () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Narrow the list.</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    expect(screen.getByRole('dialog', { name: 'Filters' })).toBeInTheDocument();
  });

  it('renders an open alert dialog with its actions', () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Archive product?</AlertDialogTitle>
          <AlertDialogDescription>It will be hidden from the list.</AlertDialogDescription>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Archive</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>,
    );
    expect(screen.getByRole('alertdialog', { name: 'Archive product?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
  });

  it('renders a select trigger with its placeholder', () => {
    render(
      <Select>
        <SelectTrigger aria-label="Category">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
      </Select>,
    );
    expect(screen.getByRole('combobox', { name: 'Category' })).toHaveTextContent('All categories');
  });

  it('switches tabs', async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">Pending users</TabsContent>
        <TabsContent value="active">Active users</TabsContent>
      </Tabs>,
    );
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Pending users');
    await user.click(screen.getByRole('tab', { name: 'Active' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Active users');
  });

  it('opens a dropdown menu', async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Edit</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    expect(await screen.findByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
  });

  it('opens a popover', async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger>Pick a product</PopoverTrigger>
        <PopoverContent>Popover body</PopoverContent>
      </Popover>,
    );
    await user.click(screen.getByRole('button', { name: 'Pick a product' }));
    expect(await screen.findByText('Popover body')).toBeInTheDocument();
  });

  it('filters command items as the user types', async () => {
    const user = userEvent.setup();
    render(
      <Command>
        <CommandInput placeholder="Search products" />
        <CommandList>
          <CommandEmpty>No product found.</CommandEmpty>
          <CommandGroup>
            <CommandItem>Desk lamp</CommandItem>
            <CommandItem>Office chair</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>,
    );
    await user.type(screen.getByPlaceholderText('Search products'), 'lamp');
    expect(screen.getByRole('option', { name: 'Desk lamp' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Office chair' })).not.toBeInTheDocument();
  });

  it('renders a six-slot OTP input', () => {
    render(
      <InputOTP maxLength={6} aria-label="One-time code">
        <InputOTPGroup>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <InputOTPSlot key={i} index={i} />
          ))}
        </InputOTPGroup>
      </InputOTP>,
    );
    expect(screen.getByLabelText('One-time code')).toHaveAttribute('maxlength', '6');
  });

  it('renders a calendar month grid', () => {
    render(<Calendar mode="range" defaultMonth={new Date(2026, 9, 1)} />);
    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(screen.getByText('October 2026')).toBeInTheDocument();
  });

  it('shows a toast announced to screen readers', async () => {
    render(<Toaster />);
    act(() => {
      toast.success('Product saved');
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Product saved');
    act(() => toast.remove());
  });
});

describe('status colours', () => {
  it.each(['success', 'warning', 'danger', 'destructive', 'secondary', 'outline'])(
    'renders a %s badge with its text',
    (variant) => {
      render(<Badge variant={variant}>Label</Badge>);
      expect(screen.getByText('Label')).toBeInTheDocument();
    },
  );

  it('announces an error alert and keeps the error tone on the danger tokens', () => {
    render(<FormAlert>Something failed</FormAlert>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Something failed');
    expect(alert).toHaveClass('bg-danger-soft', 'text-danger');
  });

  it('announces a success alert politely and keeps the success tone on the success tokens', () => {
    render(<FormAlert tone="success">Saved</FormAlert>);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Saved');
    expect(status).toHaveClass('bg-success-soft', 'text-success');
  });

  it('renders nothing without a message', () => {
    const { container } = render(<FormAlert>{undefined}</FormAlert>);
    expect(container).toBeEmptyDOMElement();
  });
});

// Source guard: each rule checks one targeted migration. `present` proves the intended token
// class is there; `absent` is only used where every occurrence in the file was meant to go.
//
// Intentional exceptions, deliberately not asserted:
// - `bg-destructive` on the solid destructive badge (now paired with text-destructive-foreground).
// - `aria-invalid:border-destructive` / `aria-invalid:ring-destructive/20` on fields: non-text
//   outlines, 4.83:1 on white and 3.56:1 on the dark card, above the 3:1 minimum.
// - `placeholder:text-muted-foreground` in command.jsx (out of scope, 7.58:1).
// - `ring-ring/50` in page-level files (DataTable*, SupplierTable, UsersTable): not read here.
describe('token migration guard', () => {
  const read = (file) => readFileSync(resolve(import.meta.dirname, file), 'utf8');
  // ring-ring at full strength: nothing after it but a space, quote or end of class.
  const FULL_RING = /ring-ring(?![/\w-])/;
  const OLD_RING = /ring-ring\/50/;
  // Plain text-destructive only; text-destructive-foreground is a legitimate token.
  const PLAIN_DESTRUCTIVE = /text-destructive(?![-\w])/;

  // `line` narrows the check to the lines that mention it; otherwise the whole file is used.
  const RULES = [
    { file: './badge.jsx', line: /destructive:/, present: [/text-destructive-foreground/] },
    { file: './badge.jsx', line: /success:/, present: [/bg-success-soft/, /text-success/] },
    { file: './badge.jsx', line: /warning:/, present: [/bg-warning-soft/, /text-warning/] },
    { file: './badge.jsx', line: /danger:/, present: [/bg-danger-soft/, /text-danger/] },
    { file: './badge.jsx', absent: [/text-white/] },
    {
      file: './button.jsx',
      present: [/hover:bg-primary-hover/, FULL_RING],
      absent: [/hover:bg-primary\/90/, OLD_RING],
    },
    {
      file: './input.jsx',
      present: [/placeholder:text-placeholder/, FULL_RING],
      absent: [/placeholder:text-muted-foreground/, OLD_RING],
    },
    {
      file: './select.jsx',
      present: [/data-\[placeholder\]:text-placeholder/, FULL_RING],
      absent: [/data-\[placeholder\]:text-muted-foreground/, OLD_RING],
    },
    { file: './dialog.jsx', present: [/bg-overlay/], absent: [/bg-black/] },
    {
      file: './dialog.jsx',
      line: /Primitive\.Close className/,
      present: [FULL_RING],
      absent: [OLD_RING],
    },
    { file: './sheet.jsx', present: [/bg-overlay/], absent: [/bg-black/] },
    {
      file: './sheet.jsx',
      line: /Primitive\.Close className/,
      present: [FULL_RING],
      absent: [OLD_RING],
    },
    { file: './alert-dialog.jsx', present: [/bg-overlay/], absent: [/bg-black/] },
    { file: './tabs.jsx', present: [FULL_RING], absent: [OLD_RING] },
    { file: './input-otp.jsx', present: [FULL_RING], absent: [OLD_RING] },
    {
      file: './dropdown-menu.jsx',
      line: /variant === 'destructive'/,
      present: [/text-danger/, /focus:bg-danger-soft/, /focus:text-danger/],
    },
    { file: './dropdown-menu.jsx', absent: [PLAIN_DESTRUCTIVE, /bg-destructive\/10/] },
    { file: './toaster.jsx', present: [/iconTheme/, /var\(--success\)/, /var\(--danger\)/] },
    { file: '../form/FormAlert.jsx', line: /error:/, present: [/bg-danger-soft/, /text-danger/] },
    {
      file: '../form/FormAlert.jsx',
      line: /success:/,
      present: [/bg-success-soft/, /text-success/],
    },
    {
      file: '../form/FormAlert.jsx',
      absent: [/emerald-/, PLAIN_DESTRUCTIVE, /bg-destructive\/5/],
    },
    { file: '../form/TextField.jsx', present: [/text-danger/], absent: [PLAIN_DESTRUCTIVE] },
    { file: '../auth/TelegramSignIn.jsx', present: [/text-danger/], absent: [PLAIN_DESTRUCTIVE] },
  ];

  it.each(RULES.map((rule) => [`${rule.file} ${rule.line ?? '(file)'}`, rule]))(
    '%s uses the intended tokens',
    (_name, { file, line, present = [], absent = [] }) => {
      const source = read(file);
      const text = line
        ? source
            .split('\n')
            .filter((l) => line.test(l))
            .join('\n')
        : source;
      expect(text, `no line matches ${line}`).not.toBe('');
      for (const pattern of present) expect(text).toMatch(pattern);
      for (const pattern of absent) expect(text).not.toMatch(pattern);
    },
  );
});
