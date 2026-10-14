/** The "or" line between Telegram sign-in and the email form. */
export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-xs uppercase text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
