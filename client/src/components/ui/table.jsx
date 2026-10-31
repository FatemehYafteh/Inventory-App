import { cn } from '@/lib/utils';

// Body rows only (header rows are not in TableBody). A row marked data-static, such as an empty or
// loading message, does not highlight. inset-ring is a shadow, so rows never shift.
const BODY_ROW_HIGHLIGHT = [
  '[&_tr:not([data-static])]:transition-[background-color,box-shadow]',
  '[&_tr:not([data-static])]:duration-200',
  '[&_tr:not([data-static]):is(:hover,:focus-within)]:bg-accent',
  '[&_tr:not([data-static]):is(:hover,:focus-within)]:inset-ring',
  '[&_tr:not([data-static]):is(:hover,:focus-within)]:inset-ring-primary/40',
].join(' ');

function Table({ className, ...props }) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}

function TableHeader({ className, ...props }) {
  return <thead className={cn('[&_tr]:border-b', className)} {...props} />;
}

function TableBody({ className, ...props }) {
  return (
    <tbody className={cn('[&_tr:last-child]:border-0', BODY_ROW_HIGHLIGHT, className)} {...props} />
  );
}

function TableFooter({ className, ...props }) {
  return (
    <tfoot
      className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }) {
  return <tr className={cn('border-b data-[state=selected]:bg-muted', className)} {...props} />;
}

function TableHead({ className, ...props }) {
  return (
    <th
      className={cn(
        'h-10 whitespace-nowrap px-2 text-start align-middle font-medium text-foreground',
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }) {
  return <td className={cn('whitespace-nowrap p-2 align-middle', className)} {...props} />;
}

function TableCaption({ className, ...props }) {
  return <caption className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />;
}

export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow };
