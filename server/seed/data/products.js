// Each product's stock comes only from its movement history, replayed in order, so
// quantity, quantityBefore/After and the movement log always agree (PRD section 7).
//
// History steps: 'receive N', 'ship N', 'adjust N' (set absolute quantity), 'inc', 'dec'.
// The first step is the initial stock ('receive N' noted "Initial stock").
//
// The mix covers every stock status (in / low / out), archived products, a product with
// no supplier, and products from an inactive supplier.

const p = (sku, title, category, supplier, price, reorderLevel, history, extra = {}) => ({
  sku,
  title,
  category,
  supplier,
  price,
  reorderLevel,
  history,
  ...extra,
});

// prettier-ignore
export const products = [
  // Electronics
  p('EL-LAP-001', 'Laptop 14" i5 16GB', 'Electronics', 'Acme Electronics', 899.0, 5,
    ['receive 20', 'ship 4', 'ship 3', 'receive 10', 'ship 6', 'dec']),
  p('EL-MON-024', '24" IPS Monitor', 'Electronics', 'Acme Electronics', 179.99, 8,
    ['receive 30', 'ship 12', 'ship 9', 'inc', 'ship 4']),
  p('EL-KBD-010', 'Wireless Keyboard', 'Electronics', 'Acme Electronics', 39.5, 15,
    ['receive 60', 'ship 20', 'ship 25', 'adjust 12']),
  p('EL-MSE-011', 'Wireless Mouse', 'Electronics', 'Acme Electronics', 24.99, 15,
    ['receive 80', 'ship 30', 'ship 18', 'inc', 'inc']),
  p('EL-CAB-HDMI', 'HDMI Cable 2m', 'Electronics', 'Acme Electronics', 7.25, 25,
    ['receive 100', 'ship 60', 'ship 40']),
  p('EL-USB-C65', 'USB-C Charger 65W', 'Electronics', 'Acme Electronics', 34.0, 10,
    ['receive 40', 'ship 15', 'receive 20', 'ship 10']),
  p('EL-HDS-200', 'Noise-Cancelling Headset', 'Electronics', null, 129.0, 4,
    ['receive 10', 'ship 3', 'ship 4']),

  // Office Supplies
  p('OF-PAP-A4', 'A4 Copy Paper (500 sheets)', 'Office Supplies', 'Paperline Office', 5.49, 50,
    ['receive 400', 'ship 120', 'ship 90', 'receive 200', 'ship 150']),
  p('OF-PEN-BLK', 'Ballpoint Pens, Black (12 pack)', 'Office Supplies', 'Paperline Office', 3.99, 20,
    ['receive 150', 'ship 40', 'ship 35', 'dec', 'dec']),
  p('OF-STP-STD', 'Desktop Stapler', 'Office Supplies', 'Paperline Office', 11.75, 10,
    ['receive 25', 'ship 9', 'ship 8']),
  p('OF-NTB-A5', 'A5 Notebook, Ruled', 'Office Supplies', 'Old Mill Paper Co.', 2.8, 30,
    ['receive 120', 'ship 50', 'ship 40', 'adjust 22']),
  p('OF-FLD-MAN', 'Manila Folders (100 pack)', 'Office Supplies', 'Old Mill Paper Co.', 14.2, 5,
    ['receive 30', 'ship 10', 'ship 20']),
  p('OF-ENV-C5', 'C5 Envelopes (500 pack)', 'Office Supplies', 'Paperline Office', 22.0, 6,
    ['receive 18', 'ship 4', 'inc']),

  // Furniture
  p('FU-CHR-ERG', 'Ergonomic Office Chair', 'Furniture', 'Sturdy Furniture Ltd', 249.0, 3,
    ['receive 12', 'ship 5', 'ship 4']),
  p('FU-DSK-140', 'Desk 140x70cm', 'Furniture', 'Sturdy Furniture Ltd', 319.0, 2,
    ['receive 8', 'ship 2', 'receive 4', 'ship 3']),
  p('FU-CAB-3D', '3-Drawer Filing Cabinet', 'Furniture', 'Sturdy Furniture Ltd', 159.0, 2,
    ['receive 6', 'ship 6']),
  p('FU-SHF-180', 'Steel Shelving Unit 180cm', 'Furniture', 'Sturdy Furniture Ltd', 89.9, 4,
    ['receive 15', 'ship 3', 'adjust 10']),

  // Cleaning
  p('CL-SPR-MP', 'Multi-Purpose Spray 750ml', 'Cleaning', 'CleanCo Supplies', 3.6, 24,
    ['receive 120', 'ship 48', 'ship 36', 'receive 60', 'ship 50']),
  p('CL-GLV-NIT', 'Nitrile Gloves, Box of 100', 'Cleaning', 'CleanCo Supplies', 8.9, 20,
    ['receive 60', 'ship 25', 'ship 20']),
  p('CL-BAG-60L', 'Bin Bags 60L (50 roll)', 'Cleaning', 'CleanCo Supplies', 6.3, 15,
    ['receive 40', 'ship 25', 'ship 15']),
  p('CL-MOP-KIT', 'Mop and Bucket Kit', 'Cleaning', null, 27.5, 2,
    ['receive 6', 'ship 1']),

  // Packaging
  p('PK-BOX-S', 'Shipping Box Small 20x15x10', 'Packaging', 'BoxRight Packaging', 0.65, 200,
    ['receive 1000', 'ship 300', 'ship 250', 'ship 280']),
  p('PK-BOX-L', 'Shipping Box Large 50x40x30', 'Packaging', 'BoxRight Packaging', 1.9, 100,
    ['receive 500', 'ship 150', 'ship 120', 'receive 200', 'ship 100']),
  p('PK-TAP-48', 'Packing Tape 48mm x 66m', 'Packaging', 'BoxRight Packaging', 2.15, 40,
    ['receive 200', 'ship 70', 'ship 65', 'dec', 'dec', 'dec']),
  p('PK-BUB-ROLL', 'Bubble Wrap Roll 50m', 'Packaging', 'BoxRight Packaging', 18.0, 5,
    ['receive 20', 'ship 8', 'ship 12']),

  // Safety Equipment
  p('SF-HLM-WHT', 'Safety Helmet, White', 'Safety Equipment', 'SafeGuard PPE', 12.5, 10,
    ['receive 50', 'ship 15', 'ship 10']),
  p('SF-VST-HV', 'Hi-Vis Vest, Large', 'Safety Equipment', 'SafeGuard PPE', 6.75, 15,
    ['receive 60', 'ship 20', 'ship 28']),
  p('SF-FAK-STD', 'First Aid Kit, Workplace', 'Safety Equipment', 'SafeGuard PPE', 45.0, 3,
    ['receive 10', 'ship 2', 'adjust 7']),

  // Archived (hidden by default; only admins can show and restore them)
  p('EL-VGA-OLD', 'VGA Cable 1.5m (discontinued)', 'Electronics', 'Acme Electronics', 4.0, 0,
    ['receive 30', 'ship 18', 'adjust 0'], { isArchived: true }),
  p('OF-FAX-RLL', 'Fax Paper Roll (discontinued)', 'Office Supplies', 'Old Mill Paper Co.', 3.1, 0,
    ['receive 40', 'ship 12'], { isArchived: true }),
];
