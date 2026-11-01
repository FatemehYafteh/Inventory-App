# UI backlog

Do one item at a time, each on its own branch and PR into `main`.

1. Two-column login page with a product introduction: on one side the product name, one sentence about what it does and a few key features (real-time stock, Telegram sign-in, Persian and English); on the other side the form.
2. Logo and favicon, and translate the hard-coded "Inventory" name in the sidebar and mobile bar for Persian mode.
3. Link preview for LinkedIn and Telegram: add og:title, og:description and og:image to index.html.
4. Dashboard summary cards: add icons and warning/danger colours for Low stock and Out of stock, fix the six cramped columns at xl width, and fix the inventory-value figure that is wider than its card at 1280px.
5. The empty "Archived" column in the admin Products table.
6. A global loading indicator: a thin bar at the top of the page that shows only when a request takes longer than about 300 ms (useIsFetching + useIsMutating), plus a "server is starting" message for slow requests.
