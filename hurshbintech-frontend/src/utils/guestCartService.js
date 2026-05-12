/**
 * Guest Cart Service - Manage shopping cart for unauthenticated users using localStorage
 * Mirrors the interface of cartService for seamless guest/registered user experience
 */

const GUEST_CART_KEY = 'guestCart';

const guestCartService = {
    /**
     * Initialize guest cart in localStorage if it doesn't exist
     * @returns {Object} - Cart object
     */
    initializeCart: () => {
        let cart = guestCartService.getCart();
        if (!cart) {
            cart = {
                items: [],
                subtotal: 0,
                discount_total: 0,
                total: 0
            };
            localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
        }
        return cart;
    },

    /**
     * Get guest cart from localStorage
     * @returns {Object|null} - Cart object or null if not exists
     */
    getCart: () => {
        try {
            const cartData = localStorage.getItem(GUEST_CART_KEY);
            return cartData ? JSON.parse(cartData) : null;
        } catch (error) {
            console.error('Error getting guest cart:', error);
            return null;
        }
    },

    /**
     * Add item to guest cart
     * @param {Object} itemData - { product_id, quantity, product }
     * @returns {Promise<Object>} - Updated cart
     */
    addToCart: async (itemData) => {
        try {
            let cart = guestCartService.getCart();
            if (!cart) {
                cart = guestCartService.initializeCart();
            }

            const { product_id, quantity, product } = itemData;

            // Check if product already in cart
            const existingItem = cart.items.find(item => item.product_id === product_id);

            if (existingItem) {
                existingItem.quantity += quantity;
            } else {
                cart.items.push({
                    id: `guest_${product_id}`, // Generate unique id for guest items
                    product_id,
                    quantity,
                    product // Store product details for display
                });
            }

            // Recalculate totals
            guestCartService._calculateTotals(cart);

            // Save to localStorage
            localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));

            return Promise.resolve(cart);
        } catch (error) {
            console.error('Error adding to guest cart:', error);
            return Promise.reject(error);
        }
    },

    /**
     * Remove item from guest cart
     * @param {string} productId - Product ID to remove
     * @returns {Promise<Object>} - Updated cart
     */
    removeFromCart: async (productId) => {
        try {
            let cart = guestCartService.getCart();
            if (!cart) return Promise.reject(new Error('Cart not found'));

            cart.items = cart.items.filter(item => item.product_id !== productId);

            guestCartService._calculateTotals(cart);
            localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));

            return Promise.resolve(cart);
        } catch (error) {
            console.error('Error removing from guest cart:', error);
            return Promise.reject(error);
        }
    },

    /**
     * Update cart item quantity
     * @param {string} productId - Product ID to update
     * @param {number} quantity - New quantity
     * @returns {Promise<Object>} - Updated cart
     */
    updateCartItem: async (productId, quantity) => {
        try {
            let cart = guestCartService.getCart();
            if (!cart) return Promise.reject(new Error('Cart not found'));

            const item = cart.items.find(item => item.product_id === productId);
            if (!item) return Promise.reject(new Error('Item not found in cart'));

            if (quantity <= 0) {
                cart.items = cart.items.filter(item => item.product_id !== productId);
            } else {
                item.quantity = quantity;
            }

            guestCartService._calculateTotals(cart);
            localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));

            return Promise.resolve(cart);
        } catch (error) {
            console.error('Error updating guest cart item:', error);
            return Promise.reject(error);
        }
    },

    /**
     * Clear entire guest cart
     * @returns {Promise<Object>} - Empty cart
     */
    clearCart: async () => {
        try {
            const emptyCart = {
                items: [],
                subtotal: 0,
                discount_total: 0,
                total: 0
            };
            localStorage.setItem(GUEST_CART_KEY, JSON.stringify(emptyCart));
            return Promise.resolve(emptyCart);
        } catch (error) {
            console.error('Error clearing guest cart:', error);
            return Promise.reject(error);
        }
    },

    /**
     * Delete guest cart from localStorage (complete removal)
     */
    deleteCart: () => {
        try {
            localStorage.removeItem(GUEST_CART_KEY);
        } catch (error) {
            console.error('Error deleting guest cart:', error);
        }
    },

    /**
     * Calculate cart totals based on items
     * @private
     */
    _calculateTotals: (cart) => {
        let subtotal = 0;
        let discount_total = 0;

        cart.items.forEach(item => {
            if (item.product) {
                const itemPrice = item.product.price || 0;
                const itemDiscount = item.product.discount || 0;

                subtotal += itemPrice * item.quantity;
                discount_total += itemDiscount * item.quantity;
            }
        });

        cart.subtotal = parseFloat(subtotal.toFixed(2));
        cart.discount_total = parseFloat(discount_total.toFixed(2));
        cart.total = parseFloat((subtotal - discount_total).toFixed(2));
    }
};

export default guestCartService;
