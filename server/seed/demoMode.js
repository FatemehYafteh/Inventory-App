// The demo data reset deletes every product, stock movement, category and supplier. It runs only
// when DEMO_MODE=true is set on purpose, so starting the workflow or the script by mistake cannot
// wipe a database that holds real data. Set it only where the data is demo data.

/** The reason the reset must not run, or null when DEMO_MODE is exactly `true`. */
export function demoModeRefusal(env = process.env) {
  if (env.DEMO_MODE?.trim() === 'true') return null;
  return (
    'Refusing to reset demo data: DEMO_MODE is not "true". ' +
    'The reset deletes every product, stock movement, category and supplier. ' +
    'Set DEMO_MODE=true only where the database holds demo data.'
  );
}
