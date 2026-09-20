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
  const paperWidth = options.paperWidth || '80mm';
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
      /* Exact height is injected immediately before print. Avoid auto height because some Android ESC/POS services can treat it as unbounded and keep feeding paper. */
      size: ${paperWidth} 200mm;
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
 * Triggers thermal printing using the Android/VeSure print service when available.
 * Falls back to window.print() if iframe printing is blocked.
 */
export function printThermalOrder(
  order: Order,
  options: ThermalPrintOptions = {}
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const html = generateThermalReceiptHtml(order, {
        ...options,
        paperWidth: '80mm',
      });

      // Print the receipt as a real standalone HTML document. The previous
      // implementation injected a complete <html> document inside a <div>,
      // which can make Android PrintService paginate/feed blank paper.
      let frame = document.getElementById('thermal-print-frame') as HTMLIFrameElement | null;
      if (!frame) {
        frame = document.createElement('iframe');
        frame.id = 'thermal-print-frame';
        frame.style.position = 'fixed';
        frame.style.left = '-10000px';
        frame.style.top = '0';
        frame.style.width = '80mm';
        frame.style.height = '1px';
        frame.style.border = '0';
        frame.setAttribute('aria-hidden', 'true');
        document.body.appendChild(frame);
      }

      const doc = frame.contentDocument;
      if (!doc) throw new Error('Cannot access print document');

      doc.open();
      doc.write(html);
      doc.close();

      const receipt = doc.querySelector('.receipt') as HTMLElement | null;
      if (receipt) {
        receipt.style.width = '72mm';
        receipt.style.maxWidth = '72mm';
        receipt.style.margin = '0 auto';
        receipt.style.padding = '1mm 0 0';
        receipt.style.boxSizing = 'border-box';
      }

      setTimeout(() => {
        try {
          if (!receipt) throw new Error('Receipt element not found');

          // Measure the actual rendered receipt and give the print job a finite
          // page height. This prevents Android/ESC-POS services from treating
          // an "auto" roll height as an unbounded document.
          const heightPx = Math.ceil(receipt.getBoundingClientRect().height);
          const heightMm = Math.max(45, Math.ceil((heightPx * 25.4) / 96) + 1);

          let pageStyle = doc.getElementById('thermal-page-size');
          if (!pageStyle) {
            pageStyle = doc.createElement('style');
            pageStyle.id = 'thermal-page-size';
            doc.head.appendChild(pageStyle);
          }
          pageStyle.textContent = '@page { margin: 0; size: 80mm ' + heightMm + 'mm; } html, body { width: 80mm; height: ' + heightMm + 'mm; overflow: hidden; margin: 0 !important; padding: 0 !important; }';

          frame!.style.height = heightPx + 'px';

          // Let the print service see the final finite page dimensions.
          requestAnimationFrame(() => {
            try {
              frame?.contentWindow?.focus();
              frame?.contentWindow?.print();
              resolve(true);
            } catch (err) {
              console.error('Thermal print failed:', err);
              resolve(false);
            }
          });
        } catch (err) {
          console.error('Thermal print preparation failed:', err);
          resolve(false);
        }
      }, 500);
    } catch (err) {
      console.error('Thermal print error:', err);
      resolve(false);
    }
  });
}
