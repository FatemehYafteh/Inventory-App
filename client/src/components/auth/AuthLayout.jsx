import { AuthIntro } from '@/components/auth/AuthIntro';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * The signed-out pages. A centred card by default; with `intro` (Login and Register) the product
 * introduction sits beside it, at the start side of the page, and above it on a small screen.
 */
export function AuthLayout({ title, description, children, footer, intro = false }) {
  // The page's one <main> landmark: the form itself, or (with the intro) the whole two-column page.
  const Form = intro ? 'div' : 'main';
  const form = (
    <Form className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
        {footer && <div className="text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </Form>
  );
  if (!intro) return form;
  return (
    <main className="min-h-svh lg:grid lg:grid-cols-[1fr_2fr]">
      <AuthIntro />
      {form}
    </main>
  );
}
