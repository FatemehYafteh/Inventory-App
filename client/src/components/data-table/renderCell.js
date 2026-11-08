/**
 * The content of one column's cell for `original`, so a card can reuse a table's cells instead of
 * repeating them. Cells only read `row.original`, so a stand-in row is enough.
 */
export function renderCell(columns, id, original) {
  const column = columns.find((item) => (item.id ?? item.accessorKey) === id);
  return column ? column.cell({ row: { original } }) : null;
}
