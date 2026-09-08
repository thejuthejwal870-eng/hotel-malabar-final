import { Order } from '../types';

export interface ThermalPrintOptions {
  type?: 'KOT' | 'BILL';
  paperWidth?: '58mm' | '80mm';
  restaurantName?: string;
  phones?: string[];
  address?: string;
}

export function generateThermalReceiptHtml(order: Order, options: ThermalPrintOptions = {}): string {
  const type = options.type || 'KOT';
  const paperWidth = options.paperWidth || '58mm';
  const restaurantName = options.restaurantName || 'HOTEL MALABAR';
  const phones = options.phones || ['9567562071', '8904634717'];
  const address = options.address || 'Authentic Kerala Cuisine, Main Road, Sulthan Bathery, Wayanad';

  const isWide = paperWidth === '80mm';
  const contentWidth = isWide ? '72mm' : '48mm';
  const fontSize = isWide ? '12px' : '10px';

  const orderDate = new Date(order.createdAt || Date.now());
  const formattedDate = orderDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = orderDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const mapsLink =
    order.googleMapsUrl ||
    (order.customerLatitude && order.customerLongitude
      ? `https://www.google.com/maps?q=${order.customerLatitude},${order.customerLongitude}`
      : '');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${type} - ${order.orderNumber}</title>
  <style>
    @page {
      margin: 0;
      size: ${paperWidth} auto;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: 'Courier New', Courier, monospace, monospace;
      font-size: ${fontSize};
      line-height: 1.25;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt {
      width: ${contentWidth};
      max-width: 100%;
      margin: 0 auto;
      padding: 2mm 1mm;
      box-sizing: border-box;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .title {
      font-size: ${isWide ? '16px' : '13px'};
      font-weight: 900;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .subtitle {
      font-size: ${isWide ? '11px' : '9px'};
      margin-bottom: 3px;
    }
    .divider {
      border-top: 1px dashed #000000;
      margin: 4px 0;
    }
    .divider-double {
      border-top: 2px solid #000000;
      margin: 4px 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin: 1.5px 0;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin: 3px 0;
    }
    .item-name {
      flex: 1;
      padding-right: 4px;
      word-break: break-word;
    }
    .item-qty {
      font-weight: bold;
      width: 28px;
    }
    .item-price {
      text-align: right;
      white-space: nowrap;
      font-weight: bold;
    }
    .badge {
      display: inline-block;
      border: 1px solid #000;
      padding: 1px 4px;
      font-weight: bold;
      margin-top: 2px;
    }
    .special-note {
      background: #eee;
      border: 1px dashed #000;
      padding: 3px;
      margin: 4px 0;
      font-weight: bold;
      font-size: ${isWide ? '11px' : '9.5px'};
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      margin: 2px 0;
    }
    .grand-total {
      font-size: ${isWide ? '14px' : '12px'};
      font-weight: 900;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      padding: 3px 0;
      margin: 3px 0;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="text-center">
      <div class="title">${restaurantName}</div>
      <div class="subtitle">AUTHENTIC KERALA CUISINE</div>
      <div class="subtitle">${address}</div>
      <div class="subtitle">Ph: ${phones.join(' / ')}</div>
      <div class="badge">*** ${type === 'KOT' ? 'KITCHEN ORDER TICKET (KOT)' : 'CUSTOMER BILL / INVOICE'} ***</div>
    </div>

    <div class="divider"></div>

    <div class="row">
      <span class="bold">ORDER NO:</span>
      <span class="bold" style="font-size: ${isWide ? '13px' : '11px'};">${order.orderNumber}</span>
    </div>
    <div class="row">
      <span>DATE: ${formattedDate}</span>
      <span>TIME: ${formattedTime}</span>
    </div>
    <div class="row">
      <span>STATUS:</span>
      <span class="bold">${order.status.toUpperCase()}</span>
    </div>
    ${
      order.estimatedPrepTimeMinutes || order.preparationMinutes
        ? `<div class="row">
            <span>PREP TIME:</span>
            <span class="bold">${order.preparationMinutes || order.estimatedPrepTimeMinutes} MINS</span>
          </div>`
        : ''
    }

    <div class="divider"></div>

    <div>
      <div><span class="bold">CUSTOMER:</span> ${order.customerName}</div>
      <div><span class="bold">PHONE:</span> ${order.customerPhone}</div>
      <div><span class="bold">DELIVERY AREA:</span> ${order.deliveryArea} (${order.deliveryDistanceKm} km)</div>
      <div style="margin-top: 2px;"><span class="bold">ADDRESS:</span> ${order.deliveryAddress}</div>
      ${
        order.customerLatitude && order.customerLongitude
          ? `<div style="margin-top: 2px; font-size: ${isWide ? '10px' : '8.5px'};">
              <span class="bold">GPS:</span> ${order.customerLatitude.toFixed(5)}, ${order.customerLongitude.toFixed(5)}
              ${mapsLink ? `<br /><span class="bold">MAPS:</span> ${mapsLink}` : ''}
            </div>`
          : ''
      }
    </div>

    <div class="special-note">
      <div class="bold">SPECIAL INSTRUCTIONS:</div>
      <div>${
        order.specialInstructions && order.specialInstructions.trim()
          ? order.specialInstructions.trim()
          : 'No special instructions'
      }</div>
    </div>

    <div class="divider-double"></div>

    <div class="row bold" style="border-bottom: 1px dashed #000; padding-bottom: 2px; margin-bottom: 4px;">
      <span>QTY ITEM</span>
      <span>PRICE</span>
    </div>

    ${order.items
      .map(
        (item) => `
      <div class="item-row">
        <span class="item-qty">${item.quantity}x</span>
        <span class="item-name">${item.itemName}</span>
        <span class="item-price">Rs.${item.subtotal}</span>
      </div>
    `
      )
      .join('')}

    <div class="divider"></div>

    <div class="totals-row">
      <span>FOOD TOTAL:</span>
      <span>Rs.${order.foodTotal}</span>
    </div>
    <div class="totals-row">
      <span>DELIVERY CHARGE:</span>
      <span>Rs.${order.deliveryCharge}</span>
    </div>
    <div class="row grand-total">
      <span>GRAND TOTAL:</span>
      <span>Rs.${order.grandTotal}</span>
    </div>

    <div class="divider"></div>

    <div class="text-center bold" style="margin-top: 4px;">
      <div>PAYMENT: CASH ON DELIVERY (COD)</div>
      <div style="font-size: ${isWide ? '11px' : '9px'}; margin-top: 2px;">
        ${type === 'KOT' ? '*** PREPARE FRESH & DELIVER QUICKLY ***' : '*** THANK YOU FOR ORDERING WITH HOTEL MALABAR ***'}
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Triggers thermal printing by writing to an isolated iframe.
 * Falls back to window.print() if iframe printing is blocked.
 */
export function printThermalOrder(
  order: Order,
  options: ThermalPrintOptions = {}
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const html = generateThermalReceiptHtml(order, options);

      // Create isolated invisible iframe
      let iframe = document.getElementById('thermal-print-frame') as HTMLIFrameElement | null;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'thermal-print-frame';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.opacity = '0';
        iframe.style.zIndex = '-9999';
        document.body.appendChild(iframe);
      }

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!doc) {
        throw new Error('Cannot access iframe document');
      }

      doc.open();
      doc.write(html);
      doc.close();

      // Give browser time to lay out CSS before opening print dialog
      setTimeout(() => {
        try {
          iframe?.contentWindow?.focus();
          iframe?.contentWindow?.print();
          resolve(true);
        } catch (printErr) {
          console.warn('Iframe print failed, falling back to window.print():', printErr);
          // Fallback: put in DOM print container and call window.print
          fallbackDomPrint(order, options);
          resolve(true);
        }
      }, 250);
    } catch (err) {
      console.error('Thermal print error, attempting fallback:', err);
      fallbackDomPrint(order, options);
      resolve(false);
    }
  });
}

function fallbackDomPrint(order: Order, options: ThermalPrintOptions) {
  let container = document.getElementById('thermal-print-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'thermal-print-container';
    document.body.appendChild(container);
  }
  container.innerHTML = generateThermalReceiptHtml(order, options);
  window.print();
}
