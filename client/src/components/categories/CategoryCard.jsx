import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';

export function productCountLabel(count) {
  return `${count} ${count === 1 ? 'product' : 'products'}`;
}

/**
 * One category. The whole card opens Products filtered by it; the admin buttons sit above the
 * link. Delete is disabled while products (archived included) use the category.
 */
export function CategoryCard({ category, canManage, onEdit, onDelete }) {
  const inUse = category.productCount > 0;
  const reasonId = `category-${category.id}-in-use`;

  return (
    <Card
      data-testid="category-card"
      className="relative flex flex-col transition-colors hover:bg-accent/40"
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
              aria-label={`Edit ${category.title}`}
              onClick={() => onEdit(category)}
            >
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-label={`Delete ${category.title}`}
              aria-describedby={inUse ? reasonId : undefined}
              disabled={inUse}
              onClick={() => onDelete(category)}
            >
              Delete
            </Button>
            {inUse && (
              <span id={reasonId} className="sr-only">
                Used by {productCountLabel(category.productCount)}, so it cannot be deleted.
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
