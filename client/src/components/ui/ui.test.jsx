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
