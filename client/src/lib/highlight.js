/**
 * Hover and keyboard-focus highlight for a list item: the accent fill with a blue inset edge.
 * inset-ring is a shadow, so the item never shifts. The negative margin keeps the text aligned
 * with the rest of the card while the padding keeps the edge off the text.
 */
export const LIST_ITEM_HIGHLIGHT =
  '-mx-2 rounded-md px-2 transition-[background-color,box-shadow] duration-200 hover:bg-accent hover:inset-ring hover:inset-ring-primary/40 focus-within:bg-accent focus-within:inset-ring focus-within:inset-ring-primary/40';
