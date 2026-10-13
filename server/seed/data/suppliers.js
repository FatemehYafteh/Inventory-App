// "Old Mill Paper Co." is inactive but still referenced by products (it stays on them).
// "Northwind Freight" has no products, so it can be deleted.
export const suppliers = [
  {
    name: 'Acme Electronics',
    contactPerson: 'Dana Whitfield',
    phone: '+1 555 0100',
    email: 'orders@acme-electronics.example',
    address: '120 Circuit Ave, San Jose, CA',
    notes: 'Net 30. Ships Monday to Thursday.',
  },
  {
    name: 'Paperline Office',
    contactPerson: 'Marco Bianchi',
    phone: '+1 555 0111',
    email: 'sales@paperline.example',
    address: '45 Quill St, Portland, OR',
  },
  {
    name: 'Sturdy Furniture Ltd',
    contactPerson: 'Priya Nair',
    phone: '+44 20 7946 0123',
    email: 'trade@sturdyfurniture.example',
    address: '9 Oak Lane, Leeds, UK',
    notes: 'Lead time 2 to 3 weeks.',
  },
  {
    name: 'CleanCo Supplies',
    contactPerson: 'Joe Martinez',
    phone: '+1 555 0144',
    email: 'joe@cleanco.example',
  },
  {
    name: 'BoxRight Packaging',
    contactPerson: 'Aiko Tanaka',
    phone: '+1 555 0155',
    email: 'hello@boxright.example',
    address: '300 Carton Blvd, Reno, NV',
  },
  {
    name: 'SafeGuard PPE',
    contactPerson: 'Liam O’Connor',
    phone: '+353 1 555 0166',
    email: 'orders@safeguard.example',
  },
  {
    name: 'Old Mill Paper Co.',
    contactPerson: 'Edith Grant',
    phone: '+1 555 0177',
    notes: 'Stopped trading with us. Kept for history.',
    isActive: false,
  },
  {
    name: 'Northwind Freight',
    contactPerson: 'Omar Haddad',
    email: 'dispatch@northwind.example',
  },
];
