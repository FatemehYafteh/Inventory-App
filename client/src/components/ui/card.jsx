import { cn } from '@/lib/utils';

function Card({ className, ...props }) {
  return (
    <div
      className={cn('rounded-xl border bg-card text-card-foreground shadow-sm', className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }) {
  return <div className={cn('flex flex-col gap-1.5 p-6', className)} {...props} />;
}

function CardTitle({ className, ...props }) {
  return <h1 className={cn('text-xl font-semibold leading-none', className)} {...props} />;
}

function CardDescription({ className, ...props }) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

function CardContent({ className, ...props }) {
  return <div className={cn('px-6 pb-6', className)} {...props} />;
}

export { Card, CardContent, CardDescription, CardHeader, CardTitle };
