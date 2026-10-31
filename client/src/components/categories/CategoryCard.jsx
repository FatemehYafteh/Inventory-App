import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import i18n from '@/i18n';
import { formatNumber } from '@/lib/format';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';

export function productCountLabel(count) {
  return i18n.t('categories.productCount', { count, n: formatNumber(count) });
}

/**
 * One category. The whole card opens Products filtered by it; the admin buttons sit above the
 * link. Delete is disabled while products (archived included) use the category.
 */
export function CategoryCard({ category, canManage, onEdit, onDelete }) {
  const { t } = useTranslation();
  const inUse = category.productCount > 0;
  const reasonId = `category-${category.id}-in-use`;
  const reason = t('categories.card.inUseReason', {
    products: productCountLabel(category.productCount),
  });

  return (
    <Card
      data-testid="category-card"
      className="relative flex flex-col transition-[background-color,border-color,box-shadow] hover:border-primary/40 hover:bg-accent hover:shadow-md focus-within:border-primary/40 focus-within:bg-accent focus-within:shadow-md"
    >
      <CardHeader>
        <h2 className="text-lg font-semibold leading-tight">
          <Link
            to={`/products?category=${encodeURIComponent(category.id)}`}
            className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {category.title}
          </Link>
        </h2>
        {category.description && <CardDescription>{category.description}</CardDescription>}
      </CardHeader>
      <CardContent className="mt-auto flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{productCountLabel(category.productCount)}</p>
        {canManage && (
          <div className="relative z-10 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              aria-label={t('categories.card.editLabel', { title: category.title })}
              onClick={() => onEdit(category)}
            >
              {t('categories.card.edit')}
            </Button>
            {/* A disabled button gets no hover events, so the span carries the tooltip. */}
            <span title={inUse ? reason : undefined}>
              <Button
                variant="outline"
                size="sm"
                aria-label={t('categories.card.deleteLabel', { title: category.title })}
                aria-describedby={inUse ? reasonId : undefined}
                disabled={inUse}
                onClick={() => onDelete(category)}
              >
                {t('categories.card.delete')}
              </Button>
            </span>
            {inUse && (
              <span id={reasonId} className="sr-only">
                {reason}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
