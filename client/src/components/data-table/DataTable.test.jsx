import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataTable } from '@/components/data-table/DataTable';
import { mockMobile } from '@/test/mobile';

const columns = [
  { accessorKey: 'title', header: 'Title' },
  { accessorKey: 'quantity', header: 'Quantity' },
  { accessorKey: 'sku', header: 'SKU', enableSorting: false },
];

const page = [
  { title: 'Desk lamp', quantity: 4, sku: 'LAMP-01' },
  { title: 'Office chair', quantity: 0, sku: 'CHAIR-02' },
];
const noRows = [];

// Owns sorting and pagination the way a page will (there, from the URL), and records changes.
function Harness({ onChange = () => {}, data = page, rowCount = 45, ...props }) {
  const [sorting, setSorting] = useState([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  return (
    <DataTable
      columns={columns}
      data={data}
      rowCount={rowCount}
      sorting={sorting}
      onSortingChange={(updater) =>
        setSorting((old) => {
          const next = typeof updater === 'function' ? updater(old) : updater;
          onChange({ sorting: next });
          return next;
        })
      }
      pagination={pagination}
      onPaginationChange={(updater) =>
        setPagination((old) => {
          const next = typeof updater === 'function' ? updater(old) : updater;
          onChange({ pagination: next });
          return next;
        })
      }
      {...props}
    />
  );
}

describe('DataTable', () => {
  it('renders the given page of rows', () => {
    render(<Harness />);

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3); // header + 2 data rows
    expect(within(rows[1]).getByText('Desk lamp')).toBeInTheDocument();
    expect(within(rows[2]).getByText('CHAIR-02')).toBeInTheDocument();
  });

  it('cycles server-side sorting from a header and reflects it in aria-sort', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    const titleHeader = screen.getByRole('columnheader', { name: /Title/ });
    expect(titleHeader).not.toHaveAttribute('aria-sort');

    await user.click(screen.getByRole('button', { name: /Title/ }));
    expect(onChange).toHaveBeenLastCalledWith({ sorting: [{ id: 'title', desc: false }] });
    expect(titleHeader).toHaveAttribute('aria-sort', 'ascending');

    await user.click(screen.getByRole('button', { name: /Title/ }));
    expect(onChange).toHaveBeenLastCalledWith({ sorting: [{ id: 'title', desc: true }] });
    expect(titleHeader).toHaveAttribute('aria-sort', 'descending');

    // Rows stay in server order: manual sorting never re-sorts the page in the browser.
    const firstCell = within(screen.getAllByRole('row')[1]).getAllByRole('cell')[0];
    expect(firstCell).toHaveTextContent('Desk lamp');
  });

  it('does not make non-sortable columns clickable', () => {
    render(<Harness />);

    expect(screen.getByRole('columnheader', { name: 'SKU' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /SKU/ })).not.toBeInTheDocument();
  });

  it('pages through the server total and changes page size', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    expect(screen.getByText('45 results')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onChange).toHaveBeenLastCalledWith({ pagination: { pageIndex: 1, pageSize: 20 } });
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    await user.selectOptions(screen.getByLabelText('Rows per page'), '50');
    expect(onChange).toHaveBeenLastCalledWith({
      pagination: expect.objectContaining({ pageSize: 50 }),
    });
    // 45 rows fit on one page of 50: the controls go, the count stays.
    expect(screen.queryByText(/Page 1 of/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Rows per page')).not.toBeInTheDocument();
    expect(screen.getByText('45 results')).toBeInTheDocument();
  });

  it('shows the toolbar above the table', () => {
    render(<Harness toolbar={<input aria-label="Search" />} />);

    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });

  it('shows loading, empty and error states', () => {
    const { rerender } = render(<Harness data={noRows} rowCount={0} isLoading />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');

    rerender(<Harness data={noRows} rowCount={0} emptyMessage="No products found." />);
    expect(screen.getByText('No products found.')).toBeInTheDocument();
    expect(screen.getByText('0 results')).toBeInTheDocument();
    expect(screen.queryByText(/Page 1 of/)).not.toBeInTheDocument();

    rerender(<Harness data={noRows} rowCount={0} error={new Error('Could not load products.')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load products.');
  });
});

describe('DataTable on a phone', () => {
  let restore = () => {};
  afterEach(() => restore());
  const card = (row) => (
    <p>
      {row.title} / {row.sku}
    </p>
  );

  it('renders each row as a card instead of a table', () => {
    restore = mockMobile();
    render(<Harness renderCard={card} />);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Desk lamp / LAMP-01');
    expect(screen.getByText('45 results')).toBeInTheDocument();
  });

  it('sorts from a "Sort by" select, since the cards have no column headers', async () => {
    restore = mockMobile();
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness renderCard={card} onChange={onChange} />);

    const select = screen.getByLabelText('Sort by');
    // Only the sortable columns are offered (SKU is not), each both ways.
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual([
      '',
      'Title (ascending)',
      'Title (descending)',
      'Quantity (ascending)',
      'Quantity (descending)',
    ]);
    await user.selectOptions(select, 'quantity:desc');
    expect(onChange).toHaveBeenLastCalledWith({ sorting: [{ id: 'quantity', desc: true }] });
    expect(select).toHaveValue('quantity:desc');
  });

  it('says so in a card-sized box when there are no rows', () => {
    restore = mockMobile();
    render(<Harness renderCard={card} data={noRows} rowCount={0} emptyMessage="Nothing here." />);

    expect(screen.getByText('Nothing here.')).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('keeps the table on a large screen even when cards are offered', () => {
    render(<Harness renderCard={card} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByLabelText('Sort by')).not.toBeInTheDocument();
  });

  it('keeps the paging bar compact: rows per page is for large screens only', () => {
    restore = mockMobile();
    render(<Harness renderCard={card} />);

    expect(screen.getByLabelText('Rows per page').parentElement).toHaveClass('hidden', 'md:flex');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });
});
