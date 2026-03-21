/**
 * Lookbook section — modal open/close and per-product variant handling.
 *
 * Custom elements defined here:
 *   <lookbook-modal>        — wraps the <dialog> and the open trigger button
 *   <lookbook-product-item> — handles variant selection and price updates for
 *                             one product row inside the modal
 */

/* ============================================================
   LookbookModal
   ============================================================ */

if (!customElements.get('lookbook-modal')) {
  customElements.define(
    'lookbook-modal',
    class LookbookModal extends HTMLElement {
      connectedCallback() {
        this.dialog = this.querySelector('dialog');
        this.closeBtn = this.querySelector('.lookbook-modal__close');
        this.openBtn = document.getElementById(`LookbookOpen-${this.dataset.sectionId}`);

        this.openBtn?.addEventListener('click', () => this.open());
        this.closeBtn?.addEventListener('click', () => this.close());

        // Close when clicking the backdrop (the dialog element itself)
        this.dialog.addEventListener('click', (event) => {
          if (event.target === this.dialog) this.close();
        });

        // Sync body scroll lock when dialog is closed via Escape key
        this.dialog.addEventListener('close', () => {
          document.body.classList.remove('overflow-hidden');
          if (this._returnFocusEl) {
            this._returnFocusEl.focus();
            this._returnFocusEl = null;
          }
        });

        if (this.dataset.closeOnAdd === 'true') {
          this._unsubscribeCart = subscribe(PUB_SUB_EVENTS.cartUpdate, () => {
            if (this.dialog.open) this.close();
          });
        }
      }

      disconnectedCallback() {
        this._unsubscribeCart?.();
      }

      open() {
        this._returnFocusEl = this.openBtn;
        this.dialog.showModal();
        document.body.classList.add('overflow-hidden');

        // Move initial focus to the close button for keyboard/screen-reader users
        const firstFocusable = this.dialog.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (firstFocusable) firstFocusable.focus();
      }

      close() {
        this.dialog.close();
        // 'close' event listener above handles body class and focus restoration
      }
    }
  );
}

/* ============================================================
   LookbookProductItem
   Handles variant switching + price/button state updates for
   a single product row inside the lookbook modal.
   ============================================================ */

if (!customElements.get('lookbook-product-item')) {
  customElements.define(
    'lookbook-product-item',
    class LookbookProductItem extends HTMLElement {
      connectedCallback() {
        this.variantData = JSON.parse(
          this.querySelector('script[type="application/json"]').textContent
        );
        this.selects = this.querySelectorAll('.lookbook-variant-select');
        this.variantIdInput = this.querySelector('.product-variant-id');
        this.submitButton = this.querySelector('[type="submit"]');
        this.submitButtonText = this.submitButton?.querySelector('span');

        this.selects.forEach((select) => {
          select.addEventListener('change', this.onVariantChange.bind(this));
        });
      }

      /** Called whenever any option <select> changes. */
      onVariantChange() {
        const selectedOptions = Array.from(this.selects).map((s) => s.value);
        const variant = this.findVariant(selectedOptions);
        if (!variant) return;

        this.updateVariantInput(variant);
        this.updatePrice(variant);
        this.updateButton(variant);
      }

      /**
       * Find a variant whose options array exactly matches selectedOptions.
       * @param {string[]} selectedOptions
       * @returns {Object|undefined}
       */
      findVariant(selectedOptions) {
        return this.variantData.find((v) =>
          v.options.every((opt, i) => opt === selectedOptions[i])
        );
      }

      /** Update the hidden <input name="id"> used by product-form. */
      updateVariantInput(variant) {
        if (!this.variantIdInput) return;
        this.variantIdInput.value = variant.id;
        this.variantIdInput.disabled = !variant.available;
      }

      /**
       * Re-render the price elements to match the newly selected variant.
       * Works with the HTML structure produced by the Dawn 'price' snippet.
       */
      updatePrice(variant) {
        const modal = this.closest('lookbook-modal');
        const moneyFormat = modal?.dataset.moneyFormat || '${{amount}}';

        const priceWrapper = this.querySelector('.price');
        if (!priceWrapper) return;

        const isOnSale =
          variant.compare_at_price && variant.compare_at_price > variant.price;

        priceWrapper.classList.toggle('price--on-sale', isOnSale);
        priceWrapper.classList.toggle(
          'price--sold-out',
          !variant.available && !isOnSale
        );

        // Regular price element (shown when NOT on sale)
        const regularPriceEl = priceWrapper.querySelector(
          '.price__regular .price-item--regular'
        );
        if (regularPriceEl) {
          regularPriceEl.innerHTML = Shopify.formatMoney(variant.price, moneyFormat);
        }

        if (isOnSale) {
          // Strikethrough compare-at price
          const compareEl = priceWrapper.querySelector(
            '.price__sale .price-item--regular'
          );
          if (compareEl) {
            compareEl.innerHTML = Shopify.formatMoney(
              variant.compare_at_price,
              moneyFormat
            );
          }
          // Sale price
          const salePriceEl = priceWrapper.querySelector('.price-item--sale');
          if (salePriceEl) {
            salePriceEl.innerHTML = Shopify.formatMoney(variant.price, moneyFormat);
          }
        }
      }

      /** Enable/disable and re-label the Add to cart button. */
      updateButton(variant) {
        if (!this.submitButton || !this.submitButtonText) return;

        const modal = this.closest('lookbook-modal');
        const addToCartText =
          modal?.dataset.addToCart ||
          window.variantStrings?.addToCart ||
          'Add to cart';
        const soldOutText =
          modal?.dataset.soldOut ||
          window.variantStrings?.soldOut ||
          'Sold out';

        if (variant.available) {
          this.submitButton.removeAttribute('disabled');
          this.submitButtonText.textContent = addToCartText;
        } else {
          this.submitButton.setAttribute('disabled', '');
          this.submitButtonText.textContent = soldOutText;
        }
      }
    }
  );
}
