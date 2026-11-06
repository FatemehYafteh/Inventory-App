import { screen } from '@testing-library/react';

/** Opens a row's "⋯" menu by its trigger label, e.g. "More actions for Claw Hammer". */
export async function openRowMenu(user, trigger) {
  await user.click(await screen.findByRole('button', { name: trigger }));
}

/** Opens a row's "⋯" menu and picks one item from it. */
export async function chooseRowAction(user, trigger, item) {
  await openRowMenu(user, trigger);
  await user.click(await screen.findByRole('menuitem', { name: item }));
}
