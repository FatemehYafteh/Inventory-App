import * as SheetPrimitive from '@radix-ui/react-dialog';
import { cva } from 'class-variance-authority';
import { XIcon } from 'lucide-react';
import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;

const sheetVariants = cva(
  'fixed z-50 flex flex-col gap-4 overflow-y-auto bg-background shadow-lg',
  {
    variants: {
      side: {
        right: 'inset-y-0 end-0 h-full w-3/4 border-s sm:max-w-md',
        left: 'inset-y-0 start-0 h-full w-3/4 border-e sm:max-w-md',
        top: 'inset-x-0 top-0 h-auto border-b',
        bottom: 'inset-x-0 bottom-0 h-auto border-t',
      },
    },
    defaultVariants: { side: 'right' },
  },
);

const SheetContent = forwardRef(function SheetContent(
  { className, side, children, ...props },
  ref,
) {
  const { t } = useTranslation();
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay" />
      <SheetPrimitive.Content
        ref={ref}
        className={cn(sheetVariants({ side }), className)}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute top-4 end-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
          <XIcon className="size-4" aria-hidden="true" />
          <span className="sr-only">{t('common.close')}</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
});

function SheetHeader({ className, ...props }) {
  return <div className={cn('flex flex-col gap-1.5 p-4', className)} {...props} />;
}

function SheetFooter({ className, ...props }) {
  return <div className={cn('mt-auto flex flex-col gap-2 p-4', className)} {...props} />;
}

const SheetTitle = forwardRef(function SheetTitle({ className, ...props }, ref) {
  return (
    <SheetPrimitive.Title
      ref={ref}
      className={cn('font-semibold text-foreground', className)}
      {...props}
    />
  );
});

const SheetDescription = forwardRef(function SheetDescription({ className, ...props }, ref) {
  return (
    <SheetPrimitive.Description
      ref={ref}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
});

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
